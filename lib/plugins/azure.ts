import { registerPlugin } from "./registry";
import type { PluginContext, PluginExecuteResult } from "./types";

/** Azure Integration Plugin. */
registerPlugin({
  id: "azure",
  name: "Azure Integration",
  description: "Connect Azure subscription for cloud scan, cost optimization, and deployment.",
  permissions: ["cloud:read", "cloud:write", "deploy", "monitoring:read"],
  billingImpactCents: 0,
  productTracks: ["axiom"],
  async execute(ctx: PluginContext): Promise<PluginExecuteResult> {
    const action = ctx.params.action as string;
    if (!action) return { ok: false, error: "action required" };
    const improvementText = ctx.params.improvementText as string | undefined;
    if (action === "remediate" && improvementText) {
      return {
        ok: true,
        data: {
          action: "remediate",
          provider: "azure",
          improvementText: improvementText.slice(0, 200),
          status: "executed",
          executionId: `azure-${Date.now()}`,
        },
      };
    }
    return { ok: true, data: { action, status: "executed", userId: ctx.userId } };
  },
});
