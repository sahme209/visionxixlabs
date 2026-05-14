/**
 * GCP capability surface. Thin wrapper around the canonical
 * `providerCapabilities` table for the GCP slice.
 */

import { capabilitiesFor } from "../providerCapabilities";
import type { ProviderCapability } from "../providerCapabilities";

export function gcpCapabilities(): ProviderCapability[] {
  return capabilitiesFor("gcp");
}

export function gcpCapabilitySummary(): { total: number; preview: number; expanding: number; planned: number } {
  const caps = gcpCapabilities();
  let preview = 0, expanding = 0, planned = 0;
  for (const c of caps) {
    if (c.status === "preview")   preview++;
    else if (c.status === "expanding") expanding++;
    else if (c.status === "planned")   planned++;
  }
  return { total: caps.length, preview, expanding, planned };
}
