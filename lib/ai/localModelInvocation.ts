/**
 * Local AI model invocation contract.
 *
 * Pure / no I/O. Defines the typed shape that every agent kernel must
 * use when invoking a local-mode model via the desktop runtime. The
 * runtime refuses any invocation that doesn't conform. Three guard
 * layers:
 *   1. PII redaction at the boundary — prompt text is scanned for
 *      common PII patterns BEFORE leaving the platform process
 *   2. Bounded inputs — token budget + max prompt chars enforced
 *   3. Output validator — closed-union expectedShape lets us refuse
 *      garbage output before it ever reaches a downstream kernel
 *
 * Reference: model status comes from the Model Registry; only models
 * with status="approved" or "installed" can be invoked. The contract
 * REFUSES candidates / evaluating / rejected status outright.
 */

import type { ModelStatus, RiskLevel } from "@/lib/platform/platformSeedData";

export type LocalModelMode = "local" | "cloud" | "hybrid";

export type LocalModelType = "coding" | "reasoning" | "embedding" | "log_analysis" | "doc";

export type ExpectedOutputShape =
  | "free_text"          // any text — least strict, default
  | "json"               // must parse as JSON
  | "yaml"               // must parse as YAML
  | "single_token"       // one-word classification (e.g. "yes" / "no")
  | "embedding_vector";  // numeric vector, validates length

export interface LocalModelInvocation {
  /** Model id from the Model Registry. */
  modelId: string;
  /** Agent kernel module that initiated the call (for audit). */
  callingKernel: string;
  /** Prompt text — will be scanned + bounded before dispatch. */
  prompt: string;
  /** Maximum tokens the runtime should generate. */
  maxOutputTokens: number;
  /** Closed-union shape the kernel expects to validate. */
  expectedShape: ExpectedOutputShape;
  /** For embedding_vector — expected dimensionality. */
  expectedEmbeddingDims?: number;
  /** Operator-readable rationale shown on the local-approval prompt. */
  reason: string;
}

export interface RegisteredModel {
  id: string;
  status: ModelStatus;
  mode: LocalModelMode;
  modelType: LocalModelType;
  riskLevel: RiskLevel;
  supportedAgents: ReadonlyArray<string>;
  /** Maximum prompt characters the model can accept. */
  maxPromptChars: number;
  /** Maximum tokens the model can generate. */
  maxOutputTokens: number;
}

export type InvocationGuardError =
  | "model_unknown"
  | "model_not_approved"
  | "agent_not_supported"
  | "prompt_too_long"
  | "tokens_too_high"
  | "pii_detected"
  | "missing_expected_dims"
  | "invocation_refused";

export interface InvocationGuardResult {
  ok: boolean;
  /** When ok=false, the closed-union error code. */
  error?: InvocationGuardError;
  message?: string;
  /** Redacted prompt — present when ok=true, with PII placeholders. */
  redactedPrompt?: string;
  /** Hash of the canonical invocation (sha-256-style, opaque) — emitted
   * by the caller into the audit row. We return a deterministic key
   * the auditor can hash. */
  invocationFingerprint?: string;
}

// PII patterns — conservative subset; the real platform layer extends
// these. We catch common high-risk patterns at the boundary.
const PII_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp; replacement: string }> = [
  { name: "email",            pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,                         replacement: "[REDACTED_EMAIL]" },
  { name: "ipv4",             pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,                          replacement: "[REDACTED_IPV4]" },
  { name: "aws_access_key",   pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,                        replacement: "[REDACTED_AWS_KEY]" },
  { name: "credit_card",      pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,              replacement: "[REDACTED_CC]" },
  { name: "stripe_key",       pattern: /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{20,}\b/g,      replacement: "[REDACTED_STRIPE]" },
  { name: "github_token",     pattern: /\bghp_[A-Za-z0-9]{20,}\b/g,                             replacement: "[REDACTED_GITHUB]" },
];

function scanAndRedact(prompt: string): { redacted: string; hits: string[] } {
  let redacted = prompt;
  const hits: string[] = [];
  for (const p of PII_PATTERNS) {
    if (p.pattern.test(redacted)) {
      hits.push(p.name);
      redacted = redacted.replace(p.pattern, p.replacement);
    }
  }
  return { redacted, hits };
}

function fingerprintInputs(invocation: LocalModelInvocation, redactedPrompt: string): string {
  // Stable string for the auditor to hash. The auditor wraps this in
  // sha-256 before persisting — that step is outside this module.
  const parts = [
    `model=${invocation.modelId}`,
    `kernel=${invocation.callingKernel}`,
    `shape=${invocation.expectedShape}`,
    `tokens=${invocation.maxOutputTokens}`,
    `dims=${invocation.expectedEmbeddingDims ?? "-"}`,
    `prompt_chars=${redactedPrompt.length}`,
    `prompt_head=${redactedPrompt.slice(0, 32).replace(/\s+/g, "_")}`,
  ];
  return parts.join("|");
}

/**
 * Guard an invocation before dispatch. Returns ok+redactedPrompt+
 * fingerprint OR an error code. Calling kernels MUST check `ok`
 * before sending the request to the local runtime.
 */
export function guardInvocation(
  invocation: LocalModelInvocation,
  model: RegisteredModel | undefined,
  options: { allowEmbeddedSecrets?: boolean } = {},
): InvocationGuardResult {
  if (!model) {
    return { ok: false, error: "model_unknown", message: `Model ${invocation.modelId} is not in the registry.` };
  }
  if (model.status !== "approved" && model.status !== "installed") {
    return {
      ok: false,
      error: "model_not_approved",
      message: `Model ${model.id} is status=${model.status}; only approved / installed models can be invoked.`,
    };
  }
  if (!model.supportedAgents.includes(invocation.callingKernel)) {
    return {
      ok: false,
      error: "agent_not_supported",
      message: `Kernel ${invocation.callingKernel} is not in supportedAgents for ${model.id}.`,
    };
  }
  if (invocation.prompt.length > model.maxPromptChars) {
    return {
      ok: false,
      error: "prompt_too_long",
      message: `Prompt is ${invocation.prompt.length} chars; model ${model.id} max is ${model.maxPromptChars}.`,
    };
  }
  if (invocation.maxOutputTokens > model.maxOutputTokens) {
    return {
      ok: false,
      error: "tokens_too_high",
      message: `Requested ${invocation.maxOutputTokens} tokens; model ${model.id} max is ${model.maxOutputTokens}.`,
    };
  }
  if (invocation.expectedShape === "embedding_vector" && !invocation.expectedEmbeddingDims) {
    return {
      ok: false,
      error: "missing_expected_dims",
      message: "expectedEmbeddingDims is required when expectedShape=embedding_vector.",
    };
  }

  const { redacted, hits } = scanAndRedact(invocation.prompt);
  if (hits.length > 0 && !options.allowEmbeddedSecrets) {
    return {
      ok: false,
      error: "pii_detected",
      message: `Prompt contains PII / secret patterns: ${hits.join(", ")}. Pass allowEmbeddedSecrets only with operator approval.`,
    };
  }

  return {
    ok: true,
    redactedPrompt: redacted,
    invocationFingerprint: fingerprintInputs(invocation, redacted),
  };
}

/**
 * Validate output before it reaches the calling kernel. Refuses
 * anything that doesn't match the declared expectedShape.
 */
export type ValidateOutputResult =
  | { ok: true; parsed: unknown }
  | { ok: false; error: "invalid_json" | "invalid_yaml" | "not_single_token" | "wrong_embedding_dims" | "empty_output"; message: string };

export function validateModelOutput(
  invocation: LocalModelInvocation,
  raw: string,
): ValidateOutputResult {
  const text = raw.trim();
  if (!text) return { ok: false, error: "empty_output", message: "Model returned an empty body." };

  switch (invocation.expectedShape) {
    case "free_text":
      return { ok: true, parsed: text };
    case "json": {
      try {
        return { ok: true, parsed: JSON.parse(text) };
      } catch (e) {
        return { ok: false, error: "invalid_json", message: e instanceof Error ? e.message : "JSON parse failed." };
      }
    }
    case "yaml": {
      // Lightweight YAML check — we accept top-level key:value lines.
      // Real YAML parsing happens downstream; this just sanity-checks
      // the shape so non-YAML output is rejected fast.
      if (!/^[\w\-]+:\s/m.test(text)) {
        return { ok: false, error: "invalid_yaml", message: "Output doesn't look like YAML (no key: value at top)." };
      }
      return { ok: true, parsed: text };
    }
    case "single_token": {
      const cleaned = text.toLowerCase();
      if (!/^[a-z0-9_-]{1,32}$/.test(cleaned)) {
        return { ok: false, error: "not_single_token", message: `Expected a single token, got: "${text.slice(0, 40)}…".` };
      }
      return { ok: true, parsed: cleaned };
    }
    case "embedding_vector": {
      try {
        const arr = JSON.parse(text);
        if (!Array.isArray(arr) || !arr.every((n) => typeof n === "number" && Number.isFinite(n))) {
          return { ok: false, error: "wrong_embedding_dims", message: "Expected JSON array of finite numbers." };
        }
        if (invocation.expectedEmbeddingDims && arr.length !== invocation.expectedEmbeddingDims) {
          return {
            ok: false,
            error: "wrong_embedding_dims",
            message: `Expected ${invocation.expectedEmbeddingDims} dimensions, got ${arr.length}.`,
          };
        }
        return { ok: true, parsed: arr };
      } catch {
        return { ok: false, error: "wrong_embedding_dims", message: "Could not parse output as a JSON array." };
      }
    }
  }
}
