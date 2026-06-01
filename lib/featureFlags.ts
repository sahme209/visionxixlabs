/**
 * Feature flags for production-honest behavior.
 * Defaults are conservative: hide stub/placeholder features until real implementation exists.
 */

/** AWS connector — real STS AssumeRole validation. Disable with ENABLE_CLOUD_CONNECTORS_AWS=false. */
export const ENABLE_CLOUD_CONNECTORS_AWS =
  process.env.ENABLE_CLOUD_CONNECTORS_AWS !== "false";

/** Azure connector — real SP validation via @azure/identity. Disable with ENABLE_CLOUD_CONNECTORS_AZURE=false. */
export const ENABLE_CLOUD_CONNECTORS_AZURE =
  process.env.ENABLE_CLOUD_CONNECTORS_AZURE !== "false";

/** GCP connector — real SA validation via google-auth-library. Disable with ENABLE_CLOUD_CONNECTORS_GCP=false. */
export const ENABLE_CLOUD_CONNECTORS_GCP =
  process.env.ENABLE_CLOUD_CONNECTORS_GCP !== "false";

/** Placeholder plugins (analytics, domain-dns, deployment, AWS remediate, IAM scan, cost explorer). */
export const ENABLE_PLACEHOLDER_PLUGINS =
  process.env.ENABLE_PLACEHOLDER_PLUGINS === "true";

export function isCloudConnectorEnabled(
  connector: "aws" | "azure" | "gcp"
): boolean {
  switch (connector) {
    case "aws":
      return ENABLE_CLOUD_CONNECTORS_AWS;
    case "azure":
      return ENABLE_CLOUD_CONNECTORS_AZURE;
    case "gcp":
      return ENABLE_CLOUD_CONNECTORS_GCP;
    default:
      return false;
  }
}
