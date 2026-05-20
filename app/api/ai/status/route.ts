/**
 * GET /api/ai/status
 *
 * Returns the configured providers + their default models + the env
 * snapshot. No secrets — only booleans for "is this env var set?".
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import { listModels, PROVIDER_PRIORITY } from "@/lib/ai/AIModelRegistry";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const mgr = getAIProviderManager();
    const status = mgr.status();
    const env = mgr.envSnapshot();
    const active = status.find((s) => s.configured) ?? status[status.length - 1]; // mock if nothing else
    const data = {
      activeProvider: active.provider,
      activeModel: active.defaultModel,
      priority: PROVIDER_PRIORITY,
      providers: status.map((s) => ({
        ...s,
        models: listModels(s.provider),
      })),
      env,
    };
    return apiOk(data, {
      correlationId,
      safetyContract: "audit_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "audit_read_only" });
  }
}
