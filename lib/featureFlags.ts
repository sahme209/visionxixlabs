/**
 * Feature flags for production-honest behavior.
 * Defaults are conservative: hide stub/placeholder features until real implementation exists.
 */

/** AWS connector — stub returns always valid. Enable when real STS validation is implemented. */
export const ENABLE_CLOUD_CONNECTORS_AWS =
  process.env.ENABLE_CLOUD_CONNECTORS_AWS === "true";

/** Azure connector — stub returns always valid. Enable when real validation is implemented. */
export const ENABLE_CLOUD_CONNECTORS_AZURE =
  process.env.ENABLE_CLOUD_CONNECTORS_AZURE === "true";

/** GCP connector — stub returns always valid. Enable when real validation is implemented. */
export const ENABLE_CLOUD_CONNECTORS_GCP =
  process.env.ENABLE_CLOUD_CONNECTORS_GCP === "true";

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
