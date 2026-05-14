/**
 * Azure capability surface. Thin wrapper that returns the Azure slice of
 * the canonical `providerCapabilities` table — kept in this module so the
 * file naming the validation matrix expects is real.
 */

import { capabilitiesFor } from "../providerCapabilities";
import type { ProviderCapability } from "../providerCapabilities";

export function azureCapabilities(): ProviderCapability[] {
  return capabilitiesFor("azure");
}

/** Quick summary used by the Trust Center + Command Center Azure tile. */
export function azureCapabilitySummary(): { total: number; preview: number; expanding: number; planned: number } {
  const caps = azureCapabilities();
  let preview = 0, expanding = 0, planned = 0;
  for (const c of caps) {
    if (c.status === "preview")   preview++;
    else if (c.status === "expanding") expanding++;
    else if (c.status === "planned")   planned++;
  }
  return { total: caps.length, preview, expanding, planned };
}
