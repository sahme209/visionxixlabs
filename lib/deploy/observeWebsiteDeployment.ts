import "server-only";
import type { DeployResult } from "./provider";

/** Read-only, bounded observation of an ID saved from a prior create response. */
export async function observeWebsiteDeployment(deploymentId: string): Promise<DeployResult | null> {
  const token = process.env.VERCEL_TOKEN;
  if (!token || !/^dpl_[a-zA-Z0-9]+$/.test(deploymentId)) return null;
  const teamId = process.env.VERCEL_TEAM_ID;
  const response = await fetch(`https://api.vercel.com/v13/deployments/${encodeURIComponent(deploymentId)}${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) return null;
  const data = await response.json() as { id?: unknown; readyState?: unknown; state?: unknown; target?: unknown; url?: unknown };
  if (data.id !== deploymentId) return null;
  const state = typeof data.readyState === "string" ? data.readyState : typeof data.state === "string" ? data.state : "UNKNOWN";
  let url = "";
  if (typeof data.url === "string" && data.url) {
    try {
      const parsed = new URL(data.url.includes("://") ? data.url : `https://${data.url}`);
      if (parsed.protocol === "https:" && !parsed.username && !parsed.password) url = parsed.href;
    } catch { /* no serving URL */ }
  }
  return { deploymentId, state: state.toUpperCase(), url, ...(typeof data.target === "string" ? { target: data.target } : {}) };
}
