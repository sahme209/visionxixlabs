/**
 * Canonical provider taxonomy.
 *
 * Multiple modules historically declared their own `CloudProvider` /
 * `Provider` / `ConnectorType` unions. This file is the single source of
 * truth — every other module should import from here.
 */

/** The three first-class cloud providers Axiom operates against. */
export type CloudProvider = "aws" | "azure" | "gcp";

/** Identity providers used for SSO / federation. */
export type IdentityProvider = "okta" | "azure_ad" | "google_workspace";

/** Source-control / CI / IaC / governance providers used in connectors. */
export type ReleaseSystemId =
  | "github"
  | "gitlab"
  | "azure_devops"
  | "jenkins"
  | "argocd"
  | "terraform_cloud";

/** Operational tool surfaces — chat / ticketing / change management. */
export type OperationalProvider =
  | "slack"
  | "teams"
  | "pagerduty"
  | "opsgenie"
  | "servicenow"
  | "jira"
  | "linear";

/** The full provider universe. */
export type ProviderId =
  | CloudProvider
  | IdentityProvider
  | ReleaseSystemId
  | OperationalProvider
  | "system"
  | "desktop";

/** Provider availability tier — drives honest preview tagging. */
export type ProviderTier = "active" | "expanding" | "preview" | "unavailable";

export interface ProviderDescriptor {
  id: ProviderId;
  label: string;
  category: "cloud" | "identity" | "release" | "operational" | "platform";
  tier: ProviderTier;
}

export const CLOUD_PROVIDERS: readonly CloudProvider[] = ["aws", "azure", "gcp"] as const;

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  aws:                "Amazon Web Services",
  azure:              "Microsoft Azure",
  gcp:                "Google Cloud Platform",
  okta:               "Okta",
  azure_ad:           "Azure AD / Entra ID",
  google_workspace:   "Google Workspace",
  github:             "GitHub",
  gitlab:             "GitLab",
  azure_devops:       "Azure DevOps",
  jenkins:            "Jenkins",
  argocd:             "Argo CD",
  terraform_cloud:    "Terraform Cloud",
  slack:              "Slack",
  teams:              "Microsoft Teams",
  pagerduty:          "PagerDuty",
  opsgenie:           "Opsgenie",
  servicenow:         "ServiceNow",
  jira:               "Jira",
  linear:             "Linear",
  system:             "Axiom",
  desktop:            "Axiom Desktop",
};

export function isCloudProvider(p: string): p is CloudProvider {
  return CLOUD_PROVIDERS.includes(p as CloudProvider);
}
