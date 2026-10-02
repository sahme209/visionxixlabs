/**
 * POST /api/ai/generate
 *
 * Generic text generation through the fallback chain. Operators call
 * this from the settings page "Try it" affordance, but the same route
 * is reusable by feature code.
 *
 * Body: { prompt: string; system?: string; maxTokens?: number;
 *         temperature?: number; only?: AIProviderName; model?: string }
 *
 * Response: AITextResponse + the set of attempted providers (so the
 * UI can show "GitHub Models tried, fell back to Ollama").
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import { isAIProviderName, type AIProviderName } from "@/lib/ai/AIProvider";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

const MAX_PROMPT_CHARS = 8000;

interface PostBody {
  prompt?: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  only?: AIProviderName;
}

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const body = (await req.json().catch(() => null)) as PostBody | null;
    if (!body || typeof body.prompt !== "string" || body.prompt.length === 0) {
      throw AxiomErrors.validation("ai.prompt_required", "Provide a non-empty 'prompt'.");
    }
    if (body.prompt.length > MAX_PROMPT_CHARS) {
      throw AxiomErrors.validation("ai.prompt_too_long", `Prompt exceeds ${MAX_PROMPT_CHARS} chars.`);
    }
    const mgr = getAIProviderManager();
    if (body.only !== undefined && (!isAIProviderName(body.only) || !mgr.isServiceProviderAvailable(body.only))) {
      throw AxiomErrors.validation("ai.provider_unavailable", "That AI provider is not enabled for this workspace.");
    }
    const result = await mgr.generateText(body.prompt, {
      system: body.system,
      maxTokens: typeof body.maxTokens === "number" ? body.maxTokens : undefined,
      temperature: typeof body.temperature === "number" ? body.temperature : undefined,
      model: body.model,
      only: body.only,
      correlationId,
      organizationId: ctx.organizationId,
    });
    return apiOk(result, {
      correlationId,
      safetyContract: "audit_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "audit_read_only" });
  }
}
