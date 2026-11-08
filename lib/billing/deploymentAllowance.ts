import { AI_RATE_CARD } from "./aiRateCard";

/**
 * Free-to-explore deployment allowance (user decision 2026-11-08).
 *
 * Every organization gets the same number of counted deployments per UTC
 * month (`AI_RATE_CARD.freeMonthlyDeployments`, 10). Per-seat plans no
 * longer change this number. A design partner may receive a per-tenant
 * override, configured as data below and reviewed like any pricing change.
 * The default is no override.
 */
export const FREE_MONTHLY_DEPLOYMENTS: number = AI_RATE_CARD.freeMonthlyDeployments;

/** organizationId -> monthly counted deployments. Default: none. */
export type DeploymentQuotaOverrides = Readonly<Record<string, number>>;
export const DESIGN_PARTNER_DEPLOYMENT_OVERRIDES: DeploymentQuotaOverrides = Object.freeze({});

/**
 * Monthly counted-deployment limit for one organization. An invalid override
 * (non-integer, negative, unsafe) throws so callers fail closed as
 * `deployment_quota_unavailable` rather than granting an unknown amount.
 */
export function monthlyDeploymentLimitFor(
  organizationId: string,
  overrides: DeploymentQuotaOverrides = DESIGN_PARTNER_DEPLOYMENT_OVERRIDES,
): number {
  if (!Object.prototype.hasOwnProperty.call(overrides, organizationId)) return FREE_MONTHLY_DEPLOYMENTS;
  const value = overrides[organizationId];
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("deployment_quota_override_invalid");
  return value;
}
