import type { DeployResult } from "./provider";

export function isWebsiteDeploymentReady(result: DeployResult): boolean {
  if (result.state !== "READY" || !/^dpl_[a-zA-Z0-9]+$/.test(result.deploymentId)) return false;
  try { const url = new URL(result.url); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}

/** A deployment receipt is not a serving URL or proof of successful publication. */
export function websiteDeploymentUpdate(input: {
  result: DeployResult;
  payload: Record<string, unknown>;
  previousStatus: string;
  kind: "preview" | "production";
}): { ready: boolean; status: string; payload: Record<string, unknown> } {
  const { result, payload, previousStatus, kind } = input;
  if (["ERROR", "CANCELED", "CANCELLED"].includes(result.state)) throw new Error("website_deployment_failed");
  const ready = isWebsiteDeploymentReady(result) && (kind !== "production" || result.target === "production");
  const hasWorkingPreview = ["deploy_ready", "published"].includes(previousStatus) && typeof payload.previewUrl === "string" && Boolean(payload.previewUrl);
  const status = ready ? kind === "production" ? "published" : previousStatus === "published" ? "published" : "deploy_ready"
    : hasWorkingPreview || kind === "production" ? previousStatus
    : result.deploymentId === "managed-pending" ? "package_ready" : "deploy_generating";
  const updatedPayload: Record<string, unknown> = {
      ...payload,
      [kind === "preview" ? "previewDeployment" : "productionDeployment"]: {
        deploymentId: result.deploymentId || null,
        state: ready ? "READY" : result.state === "READY" ? "UNKNOWN" : result.state,
        candidateUrl: result.url || null,
        target: result.target ?? null,
      },
      ...(kind === "preview" ? {
        deployStatus: ready ? "ready" : result.deploymentId === "managed-pending" ? "managed_pending" : "deployment_pending",
        ...(ready ? { previewUrl: result.url, vercelDeploymentId: result.deploymentId } : {}),
      } : ready ? { productionUrl: result.url, productionDeploymentId: result.deploymentId, publishedAt: new Date().toISOString() } : {}),
  };
  if (kind === "preview" && ready) {
    delete updatedPayload.pendingAiPackage;
    delete updatedPayload.pendingAiPackageDeploymentId;
  }
  return { ready, status, payload: updatedPayload };
}

export function websiteDeploymentPending(payload: Record<string, unknown>): boolean {
  return ["previewDeployment", "productionDeployment"].some((key) => {
    const receipt = payload[key] as { state?: unknown } | undefined;
    return Boolean(receipt && !["READY", "ERROR", "CANCELED", "CANCELLED"].includes(String(receipt.state)));
  });
}

/** A known no-dispatch configuration block is safe for explicit operator retry. */
export function websiteDeploymentAwaitingProvider(payload: Record<string, unknown>): boolean {
  return ["previewDeployment", "productionDeployment"].some((key) => {
    const receipt = payload[key] as { state?: unknown; deploymentId?: unknown } | undefined;
    return Boolean(receipt && receipt.deploymentId !== "managed-pending" && !["READY", "ERROR", "CANCELED", "CANCELLED"].includes(String(receipt.state)));
  });
}
