import { registerPlugin } from "./registry";
import type { PluginContext, PluginExecuteResult } from "./types";

/** Managed Hosting — provisions hosting for Builder projects (Vercel, etc.). */
registerPlugin({
  id: "hosting",
  name: "Managed Hosting",
  description: "Provision managed hosting with CDN, SSL, and global edge.",
  permissions: ["deploy"],
  billingImpactCents: 0,
  productTracks: ["builder"],
  async execute(ctx: PluginContext): Promise<PluginExecuteResult> {
    const projectId = ctx.projectId ?? ctx.params.projectId as string;
    if (!projectId) return { ok: false, error: "projectId required" };
    // Real: call Vercel API / hosting provider API via credentialsKey
    return {
      ok: true,
      data: {
        status: "provisioned",
        projectId,
        provider: (ctx.params.provider as string) ?? "vercel",
        url: `https://${projectId}.vercel.app`,
      },
    };
  },
});
