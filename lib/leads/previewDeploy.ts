/**
 * Preview deployment: generate static HTML from AI package and deploy to Vercel.
 * No local filesystem; serverless-safe.
 */

import { generatePreviewHtmlFiles } from "./previewHtmlGenerator";
import { deployToVercel } from "./vercelDeploy";
import type { AiStarterPackage } from "./aiWebsiteStarter";

export interface DeployPreviewResult {
  url: string;
  deploymentId: string;
}

export async function deployPreview(
  leadId: string,
  pkg: AiStarterPackage,
  businessName: string,
  mode: "preview" | "production" = "preview"
): Promise<DeployPreviewResult> {
  const name = businessName || "Your Business";
  const prefix = mode === "production" ? "prod" : "preview";
  const projectName = `${prefix}-${leadId.slice(0, 12)}`.replace(/[^a-z0-9-]/g, "-");

  const files = generatePreviewHtmlFiles(pkg, name);
  const result = await deployToVercel(projectName, files);

  return { url: result.url, deploymentId: result.deploymentId };
}
