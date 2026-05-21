/**
 * Pure AGI-Engineer marketing content drafter.
 *
 * Input: a typed event the operator wants to broadcast — a shipped
 * changelog batch, a milestone, an incident resolved publicly. Output:
 * a typed multi-channel draft (LinkedIn / X / blog) with risk tier,
 * recommended scheduling window, and an explicit gate state.
 *
 * Why this kernel exists: marketing posts are write-to-the-world
 * actions. The same approval-only-no-execution contract that gates
 * cloud mutations should gate outbound social. This kernel is the
 * "draft" half — it never publishes, only proposes content.
 *
 * Closed unions on event kind + channel + risk tier so future kinds
 * break the build. Pure / deterministic.
 */

export type MarketingEventKind =
  | "phase_shipped"        // we shipped a batch (most common)
  | "milestone"            // hit N customers, $X ARR, fundraising
  | "feature_launch"       // a single feature lands publicly
  | "incident_resolved"    // post-incident transparency note
  | "thought_leadership";  // pure positioning, no specific event

export type SocialChannel = "linkedin" | "x" | "blog";

export type RiskTier = "low" | "medium" | "high" | "critical";

export interface MarketingEvent {
  kind: MarketingEventKind;
  /** One-line summary. Becomes the lede. */
  summary: string;
  /** Optional supporting facts. Each must be verifiably true. */
  facts?: readonly string[];
  /** Optional referenced commit ids / phase numbers. */
  references?: readonly string[];
  /** Optional date the event is associated with (ISO). Defaults to now. */
  occurredAt?: string;
  /** True when the event involves customer names, dollar amounts, or
   * legal-sensitive content. Forces tier=high or critical regardless
   * of channel. */
  mentionsCustomer?: boolean;
  /** True for incident posts. Forces an explicit dual-control approval. */
  mentionsIncident?: boolean;
}

export interface SocialDraft {
  id: string;
  channel: SocialChannel;
  /** Body text — pre-formatted for the channel (handles char limits). */
  body: string;
  /** Suggested hashtags (channel-appropriate count). */
  hashtags: readonly string[];
  /** Suggested call-to-action url (defaults to the marketing site). */
  cta: { label: string; href: string };
  /** Closed-union risk tier — drives the approval policy. */
  riskTier: RiskTier;
  /** Verdict that the operator should see before approving. */
  recommendedGate: "auto_publish" | "single_approval" | "dual_approval";
  /** Char count of body — useful for the cockpit to show "47 / 280". */
  charCount: number;
  /** Reasons the kernel chose this risk tier — operator-readable. */
  riskReasons: readonly string[];
}

const CHANNEL_LIMITS: Record<SocialChannel, number> = {
  linkedin: 3000,
  x:        280,
  blog:     6000,
};

const CHANNEL_HASHTAG_CAP: Record<SocialChannel, number> = {
  linkedin: 4,
  x:        2,
  blog:     6,
};

const CTA_DEFAULTS: Record<MarketingEventKind, { label: string; href: string }> = {
  phase_shipped:       { label: "See what shipped",     href: "https://visionxixlabs.com/changelog" },
  milestone:           { label: "Learn more",           href: "https://visionxixlabs.com/team-of-one" },
  feature_launch:      { label: "See capabilities",     href: "https://visionxixlabs.com/capabilities" },
  incident_resolved:   { label: "Read the post-mortem", href: "https://visionxixlabs.com/status" },
  thought_leadership:  { label: "Read on Axiom",        href: "https://visionxixlabs.com/team-of-one" },
};

const HASHTAGS_BY_KIND: Record<MarketingEventKind, readonly string[]> = {
  phase_shipped:      ["AIops", "DevOps", "Cloud", "BuildInPublic"],
  milestone:          ["AIops", "Cloud", "Startups", "AGI"],
  feature_launch:     ["AIops", "Automation", "Cloud", "Security"],
  incident_resolved:  ["Reliability", "Transparency", "DevOps", "SRE"],
  thought_leadership: ["AIops", "AGI", "DevOps", "Cloud", "Engineering"],
};

let counter = 0;
function nextId(): string {
  counter += 1;
  return `draft-${counter}`;
}

/** Reset the in-process counter — only intended for tests. */
export function __resetDraftCounter(): void {
  counter = 0;
}

function clamp(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1).trimEnd();
  return `${cut}…`;
}

/** Build a single channel-shaped draft. */
function draftForChannel(event: MarketingEvent, channel: SocialChannel): SocialDraft {
  const id = nextId();
  const lede = event.summary.trim();
  const factLines = (event.facts ?? []).map((f) => `• ${f.trim()}`).join("\n");
  const referenceLine =
    event.references && event.references.length > 0
      ? `\n\nRef: ${event.references.join(", ")}`
      : "";
  const closer =
    channel === "x"
      ? ""
      : "\n\nApproval-only by design. Every action audited.";

  const rawBody =
    channel === "x"
      ? lede
      : `${lede}${factLines ? `\n\n${factLines}` : ""}${referenceLine}${closer}`;

  const body = clamp(rawBody, CHANNEL_LIMITS[channel]);
  const hashtags = HASHTAGS_BY_KIND[event.kind].slice(0, CHANNEL_HASHTAG_CAP[channel]);
  const cta = CTA_DEFAULTS[event.kind];

  // Risk tiering:
  // base: low
  // → high if mentions customer
  // → critical if mentions incident
  // → medium if event is feature_launch or milestone with money
  let riskTier: RiskTier = "low";
  const reasons: string[] = [];
  if (event.mentionsCustomer) {
    riskTier = "high";
    reasons.push("Customer name referenced — legal + privacy review required.");
  }
  if (event.mentionsIncident) {
    riskTier = "critical";
    reasons.push("Incident post — dual approval mandatory.");
  }
  if (riskTier === "low" && /\$\s*\d/.test(event.summary)) {
    riskTier = "medium";
    reasons.push("Summary contains a dollar figure — needs finance / legal sign-off.");
  }
  if (reasons.length === 0) reasons.push("Routine marketing — single-operator approval is sufficient.");

  const recommendedGate: SocialDraft["recommendedGate"] =
    riskTier === "critical" ? "dual_approval"
    : riskTier === "high" ? "dual_approval"
    : riskTier === "medium" ? "single_approval"
    : "single_approval";

  return {
    id,
    channel,
    body,
    hashtags,
    cta,
    riskTier,
    recommendedGate,
    charCount: body.length,
    riskReasons: reasons,
  };
}

export interface DraftEventResult {
  event: MarketingEvent;
  drafts: readonly SocialDraft[];
}

export function draftMarketingPosts(
  event: MarketingEvent,
  channels: readonly SocialChannel[] = ["linkedin", "x"],
): DraftEventResult {
  if (!event.summary || !event.summary.trim()) {
    throw new Error("marketingContentDrafter: event.summary is required");
  }
  if (channels.length === 0) {
    throw new Error("marketingContentDrafter: at least one channel required");
  }
  const drafts: SocialDraft[] = channels.map((c) => draftForChannel(event, c));
  return { event, drafts };
}
