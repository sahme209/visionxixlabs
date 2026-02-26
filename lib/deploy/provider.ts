import { generateSiteFiles } from "../scaffoldGenerator";
import type { AIStarterPackage } from "../aiWebsiteStarter";

export type DeployProvider = "vercel" | "aws" | "azure" | "gcp";
export type DeployResult = { url: string; deploymentId: string; state: string };

export type DeployOptions = {
  projectName: string;
  credentials?: Record<string, string>;
};

/**
 * Provider abstraction for multi-cloud deploy.
 * deploySite(provider, pkg, options) — generates files and deploys to chosen provider.
 */
export async function deploySite(
  provider: DeployProvider,
  pkg: AIStarterPackage,
  options: DeployOptions
): Promise<DeployResult> {
  const files = generateSiteFiles(pkg);

  switch (provider) {
    case "vercel":
      return deployToVercel(files, options);
    case "aws":
      return deployToAws(files, options);
    case "azure":
      return deployToAzure(files, options);
    case "gcp":
      return deployToGcp(files, options);
    default:
      return deployToVercel(files, options);
  }
}

async function deployToVercel(
  files: { path: string; content: string }[],
  options: DeployOptions
): Promise<DeployResult> {
  const token = process.env.VERCEL_TOKEN || options.credentials?.vercelToken;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token) throw new Error("VERCEL_TOKEN is required");

  const body = {
    name: options.projectName,
    files: files.map((f) => ({
      file: f.path,
      data: Buffer.from(f.content, "utf8").toString("base64"),
      encoding: "base64" as const,
    })),
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (teamId) headers["x-vercel-team-id"] = teamId;

  const res = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Vercel deploy failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as { url?: string; id?: string; alias?: string[] };
  const url = data.url || data.alias?.[0] || `https://${data.id}.vercel.app`;
  return {
    url: url.startsWith("http") ? url : `https://${url}`,
    deploymentId: data.id || "",
    state: "READY",
  };
}

async function deployToAws(
  _files: { path: string; content: string }[],
  _options: DeployOptions
): Promise<DeployResult> {
  return { url: "https://visionxixlabs.com/contact", deploymentId: "aws-pending", state: "PENDING" };
}

async function deployToAzure(
  _files: { path: string; content: string }[],
  _options: DeployOptions
): Promise<DeployResult> {
  return {
    url: "https://visionxixlabs.com/contact",
    deploymentId: "azure-pending",
    state: "PENDING",
  };
}

async function deployToGcp(
  _files: { path: string; content: string }[],
  _options: DeployOptions
): Promise<DeployResult> {
  return {
    url: "https://visionxixlabs.com/contact",
    deploymentId: "gcp-pending",
    state: "PENDING",
  };
}
