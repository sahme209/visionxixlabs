/**
 * Approval workflow docs pipe flow: how an Agent write moves from proposal to record.
 * Pure data for the shared PipeFlow kit, matching /docs/approval-workflow exactly, including
 * its limit that separate requester execution is a local preview, not production-activated.
 */
import type { PipeFlowStage } from "@/components/marketing/pipeKit/PipeFlow";

export const APPROVAL_FLOW_STAGES: readonly PipeFlowStage[] = [
  {
    id: "propose",
    title: "Agent proposes",
    summary: "A registered Agent tool call becomes a persisted proposal.",
    parts: [
      { title: "Tool and arguments", detail: "Exactly which tool and inputs the Agent wants." },
      { title: "Workspace", detail: "The workspace the request belongs to." },
      { title: "Status", detail: "Proposed, approved, rejected, executed or failed." },
    ],
    guarantee: "Medium- and high-risk tool calls don't execute inside the decision loop.",
    onFailure: "An invalid or out-of-scope tool call is never persisted as runnable.",
    passesOn: { label: "persisted proposal", detail: "The exact request, saved so review covers what would run." },
    tone: "sky",
  },
  {
    id: "classify",
    title: "Risk is classified",
    summary: "Low-risk reads run inline; changes need approval.",
    parts: [
      { title: "Low risk", detail: "Read-only checks execute inline and are still recorded." },
      { title: "Medium risk", detail: "Reversible configuration or repository changes need approval." },
      { title: "High risk", detail: "Deployments and sensitive configuration need approval." },
    ],
    guarantee: "In production context, risk can only go up, never down for convenience.",
    onFailure: "If risk can't be classified, the change waits for review rather than running.",
    passesOn: { label: "risk-rated proposal", detail: "The proposal plus the review it requires." },
    tone: "teal",
  },
  {
    id: "review",
    title: "Independent review",
    summary: "An authorized human reviewer approves or rejects the exact proposal.",
    parts: [
      { title: "Separate endpoints", detail: "Approve and reject are separate authenticated calls." },
      { title: "Not the Agent", detail: "The Agent can't approve its own request." },
      { title: "Exact proposal", detail: "The decision binds to the persisted proposal, not a summary." },
    ],
    guarantee: "Approval permission is distinct from execution permission.",
    onFailure: "A rejection ends the request, and the decision is recorded.",
    passesOn: { label: "approval record", detail: "Who approved which exact proposal, and when." },
    tone: "violet",
  },
  {
    id: "execute",
    title: "Separate execution",
    summary: "In the preview, the original requester runs it as a separate step.",
    parts: [
      { title: "Requester runs it", detail: "Approval records review only; running is a separate step." },
      { title: "Checks again", detail: "Authorization, the exact proposal and the target are checked again." },
      { title: "Preview only", detail: "Not production-activated; your version may not show Execute." },
    ],
    guarantee: "Approval status alone doesn't prove that an action ran.",
    onFailure: "A changed proposal, target or permission stops the run.",
    passesOn: { label: "execution attempt", detail: "What was sent, and what the provider reported." },
    tone: "amber",
  },
  {
    id: "record",
    title: "Recorded outcome",
    summary: "Every tool call gets an action record, including low-risk reads.",
    parts: [
      { title: "Every call", detail: "Reads are recorded as well as writes." },
      { title: "Clear states", detail: "Proposed, approved, rejected, executed and failed are distinct." },
      { title: "Outcome evidence", detail: "Health or rollback each need their own evidence." },
    ],
    guarantee: "Observation is as reviewable as mutation.",
    onFailure: "An unverified outcome stays unverified until independent evidence exists.",
    passesOn: null,
    tone: "emerald",
  },
];
