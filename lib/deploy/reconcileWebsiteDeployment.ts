import "server-only";
import { observeWebsiteDeployment } from "./observeWebsiteDeployment";
import { websiteDeploymentUpdate } from "./websiteDeploymentState";

export async function reconcileWebsiteDeployment(lead: { id: string; status: string; fullPayload: unknown }): Promise<{ status: string; payload: Record<string, unknown>; changed: boolean }> {
  let status = lead.status;
  let payload = (lead.fullPayload as Record<string, unknown>) || {};
  let changed = false;
  for (const kind of ["preview", "production"] as const) {
    const key = kind === "preview" ? "previewDeployment" : "productionDeployment";
    const receipt = payload[key] as { deploymentId?: unknown; state?: unknown } | undefined;
    if (!receipt || typeof receipt.deploymentId !== "string" || ["READY", "ERROR", "CANCELED", "CANCELLED"].includes(String(receipt.state))) continue;
    let observed;
    try { observed = await observeWebsiteDeployment(receipt.deploymentId); } catch { continue; }
    if (!observed || !["READY", "ERROR", "CANCELED", "CANCELLED"].includes(observed.state)) continue;
    if (observed.state !== "READY") {
      payload = { ...payload, [key]: { ...receipt, state: observed.state }, ...(kind === "preview" ? { deployStatus: "deployment_failed" } : {}) };
      if (kind === "preview") {
        delete payload.pendingAiPackage;
        delete payload.pendingAiPackageDeploymentId;
      }
      if (status === "deploy_generating") status = "package_ready";
      changed = true;
      continue;
    }
    const matchingPendingPackage = kind === "preview" && payload.pendingAiPackageDeploymentId === observed.deploymentId ? payload.pendingAiPackage : undefined;
    const update = websiteDeploymentUpdate({ result: observed, payload, previousStatus: status, kind });
    if (!update.ready) continue;
    status = update.status;
    payload = update.payload;
    if (matchingPendingPackage) payload = { ...payload, aiPackage: matchingPendingPackage };
    changed = true;
  }
  return { status, payload, changed };
}

export { websiteDeploymentPending } from "./websiteDeploymentState";
