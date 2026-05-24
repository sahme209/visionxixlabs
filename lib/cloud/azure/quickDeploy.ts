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

const DYNAMIC_TEMPLATE_PATH = "/api/azure/template";
const STATIC_TEMPLATE_PATH  = "/azure/axiom-agent-reader.json";

export interface AzureDeployInput {
  /** Site origin hosting the ARM template. */
  origin: string;
  /**
   * Object ID of the platform's Azure AD service principal. When
   * present we point Azure Portal at the dynamic template endpoint
   * (`/api/azure/template`) which bakes this value in as the parameter
   * default, so the customer doesn't have to type anything in the
   * portal. When omitted we fall back to the static JSON, which means
   * the customer has to paste an Object ID — kept as an escape hatch.
   */
  principalObjectId?: string;
}

/**
 * Returns:
 *   https://portal.azure.com/#create/Microsoft.Template/uri/<encoded template URI>
 */
export function buildAzureDeployUrl(input: AzureDeployInput): string {
  const origin = input.origin.replace(/\/$/, "");
  const templatePath = input.principalObjectId ? DYNAMIC_TEMPLATE_PATH : STATIC_TEMPLATE_PATH;
  const templateUri = `${origin}${templatePath}`;
  return `https://portal.azure.com/#create/Microsoft.Template/uri/${encodeURIComponent(templateUri)}`;
}
