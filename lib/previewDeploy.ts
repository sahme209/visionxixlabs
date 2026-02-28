import { deploySite, deploySiteFromPlan, type DeployProvider } from "./deploy/provider";
import type { AIStarterPackage } from "@/lib/websiteStarter/engine";
import type { WebsiteBuilderPlan } from "./scaffoldGenerator";

export type DeployResult = {
  url: string;
  deploymentId: string;
  state: string;
};

/**
 * Deploy generated site. Uses provider abstraction.
 * Default: Vercel for preview. Falls back to Vercel if provider not supported.
 */
export async function deployPreview(
  pkg: AIStarterPackage,
  projectName: string,
  provider: DeployProvider = "vercel",
  credentials?: Record<string, string>
): Promise<DeployResult> {
  const prov = ["vercel", "aws", "azure", "gcp"].includes(provider) ? provider : "vercel";
  return deploySite(prov, pkg, { projectName, credentials });
}

/**
 * Deploy from website-builder plan (full HTML). Base44-style full build.
 */
export async function deployPreviewFromPlan(
  plan: WebsiteBuilderPlan,
  projectName: string,
  provider: DeployProvider = "vercel",
  credentials?: Record<string, string>
): Promise<DeployResult> {
  const prov = ["vercel", "aws", "azure", "gcp"].includes(provider) ? provider : "vercel";
  return deploySiteFromPlan(prov, plan, { projectName, credentials });
}
