import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/lib/prismaClient";
const mocks = vi.hoisted(() => ({ mail: vi.fn(), compare: vi.fn() }));
vi.mock("../emailVerification", () => ({ sendGoogleLinkConfirmation: mocks.mail }));
vi.mock("bcryptjs", () => ({ compare: mocks.compare }));
import { qualifiedGoogleIdentity, GOOGLE_ISSUER, GITLAB_ISSUER } from "../googleIdentityClaims";
import { activeGoogleLink, confirmGoogleLink, resolveGoogleIdentity, sendGoogleLinkCode, validGoogleLinkCsrf } from "../googleIdentity";
import { googleLinkContext, googleLinkCsrf, hashGoogleLinkProof, googleLinkCookieValue } from "../googleLinkContext";
const now = new Date("2026-11-15T18:00:00Z");
const canonical = { id: "canonical-user", email: "owner@example.test", name: "Owner", image: null };
const claims = { iss: GOOGLE_ISSUER, sub: "google-sub", email: "owner@gmail.com", email_verified: true, exp: now.getTime() / 1000 + 3600 };
const nonce = "a".repeat(43);
function intent(overrides: object = {}) {
  return { id: "intent-1", issuer: GOOGLE_ISSUER, subject: "google-sub", email: canonical.email, candidateUserId: canonical.id, candidateUpdatedAt: now,
    browserNonceHash: hashGoogleLinkProof(nonce), csrfHash: hashGoogleLinkProof(googleLinkCsrf(nonce, "intent-1")),
    emailProofHash: hashGoogleLinkProof("mail-code"), emailProofExpiresAt: new Date(now.getTime() + 60_000), emailSentAt: null,
    attempts: 0, callbackPath: "/desktop/connect?challenge=original", createdAt: now, expiresAt: new Date(now.getTime() + 300_000), consumedAt: null, ...overrides };
}
function fixture() {
  const db = {
    user: { findUnique: vi.fn().mockResolvedValue({ ...canonical, updatedAt: now, passwordHash: "hash", emailVerifiedAt: now }), create: vi.fn().mockResolvedValue(canonical) },
    oAuthIdentity: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "binding" }) },
    pendingGoogleIdentityLink: { findUnique: vi.fn().mockResolvedValue(intent()), create: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    $queryRaw: vi.fn().mockResolvedValue([{ id: canonical.id }]),
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async action => action(db));
  return { db, client: db as unknown as PrismaClient };
}
beforeEach(() => { vi.clearAllMocks(); mocks.mail.mockResolvedValue(true); mocks.compare.mockResolvedValue(true); });
describe("qualified Google claims (verified framework boundary only)", () => {
  it("accepts stable subject and distinguishes authoritative mailbox", () => {
    expect(qualifiedGoogleIdentity(claims, claims.sub, claims.email, now)).toMatchObject({ authoritativeEmail: true, subject: claims.sub });
    expect(qualifiedGoogleIdentity({ ...claims, email: canonical.email }, claims.sub, canonical.email, now)).toMatchObject({ authoritativeEmail: false });
    expect(qualifiedGoogleIdentity({ ...claims, email: canonical.email, hd: "example.test" }, claims.sub, canonical.email, now)).toMatchObject({ authoritativeEmail: true });
  });
  it.each([
    { email_verified: false }, { email_verified: "true" }, { sub: "" }, { sub: "a".repeat(256) }, { sub: "wrong" }, { sub: "bad\nsub" },
    { iss: "https://attacker.invalid" }, { exp: now.getTime() / 1000 }, { exp: NaN }, { email: "bad" },
  ])("refuses malformed/unverified/mismatched raw claims %j", change => {
    expect(qualifiedGoogleIdentity({ ...claims, ...change }, claims.sub, claims.email, now)).toBeNull();
  });
  it("does not trust mapped email or a mismatched hosted domain", () => {
    expect(qualifiedGoogleIdentity(claims, claims.sub, canonical.email, now)).toBeNull();
    expect(qualifiedGoogleIdentity({ ...claims, email: canonical.email, hd: "other.test" }, claims.sub, canonical.email, now)?.authoritativeEmail).toBe(false);
  });
});
describe("stable Google identity resolution", () => {
  it("keeps canonical user/email when provider email changes, with no email relookup", async () => {
    const { db, client } = fixture(); db.oAuthIdentity.findUnique.mockResolvedValue({ user: canonical });
    expect(await resolveGoogleIdentity(client, { profile: claims, providerAccountId: claims.sub, email: claims.email }, now)).toMatchObject({ kind: "resolved", user: canonical });
    expect(db.user.findUnique).not.toHaveBeenCalled(); expect(db.user.create).not.toHaveBeenCalled();
  });
  it("creates authoritative new account and binding in one serializable transaction", async () => {
    const { db, client } = fixture(); db.user.findUnique.mockResolvedValue(null);
    expect(await resolveGoogleIdentity(client, { profile: claims, providerAccountId: claims.sub, email: claims.email }, now)).toMatchObject({ kind: "resolved" });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(db.oAuthIdentity.create).toHaveBeenCalledWith({ data: { provider: "google", issuer: GOOGLE_ISSUER, subject: claims.sub, userId: canonical.id } });
  });
  it.each([true, false])("never silently links an existing email (authoritative=%s)", async authoritative => {
    const { db, client } = fixture();
    const p = { ...claims, email: authoritative ? claims.email : canonical.email };
    const scope = { callbackPath: "/desktop/connect?challenge=original", pendingCookie: undefined as string | undefined };
    expect(await googleLinkContext.run(scope, () => resolveGoogleIdentity(client, { profile: p, providerAccountId: p.sub, email: p.email }, now))).toEqual({ kind: "recover" });
    expect(db.user.create).not.toHaveBeenCalled(); expect(db.oAuthIdentity.create).not.toHaveBeenCalled();
    expect(scope.pendingCookie).toMatch(/^[\w-]{43}$/);
    expect(db.pendingGoogleIdentityLink.create.mock.calls[0][0].data).toMatchObject({ candidateUserId: canonical.id, callbackPath: scope.callbackPath, createdAt: now, expiresAt: new Date(now.getTime() + 900_000) });
    expect(JSON.stringify(db.pendingGoogleIdentityLink.create.mock.calls)).not.toContain(scope.pendingCookie);
  });
  it("requires fresh mailbox proof for new third-party address", async () => {
    const { db, client } = fixture(); db.user.findUnique.mockResolvedValue(null);
    await googleLinkContext.run({ callbackPath: "/dashboard" }, () => resolveGoogleIdentity(client, { profile: { ...claims, email: canonical.email }, providerAccountId: claims.sub, email: canonical.email }, now));
    expect(db.user.create).not.toHaveBeenCalled(); expect(db.pendingGoogleIdentityLink.create.mock.calls[0][0].data.candidateUserId).toBeNull();
  });
  it("refuses an existing account already bound to another subject", async () => {
    const { db, client } = fixture(); db.oAuthIdentity.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "other-binding" });
    await expect(googleLinkContext.run({ callbackPath: "/dashboard" }, () => resolveGoogleIdentity(client, { profile: claims, providerAccountId: claims.sub, email: claims.email }, now))).rejects.toThrow("google_identity_unavailable");
    expect(db.pendingGoogleIdentityLink.create).not.toHaveBeenCalled();
  });
  it("does not reselect email on concurrent signup/subject uniqueness failure", async () => {
    const { db, client } = fixture(); db.user.findUnique.mockResolvedValue(null); db.user.create.mockRejectedValue(new Error("synthetic uniqueness conflict"));
    await expect(resolveGoogleIdentity(client, { profile: claims, providerAccountId: claims.sub, email: claims.email }, now)).rejects.toThrow();
    expect(db.user.findUnique).toHaveBeenCalledTimes(1); expect(db.oAuthIdentity.create).not.toHaveBeenCalled();
  });
});
describe("purpose/browser-bound one-use Google recovery", () => {
  it("rederives CSRF but refuses cross-intent, cross-browser and duplicate cookies", () => {
    const row = intent(); const csrf = googleLinkCsrf(nonce, row.id);
    expect(validGoogleLinkCsrf(row, nonce, csrf)).toBe(true);
    expect(validGoogleLinkCsrf(row, "b".repeat(43), csrf)).toBe(false);
    expect(validGoogleLinkCsrf(row, nonce, googleLinkCsrf(nonce, "other"))).toBe(false);
    expect(googleLinkCookieValue(`__Host-axiom.google_identity_link.v1=${nonce}; __Host-axiom.google_identity_link.v1=${nonce}`)).toBeNull();
    expect(googleLinkCookieValue(`axiom.google_identity_link.local.v1=${nonce}`)).toBeNull();
    expect(googleLinkCookieValue(`axiom.google_identity_link.v1=${nonce}`)).toBeNull();
    expect(googleLinkCookieValue(`__Host-axiom.google_identity_link.v1=${nonce}`, false)).toBeNull();
    expect(googleLinkCookieValue(`axiom.google_identity_link.local.v1=${nonce}`, false)).toBe(nonce);
  });
  it.each([{ attempts: 5 }, { consumedAt: now }, { expiresAt: now }])("refuses inactive recovery %j", async change => {
    const { db, client } = fixture(); db.pendingGoogleIdentityLink.findUnique.mockResolvedValue(intent(change));
    expect(await activeGoogleLink(client, nonce, now)).toBeNull();
  });
  it("keeps delivery absence explicit and stores only a bounded proof hash", async () => {
    const { db, client } = fixture(); mocks.mail.mockResolvedValue(false);
    expect(await sendGoogleLinkCode(client, intent({ expiresAt: new Date(now.getTime() + 1000) }), now)).toBe("delivery_unavailable");
    const data = db.pendingGoogleIdentityLink.updateMany.mock.calls[0][0].data;
    const mail = mocks.mail.mock.calls[0][0];
    expect(data.emailProofHash).toBe(hashGoogleLinkProof(mail.code)); expect(data.emailProofHash).not.toBe(mail.code);
    expect(data.emailProofExpiresAt.getTime()).toBe(now.getTime() + 1000);
  });
  it("refuses a concurrent resend without sending another code", async () => {
    const { db, client } = fixture(); db.pendingGoogleIdentityLink.updateMany.mockResolvedValue({ count: 0 });
    expect(await sendGoogleLinkCode(client, intent(), now)).toBe("wait"); expect(mocks.mail).not.toHaveBeenCalled();
  });
  it("atomically consumes live intent and creates stable binding", async () => {
    const { db, client } = fixture();
    expect(await confirmGoogleLink(client, intent(), { code: "mail-code" }, () => now)).toBe("linked");
    expect(db.$queryRaw).toHaveBeenCalled();
    const cas = db.pendingGoogleIdentityLink.updateMany.mock.calls[1][0];
    expect(cas.where).toMatchObject({ consumedAt: null, attempts: { lt: 5 }, emailProofHash: hashGoogleLinkProof("mail-code"), expiresAt: { gt: now } });
    expect(cas.data).toMatchObject({ consumedAt: now, emailProofHash: null });
    expect(db.oAuthIdentity.create).toHaveBeenCalledTimes(1);
  });
  it("fresh verified-password proof can recover legacy account, unverified password cannot", async () => {
    const { db, client } = fixture();
    expect(await confirmGoogleLink(client, intent(), { password: "existing" }, () => now)).toBe("linked");
    db.user.findUnique.mockResolvedValue({ ...canonical, updatedAt: now, passwordHash: "hash", emailVerifiedAt: null });
    expect(await confirmGoogleLink(client, intent(), { password: "existing" }, () => now)).toBe("proof_refused");
  });
  it("increments failed proof atomically without resetting attempts", async () => {
    const { db, client } = fixture();
    expect(await confirmGoogleLink(client, intent(), { code: "wrong" }, () => now)).toBe("proof_refused");
    expect(db.pendingGoogleIdentityLink.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ attempts: { lt: 5 } }), data: { attempts: { increment: 1 } } }));
    expect(db.oAuthIdentity.create).not.toHaveBeenCalled();
  });
  it.each(["email", "updatedAt", "passwordHash"])("refuses candidate %s change winning before account lock", async field => {
    const { db, client } = fixture();
    const base = { ...canonical, updatedAt: now, passwordHash: "hash", emailVerifiedAt: now };
    db.user.findUnique.mockResolvedValueOnce(base).mockResolvedValueOnce({ ...base, [field]: field === "updatedAt" ? new Date(now.getTime() + 1) : "changed" });
    expect(await confirmGoogleLink(client, intent(), { password: "existing" }, () => now)).toBe("restart");
    expect(db.oAuthIdentity.create).not.toHaveBeenCalled();
  });
  it("checks expiry after password work and lock waits", async () => {
    const { db, client } = fixture(); const clocks = [now, new Date(now.getTime() + 301_000)];
    expect(await confirmGoogleLink(client, intent(), { password: "existing" }, () => clocks.shift()!)).toBe("restart");
    expect(db.oAuthIdentity.create).not.toHaveBeenCalled();
  });
  it("CAS loser/replay/rotated proof cannot bind", async () => {
    const { db, client } = fixture(); db.pendingGoogleIdentityLink.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await confirmGoogleLink(client, intent(), { code: "mail-code" }, () => now)).toBe("restart"); expect(db.oAuthIdentity.create).not.toHaveBeenCalled();
  });
  it("new candidate becoming an existing email refuses rather than merges", async () => {
    const { db, client } = fixture();
    expect(await confirmGoogleLink(client, intent({ candidateUserId: null, candidateUpdatedAt: null }), { code: "mail-code" }, () => now)).toBe("restart");
    expect(db.user.create).not.toHaveBeenCalled(); expect(db.oAuthIdentity.create).not.toHaveBeenCalled();
  });
});

describe("GitLab.com account confirmation", () => {
  const gitlab = { ...claims, iss: GITLAB_ISSUER, sub: "801", email: "owner@gmail.com" };
  const input = { profile: gitlab, providerAccountId: gitlab.sub, email: gitlab.email };
  const gitlabIntent = () => intent({ issuer: GITLAB_ISSUER, subject: gitlab.sub });

  it("binds only the exact verified issuer and subject and always requires independent mailbox proof for a new user", async () => {
    expect(qualifiedGoogleIdentity(gitlab, gitlab.sub, gitlab.email, now, "gitlab")).toMatchObject({ authoritativeEmail: false });
    expect(qualifiedGoogleIdentity(gitlab, gitlab.sub, gitlab.email, now, "google")).toBeNull();
    expect(qualifiedGoogleIdentity({ ...gitlab, email_verified: false }, gitlab.sub, gitlab.email, now, "gitlab")).toBeNull();
    expect(qualifiedGoogleIdentity(gitlab, "802", gitlab.email, now, "gitlab")).toBeNull();
    const { db, client } = fixture();
    db.user.findUnique.mockResolvedValue(null);
    const scope = { callbackPath: "/desktop/connect?challenge=original", pendingCookie: "" };
    expect(await googleLinkContext.run(scope, () => resolveGoogleIdentity(client, input, now, "gitlab"))).toEqual({ kind: "recover" });
    expect(db.pendingGoogleIdentityLink.create).toHaveBeenCalledWith({ data: expect.objectContaining({ issuer: GITLAB_ISSUER, subject: gitlab.sub, candidateUserId: null, callbackPath: scope.callbackPath }) });
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.oAuthIdentity.create).not.toHaveBeenCalled();
  });

  it("separates provider proof and confirms an existing account without replacing its identity", async () => {
    const { db, client } = fixture();
    db.pendingGoogleIdentityLink.findUnique.mockResolvedValue(gitlabIntent());
    expect(await activeGoogleLink(client, nonce, now, "google")).toBeNull();
    expect(await activeGoogleLink(client, nonce, now, "gitlab")).toMatchObject({ issuer: GITLAB_ISSUER });
    expect(await sendGoogleLinkCode(client, gitlabIntent(), now, "google")).toBe("restart");
    expect(await confirmGoogleLink(client, gitlabIntent(), { code: "mail-code" }, () => now, "google")).toBe("restart");
    expect(mocks.mail).not.toHaveBeenCalled();
    expect(db.oAuthIdentity.create).not.toHaveBeenCalled();

    expect(await sendGoogleLinkCode(client, gitlabIntent(), now, "gitlab")).toBe("code_sent");
    expect(mocks.mail).toHaveBeenCalledWith(expect.objectContaining({ provider: "gitlab", to: canonical.email }));
    expect(await confirmGoogleLink(client, gitlabIntent(), { code: "mail-code" }, () => now, "gitlab")).toBe("linked");
    expect(db.oAuthIdentity.create).toHaveBeenCalledWith({ data: { provider: "gitlab", issuer: GITLAB_ISSUER, subject: gitlab.sub, userId: canonical.id } });
    expect(db.user.create).not.toHaveBeenCalled();
  });
});
