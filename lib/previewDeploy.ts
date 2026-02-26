import { generateSiteFiles } from "./scaffoldGenerator";
import type { AIStarterPackage } from "./aiWebsiteStarter";

const VERCEL_API = "https://api.vercel.com";

export type DeployResult = {
  url: string;
  deploymentId: string;
  state: string;
};

/**
 * Deploy generated site to Vercel and return preview URL.
 */
export async function deployPreview(
  pkg: AIStarterPackage,
  projectName: string
): Promise<DeployResult> {
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token) {
    throw new Error("VERCEL_TOKEN is required");
  }

  const files = generateSiteFiles(pkg);

  // Vercel Deployments API: create deployment from inline files
  const body = {
    name: projectName,
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

  const res = await fetch(`${VERCEL_API}/v13/deployments`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vercel deploy failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    url?: string;
    id?: string;
    readyState?: string;
    alias?: string[];
  };

  const url = data.url || data.alias?.[0] || `https://${data.id}.vercel.app`;
  return {
    url: url.startsWith("http") ? url : `https://${url}`,
    deploymentId: data.id || "",
    state: data.readyState || "BUILDING",
  };
}
