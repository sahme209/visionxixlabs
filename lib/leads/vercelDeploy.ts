/**
 * Deploy static files to Vercel via Deployments API.
 * Env: VERCEL_TOKEN, VERCEL_TEAM_ID (optional)
 */

export interface VercelDeployResult {
  url: string;
  deploymentId: string;
  status: string;
}

function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "preview";
}

export async function deployToVercel(
  projectName: string,
  files: Array<{ file: string; data: string }>
): Promise<VercelDeployResult> {
  const token = process.env.VERCEL_TOKEN;
  if (!token?.trim()) {
    throw new Error("VERCEL_TOKEN is required for preview deployment");
  }

  const safeName = sanitizeProjectName(projectName);
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  const url = new URL("https://api.vercel.com/v13/deployments");
  if (teamId) url.searchParams.set("teamId", teamId);

  const body = {
    name: safeName,
    files: files.map((f) => ({
      file: f.file,
      data: f.data,
      encoding: "utf-8" as const,
    })),
  };

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vercel deploy failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    url?: string | null;
    id?: string;
    readyState?: string;
  };

  const deploymentUrl =
    data.url && typeof data.url === "string" && data.url.startsWith("http")
      ? data.url
      : data.id
        ? `https://${safeName}-${String(data.id).slice(0, 9)}.vercel.app`
        : `https://${safeName}.vercel.app`;

  return {
    url: deploymentUrl,
    deploymentId: data.id || "",
    status: data.readyState || "BUILDING",
  };
}
