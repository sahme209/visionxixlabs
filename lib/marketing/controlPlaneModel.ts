/**
 * Source of truth for the Product page control-plane model (visual language v4, calm variant).
 * Pure data: the 3D scene, the 2D fallback and the inspector all read from here.
 * Illustrative only — describes the architecture, never a live system or a guarantee of
 * features beyond what the installed version supports.
 */
export type ControlPlaneLayerId = "interfaces" | "identity_policy" | "governance_core" | "intelligence" | "execution_evidence";

export type ControlPlanePart = { readonly title: string; readonly detail: string };

export type ControlPlaneLayer = {
  readonly id: ControlPlaneLayerId;
  /** Short title shown on the layer in 3D and in every fallback. */
  readonly title: string;
  readonly summary: string;
  /** Exactly three titled parts per layer; each is a visible block in the model. */
  readonly parts: readonly [ControlPlanePart, ControlPlanePart, ControlPlanePart];
  readonly guarantee: string;
  readonly onFailure: string;
  /** What flows through the pipe to the next stage, and why it matters. Null for the last stage. */
  readonly passesOn: { readonly label: string; readonly detail: string } | null;
  /** Calm per-stage colour, from the shared pipe-flow palette. */
  readonly tone: PipeTone;
};

export type PipeTone = "sky" | "teal" | "violet" | "amber" | "emerald";

export const CONTROL_PLANE_LAYERS: readonly ControlPlaneLayer[] = [
  {
    id: "interfaces",
    title: "Interfaces",
    summary: "Where people and systems talk to Axiom.",
    parts: [
      { title: "Desktop app", detail: "The installed Axiom Agent, where consequential operations are held." },
      { title: "Web companion", detail: "Sign-in, profile, provider consent and connection context." },
      { title: "API and SDKs", detail: "TypeScript, Swift, Python and Go clients for the same backend." },
    ],
    guarantee: "Every entry point uses the same governed backend; no side door skips policy.",
    onFailure: "Unauthenticated or out-of-scope calls are refused before reaching the core.",
    passesOn: { label: "signed request", detail: "Who sent it, from which app, and exactly what they asked for." },
    tone: "sky",
  },
  {
    id: "identity_policy",
    title: "Identity and policy",
    summary: "Who is asking, and what their workspace allows.",
    parts: [
      { title: "Members and roles", detail: "Workspace membership and the role each person holds." },
      { title: "AI provider policy", detail: "Which AI providers and models this workspace permits." },
      { title: "Environment rules", detail: "Production targets raise the risk level and the review needed." },
    ],
    guarantee: "Permissions are read fresh at each decision, not trusted from sign-in.",
    onFailure: "A missing or changed permission stops the request.",
    passesOn: { label: "verified identity + policy", detail: "The confirmed person, their role and the rules that apply to this workspace." },
    tone: "teal",
  },
  {
    id: "governance_core",
    title: "Governance core",
    summary: "Turns intent into an exact, reviewable proposal.",
    parts: [
      { title: "Risk check", detail: "Classifies the change and its blast radius." },
      { title: "Exact proposal", detail: "The precise change, frozen so review covers what will run." },
      { title: "Independent approval", detail: "A second person reviews; the requester cannot approve their own request." },
    ],
    guarantee: "Approval is never execution, and no one approves their own request.",
    onFailure: "Rejected or expired proposals end there, and the reason is recorded.",
    passesOn: { label: "approved proposal", detail: "The exact change a second person reviewed, frozen so only that change can run." },
    tone: "violet",
  },
  {
    id: "intelligence",
    title: "Intelligence",
    summary: "Governed AI on prepaid usage.",
    parts: [
      { title: "AI Gateway", detail: "Applies the workspace model policy to every call." },
      { title: "Credit hold", detail: "Holds prepaid credit before the call starts." },
      { title: "Settle to usage", detail: "Charges actual usage and releases the rest of the hold." },
    ],
    guarantee: "No AI call without current policy and a held credit; never charged beyond prepaid.",
    onFailure: "Policy off or credit short: no call is made and the hold is released.",
    passesOn: { label: "plan + settled credit", detail: "The AI-assisted plan, paid from prepaid credit with any unused hold released." },
    tone: "amber",
  },
  {
    id: "execution_evidence",
    title: "Execution and evidence",
    summary: "Hands approved work to your systems and records the outcome.",
    parts: [
      { title: "One-use dispatch", detail: "Sends the approved change once to your CI or cloud account." },
      { title: "Outcome check", detail: "Success needs independent evidence, not just a started job." },
      { title: "Audit and recovery", detail: "Every step is recorded; rollback starts a new governed request." },
    ],
    guarantee: "Execution runs in your own account, and success needs evidence.",
    onFailure: "Unknown outcomes are reconciled before anything else runs.",
    passesOn: null,
    tone: "emerald",
  },
];

export const CONTROL_PLANE_DEFAULT_LAYER = 2;

/** Two-digit index label, e.g. 0 → "01". */
export function layerNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

/** Clamp a requested layer index to the valid range (keyboard and pointer input both use this). */
export function clampLayer(index: number): number {
  if (!Number.isFinite(index)) return CONTROL_PLANE_DEFAULT_LAYER;
  return Math.min(CONTROL_PLANE_LAYERS.length - 1, Math.max(0, Math.trunc(index)));
}

/**
 * Which layers the request pulse has already passed at progress p (0 → top, 1 → bottom).
 * Returns the index of the layer the pulse is in.
 */
export function pulseLayer(progress: number): number {
  const p = Math.min(0.999999, Math.max(0, progress));
  return Math.floor(p * CONTROL_PLANE_LAYERS.length);
}
