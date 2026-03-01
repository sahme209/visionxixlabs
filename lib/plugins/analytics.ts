import { registerPlugin } from "./registry";
import type { PluginContext, PluginExecuteResult } from "./types";

/** Analytics Plugin — GA, Plausible, etc. */
registerPlugin({
  id: "analytics",
  name: "Analytics",
  description: "Add analytics tracking (Google Analytics, Plausible) to your site.",
  permissions: ["analytics:read", "analytics:write"],
  billingImpactCents: 499,
  productTracks: ["builder"],
  async execute(ctx: PluginContext): Promise<PluginExecuteResult> {
    const provider = (ctx.params.provider as string) ?? "plausible";
    return { ok: true, data: { provider, status: "plugin_placeholder", projectId: ctx.projectId } };
  },
});
