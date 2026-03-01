import { registerPlugin } from "./registry";
import type { PluginContext, PluginExecuteResult } from "./types";

/** GCP Integration Plugin. */
registerPlugin({
  id: "gcp",
  name: "GCP Integration",
  description: "Connect GCP project for cloud scan, cost optimization, and deployment.",
  permissions: ["cloud:read", "cloud:write", "deploy", "monitoring:read"],
  billingImpactCents: 0,
  productTracks: ["axiom"],
  async execute(ctx: PluginContext): Promise<PluginExecuteResult> {
    const action = ctx.params.action as string;
    if (!action) return { ok: false, error: "action required" };
    return { ok: true, data: { action, status: "plugin_placeholder", userId: ctx.userId } };
  },
});
