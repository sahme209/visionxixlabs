/**
 * Ask Axiom answer kernel (B5 / C2). Pure and deterministic.
 *
 * Retrieval over the public knowledge base with BM25 scoring, light stemming
 * and a small synonym map. Answers are extracted from reviewed sources and
 * always cite them, so they cannot invent product behaviour. Guardrails run
 * first: pasted secrets are refused, and workspace-specific or action requests
 * are routed to the signed-in app instead of being "answered".
 */
import type { KnowledgeEntry } from "./knowledgeBase";

const STOP = new Set("a an and are as at be but by can do does for from how i if in is it me my of on or our so that the this to was we what when where which who why will with you your much many any some there get say says tell about".split(" "));
const SYNONYMS: Record<string, string> = {
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
  return text.toLowerCase().replace(/\broll(ing|ed)?\s+back\b/g, "rollback").replace(/\bsign(ing|ed)?\s+in\b/g, "signin").replace(/\blog(ging|ged)?\s+in\b/g, "signin").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t))
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
const SECRET_PATTERNS = [/\bvxlk_(live|test)_[A-Za-z0-9]{8,}/, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[pousr]_[A-Za-z0-9]{20,}/, /\bsk-[A-Za-z0-9-_]{20,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bxox[baprs]-[A-Za-z0-9-]{10,}/, /\b(password|passwd|pwd)\s*[:=]\s*\S{4,}/i];

export function guard(question: string): GuardResult {
  if (SECRET_PATTERNS.some((p) => p.test(question))) return { kind: "secret_pasted" };
  if (/\b(my|our)\s+(workspace|account|invoice|bill|deployment|run|pipeline|org|organization|subscription|credits?|balance)\b/i.test(question) && /\b(status|why|show|check|what happened|failed|balance|how much)\b/i.test(question)) return { kind: "workspace_specific" };
  if (/^\s*(please\s+)?(deploy|delete|merge|rollback|roll back|restart|approve|reject|revoke|refund|cancel|run|trigger)\b/i.test(question)) return { kind: "action_request" };
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
  secret_pasted: "That message looks like it contains a password, key or token. Don't share secrets in chat. If it's real, rotate it now. I didn't store it, and I won't use it.",
  workspace_specific: "I can't see your workspace from the public site. Sign in to Axiom (or open the desktop app) to see your own deployments, approvals, credits and audit history.",
  action_request: "I can't take actions from the public site. Changes in Axiom go through the signed-in app, where they are proposed, checked and approved by an authorized person.",
};
const GUARD_SOURCES: Record<NonNullable<GuardResult>["kind"], { title: string; href: string }> = {
  secret_pasted: { title: "Security", href: "/security" },
  workspace_specific: { title: "Download Axiom Agent", href: "/download" },
  action_request: { title: "Approval workflow", href: "/docs/approval-workflow" },
};

/** BM25 retrieval; returns a cited answer, suggestions when unsure, or a guard response. */
export function answerQuestion(index: AnswerIndex, question: string, opts: { k1?: number; b?: number } = {}): Answer {
  const q = question.slice(0, 1000);
  const g = guard(q);
  if (g) return { status: "guarded", guard: g.kind, answer: GUARD_TEXT[g.kind], sources: [{ ...GUARD_SOURCES[g.kind], kind: "fact" }], confidence: 1 };
  const terms = [...new Set(tokenize(q))];
  if (terms.length === 0) return { status: "suggestions", answer: "Ask about setup, pricing, security, approvals, integrations or agents.", sources: [], confidence: 0 };
  const k1 = opts.k1 ?? 1.2, b = opts.b ?? 0.75, N = index.docs.length;
  const scored = index.docs.map((d) => {
    let score = 0, matched = 0;
    for (const t of terms) {
      const tf = d.terms.get(t); if (!tf) continue; matched++;
      const df = index.df.get(t) ?? 0;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * d.length) / index.avgLength)));
    }
    // Prefer entries whose title is mostly about the question ("What is Axiom Agent?" over "What permissions does Axiom need?").
    const titleHits = d.titleTerms.filter((t) => terms.includes(t)).length;
    if (titleHits > 0) score *= 1 + titleHits / d.titleTerms.length;
    return { d, score, coverage: matched / terms.length };
  }).filter((s) => s.score > 0).sort((a, b2) => b2.score - a.score || (a.d.entry.id < b2.d.entry.id ? -1 : 1));
  if (scored.length === 0) return { status: "suggestions", answer: "I couldn't find that in the Axiom docs. Try different words, browse the documentation, or contact us.", sources: [{ title: "Documentation", href: "/docs", kind: "guide" }, { title: "Contact", href: "/contact", kind: "fact" }], confidence: 0 };
  const top = scored[0];
  const margin = scored[1] ? top.score / scored[1].score : 2;
  const confidence = Math.max(0, Math.min(1, top.coverage * 0.8 + Math.min(1, (margin - 1)) * 0.2));
  const sources = scored.slice(0, 3).map((s) => ({ title: s.d.entry.title, href: s.d.entry.href, kind: s.d.entry.kind }));
  if (confidence < 0.45) return { status: "suggestions", answer: "I'm not sure which of these you mean. Here are the closest answers.", sources, confidence };
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
