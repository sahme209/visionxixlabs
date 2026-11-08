/**
 * Security page pipe flow: how to assess one action, as data moving through five checks.
 * Pure data for the shared PipeFlow kit. It describes what to verify; it is not an assurance
 * claim. Wording stays within the page's stated limits (no universal enforcement is claimed).
 */
import type { PipeFlowStage } from "@/components/marketing/pipeKit/PipeFlow";

export const SECURITY_ASSESSMENT_STAGES: readonly PipeFlowStage[] = [
  {
    id: "current_access",
    title: "Current access",
    summary: "Who is acting, in which workspace, on which exact target.",
    parts: [
      { title: "Actor and workspace", detail: "The signed-in person and the workspace the action belongs to." },
      { title: "Provider connection", detail: "Which connected account would be used, and its scope." },
      { title: "Exact target", detail: "The specific repository, environment or resource, not a whole provider." },
    ],
    guarantee: "A connected label is not permission for every action; checks belong in the service, not the interface.",
    onFailure: "Missing access or the wrong target means the action should not proceed.",
    passesOn: { label: "confirmed actor + target", detail: "Who is asking and exactly what they want to touch." },
    tone: "sky",
  },
  {
    id: "exact_proposal",
    title: "Exact proposal",
    summary: "What would change, from which source, with which checks.",
    parts: [
      { title: "Change and scope", detail: "The precise change and everything it reaches." },
      { title: "Source", detail: "Where the change comes from, such as a commit or a release." },
      { title: "Validation and recovery", detail: "How success is checked and how it would be undone." },
    ],
    guarantee: "Review covers the exact change, so what is approved is what would run.",
    onFailure: "An unclear source or scope means the proposal is not ready to review.",
    passesOn: { label: "reviewable proposal", detail: "The exact change with its validation and recovery plan." },
    tone: "teal",
  },
  {
    id: "independent_review",
    title: "Independent review",
    summary: "Which review this workflow needs, and who may decide.",
    parts: [
      { title: "Required review", detail: "The review the selected workflow asks for." },
      { title: "Eligible reviewer", detail: "Someone other than the requester, with the right role." },
      { title: "Decision still valid", detail: "The decision matches this exact proposal and hasn't expired." },
    ],
    guarantee: "Where a workflow requires it, the requester cannot approve their own request.",
    onFailure: "A rejected, expired or mismatched decision ends the request on record.",
    passesOn: { label: "valid decision", detail: "An approval bound to this exact proposal." },
    tone: "violet",
  },
  {
    id: "deliberate_execution",
    title: "Deliberate execution",
    summary: "The requester runs it, after current authority is checked again.",
    parts: [
      { title: "Requester confirms", detail: "The person who asked starts the run on purpose." },
      { title: "Authority re-checked", detail: "Permissions and the decision are read again just before running." },
      { title: "Runs in your account", detail: "The provider action happens in your connected system." },
    ],
    guarantee: "A saved plan or approval alone is not a provider outcome.",
    onFailure: "Changed authority stops the run before anything is sent.",
    passesOn: { label: "provider result", detail: "What the provider reported: confirmed, refused or unknown." },
    tone: "amber",
  },
  {
    id: "outcome_recovery",
    title: "Outcome and recovery",
    summary: "Tell confirmed, refused and unknown results apart, then recover deliberately.",
    parts: [
      { title: "Classify the result", detail: "Confirmed, refused or unknown, each handled differently." },
      { title: "Inspect history", detail: "Read what was recorded before deciding what to do next." },
      { title: "Recover deliberately", detail: "Recovery is a new reviewed action; uncertain actions are never resent." },
    ],
    guarantee: "Supported paths record actors, decisions and outcomes.",
    onFailure: "An unknown result is investigated first; a green workflow alone does not prove application health.",
    passesOn: null,
    tone: "emerald",
  },
];
