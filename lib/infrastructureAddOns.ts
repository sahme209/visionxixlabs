export type CloudProvider = "vercel" | "aws" | "azure" | "gcp";

export const INFRASTRUCTURE_ADDONS: Record<
  CloudProvider,
  { id: string; label: string; tier: "professional" | "done_for_you" }[]
> = {
  vercel: [
    { id: "cdn", label: "CDN", tier: "professional" },
    { id: "ssl", label: "SSL", tier: "professional" },
    { id: "cicd", label: "CI/CD", tier: "professional" },
  ],
  aws: [
    { id: "s3", label: "S3 storage", tier: "professional" },
    { id: "cloudfront", label: "CloudFront CDN", tier: "professional" },
    { id: "route53", label: "Route53 DNS", tier: "professional" },
    { id: "waf", label: "WAF", tier: "done_for_you" },
    { id: "autoscaling", label: "Auto scaling", tier: "done_for_you" },
  ],
  azure: [
    { id: "blob", label: "Blob storage", tier: "professional" },
    { id: "cdn", label: "Azure CDN", tier: "professional" },
    { id: "frontdoor", label: "Front Door", tier: "professional" },
    { id: "appservice", label: "App Service", tier: "professional" },
  ],
  gcp: [
    { id: "storage", label: "Cloud Storage", tier: "professional" },
    { id: "cdn", label: "Cloud CDN", tier: "professional" },
    { id: "armor", label: "Cloud Armor", tier: "done_for_you" },
    { id: "run", label: "Cloud Run", tier: "done_for_you" },
  ],
};
