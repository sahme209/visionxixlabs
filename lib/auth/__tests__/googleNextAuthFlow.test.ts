import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ bound: vi.fn(), membership: vi.fn(), audit: vi.fn(), userFind: vi.fn(), compare: vi.fn(), rateLimit: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { oAuthIdentity: { findUnique: mocks.bound }, user: { findUnique: mocks.userFind } } }));
vi.mock("@/lib/auth/ensurePersonalWorkspaceMembership", () => ({ ensurePersonalWorkspaceMembership: mocks.membership }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.audit }));
vi.mock("bcryptjs", () => ({ compare: mocks.compare }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: mocks.rateLimit }));
import { authOptions } from "@/lib/auth";
import { attestCanonicalIdentity } from "../canonicalIdentity";

const require = createRequire(import.meta.url);
const base = dirname(require.resolve("next-auth"));
const oauth = require(join(base, "core/lib/oauth/callback.js"));
const installedCallback = require(join(base, "core/routes/callback.js")).default;
const originalOauth = oauth.default;
const canonical = { id: "canonical-user", email: "owner@example.test", name: "Owner", image: null };
function wire(subject = "google-sub", email = "new-email@gmail.com") {
  return { profile: { id: subject, email, name: "Provider", image: null },
    account: { type: "oauth", provider: "google", providerAccountId: subject },
    OAuthProfile: { iss: "https://accounts.google.com", sub: subject, email, email_verified: true, exp: Math.floor(Date.now() / 1000) + 3600 }, cookies: [] };
}
async function runInstalled(qualified: ReturnType<typeof wire>) {
  // ONLY the network/OIDC verification boundary is synthetic. The installed
  // callback router, no-adapter handler, callbacks and event wiring are real.
  oauth.default = async () => qualified;
  const encode = vi.fn().mockResolvedValue("synthetic-session");
  const chunk = vi.fn().mockReturnValue([{ name: "synthetic-session-cookie", value: "opaque" }]);
  try {
    const result = await installedCallback({ options: {
      ...authOptions, provider: { type: "oauth", id: "google" }, adapter: undefined,
      url: "https://canonical.invalid/api/auth", callbackUrl: "/desktop/connect?challenge=original",
      jwt: { encode }, logger: { debug() {}, error() {} },
    }, query: {}, body: {}, method: "GET", headers: {}, cookies: {}, sessionStore: { value: undefined, chunk } });
    return { result, encode, chunk };
  } finally { oauth.default = originalOauth; }
}
beforeEach(() => { vi.clearAllMocks(); mocks.bound.mockResolvedValue({ user: canonical }); mocks.membership.mockResolvedValue(undefined); mocks.audit.mockResolvedValue(undefined); mocks.rateLimit.mockReturnValue(true); mocks.compare.mockResolvedValue(true); });
describe("actual installed NextAuth callback identity propagation (synthetic qualified OIDC boundary)", () => {
  it("passes the exact attested object into JWT and audit with canonical id, not Google sub", async () => {
    const qualified = wire(); const { result, encode, chunk } = await runInstalled(qualified);
    expect(result.redirect).toBe("/desktop/connect?challenge=original");
    expect(encode.mock.calls[0][0].token).toMatchObject({ id: canonical.id, sub: canonical.id, email: canonical.email, identityVersion: 1 });
    expect(qualified.profile.id).toBe(canonical.id); expect(qualified.account.providerAccountId).toBe("google-sub");
    expect(mocks.userFind).not.toHaveBeenCalled(); expect(chunk).toHaveBeenCalledTimes(1);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: canonical.id, action: "auth.signin", entityRef: `user:${canonical.email}` }));
  });
  it("membership failure cannot deny a qualified bound identity", async () => {
    mocks.membership.mockRejectedValue(new Error("synthetic failure"));
    expect((await runInstalled(wire())).result.redirect).toContain("challenge=original");
  });
  it("unverified/raw subject mismatch or store failure creates no session cookie", async () => {
    for (const change of [{ email_verified: false }, { sub: "wrong" }]) {
      const qualified = wire(); Object.assign(qualified.OAuthProfile, change);
      const { result, encode, chunk } = await runInstalled(qualified);
      expect(result.redirect).toBe("/auth/link-google?reason=unavailable"); expect(encode).not.toHaveBeenCalled(); expect(chunk).not.toHaveBeenCalled();
    }
    mocks.bound.mockRejectedValue(new Error("synthetic private native error"));
    expect((await runInstalled(wire())).encode).not.toHaveBeenCalled();
  });
  it("does not accept cloned or invented canonical objects or ID-less legacy tokens", async () => {
    const user = { id: "provider-sub", email: "provider@gmail.com" }; attestCanonicalIdentity(user, canonical, "google", "google-sub");
    const jwt = authOptions.callbacks!.jwt!;
    expect(await jwt({ token: {}, user, account: { provider: "google", providerAccountId: "google-sub" } } as never)).toMatchObject({ id: canonical.id });
    await expect(jwt({ token: {}, user: { ...user }, account: { provider: "google", providerAccountId: "google-sub" } } as never)).rejects.toThrow("canonical_identity_required");
    await expect(jwt({ token: { id: canonical.id, email: canonical.email } } as never)).rejects.toThrow("canonical_identity_required");
    await expect(jwt({ token: { identityVersion: 1, email: canonical.email } } as never)).rejects.toThrow("canonical_identity_required");
  });
  it("isolates simultaneous object attestations despite identical provider email", async () => {
    const a = { id: "a", email: "same@example.test" }, b = { id: "b", email: "same@example.test" };
    attestCanonicalIdentity(a, { id: "canonical-a", email: a.email }, "google", "sub-a");
    attestCanonicalIdentity(b, { id: "canonical-b", email: b.email }, "google", "sub-b");
    const tokens = await Promise.all([a, b].map((user, i) => authOptions.callbacks!.jwt!({ token: {}, user, account: { provider: "google", providerAccountId: i ? "sub-b" : "sub-a" } } as never)));
    expect(tokens.map(token => token.id)).toEqual(["canonical-a", "canonical-b"]);
    await expect(authOptions.callbacks!.jwt!({ token: {}, user: a, account: { provider: "google", providerAccountId: "sub-b" } } as never)).rejects.toThrow();
  });
  it("credentials retain their verified canonical provenance through JWT", async () => {
    mocks.userFind.mockResolvedValue({ ...canonical, passwordHash: "hash", emailVerifiedAt: new Date() });
    const provider = authOptions.providers.find(p => p.id === "credentials")!;
    const authorize = (provider.options as { authorize: (body: object) => Promise<object> }).authorize;
    const user = await authorize({ email: canonical.email, password: "verified" });
    expect(await authOptions.callbacks!.jwt!({ token: {}, user, account: { provider: "credentials", providerAccountId: canonical.id } } as never)).toMatchObject({ id: canonical.id, identityVersion: 1 });
  });
});
