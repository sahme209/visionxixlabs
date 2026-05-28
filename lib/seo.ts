/**
 * SEO constants and helpers for Vision XIX Labs.
 */

export const SITE_URL = "https://visionxixlabs.com";

export const defaultOgImage = `${SITE_URL}/vision-xix-logo.png`;

export const organization = {
  name: "Vision XIX Labs",
  legalName: "Vision XIX Labs LLC",
  url: SITE_URL,
  logo: `${SITE_URL}/vision-xix-logo.png`,
  description:
    "Axiom is an autonomous cloud operations agent. It scans infrastructure, reasons about what to fix, generates execution plans, and applies approved changes — with governance, rollback, and full audit trail.",
  foundingDate: "2024",
  /* sameAs powers schema.org Organization sameAs[]. Surfaces these
     social profiles in Google's Knowledge Panel + Twitter card / OG
     parsers. Keep in sync with Footer + Navigation social links. */
  sameAs: [
    "https://www.linkedin.com/company/vision-xix-labs/",
    "https://x.com/VisionXIXLabs",
    "https://github.com/sahme209/axiom-releases",
  ],
};

export const primaryKeywords = [
  "autonomous cloud operations",
  "cloud operations agent",
  "infrastructure intelligence",
  "cloud cost optimization",
  "drift detection",
  "cloud governance",
  "Terraform automation",
  "AWS operations",
  "cloud security scanning",
  "Vision XIX Labs",
  "Axiom",
];

export const secondaryKeywords = [
  "infrastructure as code",
  "approval workflows",
  "cloud audit trail",
  "multi-cloud",
  "Azure scanning",
  "GCP scanning",
  "AI cloud operations",
  "cloud compliance",
  "rollback automation",
  "scheduled cloud scans",
];
