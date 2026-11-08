/**
 * Permissions model docs pipe flow: the separate authority boundaries a request crosses.
 * Pure data for the shared PipeFlow kit, restating /docs/permissions-model, including its
 * limit that separate requester execution is a local preview, not production-activated.
 */
import type { PipeFlowStage } from "@/components/marketing/pipeKit/PipeFlow";

export const PERMISSIONS_FLOW_STAGES: readonly PipeFlowStage[] = [
  {
    id: "session",
    title: "Signed-in session",
    summary: "Signing in proves who you are, nothing more.",
    parts: [
      { title: "Desktop session", detail: "Desktop APIs resolve a bearer-token desktop session." },
      { title: "Web sign-in", detail: "The browser session identifies the person." },
      { title: "No implied rights", detail: "Sign-in alone grants no repository or deploy rights." },
    ],
    guarantee: "One successful connection is not authority for everything else.",
    onFailure: "Without a valid session, no workspace action is considered.",
    passesOn: { label: "identified person", detail: "Who is asking, not yet what they may do." },
    tone: "sky",
  },
  {
    id: "workspace",
    title: "Workspace capability",
    summary: "Membership sets the tenant boundary; each action checks its capability.",
    parts: [
      { title: "Membership", detail: "Workspace membership establishes the tenant boundary." },
      { title: "Server-side check", detail: "Each supported action checks its required capability at the server." },
      { title: "AI policy and credit", detail: "AI needs both available credit and an explicit provider policy." },
    ],
    guarantee: "Capabilities are checked by the service, not by what the interface shows.",
    onFailure: "A missing capability refuses the action.",
    passesOn: { label: "allowed capability", detail: "This person may request this kind of action here." },
    tone: "teal",
  },
  {
    id: "provider_scope",
    title: "Provider scope",
    summary: "Provider access is scoped to the exact repository or resource.",
    parts: [
      { title: "GitHub App install", detail: "The installation decides which repositories are available." },
      { title: "Short-lived token", detail: "A token is minted for the selected repository only." },
      { title: "No broad reuse", detail: "A broad user token is not reused for the action." },
    ],
    guarantee: "GitHub tokens are tenant- and repository-scoped.",
    onFailure: "A repository outside the installation can't be acted on.",
    passesOn: { label: "scoped token", detail: "Short-lived access to exactly one target." },
    tone: "violet",
  },
  {
    id: "approval_execution",
    title: "Approval vs execution",
    summary: "Reviewing a change and running it are separate permissions.",
    parts: [
      { title: "Reads run inline", detail: "The decision loop may run registered low-risk reads." },
      { title: "Writes are proposed", detail: "Medium- and high-risk tools create proposals for review." },
      { title: "Preview execution", detail: "The requester runs it separately; a local preview, not production-activated." },
    ],
    guarantee: "The model may recommend; only an authorized independent human records approval.",
    onFailure: "An approval record is not evidence that a provider action ran.",
    passesOn: { label: "approved dispatch", detail: "A reviewed action, sent to your own workflow." },
    tone: "amber",
  },
  {
    id: "cloud_role",
    title: "Cloud role",
    summary: "For AWS ECS, your own GitHub workflow assumes your configured role.",
    parts: [
      { title: "Tenant workflow", detail: "Axiom dispatches the workflow in your repository." },
      { title: "OIDC role", detail: "GitHub Actions OIDC assumes the environment's AWS role." },
      { title: "Two limits", detail: "Constrained by both the GitHub trust subject and the role policy." },
    ],
    guarantee: "AWS permissions stay inside the role you configured.",
    onFailure: "If the trust subject or role policy doesn't allow it, AWS refuses.",
    passesOn: null,
    tone: "emerald",
  },
];
