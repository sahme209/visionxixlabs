import { registerPlugin } from "./registry";
import type { PluginContext, PluginExecuteResult } from "./types";

/** AWS Integration Plugin — scan, deploy, cost data. */
registerPlugin({
  id: "aws",
  name: "AWS Integration",
  description: "Connect AWS account for cloud scan, cost optimization, and deployment.",
  permissions: ["cloud:read", "cloud:write", "deploy", "monitoring:read"],
  billingImpactCents: 0,
  productTracks: ["axiom"],
  async execute(ctx: PluginContext): Promise<PluginExecuteResult> {
    const action = ctx.params.action as string;
    if (!action) return { ok: false, error: "action required" };
    // Placeholder: real execution would use ctx.credentialsKey to fetch OAuth token
    // and call AWS APIs (Cost Explorer, CloudFormation, etc.)
    return { ok: true, data: { action, status: "plugin_placeholder", userId: ctx.userId } };
  },
});
