/**
 * Sales lead enricher — VisionXIXLabs INTERNAL kernel.
 *
 * **Product layer: internal_admin.** Used by /admin/leads to classify
 * inbound prospects landing on visionxixlabs.com /contact and
 * /book-demo. Routes leads to AE / AM / welcome flow. Not exposed
 * to client tenants — a client business gets their own
 * customer-support kernels under /dashboard/* for triaging THEIR
 * customers.
 *
 * Input: a raw lead — name, email, optional company / role / message.
 * Output: a typed enrichment proposal — inferred segment, ICP-fit
 * score, tier suggestion, talking points, suggested next action.
 *
 * Pure / no I/O. Caller may later combine this with a live company-
 * data lookup (Clearbit / Apollo) before sending an outbound email;
 * outbound is always approval-gated.
 *
 * The kernel uses email-domain heuristics + role-keyword scoring —
 * no model invocation. That keeps it deterministic + cheap and lets
 * the live data lookup add on top of the structural inference.
 */

export type ICPSegment =
  | "startup_seed"
  | "startup_growth"
  | "mid_market"
  | "enterprise"
  | "freelance"
  | "education"
  | "personal"
  | "unknown";

export type RoleSeniority = "exec" | "director" | "ic" | "intern" | "unknown";

export type PlanSuggestion = "starter" | "growth" | "scale" | "enterprise" | "trial";

export type LeadAction =
  | "send_welcome_email"
  | "schedule_demo"
  | "route_to_AE"          // account executive
  | "route_to_AM"          // account manager
  | "mark_low_priority"
  | "needs_human_triage";

export interface RawLead {
  id: string;
  email: string;
  fullName?: string;
  company?: string;
  /** Free-text role / title the lead provided. */
  role?: string;
  /** Optional message body the lead submitted. */
  message?: string;
  /** Submission source — used in routing. */
  source?: "marketing-contact" | "demo-request" | "trial-signup" | "newsletter" | "unknown";
}

export interface LeadEnrichment {
  leadId: string;
  segment: ICPSegment;
  /** 0..100 — fit score against our ICP. */
  icpFitScore: number;
  /** Closed-union plan suggestion. */
  suggestedPlan: PlanSuggestion;
  roleSeniority: RoleSeniority;
  /** Operator-readable talking points the AE can use. */
  talkingPoints: readonly string[];
  /** Recommended next action — closed-union. */
  recommendedAction: LeadAction;
  /** Operator-readable rationale. */
  rationale: string;
}

// ─── Heuristics ───────────────────────────────────────────────────

// Free-mail / personal email providers.
const PERSONAL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "proton.me", "protonmail.com",
  "live.com", "msn.com", "aol.com", "pm.me",
]);

// Education / non-profit signals via TLD or pattern.
const EDU_PATTERNS = [/\.edu$/i, /\.ac\.[a-z]{2,4}$/i, /\.edu\.[a-z]{2,4}$/i];
const NONPROFIT_PATTERNS = [/\.org$/i];

// Role keywords → seniority.
const SENIORITY_PATTERNS: ReadonlyArray<{ s: RoleSeniority; pattern: RegExp }> = [
  { s: "exec",     pattern: /\b(cto|ceo|cio|coo|cfo|cso|founder|cofounder|co-founder|vp|chief)\b/i },
  { s: "director", pattern: /\b(director|head of|principal|staff|lead)\b/i },
  { s: "intern",   pattern: /\b(intern|trainee|graduate|junior|jr)\b/i },
  { s: "ic",       pattern: /\b(engineer|developer|sre|analyst|designer|architect|scientist|consultant)\b/i },
];

// Company name length / common Fortune-style hints. Without a live
// lookup, we infer enterprise from explicit hints in the message.
const ENTERPRISE_HINTS = /\b(enterprise|soc[- ]?2|gdpr|hipaa|fedramp|isos?o27001|self[- ]?host|on[- ]?prem|air[- ]?gap)\b/i;
const STARTUP_HINTS    = /\b(series\s+(a|b|c)|seed|pre-seed|yc|y combinator|techstars|launching|early stage|founder)\b/i;
const MID_MARKET_HINTS = /\b(scale-?up|growth-?stage|expanding|growing team|raising)\b/i;

function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  return email.slice(at + 1).toLowerCase().trim();
}

function detectSeniority(role: string | undefined): RoleSeniority {
  if (!role) return "unknown";
  for (const r of SENIORITY_PATTERNS) {
    if (r.pattern.test(role)) return r.s;
  }
  return "unknown";
}

function detectSegment(lead: RawLead): ICPSegment {
  const dom = emailDomain(lead.email);
  if (!dom) return "unknown";
  if (PERSONAL_DOMAINS.has(dom)) return "personal";
  for (const p of EDU_PATTERNS) if (p.test(dom)) return "education";
  const message = `${lead.role ?? ""} ${lead.message ?? ""}`;
  if (ENTERPRISE_HINTS.test(message)) return "enterprise";
  if (MID_MARKET_HINTS.test(message)) return "mid_market";
  if (STARTUP_HINTS.test(message)) {
    return /\bseed|pre-seed|launching|early stage\b/i.test(message) ? "startup_seed" : "startup_growth";
  }
  // Company name length is a weak signal — fallback to mid_market if
  // they provided a company at all, else unknown.
  if (lead.company && lead.company.trim().length > 0) return "mid_market";
  return "unknown";
}

function suggestPlan(segment: ICPSegment, seniority: RoleSeniority): PlanSuggestion {
  switch (segment) {
    case "enterprise":     return "enterprise";
    case "mid_market":     return "scale";
    case "startup_growth": return "growth";
    case "startup_seed":   return "starter";
    case "education":      return "trial";
    case "freelance":      return "starter";
    case "personal":       return "trial";
    case "unknown":        return seniority === "exec" ? "growth" : "trial";
  }
}

function scoreIcpFit(segment: ICPSegment, seniority: RoleSeniority): number {
  let score = 50;
  switch (segment) {
    case "enterprise":     score += 35; break;
    case "mid_market":     score += 25; break;
    case "startup_growth": score += 20; break;
    case "startup_seed":   score += 10; break;
    case "education":      score -= 10; break;
    case "freelance":      score -= 15; break;
    case "personal":       score -= 25; break;
    case "unknown":        score -= 5; break;
  }
  switch (seniority) {
    case "exec":     score += 15; break;
    case "director": score += 10; break;
    case "ic":       score += 2;  break;
    case "intern":   score -= 20; break;
    case "unknown":  break;
  }
  return Math.max(0, Math.min(100, score));
}

function talkingPointsFor(segment: ICPSegment, hasMessage: boolean): readonly string[] {
  const base: string[] = [];
  switch (segment) {
    case "enterprise":
      base.push("SOC 2 readiness packet auto-generated weekly.");
      base.push("Self-host + air-gap options on Enterprise tier.");
      base.push("Audit log streaming + dual-control on critical actions.");
      break;
    case "mid_market":
      base.push("Replaces Datadog + PagerDuty + Snyk for ~$3.5k/mo.");
      base.push("Multi-cloud write (AWS today; Azure / GCP read).");
      base.push("SSO + 15 operators standard on Scale tier.");
      break;
    case "startup_growth":
      base.push("Phased Terraform execution + GitHub PR write.");
      base.push("5 operators, 10k autonomy cycles/day on Growth.");
      base.push("~$899/mo or $599/mo billed annually.");
      break;
    case "startup_seed":
      base.push("Starter tier: 1 cloud, $149/mo (or $99 billed annually).");
      base.push("Free Trial available for sandbox runs.");
      base.push("Cost-cut typical 20-30% on first scan.");
      break;
    case "education":
      base.push("Free Trial works for classroom + research use cases.");
      base.push("Audit log + rationale rows are great for teaching governance.");
      break;
    case "personal":
      base.push("Free Trial is the right starting point — no card required.");
      break;
    case "freelance":
      base.push("Starter tier covers one-cloud freelance engagements.");
      break;
    case "unknown":
      base.push("Need more info to pinpoint plan — start with a discovery call.");
      break;
  }
  if (hasMessage) base.push("Lead provided a message — reference it in the first reply.");
  return base;
}

function recommendAction(segment: ICPSegment, seniority: RoleSeniority, source: RawLead["source"]): LeadAction {
  if (source === "trial-signup") return "send_welcome_email";
  if (source === "demo-request") return "schedule_demo";
  if (segment === "enterprise") return "route_to_AE";
  if (segment === "mid_market") return "route_to_AE";
  if (segment === "startup_growth" && seniority === "exec") return "route_to_AE";
  if (segment === "startup_growth") return "route_to_AM";
  if (segment === "personal" || segment === "education") return "send_welcome_email";
  if (segment === "unknown" && seniority === "unknown") return "needs_human_triage";
  if (seniority === "intern") return "mark_low_priority";
  return "send_welcome_email";
}

export function enrichLead(lead: RawLead): LeadEnrichment {
  if (!lead.id.trim()) throw new Error("salesLeadEnricher: lead.id is required");
  if (!lead.email.trim()) throw new Error("salesLeadEnricher: lead.email is required");
  if (!/^[\w.+-]+@[\w.-]+\.[\w.-]+$/.test(lead.email)) {
    throw new Error(`salesLeadEnricher: lead.email "${lead.email}" is not a valid email`);
  }

  const segment = detectSegment(lead);
  const seniority = detectSeniority(lead.role);
  const icpFitScore = scoreIcpFit(segment, seniority);
  const suggestedPlan = suggestPlan(segment, seniority);
  const recommendedAction = recommendAction(segment, seniority, lead.source);
  const talkingPoints = talkingPointsFor(segment, Boolean(lead.message?.trim()));

  const rationale =
    `Segment ${segment}, seniority ${seniority}, ICP fit ${icpFitScore}/100. ` +
    `Suggested plan: ${suggestedPlan}. Recommended action: ${recommendedAction}.`;

  return {
    leadId: lead.id,
    segment,
    icpFitScore,
    suggestedPlan,
    roleSeniority: seniority,
    talkingPoints,
    recommendedAction,
    rationale,
  };
}
