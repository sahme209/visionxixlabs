/** Metadata-only projection for an authorized raw Vercel environment response.
 * Never emits values, credentials, comments, IDs, or unknown provider fields.
 * This is an inventory completeness check, not deployment authorization. */
import { pathToFileURL } from "node:url";

export function auditPreviewMetadata(input) {
  const envs = input?.envs;
  if (!Array.isArray(envs)) return { complete: false, reason: "environment_inventory_invalid", variables: [], sharedProductionPreview: [], deploymentAuthorized: false };
  let complete = input.hiddenProductionEnvCount === 0;
  const variables = [];
  for (const row of envs) {
    if (!row || typeof row.key !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(row.key) || !Array.isArray(row.target) || row.target.length === 0 || row.target.some(target => !["production", "preview", "development"].includes(target))) {
      complete = false; continue;
    }
    // Stable custom-environment IDs and shared references also require a
    // separately complete inventory; never silently classify them as safe.
    if (row.customEnvironmentIds?.length || row.sharedEnvVariableId || row.sharedEnvVariableIds?.length) complete = false;
    const branch = row.gitBranch;
    if (branch !== undefined && branch !== null && (typeof branch !== "string" || !/^[A-Za-z0-9_./-]{1,250}$/.test(branch))) { complete = false; continue; }
    variables.push({ name: row.key, targets: [...new Set(row.target)].sort(), ...(branch ? { branch } : {}) });
  }
  const pagination = input.pagination;
  if (pagination !== undefined && pagination !== null) {
    if (typeof pagination !== "object" || Array.isArray(pagination)
      || (pagination.hasMore !== undefined && typeof pagination.hasMore !== "boolean")
      || pagination.next != null || pagination.hasMore === true) complete = false;
  }
  return { complete, reason: complete ? "metadata_only_not_isolation_proof" : "inventory_incomplete", variables,
    sharedProductionPreview: variables.filter(row => row.targets.includes("production") && row.targets.includes("preview")).map(row => row.name),
    deploymentAuthorized: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const chunks = []; let bytes = 0;
  try {
    for await (const chunk of process.stdin) { bytes += chunk.length; if (bytes > 4 * 1024 * 1024) throw new Error("input_limit"); chunks.push(chunk); }
    const report = auditPreviewMetadata(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`); process.exitCode = report.complete ? 0 : 2;
  } catch { process.stderr.write("Metadata input is invalid or exceeds the bounded input limit. No input content was logged.\n"); process.exitCode = 2; }
}
