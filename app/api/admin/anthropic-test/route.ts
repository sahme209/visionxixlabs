/**
 * Legacy route name retained for compatibility. The check is Gateway-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const manager = getAIProviderManager();
  if (!manager.isServiceProviderAvailable("vercel_gateway")) {
    return NextResponse.json({
      ok: false,
      stage: "env_check",
      reason: "Vercel AI Gateway is not configured.",
    });
  }

  try {
    const response = await manager.generateText("Reply with exactly: Axiom online.", {
      only: "vercel_gateway", maxTokens: 50, temperature: 0, correlationId: "admin-gateway-health",
    });

    return NextResponse.json({
      ok: true,
      stage: "vercel_ai_gateway",
      model: response.model,
      reply: response.text,
      usage: {
        inputTokens: response.usage?.promptTokens ?? 0,
        outputTokens: response.usage?.completionTokens ?? 0,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      stage: "vercel_ai_gateway",
      reason: msg,
    });
  }
}
