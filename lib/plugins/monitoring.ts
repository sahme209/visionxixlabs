import { registerPlugin } from "./registry";
import type { PluginContext, PluginExecuteResult } from "./types";

/** Monitoring Plugin — Datadog, New Relic, etc. */
registerPlugin({
  id: "monitoring",
  name: "Monitoring",
  description: "Connect monitoring and observability tools.",
  permissions: ["monitoring:read", "monitoring:write"],
  billingImpactCents: 999,
  productTracks: ["axiom"],
  async execute(ctx: PluginContext): Promise<PluginExecuteResult> {
    const provider = (ctx.params.provider as string) ?? "datadog";
    return { ok: true, data: { provider, status: "plugin_placeholder", userId: ctx.userId } };
  },
});
