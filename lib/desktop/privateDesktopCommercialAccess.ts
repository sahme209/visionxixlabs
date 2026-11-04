import "server-only";
import { createBillingPlanReaderCore, type BillingPlanReadRepository } from "@/lib/billing/tenantBillingReadCore";
import type { PublicBillingIdentity } from "@/lib/billing/publicCheckoutService";
import { decideDesktopCommercialAccess, type DesktopCommercialAccess } from "./desktopCommercialAccessPolicy";

export type PrivateBillingConfiguration = Readonly<{ kind: "legacy" } | { kind: "public"; identity: PublicBillingIdentity }>;
/** Fixed private composition only: current actual billing evidence, never caller-supplied access. */
export function createPrivateDesktopCommercialAccessReader(repo: BillingPlanReadRepository, config: PrivateBillingConfiguration) {
 if (!config || !["legacy", "public"].includes(config.kind)) throw Error("private_billing_configuration_unavailable");
 const publicMode = config.kind === "public";
 const identity = config.kind === "public" ? { accountId: config.identity?.accountId, livemode: config.identity?.livemode } : undefined;
 if (publicMode && (!identity || typeof identity.accountId !== "string" || !/^acct_[A-Za-z0-9]+$/.test(identity.accountId) || typeof identity.livemode !== "boolean")) throw Error("private_billing_configuration_unavailable");
 const reader = createBillingPlanReaderCore(repo, {
  strictCurrentRecords: true,
  publicBillingPolicyEnabled: () => publicMode,
  configuredPublicBillingIdentity: () => { if (!identity) throw Error("private_billing_configuration_unavailable"); return { ...identity }; },
 });
 return async (organizationId: string): Promise<DesktopCommercialAccess> => {
  const result = await reader.readBillingPlanWithAvailability(organizationId);
  if (!result.available || result.plan.organizationId !== organizationId) throw Error("desktop_commercial_access_unavailable");
  return { ...decideDesktopCommercialAccess(result.plan), currentPeriodEndsAt: result.plan.currentPeriodEndsAt, cancelAtPeriodEnd: result.plan.cancelAtPeriodEnd };
 };
}
