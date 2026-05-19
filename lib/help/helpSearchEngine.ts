/**
 * Local help search engine.
 *
 * Pure local keyword scorer over the HELP_ENTRIES table. No LLM
 * call, no network — the answers always come from grounded
 * knowledge-base entries. When nothing matches above the floor we
 * say so honestly instead of hallucinating.
 *
 * Scoring is term-frequency weighted by field:
 *   title          ×3
 *   keywords       ×2.5
 *   description    ×1
 *   requirements   ×0.6
 *   id             ×1.5
 *
 * Tokens are case-folded and split on \W+. Stopwords trimmed.
 * Single-character tokens dropped. Score is normalised by total
 * input tokens so longer queries don't tilt toward longer entries.
 */

import { HELP_ENTRIES, type HelpEntry } from "./helpKnowledgeBase";

export interface HelpSearchHit {
  entry: HelpEntry;
  score: number;
  matchedTokens: string[];
}

export interface HelpAnswer {
  query: string;
  totalTokens: number;
  hits: HelpSearchHit[];
  /** Best-match entry, or undefined when no hit cleared the floor. */
  primary?: HelpEntry;
  /** Operator-readable verdict — "found primary" / "ambiguous" / "no_match". */
  verdict: "found_primary" | "ambiguous" | "no_match";
  /** Plain-English suggestion when no hit found. */
  fallbackSuggestion: string;
}

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "how",
  "i", "in", "into", "is", "it", "its", "of", "on", "or", "that", "the", "this", "to",
  "what", "where", "who", "why", "will", "with", "you", "your", "do", "does", "can",
  "should", "would", "could", "tell", "me", "us", "my", "we", "our",
]);

const MIN_SCORE_FLOOR = 0.18;
const AMBIGUITY_GAP = 0.12;

export function searchHelp(query: string, limit = 5): HelpAnswer {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return {
      query,
      totalTokens: 0,
      hits: [],
      verdict: "no_match",
      fallbackSuggestion:
        "Type a topic, route, or env var name. Try: 'cloudtrail', 'cost anomaly', 'slack webhook', 'autonomy charter'.",
    };
  }

  const cloudIntent = detectCloudIntent(tokens);
  const scored: HelpSearchHit[] = HELP_ENTRIES.map((entry) => {
    const haystack = buildHaystack(entry);
    const { score, matchedTokens } = scoreEntry(tokens, haystack, cloudIntent);
    return { entry, score, matchedTokens };
  })
    .filter((h) => h.score >= MIN_SCORE_FLOOR)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (scored.length === 0) {
    return {
      query,
      totalTokens: tokens.length,
      hits: [],
      verdict: "no_match",
      fallbackSuggestion: noMatchFallback(tokens),
    };
  }

  const top = scored[0];
  const second = scored[1];

  if (!second || top.score - second.score >= AMBIGUITY_GAP) {
    return {
      query,
      totalTokens: tokens.length,
      hits: scored,
      primary: top.entry,
      verdict: "found_primary",
      fallbackSuggestion: "",
    };
  }

  return {
    query,
    totalTokens: tokens.length,
    hits: scored,
    verdict: "ambiguous",
    fallbackSuggestion:
      "Several entries match closely. Pick the one closest to your intent — the per-entry route opens the actual surface.",
  };
}

// ---------------------------------------------------------------------------
// Scoring internals
// ---------------------------------------------------------------------------

interface Haystack {
  title: Set<string>;
  keywords: Set<string>;
  description: Set<string>;
  requirements: Set<string>;
  id: Set<string>;
}

function buildHaystack(entry: HelpEntry): Haystack {
  return {
    title: new Set(tokenize(entry.title)),
    keywords: new Set(entry.keywords.flatMap((k) => tokenize(k))),
    description: new Set(tokenize(entry.description)),
    requirements: new Set(entry.requirements.flatMap((r) => tokenize(r))),
    id: new Set(tokenize(entry.id)),
  };
}

function scoreEntry(
  tokens: string[],
  hay: Haystack,
  cloudIntent: ReturnType<typeof detectCloudIntent>,
): { score: number; matchedTokens: string[] } {
  let total = 0;
  const matched: string[] = [];
  for (const t of tokens) {
    let contribution = 0;
    if (hay.title.has(t)) contribution += 3;
    if (hay.keywords.has(t)) contribution += 2.5;
    if (hay.description.has(t)) contribution += 1;
    if (hay.requirements.has(t)) contribution += 0.6;
    if (hay.id.has(t)) contribution += 1.5;
    if (contribution > 0) {
      matched.push(t);
      total += contribution;
    }
  }
  // Phase 120 — Semantic cloud boost. When the query mentions a cloud
  // ("aws"/"azure"/"gcp") and the entry's keywords reference that cloud
  // (directly or via service tokens like "ec2"/"aks"/"gke"), add a small
  // bonus so cross-cloud surfaces don't accidentally outrank the
  // cloud-specific one for cloud-specific queries.
  if (cloudIntent.aws && shareTokens(hay.keywords, CLOUD_INDICATORS.aws)) {
    total += 0.4;
    if (!matched.includes("aws")) matched.push("aws");
  }
  if (cloudIntent.azure && shareTokens(hay.keywords, CLOUD_INDICATORS.azure)) {
    total += 0.4;
    if (!matched.includes("azure")) matched.push("azure");
  }
  if (cloudIntent.gcp && shareTokens(hay.keywords, CLOUD_INDICATORS.gcp)) {
    total += 0.4;
    if (!matched.includes("gcp")) matched.push("gcp");
  }
  // Normalise by total tokens — longer queries shouldn't bias toward longer entries.
  const normalised = tokens.length > 0 ? total / (tokens.length * 3) : 0;
  return { score: Math.min(1, normalised), matchedTokens: matched };
}

// ---------------------------------------------------------------------------
// Cloud intent detection (Phase 120)
// ---------------------------------------------------------------------------

const CLOUD_INDICATORS: Record<"aws" | "azure" | "gcp", string[]> = {
  aws:   ["aws", "ec2", "s3", "rds", "lambda", "iam", "vpc", "cloudtrail", "guardduty", "eks", "ecs"],
  azure: ["azure", "vnet", "aks", "subscription", "monitor"],
  gcp:   ["gcp", "gke", "bigquery"],
};

function detectCloudIntent(tokens: string[]): { aws: boolean; azure: boolean; gcp: boolean } {
  const set = new Set(tokens);
  return {
    aws: set.has("aws") || tokens.some((t) => CLOUD_INDICATORS.aws.includes(t)),
    azure: set.has("azure") || tokens.some((t) => CLOUD_INDICATORS.azure.includes(t)),
    gcp: set.has("gcp") || tokens.some((t) => CLOUD_INDICATORS.gcp.includes(t)),
  };
}

function shareTokens(haystack: Set<string>, indicators: string[]): boolean {
  for (const tok of indicators) {
    if (haystack.has(tok)) return true;
  }
  return false;
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function noMatchFallback(tokens: string[]): string {
  if (tokens.some((t) => t === "execute" || t === "run" || t === "apply" || t === "mutate" || t === "delete")) {
    return "Axiom is read-only by design — no surface executes mutations. The closest action is to stage a runbook for approval (try 'runbook') or copy a policy preview to your IaC pipeline.";
  }
  if (tokens.some((t) => t === "billing" || t === "invoice" || t === "pricing" || t === "money")) {
    return "Try 'cost overview' or 'cost explainer' — every cost surface is honest about confirmed-spend only, no fabricated savings.";
  }
  return `No knowledge-base entry matched [${tokens.join(", ")}]. Browse /dashboard/help to see every documented surface, or refine the query.`;
}
