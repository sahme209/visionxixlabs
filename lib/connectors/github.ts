import type { ConnectorStatus } from "./types";

/**
 * Phase 5: GitHub connector — read-only repo metadata.
 * Optional: real validation via GitHub API.
 */
export async function validateGithubConnection(token: string): Promise<{
  valid: boolean;
  status: ConnectorStatus;
  error?: string;
}> {
  if (!token || typeof token !== "string" || token.trim().length < 10) {
    return { valid: false, status: "error", error: "Invalid token format" };
  }
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    if (res.ok) return { valid: true, status: "linked" };
    return {
      valid: false,
      status: "error",
      error: res.status === 401 ? "Invalid or expired token" : `GitHub API error: ${res.status}`,
    };
  } catch (e) {
    return {
      valid: false,
      status: "error",
      error: e instanceof Error ? e.message : "Connection failed",
    };
  }
}
