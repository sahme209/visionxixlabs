/**
 * Phase 417 — operator-facing copy for the ConnectorSetup state machine.
 *
 * The kernel + repo + snapshot tell us WHAT state we're in. This module
 * answers two questions the dashboard panel actually needs to render:
 *
 *   1. "What should the operator DO right now?"
 *        → suggestNextAction(status, lastErrorCode?)
 *   2. "What just happened, in plain English?"
 *        → describeTransition(transition)
 *
 * Pure function, no I/O. All copy is customer-facing — no SDK names,
 * no env-var leakage, no "broker user needs sts:AssumeRole" pre-diagnosis
 * (that's the bug that chased us through Phase 410-412).
 */

import { statusLabel, type ConnectorSetupStatus } from "./connectorSetupSession";

/* ──────────────────────────────────────────────────────────────────
   suggestNextAction — drives the primary CTA on the connector card.
   ────────────────────────────────────────────────────────────── */

export type ActionTone = "primary" | "secondary" | "danger" | "none";

export interface SuggestedAction {
  /** Imperative button label. Empty string when `tone` is "none". */
  ctaLabel: string;
  /** Visual tone — tells the UI which button style to use. */
  tone: ActionTone;
  /** One-line description shown under the status pill. */
  description: string;
  /** Optional secondary hint — used when there's extra context (e.g. last error). */
  hint?: string;
}

export function suggestNextAction(
  status: ConnectorSetupStatus,
  lastErrorCode?: string | null,
): SuggestedAction {
  switch (status) {
    case "not_connected":
      return {
        ctaLabel: "Connect",
        tone: "primary",
        description: "Link this provider to start collecting cost + posture data.",
      };

    case "setup_started":
      return {
        ctaLabel: "Continue setup",
        tone: "primary",
        description: "Pick up where you left off — the setup link is ready.",
      };

    case "waiting_for_provider":
      return {
        ctaLabel: "Finish in provider console",
        tone: "primary",
        description: "Switch to the provider tab to finish — then come back and validate.",
      };

    case "validating":
      return {
        ctaLabel: "",
        tone: "none",
        description: "Verifying credentials with the provider. This usually takes a few seconds.",
      };

    case "connected":
      return {
        ctaLabel: "Disconnect",
        tone: "secondary",
        description: "Connector is live and read-only. No action needed.",
      };

    case "needs_attention":
      return {
        ctaLabel: "Re-validate",
        tone: "primary",
        description: "Health check found a regression. Re-validate to confirm — or fix the provider-side permission and retry.",
      };

    case "failed":
      return {
        ctaLabel: "Start fresh setup",
        tone: "primary",
        description: "Validation didn't pass. Re-run setup with a fresh session ID.",
        hint: formatErrorCodeHint(lastErrorCode ?? null),
      };

    case "disconnected":
      return {
        ctaLabel: "Reconnect",
        tone: "primary",
        description: "You disconnected this provider. Re-run setup to bring it back online.",
      };

    case "revoked":
      return {
        ctaLabel: "Reconnect",
        tone: "danger",
        description: "The provider invalidated our access (credentials rotated or stack removed). Run setup again.",
      };
  }
}

/* ──────────────────────────────────────────────────────────────────
   describeTransition — renders one audit row as a human-readable line.
   ────────────────────────────────────────────────────────────── */

export interface TransitionView {
  fromStatus: ConnectorSetupStatus;
  toStatus: ConnectorSetupStatus;
  eventKind: string;
  isLegal: boolean;
  actorLabel: string | null;
  actorUserId: string | null;
}

export function describeTransition(t: TransitionView): string {
  if (!t.isLegal) {
    // Illegal transitions show up in the audit log so we can debug
    // "why didn't my button work" — kept terse since they're rare in
    // healthy flows.
    return `Ignored ${humanizeEventKind(t.eventKind)} — connector was in ${statusLabel(t.fromStatus)}.`;
  }
  const actor = describeActor(t);
  const verb = legalTransitionVerb(t.eventKind);
  return `${actor} ${verb} — now ${statusLabel(t.toStatus).toLowerCase()}.`;
}

/* ──────────────────────────────────────────────────────────────────
   Internals.
   ────────────────────────────────────────────────────────────── */

function describeActor(t: TransitionView): string {
  if (t.actorUserId) return `Operator`;
  if (t.actorLabel) {
    if (t.actorLabel.startsWith("cron")) return "Health check";
    if (t.actorLabel.startsWith("webhook")) return "Provider webhook";
    if (t.actorLabel.startsWith("validator")) return "Validator";
    return capitalize(t.actorLabel);
  }
  return "System";
}

function legalTransitionVerb(eventKind: string): string {
  switch (eventKind) {
    case "operator_started":              return "started setup";
    case "provider_link_opened":          return "opened the provider console";
    case "bounce_back_received":          return "returned with credentials";
    case "validation_succeeded":          return "confirmed access";
    case "validation_failed":             return "could not confirm access";
    case "operator_disconnected":         return "disconnected the connector";
    case "provider_revoked_credentials":  return "had credentials revoked by the provider";
    case "health_check_regressed":        return "detected a regression";
    case "health_check_recovered":        return "saw access recover";
    default:                              return humanizeEventKind(eventKind);
  }
}

function humanizeEventKind(eventKind: string): string {
  return eventKind.replace(/_/g, " ");
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s[0].toUpperCase() + s.slice(1);
}

/**
 * Map raw errorCodes to operator-friendly hints. Deliberately conservative
 * — we never pre-diagnose root cause (that was the source of the
 * "broker user needs sts:AssumeRole" loop we chased through ten cards).
 * If we don't recognize the code, we surface it verbatim so operators can
 * look it up.
 */
function formatErrorCodeHint(errorCode: string | null): string | undefined {
  if (!errorCode) return undefined;
  switch (errorCode) {
    case "AccessDenied":
      return "Provider returned AccessDenied. The stack might still be creating — wait 30 seconds and try again.";
    case "HealthCheckAuthFailed":
      return "A periodic health check could no longer reach the provider. Your IAM role / service principal may have been edited.";
    case "AssumeRoleFailed":
      return "The provider rejected the AssumeRole call. Re-deploy the setup template so a fresh trust policy is generated.";
    default:
      return `Provider returned ${errorCode}.`;
  }
}
