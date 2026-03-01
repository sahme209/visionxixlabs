import { registerPlugin } from "./registry";
import type { PluginContext, PluginExecuteResult } from "./types";

/** CRM Plugin — HubSpot, Salesforce, etc. */
registerPlugin({
  id: "crm",
  name: "CRM",
  description: "Connect CRM for lead capture and contact sync.",
  permissions: ["crm:read", "crm:write"],
  billingImpactCents: 999,
  productTracks: ["builder"],
  async execute(ctx: PluginContext): Promise<PluginExecuteResult> {
    const provider = (ctx.params.provider as string) ?? "hubspot";
    return { ok: true, data: { provider, status: "plugin_placeholder", projectId: ctx.projectId } };
  },
});
