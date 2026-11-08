/**
 * Integrations page pipe flow: how one connection is used, from catalog to recorded outcome.
 * Pure data for the shared PipeFlow kit. It matches the page's limits: browsing starts no
 * connection, readiness, review and execution are separate checks, and a catalog entry is
 * not an available connection.
 */
import type { PipeFlowStage } from "@/components/marketing/pipeKit/PipeFlow";

export const INTEGRATION_FLOW_STAGES: readonly PipeFlowStage[] = [
  {
    id: "choose",
    title: "Choose a workflow",
    summary: "Pick the job first, then the connection that supports it.",
    parts: [
      { title: "Availability", detail: "Available, configuration required, preview or planned." },
      { title: "Operation limits", detail: "What this workflow can and can't do today." },
      { title: "Setup needs", detail: "The accounts and permissions it requires." },
    ],
    guarantee: "Browsing the catalog starts no connection and grants no permission.",
    onFailure: "A planned or preview entry is not an available connection; nothing can be set up from it.",
    passesOn: { label: "chosen workflow", detail: "The job, the connector it needs and its known limits." },
    tone: "sky",
  },
  {
    id: "connect",
    title: "Connect and scope",
    summary: "Authorize the provider with the narrowest scope that does the job.",
    parts: [
      { title: "Provider sign-in", detail: "You authorize the connection with the provider itself." },
      { title: "Narrow scope", detail: "Only the repositories, projects or accounts the job needs." },
      { title: "Workspace binding", detail: "The connection belongs to one Axiom workspace." },
    ],
    guarantee: "A connected label is not permission for every action.",
    onFailure: "Missing or wrong scope means the connection is not ready for this workflow.",
    passesOn: { label: "scoped connection", detail: "A provider link limited to what this workflow needs." },
    tone: "teal",
  },
  {
    id: "read",
    title: "Read evidence",
    summary: "Axiom reads current state before anything is proposed.",
    parts: [
      { title: "Current state", detail: "What exists now in the connected system." },
      { title: "Source of truth", detail: "The provider's own record, not a cached guess." },
      { title: "Readiness check", detail: "Whether this workflow can run with this connection." },
    ],
    guarantee: "Proposals are built from what the provider reports, not from assumptions.",
    onFailure: "Unreadable or stale state stops the workflow before a proposal is made.",
    passesOn: { label: "observed state", detail: "The provider's current facts the proposal will rely on." },
    tone: "violet",
  },
  {
    id: "propose_review",
    title: "Propose and review",
    summary: "An exact change is prepared and reviewed separately.",
    parts: [
      { title: "Exact proposal", detail: "The precise change for this provider and target." },
      { title: "Independent review", detail: "A separate person decides where the workflow requires it." },
      { title: "Decision recorded", detail: "Who decided, when, and on which exact proposal." },
    ],
    guarantee: "Connection readiness, review and execution are separate checks.",
    onFailure: "A rejected or expired decision ends the request on record.",
    passesOn: { label: "approved change", detail: "The reviewed proposal, ready for deliberate execution." },
    tone: "amber",
  },
  {
    id: "act_record",
    title: "Act and record",
    summary: "The requester runs the change in the provider, and the outcome is recorded.",
    parts: [
      { title: "Deliberate run", detail: "Started on purpose, after authority is checked again." },
      { title: "Provider result", detail: "Confirmed, refused or unknown, as the provider reports it." },
      { title: "Audit record", detail: "The outcome joins the workspace history." },
    ],
    guarantee: "The action happens in your connected account, and the result is recorded.",
    onFailure: "An unknown result is investigated before anything is resent.",
    passesOn: null,
    tone: "emerald",
  },
];
