import { describe, expect, it, vi } from "vitest";
import { claimOrganizationSeat, type OrganizationSeatClaimRepo } from "../organizationSeatClaim";

function repository(input: { used: number; tier?: string; seats?: number | null; existing?: boolean }) {
  const tx = {
    tenantBillingPlan: { findUnique: vi.fn(async () => input.tier ? { tier: input.tier, status: "active", seatQuantity: input.seats ?? null } : null) },
    orgMembership: {
      findUnique: vi.fn(async () => input.existing ? { id: "membership-1" } : null),
      count: vi.fn(async () => input.used),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    },
  };
  const repo = { $transaction: vi.fn(async (fn: (value: typeof tx) => Promise<unknown>) => fn(tx)) } as unknown as OrganizationSeatClaimRepo;
  return { repo, tx };
}

describe("claimOrganizationSeat", () => {
  it("allows the second Free member and blocks a third", async () => {
    const second = repository({ used: 1 });
    await expect(claimOrganizationSeat(second.repo, { organizationId: "org-1", userId: "user-2", role: "operator" })).resolves.toMatchObject({ ok: true, created: true, used: 2, limit: 2 });
    const third = repository({ used: 2 });
    await expect(claimOrganizationSeat(third.repo, { organizationId: "org-1", userId: "user-3", role: "operator" })).resolves.toMatchObject({ ok: false, error: "seat_limit_exhausted", limit: 2 });
    expect(third.tx.orgMembership.create).not.toHaveBeenCalled();
  });

  it("uses the signed subscription quantity for paid plans", async () => {
    const { repo } = repository({ used: 4, tier: "growth", seats: 5 });
    await expect(claimOrganizationSeat(repo, { organizationId: "org-1", userId: "user-5", role: "operator" })).resolves.toMatchObject({ ok: true, used: 5, limit: 5 });
  });

  it("fails closed when a paid subscription has no seat quantity", async () => {
    const { repo } = repository({ used: 1, tier: "growth", seats: null });
    await expect(claimOrganizationSeat(repo, { organizationId: "org-1", userId: "user-2", role: "operator" })).resolves.toEqual({ ok: false, error: "seat_entitlement_unavailable" });
  });

  it("lets an existing member refresh their role without consuming another seat", async () => {
    const { repo, tx } = repository({ used: 2, existing: true });
    await expect(claimOrganizationSeat(repo, { organizationId: "org-1", userId: "user-1", role: "admin" })).resolves.toMatchObject({ ok: true, created: false });
    expect(tx.orgMembership.update).toHaveBeenCalled();
    expect(tx.orgMembership.create).not.toHaveBeenCalled();
  });
});
