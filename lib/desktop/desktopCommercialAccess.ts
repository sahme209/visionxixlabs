import "server-only";

import { readBillingPlan } from "@/lib/billing/tenantBillingStore";
import { decideDesktopCommercialAccess, type DesktopCommercialAccess } from "./desktopCommercialAccessPolicy";

export { decideDesktopCommercialAccess } from "./desktopCommercialAccessPolicy";
export type { DesktopCommercialAccess, DesktopCommercialAccessCode } from "./desktopCommercialAccessPolicy";

export async function readDesktopCommercialAccess(organizationId: string): Promise<DesktopCommercialAccess> {
  const plan = await readBillingPlan(organizationId);
  return decideDesktopCommercialAccess(plan);
}
