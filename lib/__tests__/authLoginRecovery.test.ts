import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(), upsertUser: vi.fn(), membership: vi.fn(),
  compare: vi.fn(), rateLimit: vi.fn(), audit: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: mocks.findUser, upsert: mocks.upsertUser } } }));
vi.mock("@/lib/auth/ensurePersonalWorkspaceMembership", () => ({ ensurePersonalWorkspaceMembership: mocks.membership }));
vi.mock("bcryptjs", () => ({ compare: mocks.compare }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: mocks.rateLimit }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.audit }));

import { authOptions } from "@/lib/auth";

const credentials = authOptions.providers.find((provider) => provider.id === "credentials")!;
// NextAuth's provider factory stores the supplied callback in options.
const authorize = (credentials.options as { authorize: (input: { email: string; password: string }) => Promise<unknown> }).authorize;
const login = () => authorize({ email: " Pilot@Example.Test ", password: "test-password" });
const verifiedUser = { id: "user-1", email: "pilot@example.test", name: "Pilot", image: null, passwordHash: "hash", emailVerifiedAt: new Date() };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rateLimit.mockReturnValue(true);
  mocks.compare.mockResolvedValue(true);
  mocks.findUser.mockResolvedValue(verifiedUser);
  mocks.upsertUser.mockResolvedValue(verifiedUser);
  mocks.membership.mockResolvedValue(undefined);
  mocks.audit.mockResolvedValue(undefined);
});

describe("password login after the verification schema is deployed", () => {
  it("accepts a verified account and resolves its existing canonical identity", async () => {
    expect(await login()).toMatchObject({ id: "user-1", email: "pilot@example.test" });
    expect(mocks.findUser).toHaveBeenCalledWith({ where: { email: "pilot@example.test" } });
    expect(mocks.membership).toHaveBeenCalledWith({ userId: "user-1", email: "pilot@example.test" });
  });
  it.each([null, { ...verifiedUser, emailVerifiedAt: null }, { ...verifiedUser, passwordHash: null }])("rejects unknown, unverified, and OAuth-only accounts", async (user) => {
    mocks.findUser.mockResolvedValue(user);
    expect(await login()).toBeNull();
    expect(mocks.membership).not.toHaveBeenCalled();
  });
  it("rejects an incorrect password", async () => {
    mocks.compare.mockResolvedValue(false);
    expect(await login()).toBeNull();
    expect(mocks.membership).not.toHaveBeenCalled();
  });
  it("fails closed during schema drift instead of bypassing verification", async () => {
    mocks.findUser.mockRejectedValue(Object.assign(new Error("missing verification column"), { code: "P2022" }));
    expect(await login()).toBeNull();
    expect(mocks.compare).not.toHaveBeenCalled();
    expect(mocks.membership).not.toHaveBeenCalled();
  });
});

describe.each(["google", "github"])("%s identity-store recovery", (provider) => {
  const signIn = () => authOptions.callbacks!.signIn!({ user: { email: "pilot@example.test" }, account: { provider } } as never);
  it("accepts an existing identity without rewriting its role", async () => {
    expect(await signIn()).toBe(true);
    expect(mocks.upsertUser.mock.calls[0][0].update).not.toHaveProperty("role");
    expect(mocks.membership).toHaveBeenCalledWith({ userId: "user-1", email: "pilot@example.test" });
  });
  it("denies a missing identity schema and records the safe server-side reason", async () => {
    mocks.upsertUser.mockRejectedValue(Object.assign(new Error("missing verification column"), { code: "P2022" }));
    expect(await signIn()).toBe(false);
    expect(mocks.membership).not.toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "auth.failed", errorCode: "identity_store_unavailable" }));
  });
  it("denies identities without an email", async () => {
    expect(await authOptions.callbacks!.signIn!({ user: {}, account: { provider } } as never)).toBe(false);
    expect(mocks.upsertUser).not.toHaveBeenCalled();
  });
});
