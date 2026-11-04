import { expect, it, vi } from "vitest";
import { createPrivateDesktopCommercialAccessReader } from "../privateDesktopCommercialAccess";
import { decideDesktopCommercialAccess } from "../desktopCommercialAccessPolicy";

it("reads the supplied current billing row and applies the existing actual desktop policy", async () => {
  let row: any = { organizationId: "org", tier: "growth", status: "active", trialEndsAt: null, currentPeriodEndsAt: new Date("2027-01-01"), stripeCustomerId: null, stripeSubscriptionId: null, cancelAtPeriodEnd: true, seatQuantity: 2 };
  const findUnique = vi.fn(async () => row);
  const repo = { tenantBillingPlan: { findUnique }, $transaction: vi.fn() };
  const read = createPrivateDesktopCommercialAccessReader(repo as never, { kind: "legacy" });
  expect(await read("org")).toMatchObject({ ...decideDesktopCommercialAccess(row), currentPeriodEndsAt: "2027-01-01T00:00:00.000Z", cancelAtPeriodEnd: true });
  expect(findUnique).toHaveBeenCalledWith({ where: { organizationId: "org" } });
  expect(repo.$transaction).not.toHaveBeenCalled();
  row = null;
  // Existing legacy policy is identity-only; do not invent paid enforcement.
  expect(await read("org")).toMatchObject(decideDesktopCommercialAccess({ tier: "trial", status: "no_plan" }));
  findUnique.mockRejectedValueOnce(Error("private synthetic DB refusal"));
  await expect(read("org")).rejects.toThrow("desktop_commercial_access_unavailable");
});

it("refuses unqualified public projections and unavailable public entitlement storage", async () => {
  const repo = { tenantBillingPlan: { findUnique: vi.fn(async () => ({ tier: "public_pro_v1" })) }, $transaction: vi.fn(async () => { throw Error("synthetic unavailable"); }) };
  await expect(createPrivateDesktopCommercialAccessReader(repo as never, { kind: "legacy" })("org")).rejects.toThrow("desktop_commercial_access_unavailable");
  await expect(createPrivateDesktopCommercialAccessReader(repo as never, { kind: "public", identity: { accountId: "acct_synthetic", livemode: false } })("org")).rejects.toThrow("desktop_commercial_access_unavailable");
  expect(() => createPrivateDesktopCommercialAccessReader(repo as never, { kind: "public", identity: { accountId: "invalid", livemode: false } })).toThrow();
});
