/**
 * Pure intent parser — natural-language → typed ActionSpec.
 *
 * Operator types a request in plain English. This kernel produces a
 * typed ActionSpec that downstream kernels (metaReasoner, approver,
 * orchestrator) consume. Closed-union intent kind so the type
 * checker refuses anything outside the known set.
 *
 * Pure / no LLM call. Keyword + verb + domain phrase matching. This
 * keeps the parser deterministic + cheap; an optional LLM refinement
 * layer can wrap this kernel later without changing the contract.
 *
 * Why this matters for AGI:
 *   Without a typed intent layer, every downstream agent has to do
 *   its own NL classification. Centralising the parse means each
 *   agent receives a clean, typed brief — and the audit row carries
 *   the exact normalised intent, not a fuzzy prompt.
 */

export type IntentKind =
  | "investigate"
  | "fix"
  | "optimize"
  | "scan"
  | "draft"
  | "schedule"
  | "rollback"
  | "approve"
  | "report"
  | "unknown";

export type IntentDomain =
  | "cloud"
  | "database"
  | "devops"
  | "security"
  | "observability"
  | "marketing"
  | "support"
  | "hr"
  | "finance"
  | "general";

export type Urgency = "low" | "medium" | "high" | "critical";

export interface ActionSpec {
  /** Closed-union intent kind. */
  kind: IntentKind;
  /** Closed-union domain. */
  domain: IntentDomain;
  /** Operator-readable normalised one-line intent. */
  normalisedStatement: string;
  /** Detected urgency. */
  urgency: Urgency;
  /** Free-form named entities (e.g. service names, table names). */
  entities: readonly string[];
  /** Confidence 0..1 in the parse. */
  confidence: number;
  /** True when the kernel detected possible destructive language. */
  flaggedDestructive: boolean;
  /** Operator-readable rationale for the classification. */
  rationale: string;
}

// Note: "plan" is intentionally NOT in the schedule pattern — it
// would mis-fire on noun uses like "Terraform plan" / "execution
// plan". Approve + rollback are listed early so phrases like
// "approve the staged Terraform plan" resolve correctly.
const VERB_MAP: ReadonlyArray<{ kind: IntentKind; pattern: RegExp }> = [
  { kind: "investigate", pattern: /\b(why|investigate|diagnose|root[- ]?cause|debug|inspect|look\s+at|check\s+why)\b/i },
  { kind: "rollback",    pattern: /\b(rollback|roll\s+back|revert|undo|back\s+out)\b/i },
  { kind: "approve",     pattern: /\b(approve|sign\s*off|green[- ]?light|accept)\b/i },
  { kind: "fix",         pattern: /\b(fix|repair|patch|remediate|address|correct|resolve)\b/i },
  { kind: "optimize",    pattern: /\b(optimi[sz]e|tune|speed\s*up|reduce\s+cost|right[- ]?size|cut\s+spend)\b/i },
  { kind: "scan",        pattern: /\b(scan|audit|review|check|inventory|enumerate|list)\b/i },
  { kind: "draft",       pattern: /\b(draft|write|compose|generate|propose)\b/i },
  { kind: "schedule",    pattern: /\b(schedule|defer|delay|queue|book\s+a)\b/i },
  { kind: "report",      pattern: /\b(report|summari[sz]e|recap|brief\s+me|show\s+me\s+a)\b/i },
];

const DOMAIN_MAP: ReadonlyArray<{ domain: IntentDomain; pattern: RegExp }> = [
  { domain: "cloud",         pattern: /\b(aws|azure|gcp|s3|ec2|rds|lambda|vpc|iam|cloud[- ]?account|terraform)\b/i },
  { domain: "database",      pattern: /\b(database|postgres|mysql|mongo|schema|table|query|index|migration)\b/i },
  { domain: "devops",        pattern: /\b(deploy|pipeline|ci[/ ]?cd|github|release|branch|action|build|workflow)\b/i },
  { domain: "security",      pattern: /\b(secret|secrets|cve|kev|vulnerab|exposure|iam|leak|breach|compliance)\b/i },
  { domain: "observability", pattern: /\b(alert|incident|trace|metric|log|p95|slo|sli|dashboard|page(?:r)?duty|grafana|datadog)\b/i },
  { domain: "marketing",     pattern: /\b(linkedin|post|tweet|blog|launch\s+announcement|campaign)\b/i },
  { domain: "support",       pattern: /\b(ticket|customer|sla|response|reply|helpdesk)\b/i },
  { domain: "hr",            pattern: /\b(onboard|offboard|new\s+hire|employee|role\s+setup)\b/i },
  { domain: "finance",       pattern: /\b(invoice|billing|payment|refund|payroll|budget)\b/i },
];

const URGENCY_MAP: ReadonlyArray<{ urgency: Urgency; pattern: RegExp }> = [
  { urgency: "critical", pattern: /\b(critical|asap|right\s*now|outage|p0|sev1|emergency|on\s*fire)\b/i },
  { urgency: "high",     pattern: /\b(urgent|today|p1|sev2|important|asap)\b/i },
  { urgency: "low",      pattern: /\b(later|whenever|sometime|backlog|when\s+you\s+have\s+time)\b/i },
];

const DESTRUCTIVE_PATTERN = /\b(delete|drop|destroy|terminate|wipe|rm\s+-rf|force\s+push|truncate|purge)\b/i;

const STOPWORDS = new Set([
  "a", "an", "the", "is", "in", "on", "of", "for", "to", "with", "and", "or", "but",
  "we", "i", "you", "they", "this", "that", "be", "are", "was", "were", "do", "does",
  "did", "at", "by", "from", "up", "down", "out", "off", "over", "again", "further",
  "then", "once", "here", "there", "when", "where", "why", "how", "all", "any", "both",
  "each", "few", "more", "most", "some", "such", "no", "nor", "not", "only", "own",
  "same", "so", "than", "too", "very", "can", "will", "just", "should", "now",
]);

// Match capitalised words, qualified service names (api-prod, prod-db-02),
// and common ALL_CAPS env tokens.
const ENTITY_PATTERN = /\b([A-Z][a-zA-Z0-9_-]+|[a-z][a-z0-9_]*-[a-z0-9_-]+|[A-Z][A-Z0-9_]{3,})\b/g;

function pickKind(s: string): IntentKind {
  for (const m of VERB_MAP) if (m.pattern.test(s)) return m.kind;
  return "unknown";
}

function pickDomain(s: string): IntentDomain {
  for (const m of DOMAIN_MAP) if (m.pattern.test(s)) return m.domain;
  return "general";
}

function pickUrgency(s: string): Urgency {
  for (const m of URGENCY_MAP) if (m.pattern.test(s)) return m.urgency;
  return "medium";
}

function extractEntities(s: string): readonly string[] {
  const out = new Set<string>();
  for (const m of s.matchAll(ENTITY_PATTERN)) {
    const e = m[1];
    if (e.length < 2) continue;
    if (STOPWORDS.has(e.toLowerCase())) continue;
    out.add(e);
  }
  return [...out];
}

function normalise(s: string): string {
  return s.trim().replace(/\s+/g, " ").slice(0, 300);
}

export function parseIntent(statement: string): ActionSpec {
  if (!statement.trim()) {
    return {
      kind: "unknown",
      domain: "general",
      normalisedStatement: "",
      urgency: "low",
      entities: [],
      confidence: 0,
      flaggedDestructive: false,
      rationale: "Empty statement.",
    };
  }

  const kind = pickKind(statement);
  const domain = pickDomain(statement);
  const urgency = pickUrgency(statement);
  const entities = extractEntities(statement);
  const flaggedDestructive = DESTRUCTIVE_PATTERN.test(statement);

  // Confidence: each successful match adds, unknown kind subtracts.
  let confidence = 0.4;
  if (kind !== "unknown") confidence += 0.25;
  if (domain !== "general") confidence += 0.2;
  if (urgency !== "medium") confidence += 0.05;
  if (entities.length > 0)  confidence += 0.05;
  if (flaggedDestructive)   confidence += 0.05;
  confidence = Math.min(1, confidence);

  const reasons: string[] = [];
  if (kind !== "unknown")        reasons.push(`verb → ${kind}`);
  if (domain !== "general")      reasons.push(`domain → ${domain}`);
  if (urgency !== "medium")      reasons.push(`urgency → ${urgency}`);
  if (entities.length > 0)       reasons.push(`${entities.length} entity hit(s)`);
  if (flaggedDestructive)        reasons.push("destructive verb detected — destructive flag set");
  if (reasons.length === 0)      reasons.push("no specific signal; routing to human triage");

  return {
    kind,
    domain,
    normalisedStatement: normalise(statement),
    urgency,
    entities,
    confidence: Math.round(confidence * 100) / 100,
    flaggedDestructive,
    rationale: reasons.join(" · "),
  };
}
