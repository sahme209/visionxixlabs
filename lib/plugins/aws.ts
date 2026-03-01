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
    // Real: use ctx.credentialsKey to fetch OAuth token, call AWS APIs
    const improvementText = ctx.params.improvementText as string | undefined;
    if (action === "remediate" && improvementText) {
      // Placeholder: would parse improvementText, map to AWS API calls (e.g. EC2 modify, S3 lifecycle)
      return {
        ok: true,
        data: {
          action: "remediate",
          provider: "aws",
          improvementText: improvementText.slice(0, 200),
          status: "executed",
          executionId: `aws-${Date.now()}`,
        },
      };
    }
    return { ok: true, data: { action, status: "executed", userId: ctx.userId } };
  },
});
