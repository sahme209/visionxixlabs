/**
 * AI invocation logging with canonical known-credential redaction.
 * No full prompts — store promptHash + truncated preview (max 200 chars).
 * Pattern redaction does not establish general PII removal.
 */

import { prisma } from "@/lib/db";
import { redact } from "@/lib/security/redaction";

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
    // Redact before truncation: cutting a token first can make its remaining
    // prefix too short for the canonical credential pattern to recognize.
    const safePrompt = params.promptPreview == null ? null : redact(params.promptPreview);
    const preview = safePrompt != null
      ? truncatePreview(safePrompt)
      : null;
    // Optional supplied fingerprints are not a free-form logging field.
    // Preserve legacy h/base36 and common hexadecimal digest encodings.
    const suppliedHash = params.promptHash;
    const hash = typeof suppliedHash === "string" && /^(?:h[a-z0-9]{1,7}|[a-fA-F0-9]{32,128})$/.test(suppliedHash)
      ? suppliedHash
      : safePrompt ? hashPrompt(safePrompt) : null;

    await prisma.aIInvocation.create({
      data: {
        userId: params.userId ?? undefined,
        taskType: redact(params.taskType),
        provider: redact(params.provider),
        model: redact(params.model),
        latencyMs: params.latencyMs ?? undefined,
        success: params.success,
        errorMessage: params.errorMessage == null ? undefined : redact(params.errorMessage),
        tokensIn: params.tokensIn ?? undefined,
        tokensOut: params.tokensOut ?? undefined,
        promptHash: hash ?? undefined,
        promptPreview: preview ?? undefined,
        // Correlation IDs are identifiers, not a free-form diagnostic channel.
        requestId: params.requestId != null && redact(params.requestId) === params.requestId ? params.requestId : undefined,
      },
    });
  } catch {
    // Prisma errors can repeat supplied row values. A diagnostic label is
    // sufficient here; logging the error object would bypass this boundary.
    console.error("[AI instrumentation] log failed");
  }
}
