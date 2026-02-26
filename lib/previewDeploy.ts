import { deploySite, type DeployProvider } from "./provider";
import type { AIStarterPackage } from "./aiWebsiteStarter";

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
