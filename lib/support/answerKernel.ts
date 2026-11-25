/**
 * Ask V19 answer kernel (B5 / C2). Pure and deterministic.
 *
 * Retrieval over the public knowledge base with BM25 scoring, light stemming
 * and a small synonym map. Answers are extracted from reviewed sources and
 * always cite them, so they cannot invent product behaviour. Guardrails run
 * first: pasted secrets are refused, and workspace-specific or action requests
 * are routed to the signed-in app instead of being "answered".
 */
import type { KnowledgeEntry } from "./knowledgeBase";
import { containsSupportSecret, SUPPORT_SECRET_NOTICE } from "./secretQuestion";

const STOP = new Set("a an and are as at be but by can do does for from how i if in is it me my of on or our so that the this to was we what when where which who why will with you your much many any some someone there until get say says tell about".split(" "));
const SYNONYMS: Record<string, string> = {
  v19: "axiom", // Current display name and legacy queries share one retrieval term.
  price: "pricing", cost: "pricing", costs: "pricing", pay: "pricing", paid: "pricing", charge: "pricing", billing: "pricing", credit: "credits",
  install: "download", installer: "download", setup: "download", mac: "macos", windows: "windows", linux: "linux",
  revoke: "revoke", disconnect: "revoke", remove: "revoke",
  approve: "approval", approvals: "approval", approver: "approval",
  key: "credentials", keys: "credentials", secret: "credentials", secrets: "credentials", token: "credentials", tokens: "credentials", password: "credentials",
  deploy: "deployment", deploys: "deployment", deploying: "deployment", release: "deployment", ship: "deployment",
  agents: "agent", bot: "agent", ai: "agent", llm: "agent",
  log: "audit", logs: "audit", history: "audit", recorded: "audit",
  sso: "identity", saml: "identity", oidc: "identity", login: "identity", signin: "identity",
};

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/\baxiom\s+agent\b/g, "axiom").replace(/\bset\s+up\b/g, "setup").replace(/\broll(ing|ed)?\s+back\b/g, "rollback").replace(/\bsign(ing|ed)?\s+in\b/g, "signin").replace(/\blog(ging|ged)?\s+in\b/g, "signin").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t))
    .map((t) => SYNONYMS[t] ?? t)
    .map((t) => (t.length > 4 && t.endsWith("ing") ? t.slice(0, -3) : t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t))
    .map((t) => SYNONYMS[t] ?? t);
}

interface Indexed { entry: KnowledgeEntry; terms: Map<string, number>; length: number; titleTerms: string[] }
export interface AnswerIndex { docs: Indexed[]; df: Map<string, number>; avgLength: number }

export function buildIndex(entries: readonly KnowledgeEntry[]): AnswerIndex {
  const docs = entries.map((entry) => {
    // Titles and keywords count more than body text.
    const tokens = [...tokenize(entry.title), ...tokenize(entry.title), ...tokenize(entry.body), ...tokenize((entry.keywords ?? []).join(" ")), ...tokenize((entry.keywords ?? []).join(" "))];
    const terms = new Map<string, number>();
    for (const t of tokens) terms.set(t, (terms.get(t) ?? 0) + 1);
    return { entry, terms, length: tokens.length, titleTerms: [...new Set(tokenize(entry.title))] };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.terms.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  return { docs, df, avgLength: docs.reduce((n, d) => n + d.length, 0) / Math.max(1, docs.length) };
}

export type GuardResult = { kind: "secret_pasted" } | { kind: "workspace_specific" } | { kind: "action_request" } | null;

const WORKSPACE_LOOKUP = /\b(status|why|show|check|what happened|failed|balance|how much|where is|where are)\b/i;
const PRIVATE_AUDIT_RECORD = /\b(?:my|our)\s+(?:(?:production|staging|current|latest|pending)\s+)?audit\s+(?:logs?|trail|records?|history)\b/i;
const PRIVATE_BATCH_RECORD = /\b(?:my|our)\s+(?:(?:production|staging|current|latest|pending)\s+)?(?:(?:airflow|batch)\s+(?:dags?|jobs?|runs?|workflows?)|dags?)\b/i;
const PRIVATE_MEMBERSHIP_QUERY = /\b(?:who|show|list|check|identify|name)\b.*\b(?:my|our)\s+(?:current\s+)?(?:workspace|org(?:anization)?)\s+(?:owners?|members?|admins?)\b|\bwho\s+owns\s+(?:my|our)\s+(?:workspace|org(?:anization)?)\b/i;
const REQUEST_PREFIX = /^\s*(?:please[\s,]+)?(?:(?:can|could|would|will)\s+you\s+(?:please[\s,]+)?)?/i;
const WORKSPACE_ACTION = /^(?:deploy|delete|merge|rollback|roll back|restart|approve|reject|revoke|refund|cancel|run|trigger)\b/i;
const BATCH_ACTION = /^(?:start|retry|schedule)\s+(?:(?:a|an|the|my|our|this|that|failed|current|latest|pending|staging|production|airflow|batch)\s+){0,5}(?:dags?|jobs?|runs?|workflows?|batches?)\b/i;
const CLOSURE_ACTION = /^close\s+(?:(?:a|the|my|our|this|that|current|pending|staging|production)\s+){0,5}(?:release|deployment)(?:\s+request)?\b/i;
const PRIVATE_BATCH_HISTORY = /\b(?:my|our)\s+(?:(?:closed\s+)?release\s+history\s+in\s+batches|(?:batches|batch)\s+(?:release\s+)?history)\b/i;
const PRIVATE_CLOSURE_RECORD = /\b(?:my|our)\s+(?:(?:release|deployment|latest|current)\s+){0,3}closure\s+(?:evidence|receipt|record|status)\b/i;
const PRIVATE_WORKSPACE_RECORD = /\b(?:my|our)\s+(?:(?:production|staging|current|latest|pending)\s+)?(?:workspace|account|invoice|bill|deployment|release|runs?|pipeline|approval|repository|org|organization|subscription|credits?|balance)\b/i;

export function isPrivateAuditEvidenceQuestion(question: string): boolean {
  return PRIVATE_AUDIT_RECORD.test(question) && WORKSPACE_LOOKUP.test(question);
}

export function isPrivateBatchEvidenceQuestion(question: string): boolean {
  return PRIVATE_BATCH_RECORD.test(question) && WORKSPACE_LOOKUP.test(question);
}

export function guard(question: string): GuardResult {
  if (containsSupportSecret(question)) return { kind: "secret_pasted" };
  const request = question.replace(REQUEST_PREFIX, "");
  if (WORKSPACE_ACTION.test(request) || BATCH_ACTION.test(request) || CLOSURE_ACTION.test(request)) return { kind: "action_request" };
  if (PRIVATE_MEMBERSHIP_QUERY.test(question) || PRIVATE_CLOSURE_RECORD.test(question) || PRIVATE_BATCH_HISTORY.test(question)) return { kind: "workspace_specific" };
  if (WORKSPACE_LOOKUP.test(question) && (PRIVATE_AUDIT_RECORD.test(question) || PRIVATE_BATCH_RECORD.test(question) || PRIVATE_WORKSPACE_RECORD.test(question))) {
    return { kind: "workspace_specific" };
  }
  return null;
}

export interface Answer {
  status: "answered" | "suggestions" | "guarded";
  guard?: NonNullable<GuardResult>["kind"];
  answer: string;
  sources: { title: string; href: string; kind: KnowledgeEntry["kind"] }[];
  confidence: number;
}

const GUARD_TEXT: Record<NonNullable<GuardResult>["kind"], string> = {
  secret_pasted: SUPPORT_SECRET_NOTICE,
  workspace_specific: "I can't see your workspace from the public site. Sign in to V19 (or open the desktop app) to see your own deployments, approvals, credits and audit history.",
  action_request: "I can't take actions from the public site. Changes in V19 go through the signed-in app, where they are proposed, checked and approved by an authorized person.",
};
const GUARD_SOURCES: Record<NonNullable<GuardResult>["kind"], { title: string; href: string }> = {
  secret_pasted: { title: "Security", href: "/security" },
  workspace_specific: { title: "Download V19", href: "/download" },
  action_request: { title: "Approval workflow", href: "/docs/approval-workflow" },
};

/** BM25 retrieval; returns a cited answer, suggestions when unsure, or a guard response. */
export function answerQuestion(index: AnswerIndex, question: string, opts: { k1?: number; b?: number } = {}): Answer {
  const q = question.slice(0, 1000);
  const g = guard(q);
  if (g?.kind === "workspace_specific" && isPrivateAuditEvidenceQuestion(q)) {
    return {
      status: "guarded",
      guard: g.kind,
      answer: "The public assistant cannot see your audit records. Sign in, select the workspace in your browser, and open Audit & Security. An authorized workspace owner or administrator can review the records there.",
      sources: [{ title: "Find the audit log", href: "/docs/audit-logs#desktop-settings", kind: "guide" }],
      confidence: 1,
    };
  }
  if (g?.kind === "workspace_specific" && isPrivateBatchEvidenceQuestion(q)) {
    return {
      status: "guarded",
      guard: g.kind,
      answer: "I can't look up a specific run here. In V19 Batches, select the correct workspace and connection, then verify the workflow and run before relying on its status.",
      sources: [{ title: "Find the Batches workflow", href: "/docs/surfaces#workflow-map", kind: "guide" }],
      confidence: 1,
    };
  }
  if (g?.kind === "workspace_specific" && PRIVATE_MEMBERSHIP_QUERY.test(q)) {
    return {
      status: "guarded",
      guard: g.kind,
      answer: "I can't look up the people in your workspace from public support. In the paired app, select the intended workspace and open Settings → General. Check Owner and Access & roles, then choose View permissions for the member view.",
      sources: [{ title: "Workspace access in desktop Settings", href: "/docs/settings#desktop-workspace-access", kind: "guide" }],
      confidence: 1,
    };
  }
  if (g) return { status: "guarded", guard: g.kind, answer: GUARD_TEXT[g.kind], sources: [{ ...GUARD_SOURCES[g.kind], kind: "fact" }], confidence: 1 };
  const terms = [...new Set(tokenize(q))];
  if (terms.length === 0) return { status: "suggestions", answer: "Ask about setup, pricing, security, approvals, integrations or agents.", sources: [], confidence: 0 };
  const k1 = opts.k1 ?? 1.2, b = opts.b ?? 0.75, N = index.docs.length;
  const queryIdf = terms.reduce((sum, t) => { const df = index.df.get(t) ?? 0; return sum + Math.log(1 + (N - df + 0.5) / (df + 0.5)); }, 0) || 1;
  const scored = index.docs.map((d) => {
    let score = 0, matched = 0;
    for (const t of terms) {
      const tf = d.terms.get(t); if (!tf) continue;
      const df = index.df.get(t) ?? 0;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      matched += idf;
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * d.length) / index.avgLength)));
    }
    // Prefer entries whose title is mostly about the question ("What is V19?" over "What permissions does V19 need?").
    const titleHits = d.titleTerms.filter((t) => terms.includes(t)).length;
    if (titleHits > 0) score *= 1 + titleHits / d.titleTerms.length;
    // Coverage weighted by rarity: a common word ("support", "setup") counts less than a specific one ("prefect").
    return { d, score, coverage: matched / queryIdf };
  }).filter((s) => s.score > 0).sort((a, b2) => b2.score - a.score || (a.d.entry.id < b2.d.entry.id ? -1 : 1));
  if (scored.length === 0) return { status: "suggestions", answer: "I couldn't find that in the V19 docs. Try different words, browse the documentation, or contact us.", sources: [{ title: "Documentation", href: "/docs", kind: "guide" }, { title: "Contact", href: "/contact", kind: "fact" }], confidence: 0 };
  const top = scored[0];
  // Near-ties from the same page (a guide and its own sections) agree, so they must not lower confidence.
  const page = (h: string) => h.split("#")[0];
  const rival = scored.find((x) => page(x.d.entry.href) !== page(top.d.entry.href));
  const margin = rival ? top.score / rival.score : 2;
  // Being ahead of weak alternatives cannot compensate for an unsupported
  // part of the question. Keep confidence within actual query coverage.
  const confidence = Math.max(0, Math.min(1, top.coverage, top.coverage * 0.8 + Math.min(1, (margin - 1)) * 0.2));
  const sources = scored.slice(0, 3).map((s) => ({ title: s.d.entry.title, href: s.d.entry.href, kind: s.d.entry.kind }));
  if (confidence < 0.4) return { status: "suggestions", answer: "I'm not sure which of these you mean. Here are the closest answers.", sources, confidence };
  return { status: "answered", answer: top.d.entry.body, sources, confidence };
}


/** Top-k entries for a question (BM25 with title weighting), for grounding an AI answer. Pure. */
export function retrieve(index: AnswerIndex, question: string, k = 5): KnowledgeEntry[] {
  const terms = [...new Set(tokenize(question.slice(0, 1000)))];
  if (terms.length === 0) return [];
  const N = index.docs.length;
  return index.docs.map((d) => {
    let score = 0;
    for (const t of terms) {
      const tf = d.terms.get(t); if (!tf) continue;
      const df = index.df.get(t) ?? 0;
      score += Math.log(1 + (N - df + 0.5) / (df + 0.5)) * ((tf * 2.2) / (tf + 1.2 * (0.25 + (0.75 * d.length) / index.avgLength)));
    }
    const hits = d.titleTerms.filter((t) => terms.includes(t)).length;
    if (hits > 0) score *= 1 + hits / d.titleTerms.length;
    return { entry: d.entry, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || (a.entry.id < b.entry.id ? -1 : 1)).slice(0, k).map((x) => x.entry);
}
