/**
 * Azure ARM "Deploy to Azure" URL builder — Phase 412.
 *
 * Azure's portal accepts a `#create/Microsoft.Template/uri/<encoded
 * template URI>` deep-link that opens the ARM deployment blade with
 * the template prefilled. The customer clicks Create + Review +
 * Create, picks the subscription, and the service principal lands in
 * their tenant with Reader role on the chosen subscription.
 *
 * Pure URL builder — no I/O.
 */

const TEMPLATE_PATH = "/azure/axiom-agent-reader.json";

export interface AzureDeployInput {
  /** Site origin hosting the public ARM template. */
  origin: string;
}

/**
 * Returns:
 *   https://portal.azure.com/#create/Microsoft.Template/uri/<encoded template URI>
 */
export function buildAzureDeployUrl(input: AzureDeployInput): string {
  const origin = input.origin.replace(/\/$/, "");
  const templateUri = `${origin}${TEMPLATE_PATH}`;
  return `https://portal.azure.com/#create/Microsoft.Template/uri/${encodeURIComponent(templateUri)}`;
}
