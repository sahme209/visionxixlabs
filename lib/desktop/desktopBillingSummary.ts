/** Wire-only DTO: keep server billing dependencies out of the desktop build. */
export type DesktopAIAllowance = { available: false } | {
  available: true;
  baseCents: number;
  addOnCents: number;
  poolCents: number;
  usedCents: number;
  heldCents: number;
  includedRemainingCents: number;
  overagePolicy: string;
};

type PublicPlanId = "free" | "pro" | "enterprise";
export interface DesktopBillingSnapshot {
  version: 1;
  plan: { available: false } | {
    available: true;
    label: string;
    status: string;
    publicPlanId?: PublicPlanId;
    hasCustomer: boolean;
  };
  allowance: DesktopAIAllowance;
  canManageBilling: boolean;
}
export interface DesktopUsageSummary {
  periodMonth: string;
  aiInvocationCount: number;
  aiInputTokens: number;
  aiOutputTokens: number;
  aiCostCents: number;
  billingSnapshot?: DesktopBillingSnapshot;
}
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const usageFields = ["aiInvocationCount", "aiInputTokens", "aiOutputTokens", "aiCostCents"] as const;
const allowanceFields = ["baseCents", "addOnCents", "poolCents", "usedCents", "heldCents", "includedRemainingCents"] as const;

/** Older servers remain readable. A present malformed extension is never
 * interpreted as a verified plan, available credit or permission. */
export function parseDesktopUsageSummary(value: unknown): DesktopUsageSummary | null {
  if (!record(value) || typeof value.periodMonth !== "string"
    || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value.periodMonth)
    || !usageFields.every(key => count(value[key]))) return null;
  const base: DesktopUsageSummary = {
    periodMonth: value.periodMonth,
    aiInvocationCount: value.aiInvocationCount as number,
    aiInputTokens: value.aiInputTokens as number,
    aiOutputTokens: value.aiOutputTokens as number,
    aiCostCents: value.aiCostCents as number,
  };
  if (value.billingSnapshot === undefined) return base;
  const snapshot = value.billingSnapshot;
  if (!record(snapshot) || snapshot.version !== 1 || typeof snapshot.canManageBilling !== "boolean"
    || !record(snapshot.plan) || typeof snapshot.plan.available !== "boolean"
    || !record(snapshot.allowance) || typeof snapshot.allowance.available !== "boolean") return null;
  const { plan, allowance } = snapshot;
  if (plan.available && (typeof plan.label !== "string" || !plan.label.trim() || plan.label.length > 80
    || typeof plan.status !== "string" || !["trialing", "active", "past_due", "canceled", "no_plan"].includes(plan.status)
    || typeof plan.hasCustomer !== "boolean"
    || (plan.publicPlanId !== undefined && !["free", "pro", "enterprise"].includes(plan.publicPlanId as string)))) return null;
  if (allowance.available && (!allowanceFields.every(key => count(allowance[key]))
    || typeof allowance.overagePolicy !== "string" || allowance.overagePolicy.length > 80)) return null;
  base.billingSnapshot = {
    version: 1,
    canManageBilling: snapshot.canManageBilling,
    plan: plan.available ? {
      available: true,
      label: plan.label as string,
      status: plan.status as string,
      hasCustomer: plan.hasCustomer as boolean,
      ...(plan.publicPlanId ? { publicPlanId: plan.publicPlanId as PublicPlanId } : {}),
    } : { available: false },
    allowance: allowance.available ? {
      available: true,
      baseCents: allowance.baseCents as number,
      addOnCents: allowance.addOnCents as number,
      poolCents: allowance.poolCents as number,
      usedCents: allowance.usedCents as number,
      heldCents: allowance.heldCents as number,
      includedRemainingCents: allowance.includedRemainingCents as number,
      overagePolicy: allowance.overagePolicy as string,
    } : { available: false },
  };
  return base;
}
