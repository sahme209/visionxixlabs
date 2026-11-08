import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createPrivateAuthorityDatabase } from "@/lib/security/privateAuthorityDatabase";
import { createPrivateCredentialVault } from "@/lib/security/privateCredentialVault";
import { createPrivateDesktopTokenCodec } from "../privateDesktopToken";
import { createPrivateReleaseMergeComposition } from "../privateReleaseMergeComposition";

afterEach(() => vi.restoreAllMocks());

it("uses actual private session resources and preserves the canonical issuer refusal before any claim or mint", async () => {
  const client = createPrivateAuthorityDatabase("postgresql://synthetic:synthetic@127.0.0.1:1/private_fixture");
  const now = Date.parse("2026-11-03T00:00:00Z");
  const key = new Uint8Array(32).fill(7);
  const token = createPrivateDesktopTokenCodec(key).mintDesktopToken("dsk_owned");
  const session = vi.spyOn(client.desktopSessionRecord, "findUnique").mockResolvedValue({ id: "dsk_owned", userId: "user", organizationId: "org", deviceFingerprint: "owned", deviceLabel: "Owned test", platform: "unknown", desktopVersion: null, createdAt: new Date(now), issuedAt: new Date(now), expiresAt: new Date(now + 60_000), lastSeenAt: new Date(now), revokedAt: null, revokeReason: null });
  const membership = vi.spyOn(client.orgMembership, "findUnique").mockResolvedValue({ role: "admin", acceptedAt: new Date(now) } as never);
  vi.spyOn(client.tenantBillingPlan, "findUnique").mockResolvedValue({ organizationId: "org", tier: "growth", status: "active", trialEndsAt: null, currentPeriodEndsAt: null, stripeCustomerId: null, stripeSubscriptionId: null, cancelAtPeriodEnd: false } as never);
  const transaction = vi.spyOn(client, "$transaction");
  const app = vi.spyOn(client.platformGithubAppCredential, "findUnique");
  const transport = vi.fn();
  try {
    const composition = createPrivateReleaseMergeComposition({ client, vault: createPrivateCredentialVault(new Uint8Array(32).fill(8)), sessionSigningKey: key, billing: { kind: "legacy" }, fetch: transport as typeof fetch, now: () => now, enabled: () => true, governanceEnabled: () => true });
    const request = new NextRequest("https://example.invalid/private-merge", { headers: { authorization: `Bearer ${token}` } });
    await expect(composition.forRequest(request).run("release_merge_provider_" + "a".repeat(64))).rejects.toThrow("governance_merge_outbound_issuer_unavailable");
    expect(session).toHaveBeenCalled();
    expect(membership).toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(app).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  } finally { await client.$disconnect(); }
});

it("refuses API keys without reading the supplied database or exposing resource handles", async () => {
  const client = createPrivateAuthorityDatabase("postgresql://synthetic:synthetic@127.0.0.1:1/private_fixture");
  const session = vi.spyOn(client.desktopSessionRecord, "findUnique");
  const transport = vi.fn();
  try {
    const composition = createPrivateReleaseMergeComposition({ client, vault: createPrivateCredentialVault(new Uint8Array(32).fill(8)), sessionSigningKey: new Uint8Array(32).fill(7), billing: { kind: "legacy" }, fetch: transport as typeof fetch, now: Date.now, enabled: () => true, governanceEnabled: () => true });
    expect(Object.keys(composition)).toEqual(["forRequest", "handleExecution", "handleOperation", "forGovernanceRequest"]);
    const request = new NextRequest("https://example.invalid/private-merge", { headers: { authorization: "Bearer vxlk_owned" } });
    await expect(composition.forRequest(request).run("release_merge_provider_" + "a".repeat(64))).rejects.toThrow();
    expect(session).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  } finally { await client.$disconnect(); }
});
