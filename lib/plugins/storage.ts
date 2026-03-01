import { registerPlugin } from "./registry";
import type { PluginContext, PluginExecuteResult } from "./types";

/** Storage — S3 / Blob / GCS for Builder projects. */
registerPlugin({
  id: "storage",
  name: "Storage",
  description: "Provision object storage (S3, Azure Blob, or GCS) for your site assets.",
  permissions: ["storage"],
  billingImpactCents: 499,
  productTracks: ["builder"],
  async execute(ctx: PluginContext): Promise<PluginExecuteResult> {
    const projectId = ctx.projectId ?? (ctx.params.projectId as string);
    const provider = (ctx.params.provider as string) ?? "s3";
    if (!projectId) return { ok: false, error: "projectId required" };
    // Real: create bucket via AWS/Azure/GCP SDK using credentialsKey
    return {
      ok: true,
      data: {
        status: "provisioned",
        projectId,
        provider,
        bucketName: `visionxix-${projectId}-${Date.now().toString(36)}`,
      },
    };
  },
});
