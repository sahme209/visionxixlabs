import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET, POST } from "../route";

const ports = vi.hoisted(() => ({session: vi.fn(), register: vi.fn(), activate: vi.fn(), status: vi.fn(), revoke: vi.fn()}));
vi.mock("@/lib/auth/currentContext", () => ({currentContext: ports.session}));
vi.mock("@/lib/db", () => ({prisma: {}}));
vi.mock("@/lib/releaseops/gitlabPendingRegistration", () => ({
  registerPendingGitLabReadConnection: ports.register, readGitLabSetupState: ports.status, revokeGitLabReadConnection: ports.revoke,
}));
vi.mock("@/lib/releaseops/gitlabReadActivation", () => ({activateGitLabReadConnection: ports.activate}));

const origin = "https://workspace.test";
const registration = {action: "register", repositoryId: "repo", projectId: "42", projectToken: "fixture-project", expiresAt: 4_000_000_000_000};

function post(body: unknown, from = origin) {
  return new NextRequest(origin + "/api/dashboard/gitlab-connection", {
    method: "POST", body: JSON.stringify(body), headers: {origin: from, "content-type": "application/json"},
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("GITLAB_WORKSPACE_SETUP_ENABLED", "true");
  ports.session.mockResolvedValue({isAuthenticated: true, organizationId: "workspace", sessionUserId: "owner", roles: ["owner"]});
});
afterEach(() => vi.unstubAllEnvs());

it("keeps setup disabled by default without looking up a session", async () => {
  vi.stubEnv("GITLAB_WORKSPACE_SETUP_ENABLED", undefined);
  expect((await POST(post(registration))).status).toBe(404);
  expect(ports.session).not.toHaveBeenCalled();
});

it("rejects a foreign origin, fallback identity and a non-manager", async () => {
  expect((await POST(post(registration, "https://foreign.test"))).status).toBe(403);
  ports.session.mockResolvedValueOnce({isAuthenticated: true, organizationId: "workspace", userId: "fallback", roles: ["owner"]});
  expect((await POST(post(registration))).status).toBe(401);
  ports.session.mockResolvedValueOnce({isAuthenticated: true, organizationId: "workspace", sessionUserId: "operator", roles: ["operator"]});
  expect((await POST(post(registration))).status).toBe(403);
  expect(ports.register).not.toHaveBeenCalled();
});

it("rejects oversized requests and client-supplied workspace authority", async () => {
  expect((await POST(post({...registration, projectToken: "x".repeat(8_200)}))).status).toBe(400);
  expect((await POST(post({...registration, organizationId: "other"}))).status).toBe(400);
  expect(ports.register).not.toHaveBeenCalled();
});

it("uses the verified workspace and returns only pending metadata", async () => {
  const revision = new Date("2027-01-01T00:00:00Z");
  ports.register.mockResolvedValueOnce({connectionId: "connection", revision, unexpectedSecret: "ignored"});
  const response = await POST(post(registration));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  await expect(response.json()).resolves.toEqual({status: "pending", connectionId: "connection", revision: revision.toISOString()});
  expect(ports.register).toHaveBeenCalledWith({}, expect.objectContaining({organizationId: "workspace", userId: "owner"}));
});

it("returns a fixed uncertain response and supports reloading the scoped status", async () => {
  const revision = "2027-01-01T00:00:00.000Z";
  ports.activate.mockRejectedValueOnce(new Error("gitlab_read_activation_unconfirmed"));
  const result = await POST(post({action: "validate", repositoryId: "repo", connectionId: "connection", revision, verifierToken: "fixture-review"}));
  expect(result.status).toBe(409);
  await expect(result.json()).resolves.toEqual({error: "gitlab_setup_unconfirmed"});
  const expected = {status: "awaiting_validation", connectionId: "connection", revision, validatedAt: null};
  ports.status.mockResolvedValueOnce(expected);
  const response = await GET(new NextRequest(origin + "/api/dashboard/gitlab-connection?repositoryId=repo"));
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual(expected);
  expect(ports.status).toHaveBeenCalledWith({}, {repositoryId: "repo", organizationId: "workspace", userId: "owner"}, expect.any(AbortSignal));
});

it("routes revalidation and revocation with the exact authenticated revision", async () => {
  const revision = "2027-01-01T00:00:00.000Z";
  const common = {repositoryId: "repo", connectionId: "connection", revision};
  ports.activate.mockResolvedValueOnce({connectionId: "connection", projectId: "42", validatedAt: new Date(revision)});
  expect((await POST(post({action: "revalidate", ...common, verifierToken: "fixture-review"}))).status).toBe(200);
  expect(ports.activate).toHaveBeenCalledWith({}, expect.objectContaining({mode: "revalidate", revision: new Date(revision), userId: "owner"}));
  ports.revoke.mockResolvedValueOnce({connectionId: "connection", revision: new Date(revision)});
  const result = await POST(post({action: "revoke", ...common}));
  await expect(result.json()).resolves.toEqual({status: "revoked", connectionId: "connection", revision});
  expect(ports.revoke).toHaveBeenCalledWith({}, expect.objectContaining({revision: new Date(revision), userId: "owner"}));
  expect((await POST(post({action: "revoke", ...common, verifierToken: "unexpected"}))).status).toBe(400);
});
