import { generateSiteFiles, generateSiteFilesFromPlan, type WebsiteBuilderPlan } from "../scaffoldGenerator";
import type { AIStarterPackage } from "@/lib/websiteStarter/engine";

export type DeployProvider = "vercel" | "aws" | "azure" | "gcp";
export class UnsupportedDeploymentProviderError extends Error {
  readonly code = "deployment_provider_not_supported";
  constructor() {
    super("Deployment provider is not supported by the website preview service.");
    this.name = "UnsupportedDeploymentProviderError";
  }
}

function assertSupportedProvider(provider: unknown): asserts provider is "vercel" {
  if (provider !== "vercel") throw new UnsupportedDeploymentProviderError();
}

export type DeployResult = { url: string; deploymentId: string; state: string; target?: string };

export type DeployOptions = {
  projectName: string;
  target?: "production";
  credentials?: Record<string, string>;
};

/**
 * Deploy from website-builder plan (full HTML).
 */
export async function deploySiteFromPlan(
  provider: DeployProvider,
  plan: WebsiteBuilderPlan,
  options: DeployOptions
): Promise<DeployResult> {
  assertSupportedProvider(provider);
  const files = generateSiteFilesFromPlan(plan);
  if (files.length === 0) throw new Error("No HTML generated from plan");
  return deployToVercel(files, options);
}

/**
 * Provider abstraction for multi-cloud deploy.
 * deploySite(provider, pkg, options) — generates files and deploys to chosen provider.
 */
export async function deploySite(
  provider: DeployProvider,
  pkg: AIStarterPackage,
  options: DeployOptions
): Promise<DeployResult> {
  assertSupportedProvider(provider);
  const files = generateSiteFiles(pkg);

  return deployToVercel(files, options);
}

async function deployToVercel(
  files: { path: string; content: string }[],
  options: DeployOptions
): Promise<DeployResult> {
  const token = process.env.VERCEL_TOKEN || options.credentials?.vercelToken;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token) {
    return {
      url: "",
      deploymentId: "managed-pending",
      state: "PENDING",
    };
  }

  const body = {
    name: options.projectName,
    ...(options.target ? { target: options.target } : {}),
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

  const data = (await res.json()) as { url?: unknown; id?: unknown; readyState?: unknown; state?: unknown; target?: unknown; alias?: unknown };
  const rawUrl = typeof data.url === "string" ? data.url : Array.isArray(data.alias) && typeof data.alias[0] === "string" ? data.alias[0] : "";
  let url = "";
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`);
      if (parsed.protocol === "https:" && !parsed.username && !parsed.password) url = rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`;
    } catch { /* an accepted request need not have a serving URL */ }
  }
  const reportedState = typeof data.readyState === "string" ? data.readyState : typeof data.state === "string" ? data.state : "UNKNOWN";
  return {
    url,
    deploymentId: typeof data.id === "string" ? data.id : "",
    state: reportedState.toUpperCase(),
    ...(typeof data.target === "string" ? { target: data.target } : {}),
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
