/**
 * Plugin execution engine — runs execution plugins with entitlement validation,
 * scope checks, timeout, dry-run support, and audit logging.
 */

import { prisma } from "@/lib/db";
import { getExecutionPlugin } from "@/lib/plugins/executionRegistry";
import { hasAxiomModule, hasPlugin, parseUserModules } from "@/lib/userModules";
import type { ExecutionPluginContext, PluginEntitlements } from "@/lib/plugins/types";

const PLUGIN_TIMEOUT_MS = Number(process.env.PLUGIN_TIMEOUT_MS) || 60_000;

function hashInput(input: unknown): string {
  const str = JSON.stringify(input ?? {});
  let h = 0;
  for (let i = 0; i < Math.min(str.length, 2000); i++) {
    const c = str.charCodeAt(i);
    h = (h << 5) - h + c;
    h = h & h;
  }
  return `h${Math.abs(h).toString(36)}`;
}

function createLogger(executionId: string): ExecutionPluginContext["logger"] {
  return {
    info: (msg, meta) => console.log(`[execution ${executionId}]`, msg, meta ?? ""),
    warn: (msg, meta) => console.warn(`[execution ${executionId}]`, msg, meta ?? ""),
    error: (msg, meta) => console.error(`[execution ${executionId}]`, msg, meta ?? ""),
  };
}

export interface ExecutePluginOptions {
  pluginId: string;
  input?: Record<string, unknown>;
  ctx: {
    userId: string;
    projectId?: string;
    leadId?: string;
    dryRun: boolean;
    userModules?: unknown;
    userPlan?: string | null;
    credentialsKey?: string;
  };
}

export interface ExecutePluginResult {
  executionId: string;
  status: "success" | "failed";
  resultSummary?: string;
  data?: Record<string, unknown>;
  error?: string;
}

function validateEntitlement(
  pluginId: string,
  userModules: unknown,
  userPlan: string | null | undefined,
  pluginPlanRequired?: string,
  options?: { dryRun?: boolean; readOnly?: boolean }
): { ok: true } | { ok: false; error: string } {
  if (!hasAxiomModule(userModules)) {
    return { ok: false, error: "Axiom module required" };
  }
  if (pluginPlanRequired) {
    const plan = (userPlan ?? "").toLowerCase();
    const required = pluginPlanRequired.toLowerCase();
    const tiers = ["starter", "growth", "scale", "enterprise"];
    const planIdx = tiers.indexOf(plan);
    const requiredIdx = tiers.indexOf(required);
    if (requiredIdx >= 0 && (planIdx < 0 || planIdx < requiredIdx)) {
      return { ok: false, error: `Plan ${pluginPlanRequired} or higher required` };
    }
  }
  const parentPlugin = pluginId.split(":")[0];
  const hasPluginAccess = hasPlugin(userModules, pluginId) || hasPlugin(userModules, parentPlugin);
  if (!hasPluginAccess && !(options?.dryRun && options?.readOnly)) {
    return { ok: false, error: `Plugin ${pluginId} (or ${parentPlugin}) not enabled. Add it in Connectors.` };
  }
  return { ok: true };
}

function validateScopes(
  userScopes: string[],
  requiredScopes: string[]
): { ok: true } | { ok: false; error: string } {
  const has = new Set(userScopes.map((s) => s.toLowerCase()));
  for (const s of requiredScopes) {
    const scope = s.toLowerCase();
    if (!has.has(scope)) {
      return { ok: false, error: `Scope ${scope} required` };
    }
  }
  return { ok: true };
}

/**
 * Execute a single plugin with validation, timeout, and logging.
 */
export async function executePlugin(opts: ExecutePluginOptions): Promise<ExecutePluginResult> {
  const { pluginId, input = {}, ctx } = opts;
  const plugin = getExecutionPlugin(pluginId);
  if (!plugin) {
    throw new Error(`Plugin ${pluginId} not found`);
  }

  const userModules = ctx.userModules ?? {};
  const entitlements: PluginEntitlements = {
    plan: ctx.userPlan ?? null,
    purchasedPlugins: parseUserModules(userModules).plugins ?? [],
  };

  const ent = validateEntitlement(
    pluginId,
    userModules,
    ctx.userPlan,
    plugin.planRequired,
    { dryRun: ctx.dryRun, readOnly: plugin.readOnly }
  );
  if (!ent.ok) throw new Error(ent.error);

  const userScopes = ["cloud:read", "cloud:aws"];
  const scopeCheck = validateScopes(userScopes, plugin.scopesRequired);
  if (!scopeCheck.ok) throw new Error(scopeCheck.error);

  if (plugin.readOnly && !ctx.dryRun) {
    throw new Error(`${plugin.name} is read-only and must run with dryRun=true`);
  }

  const inputHash = hashInput(input);
  const executionLog = await prisma.executionLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId ?? null,
      leadId: ctx.leadId ?? null,
      action: "plugin_run",
      pluginId,
      status: "pending",
      dryRun: ctx.dryRun,
      params: input as object,
      inputHash,
      startedAt: new Date(),
    },
  });
  const executionId = executionLog.id;
  const logger = createLogger(executionId);

  const pluginCtx: ExecutionPluginContext = {
    userId: ctx.userId,
    projectId: ctx.projectId,
    leadId: ctx.leadId,
    dryRun: ctx.dryRun,
    entitlements,
    logger,
    credentialsKey: ctx.credentialsKey,
  };

  const timeoutPromise = new Promise<never>((_, rej) =>
    setTimeout(() => rej(new Error(`Plugin timed out after ${PLUGIN_TIMEOUT_MS}ms`)), PLUGIN_TIMEOUT_MS)
  );

  try {
    const result = await Promise.race([
      plugin.run(input, pluginCtx),
      timeoutPromise,
    ]);

    const finishedAt = new Date();
    if (result.ok) {
      await prisma.executionLog.update({
        where: { id: executionId },
        data: {
          status: "success",
          result: result.data as object,
          outputJson: result.data as object,
          finishedAt,
        },
      });
      return {
        executionId,
        status: "success",
        resultSummary: result.summary,
        data: result.data,
      };
    } else {
      await prisma.executionLog.update({
        where: { id: executionId },
        data: {
          status: "failed",
          error: result.error,
          errorMessage: result.error,
          finishedAt,
        },
      });
      return {
        executionId,
        status: "failed",
        resultSummary: result.summary,
        error: result.error,
      };
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await prisma.executionLog.update({
      where: { id: executionId },
      data: {
        status: "failed",
        error: errMsg,
        errorMessage: errMsg,
        finishedAt: new Date(),
      },
    });
    return {
      executionId,
      status: "failed",
      error: errMsg,
    };
  }
}
