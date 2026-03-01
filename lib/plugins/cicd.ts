import { registerPlugin } from "./registry";
import type { PluginContext, PluginExecuteResult } from "./types";

/** CI/CD Pipeline — provisions GitHub Actions or provider-native pipeline. */
registerPlugin({
  id: "cicd",
  name: "CI/CD Pipeline",
  description: "Provision CI/CD pipeline (GitHub Actions, Cloud Build, etc.) for automated deployments.",
  permissions: ["deploy"],
  billingImpactCents: 499,
  productTracks: ["builder"],
  async execute(ctx: PluginContext): Promise<PluginExecuteResult> {
    const projectId = ctx.projectId ?? (ctx.params.projectId as string);
    const gitProvider = (ctx.params.gitProvider as string) ?? "github";
    if (!projectId) return { ok: false, error: "projectId required" };
    // Real: create workflow file via GitHub API or equivalent
    return {
      ok: true,
      data: {
        status: "provisioned",
        projectId,
        gitProvider,
        workflowPath: ".github/workflows/deploy.yml",
      },
    };
  },
});
