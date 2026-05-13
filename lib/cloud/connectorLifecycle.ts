/**
 * Connector lifecycle engine — typed state machine for cloud onboarding,
 * validation, scanning, snapshot generation, and reasoning.
 *
 * All three providers (AWS active, Azure/GCP foundation) share this same
 * state machine. Provider-specific lifecycle behavior is composed by
 * implementing handlers per state; the state machine itself is provider-agnostic.
 */

import type { CloudProvider } from "@/lib/connectors/interface";
import type { CloudSnapshot } from "@/lib/cloud/snapshotModel";

// ---------------------------------------------------------------------------
// Lifecycle states
// ---------------------------------------------------------------------------

export type LifecycleState =
  | "provider.selected"           // User picked a provider
  | "provider.setup_started"      // Onboarding wizard opened
  | "credentials.submitted"       // User entered credentials / Role ARN
  | "credentials.validating"      // Axiom is calling assume-role / SP / SA
  | "credentials.validated"       // Validation succeeded
  | "credentials.failed"          // Validation failed — see error code
  | "scan.ready"                  // Ready to scan; awaiting trigger
  | "scan.started"                // Scan accepted; in queue
  | "scan.running"                // Scan actively enumerating resources
  | "scan.completed"              // Scan produced a snapshot
  | "scan.failed"                 // Scan errored before completion
  | "snapshot.created"            // Normalized snapshot persisted
  | "findings.generated"          // Signal engine produced findings
  | "recommendations.generated"   // Recommendations attached to findings
  | "execution_plan.ready"        // Plan candidate built; awaiting approval
  | "lifecycle.idle";             // Steady state (between recurring runs)

export type LifecycleProviderTier = "active" | "expanding" | "preview" | "unavailable";

/** Subset of states that are valid for "expanding" providers (Azure, GCP). */
export const EXPANDING_STATES: LifecycleState[] = [
  "provider.selected",
  "provider.setup_started",
  "credentials.submitted",
  "credentials.validating",
  "credentials.validated",
  "credentials.failed",
  "scan.ready",
  "scan.started",
  "scan.running",
  "scan.completed",
  "scan.failed",
  "snapshot.created",
];

// ---------------------------------------------------------------------------
// State machine + transitions
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  "provider.selected": ["provider.setup_started"],
  "provider.setup_started": ["credentials.submitted", "provider.selected"],
  "credentials.submitted": ["credentials.validating"],
  "credentials.validating": ["credentials.validated", "credentials.failed"],
  "credentials.validated": ["scan.ready"],
  "credentials.failed": ["credentials.submitted", "provider.setup_started"],
  "scan.ready": ["scan.started"],
  "scan.started": ["scan.running"],
  "scan.running": ["scan.completed", "scan.failed"],
  "scan.completed": ["snapshot.created"],
  "scan.failed": ["scan.ready", "credentials.failed"],
  "snapshot.created": ["findings.generated"],
  "findings.generated": ["recommendations.generated"],
  "recommendations.generated": ["execution_plan.ready", "lifecycle.idle"],
  "execution_plan.ready": ["lifecycle.idle"],
  "lifecycle.idle": ["scan.ready"],
};

export function canTransition(from: LifecycleState, to: LifecycleState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** All states a given state can transition into. */
export function nextStates(from: LifecycleState): LifecycleState[] {
  return TRANSITIONS[from] ?? [];
}

// ---------------------------------------------------------------------------
// Lifecycle context — captured per (provider × account) pair
// ---------------------------------------------------------------------------

export interface LifecycleContext {
  provider: CloudProvider;
  tier: LifecycleProviderTier;
  state: LifecycleState;
  /** The account/subscription/project ID once validated. */
  accountId?: string;
  /** Selected regions. */
  regions?: string[];
  /** Last error code if state is *.failed. */
  errorCode?: string;
  /** Human-readable error message if state is *.failed. */
  errorMessage?: string;
  /** Latest snapshot produced by this lifecycle context. */
  latestSnapshot?: CloudSnapshot;
  /** When this lifecycle was last advanced. */
  updatedAt: string;
  /** History of state transitions, newest first. */
  history?: { state: LifecycleState; at: string; note?: string }[];
}

// ---------------------------------------------------------------------------
// Honest expanding-tier guard
// ---------------------------------------------------------------------------

/**
 * For expanding providers (Azure/GCP), block transitions into states beyond
 * snapshot.created — reasoning and execution plan are not yet implemented.
 */
export function isStateAvailable(provider: CloudProvider, tier: LifecycleProviderTier, state: LifecycleState): boolean {
  if (tier === "active") return true;
  if (tier === "unavailable") return false;
  // expanding / preview tiers — only allow states up to snapshot.created
  return EXPANDING_STATES.includes(state);
}

// ---------------------------------------------------------------------------
// State display
// ---------------------------------------------------------------------------

export interface LifecycleDisplay {
  label: string;
  detail: string;
  /** Short pill text suited for status badges. */
  pill: string;
  /** Semantic color for the state. */
  semantic: "neutral" | "running" | "success" | "warning" | "error";
}

const DISPLAY: Record<LifecycleState, LifecycleDisplay> = {
  "provider.selected":          { label: "Provider selected",         detail: "Provider chosen; setup wizard not yet opened.", pill: "Selected",         semantic: "neutral" },
  "provider.setup_started":     { label: "Setup started",             detail: "Onboarding wizard open; awaiting credentials.", pill: "Setup",            semantic: "neutral" },
  "credentials.submitted":      { label: "Credentials submitted",     detail: "Credentials received; validation queued.",      pill: "Submitted",        semantic: "running" },
  "credentials.validating":     { label: "Validating connection",     detail: "Calling assume-role / SP / SA endpoint.",       pill: "Validating",       semantic: "running" },
  "credentials.validated":      { label: "Connection validated",      detail: "Read access confirmed.",                        pill: "Validated",        semantic: "success" },
  "credentials.failed":         { label: "Validation failed",         detail: "Connection could not be validated.",            pill: "Failed",           semantic: "error" },
  "scan.ready":                 { label: "Ready to scan",             detail: "Connection verified; ready for first scan.",    pill: "Ready",            semantic: "success" },
  "scan.started":               { label: "Scan queued",               detail: "Scan accepted; awaiting worker.",               pill: "Queued",           semantic: "running" },
  "scan.running":               { label: "Scan running",              detail: "Enumerating resources across regions.",         pill: "Scanning",         semantic: "running" },
  "scan.completed":             { label: "Scan completed",            detail: "Raw enumeration finished; building snapshot.",  pill: "Completed",        semantic: "success" },
  "scan.failed":                { label: "Scan failed",               detail: "Scan errored; see error code.",                 pill: "Failed",           semantic: "error" },
  "snapshot.created":           { label: "Snapshot ready",            detail: "Typed snapshot persisted.",                     pill: "Snapshot",         semantic: "success" },
  "findings.generated":         { label: "Findings generated",        detail: "Signal engine produced findings.",              pill: "Findings",         semantic: "warning" },
  "recommendations.generated":  { label: "Recommendations ready",     detail: "Findings turned into recommendations.",         pill: "Recs ready",       semantic: "warning" },
  "execution_plan.ready":       { label: "Execution plan ready",      detail: "Plan candidate awaiting approval.",             pill: "Plan ready",       semantic: "warning" },
  "lifecycle.idle":             { label: "Idle",                      detail: "Between scheduled runs.",                       pill: "Idle",             semantic: "neutral" },
};

export function displayFor(state: LifecycleState): LifecycleDisplay {
  return DISPLAY[state];
}

// ---------------------------------------------------------------------------
// Lifecycle helpers
// ---------------------------------------------------------------------------

/**
 * Advance a lifecycle context to a new state. Returns a new context object —
 * does not mutate input. Throws if the transition is invalid.
 */
export function advance(ctx: LifecycleContext, to: LifecycleState, note?: string): LifecycleContext {
  if (!canTransition(ctx.state, to)) {
    throw new Error(`Invalid lifecycle transition: ${ctx.state} → ${to}`);
  }
  if (!isStateAvailable(ctx.provider, ctx.tier, to)) {
    throw new Error(`State ${to} not available for ${ctx.provider} (${ctx.tier})`);
  }
  const at = new Date().toISOString();
  return {
    ...ctx,
    state: to,
    updatedAt: at,
    history: [{ state: to, at, note }, ...(ctx.history ?? [])].slice(0, 50),
  };
}

/**
 * Create a fresh lifecycle context.
 */
export function createContext(provider: CloudProvider, tier: LifecycleProviderTier): LifecycleContext {
  return {
    provider,
    tier,
    state: "provider.selected",
    updatedAt: new Date().toISOString(),
    history: [{ state: "provider.selected", at: new Date().toISOString() }],
  };
}
