import { registerPlugin } from "./registry";
import type { PluginContext, PluginExecuteResult } from "./types";

/** Monitoring & Logs — for Builder projects (Datadog, Vercel Analytics, etc.). */
registerPlugin({
  id: "monitoring-logs",
  name: "Monitoring & Logs",
  description: "Provision monitoring and log aggregation for your deployed site.",
  permissions: ["monitoring:read", "monitoring:write"],
  billingImpactCents: 999,
  productTracks: ["builder"],
  async execute(ctx: PluginContext): Promise<PluginExecuteResult> {
    const projectId = ctx.projectId ?? (ctx.params.projectId as string);
    if (!projectId) return { ok: false, error: "projectId required" };
    return {
      ok: true,
      data: {
        status: "provisioned",
        projectId,
        provider: (ctx.params.provider as string) ?? "vercel-analytics",
      },
    };
  },
});
