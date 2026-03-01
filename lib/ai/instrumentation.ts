/**
 * PII-safe AI invocation logging.
 * No full prompts — store promptHash + truncated preview (max 200 chars).
 */

import { prisma } from "@/lib/db";

function hashPrompt(s: string): string {
  let h = 0;
  const str = String(s).slice(0, 2000);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h = (h << 5) - h + c;
    h = h & h;
  }
  return `h${Math.abs(h).toString(36)}`;
}

function truncatePreview(s: string, max = 200): string {
  const t = String(s).trim().slice(0, max);
  return t.length >= max ? t + "…" : t;
}

export interface LogInvocationParams {
  userId?: string | null;
  taskType: string;
  provider: string;
  model: string;
  latencyMs?: number;
  success: boolean;
  errorMessage?: string | null;
  tokensIn?: number;
  tokensOut?: number;
  promptPreview?: string;
  promptHash?: string;
  requestId?: string;
}

export async function logAIInvocation(params: LogInvocationParams): Promise<void> {
  try {
    const preview = params.promptPreview != null
      ? truncatePreview(params.promptPreview)
      : null;
    const hash = params.promptHash ?? (params.promptPreview ? hashPrompt(params.promptPreview) : null);

    await prisma.aIInvocation.create({
      data: {
        userId: params.userId ?? undefined,
        taskType: params.taskType,
        provider: params.provider,
        model: params.model,
        latencyMs: params.latencyMs ?? undefined,
        success: params.success,
        errorMessage: params.errorMessage ?? undefined,
        tokensIn: params.tokensIn ?? undefined,
        tokensOut: params.tokensOut ?? undefined,
        promptHash: hash ?? undefined,
        promptPreview: preview ?? undefined,
        requestId: params.requestId ?? undefined,
      },
    });
  } catch (e) {
    console.error("[AI instrumentation] log failed:", e);
  }
}
