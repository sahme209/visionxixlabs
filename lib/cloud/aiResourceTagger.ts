/**
 * AI resource auto-tagger.
 *
 * For each untagged resource, suggest values for required cost-
 * allocation tags drawn from the allowed dictionary (e.g.
 * cost_center ∈ {marketing, engineering, sales, ops}). REJECTS
 * hallucinated values. Advisory only — operator applies the tags
 * via IaC PR or console.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

export interface ResourceForTagging {
  id: string;
  service: string;            // "checkout-api" etc.
  resourceType: string;       // "aws_s3_bucket" etc.
  nameHint?: string;          // resource name / id
  existingTags: Record<string, string>;
}

export interface TaggingPolicy {
  requiredKeys: readonly string[];
  /** Allowed values per key. */
  allowedValues: Record<string, readonly string[]>;
}

export interface TagSuggestion {
  resourceId: string;
  /** Suggested tags only for the missing required keys. */
  suggestions: Record<string, string>;
  /** Keys we could not suggest (no good signal). */
  unsureKeys: string[];
}

export interface TaggingResult {
  rows: TagSuggestion[];
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
}

const SYSTEM = [
  "You suggest cost-allocation tag values for untagged cloud resources.",
  "Each suggested value MUST come from the allowed list for that key.",
  "Reply strictly as JSON: { \"rows\": [{ \"resourceId\": \"...\", \"suggestions\": { \"<key>\": \"<value>\" }, \"unsureKeys\": [\"<key>\"] }] }.",
  "Never invent keys or values outside the policy.",
].join(" ");

const missingKeys = (existing: Readonly<Record<string, string>>, required: readonly string[]): string[] =>
  required.filter((k) => !(k in existing) || existing[k].length === 0);

function deterministicSuggest(resources: readonly ResourceForTagging[], policy: TaggingPolicy): TagSuggestion[] {
  return resources.map((r) => {
    const missing = missingKeys(r.existingTags, policy.requiredKeys);
    const suggestions: Record<string, string> = {};
    const unsureKeys: string[] = [];

    for (const key of missing) {
      const allowed = policy.allowedValues[key] ?? [];
      if (allowed.length === 0) {
        unsureKeys.push(key);
        continue;
      }
      // Heuristic: match service name fragment against allowed values.
      const svcLower = r.service.toLowerCase();
      const match = allowed.find((v) => svcLower.includes(v.toLowerCase()));
      if (match) suggestions[key] = match;
      else unsureKeys.push(key);
    }

    return { resourceId: r.id, suggestions, unsureKeys };
  });
}

export async function suggestResourceTags(input: {
  resources: readonly ResourceForTagging[];
  policy: TaggingPolicy;
}): Promise<TaggingResult> {
  const fallback: TaggingResult = {
    rows: deterministicSuggest(input.resources, input.policy),
    aiUsed: false, provider: null, model: null, latencyMs: 0,
  };
  if (input.resources.length === 0) return fallback;

  try {
    const mgr = getAIProviderManager();
    const policyHint = Object.entries(input.policy.allowedValues)
      .map(([k, vs]) => `${k} ∈ {${vs.join(", ")}}`)
      .join("; ");
    const list = input.resources
      .map((r) => `- id=${r.id} service=${r.service} type=${r.resourceType} existing=${JSON.stringify(r.existingTags)}`)
      .join("\n");
    const prompt = `Required keys: ${input.policy.requiredKeys.join(", ")}\nAllowed values: ${policyHint}\nResources:\n${list}`;
    const r = await mgr.extractStructuredData<{ rows?: unknown }>(
      prompt,
      `{ "rows": [{ "resourceId": "string", "suggestions": "{key: allowed-value}", "unsureKeys": ["string"] }] }`,
      { system: SYSTEM, temperature: 0, maxTokens: 4096, timeoutMs: 15_000 },
    );
    if (r.provider === "mock") return { ...fallback, latencyMs: r.latencyMs };
    const arr = (r.data as { rows?: unknown }).rows;
    if (!Array.isArray(arr)) return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs };

    const idSet = new Set(input.resources.map((res) => res.id));
    const cleaned: TagSuggestion[] = [];
    for (const x of arr) {
      if (!x || typeof x !== "object" || Array.isArray(x)) continue;
      const rid = String((x as { resourceId?: unknown }).resourceId ?? "");
      if (!idSet.has(rid)) continue;
      const sug = (x as { suggestions?: unknown }).suggestions;
      const unsure = (x as { unsureKeys?: unknown }).unsureKeys;
      const suggestions: Record<string, string> = {};
      if (sug && typeof sug === "object" && !Array.isArray(sug)) {
        for (const [k, v] of Object.entries(sug as Record<string, unknown>)) {
          if (typeof v !== "string") continue;
          if (!input.policy.requiredKeys.includes(k)) continue;
          const allowed = input.policy.allowedValues[k] ?? [];
          if (!allowed.includes(v)) continue;
          suggestions[k] = v;
        }
      }
      const unsureKeys = Array.isArray(unsure)
        ? (unsure as unknown[]).filter((u): u is string => typeof u === "string" && input.policy.requiredKeys.includes(u))
        : [];
      cleaned.push({ resourceId: rid, suggestions, unsureKeys });
    }
    if (cleaned.length === 0) return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs };
    return { rows: cleaned, aiUsed: true, provider: r.provider, model: r.model, latencyMs: r.latencyMs };
  } catch {
    return fallback;
  }
}
