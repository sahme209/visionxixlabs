/**
 * Plugin execution engine — runs execution plugins with entitlement validation,
 * scope checks, timeout, dry-run support, and audit logging.
 */

import { prisma } from "@/lib/db";
import { getExecutionPlugin } from "@/lib/plugins/executionRegistry";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import type { ExecutionPluginContext, PluginEntitlements, PluginResult } from "@/lib/plugins/types";

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
    userPlan?: string | null;
    credentialsKey?: string;
  };
  /** When true, skip entitlement check (trusted agent context only) */
  skipEntitlementCheck?: boolean;
}

export interface ExecutePluginResult {
  executionId: string;
  status: "success" | "failed";
  resultSummary?: string;
  data?: Record<string, unknown>;
  error?: string;
}

function validateEntitlement(
  userPlan: string | null | undefined,
  pluginPlanRequired?: string
): { ok: true } | { ok: false; error: string } {
  const ent = getEntitlementsFromPlan(userPlan);
  if (!ent.axiomExecution) {
    return { ok: false, error: "Scale or Enterprise plan required for execution" };
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
  const { pluginId, input = {}, ctx, skipEntitlementCheck } = opts;
  const plugin = getExecutionPlugin(pluginId);
  if (!plugin) {
    throw new Error(`Plugin ${pluginId} not found`);
  }

  if (!skipEntitlementCheck) {
    const ent = validateEntitlement(ctx.userPlan, plugin.planRequired);
    if (!ent.ok) throw new Error(ent.error);
  }

  const pluginEntitlements: PluginEntitlements = {
    plan: ctx.userPlan ?? null,
    purchasedPlugins: [], // plan-based; scale+ gets all plugins
  };

  const userScopes = ["cloud:read", "cloud:aws", "cloud:write"];
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
    entitlements: pluginEntitlements,
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
    const rollbackSteps = (result as PluginResult).rollbackHints ?? [];
    if (result.ok) {
      await prisma.executionLog.update({
        where: { id: executionId },
        data: {
          status: "success",
          result: result.data as object,
          outputJson: result.data as object,
          rollbackSteps,
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
