import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const io = vi.hoisted(() => ({
  session: vi.fn(),
  request: vi.fn(),
  installation: vi.fn(),
  token: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: {gitHubInstallation: {findFirst: io.installation}} }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: io.session }));
vi.mock("@/lib/tauri/deploymentRequestRepo", () => ({ getDeploymentRequest: io.request }));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: io.audit }));
vi.mock("@/lib/connectors/github/githubAppAuth", () => ({ resolveGithubInstallationToken: io.token }));
vi.mock("@/lib/tauri/deploymentIntakeSchema", () => ({
  parseDeploymentIntake: () => ({ok: true, intake: {
    repositoryUrls: ["https://github.com/fixture/payments"],
    targetBranch: "main", sourceBranch: "release", productionPrUrls: [],
  }}),
}));

import { POST } from "@/app/api/desktop/deployments/[id]/github-evidence/route";

const version = {id: "release-1", version: 3, intakeJson: {}};
const invoke = (query: string) => POST(new NextRequest(`https://fixture.invalid/github-evidence${query}`, {method: "POST"}), {
  params: Promise.resolve({id: version.id}),
});

beforeEach(() => {
  vi.resetAllMocks();
  io.session.mockResolvedValue({organizationId: "workspace-1", userId: "actor-1"});
  io.request.mockResolvedValue(version);
  io.installation.mockResolvedValue({githubInstallationId: "123", lastSeenAt: new Date()});
  io.token.mockResolvedValue({ok: true, token: "synthetic"});
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({default_branch: "main"})));
});
afterEach(() => vi.unstubAllGlobals());

it("refuses an invalid or stale selection before installation and provider access", async () => {
  expect((await invoke("?expectedVersion=3x")).status).toBe(400);
  expect(io.request).not.toHaveBeenCalled();
  expect((await invoke("?expectedVersion=2")).status).toBe(409);
  expect(io.request).toHaveBeenCalledWith(expect.anything(), "workspace-1", version.id);
  expect(io.installation).not.toHaveBeenCalled();
  expect(io.token).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(io.audit).not.toHaveBeenCalled();
});

it("withholds evidence if the version changes during the read", async () => {
  io.request.mockResolvedValueOnce(version).mockResolvedValueOnce({...version, version: 4});
  expect((await invoke("?expectedVersion=3")).status).toBe(409);
  expect(fetch).toHaveBeenCalled();
  expect(io.audit).not.toHaveBeenCalled();
});

it("returns the exact request version and preserves the existing legacy request path", async () => {
  const result = await invoke("?expectedVersion=3");
  expect(result.status).toBe(200);
  expect(await result.json()).toMatchObject({ok: true, data: {mode: "read_only_evidence", requestId: version.id, requestVersion: 3}});
  expect(io.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({detailJson: expect.objectContaining({requestVersion: 3})}));

  vi.clearAllMocks();
  expect((await invoke("")).status).toBe(200);
  expect(io.request).toHaveBeenCalledOnce();
});
