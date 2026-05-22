/**
 * Internal VisionXIXLabs growth automation — typed models.
 *
 * These models are INTERNAL ONLY. They live alongside the client SaaS
 * product but never surface in /dashboard/* — every consumer must be a
 * route under /admin/* (guarded by isAdminEmail) or a backend worker.
 *
 * Pure types — persistence lands in a follow-up Prisma migration. The
 * admin UI binds to these types so we can iterate without a schema.
 */

import "server-only";

// ---------------------------------------------------------------------------
// Channels + closed-union taxonomy
// ---------------------------------------------------------------------------

export type SocialChannel = "linkedin" | "x" | "blog" | "website" | "newsletter" | "youtube_short";

export type ContentTopicCategory =
  | "product_education"
  | "thought_leadership"
  | "launch_announcement"
  | "case_study"
  | "founder_voice"
  | "technical_deep_dive"
  | "marketing_campaign";

export type DraftStatus =
  | "idea"
  | "drafted"
  | "in_review"
  | "approved"
  | "scheduled"
  | "published"
  | "rejected"
  | "needs_revision";

export type ApprovalAction = "publish" | "send_outreach" | "update_website" | "schedule";

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

export interface ContentIdea {
  id: string;
  /** Short headline of the idea. */
  title: string;
  /** Topic category. */
  category: ContentTopicCategory;
  /** Channels this idea targets. */
  channels: readonly SocialChannel[];
  /** Free-text angle / hook. */
  angle: string;
  /** Why this idea was generated — used by the planner to learn. */
  rationale?: string;
  /** Numeric priority assigned by the planner — higher = surface first. */
  priority: number;
  /** ISO timestamp of generation. */
  generatedAt: string;
  /** Optional source — which workflow created the idea. */
  generatedBy: "daily_content_workflow" | "weekly_campaign_workflow" | "product_education_workflow" | "launch_workflow" | "manual";
}

export interface SocialPostDraft {
  id: string;
  /** Linked content idea if generated from one. */
  ideaId?: string;
  channel: SocialChannel;
  /** Full draft body, ready for approval (or editing). */
  body: string;
  /** Optional hashtags / mentions to append. */
  hashtags: readonly string[];
  /** Optional call-to-action label. */
  cta?: string;
  status: DraftStatus;
  /** ISO timestamp. */
  createdAt: string;
  updatedAt: string;
  /** ISO timestamp when scheduled — only set when status === "scheduled". */
  scheduledFor?: string;
  /** Audit fields. */
  draftedByAgent: string;
  reviewedByUserEmail?: string;
  /** External post id if published. */
  externalPostId?: string;
  externalPostUrl?: string;
  /** Performance snapshot once available. */
  performance?: SocialPostPerformance;
}

export interface SocialPostPerformance {
  /** ISO timestamp of last metrics pull. */
  collectedAt: string;
  impressions: number;
  clicks: number;
  engagementCount: number;
  /** Net new follows attributed to this post (when known). */
  follows?: number;
}

export interface GrowthCampaign {
  id: string;
  name: string;
  /** Short campaign hypothesis. */
  hypothesis: string;
  /** Theme / topic. */
  theme: ContentTopicCategory;
  /** Start / end ISO dates. */
  startsAt: string;
  endsAt: string;
  status: "planned" | "active" | "paused" | "completed" | "cancelled";
  /** Post drafts allocated to this campaign. */
  draftIds: readonly string[];
  /** Performance KPIs. */
  targets: {
    impressions: number;
    engagements: number;
    websiteVisits: number;
    qualifiedLeads: number;
  };
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
}

export interface BlogDraft {
  id: string;
  ideaId?: string;
  title: string;
  outline: readonly string[];
  body?: string;
  status: DraftStatus;
  draftedByAgent: string;
  createdAt: string;
  updatedAt: string;
  reviewedByUserEmail?: string;
  publishedUrl?: string;
}

export interface WebsiteContentSuggestion {
  id: string;
  /** Which page on the public site this targets — e.g. "/", "/platform", "/plans". */
  targetPath: string;
  /** Which section / component slot. */
  sectionLabel: string;
  /** Suggested new copy. */
  proposedCopy: string;
  /** Rationale for the change. */
  rationale: string;
  status: "idea" | "in_review" | "approved" | "applied" | "rejected";
  generatedAt: string;
}

export interface HomepageDemoSequence {
  id: string;
  /** Slug for /admin/growth/website-demo/[slug]. */
  slug: string;
  name: string;
  /** Ordered animation steps. */
  steps: readonly DemoAnimationStep[];
  /** Whether this is the current homepage default. */
  isLive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DemoAnimationStep {
  id: string;
  /** Step order. */
  order: number;
  /** Short label rendered above the demo viewport during the step. */
  label: string;
  /** Operator-readable description of what's shown. */
  description: string;
  /** Cursor end position in viewport %. */
  cursorTarget: { xPct: number; yPct: number };
  /** Click highlight on the target element id. */
  clickTargetId?: string;
  /** App-state mutation to render — closed-union. */
  appState:
    | "connector_validating"
    | "scan_running"
    | "iam_risk_detected"
    | "alert_linked"
    | "deployment_checked"
    | "approval_requested"
    | "approval_granted"
    | "report_generated"
    | "dashboard_healthy";
  /** Hold duration in ms before moving to the next step. */
  holdMs: number;
}

export interface OutreachDraft {
  id: string;
  /** Recipient label — never actual contact info until approved. */
  recipientLabel: string;
  /** Recipient persona / segment. */
  persona: string;
  /** Channel — email / linkedin DM. */
  channel: "email" | "linkedin_dm";
  /** Subject (email only). */
  subject?: string;
  /** Draft body. */
  body: string;
  status: DraftStatus;
  draftedByAgent: string;
  createdAt: string;
  updatedAt: string;
  /** Audit pointer to the approval. */
  approvalRecordId?: string;
}

export interface LeadResearchRecord {
  id: string;
  /** Industry vertical we're targeting. */
  vertical: string;
  /** Persona we're modelling — e.g. "platform-eng-lead-at-fintech". */
  persona: string;
  /** Pain points discovered. */
  painPoints: readonly string[];
  /** Outreach angles to test. */
  outreachAngles: readonly string[];
  /** ISO. */
  generatedAt: string;
}

export interface PublishingApproval {
  id: string;
  /** What's being approved. */
  action: ApprovalAction;
  /** What draft / suggestion this approves. */
  targetKind: "social_post" | "blog" | "website" | "outreach";
  targetId: string;
  /** State machine. */
  state: "pending" | "approved" | "rejected" | "expired";
  /** Operator who acted. */
  decidedByUserEmail?: string;
  /** ISO timestamps. */
  requestedAt: string;
  decidedAt?: string;
  /** Optional rationale for rejections. */
  rejectionReason?: string;
}

export interface GrowthAutomationRun {
  id: string;
  /** Which workflow ran. */
  workflow:
    | "daily_content"
    | "weekly_campaign"
    | "product_education"
    | "thought_leadership"
    | "launch_workflow"
    | "website_hero_demo"
    | "lead_research"
    | "analytics_feedback";
  startedAt: string;
  completedAt?: string;
  outcome: "ok" | "partial" | "failed";
  artifactsCreated: {
    ideas: number;
    socialDrafts: number;
    blogDrafts: number;
    websiteSuggestions: number;
    outreachDrafts: number;
    leadResearchRecords: number;
  };
  /** Free-text summary the workflow produced. */
  summary?: string;
}

export interface GrowthAuditLog {
  id: string;
  /** Whoever caused the action — agent module id, cron trigger, or operator email. */
  actor: string;
  action: string;
  targetKind?: string;
  targetId?: string;
  detail?: Record<string, string | number | boolean>;
  occurredAt: string;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

const CHANNELS: SocialChannel[] = ["linkedin", "x", "blog", "website", "newsletter", "youtube_short"];

export function isSocialChannel(v: string): v is SocialChannel {
  return (CHANNELS as string[]).includes(v);
}

const STATUSES: DraftStatus[] = ["idea", "drafted", "in_review", "approved", "scheduled", "published", "rejected", "needs_revision"];

export function isDraftStatus(v: string): v is DraftStatus {
  return (STATUSES as string[]).includes(v);
}
