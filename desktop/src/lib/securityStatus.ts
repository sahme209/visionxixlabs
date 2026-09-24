/**
 * Desktop-side security status. Mirrors the web platform's data
 * classification + handoff guarantees so the desktop's Security view
 * renders honest claims without independently re-deriving them.
 */

import { DESKTOP_VERSION } from "./desktopMetadata";

export type DesktopSecurityState = "unknown" | "trusted" | "version_blocked" | "signature_blocked" | "policy_blocked" | "revoked";

export interface DesktopSecurityCheck {
  id: string;
  label: string;
  detail: string;
  status: "ok" | "warning" | "blocked" | "unknown";
}

export interface DesktopSecurityStatus {
  state: DesktopSecurityState;
  appVersion: string;
  channel: "stable" | "beta" | "preview" | "dev";
  signing: { macos: "not_signed" | "signed" | "notarized"; windows: boolean; linux: boolean };
  applyGate: { reason: string; blockedByDefault: boolean };
  handoffSignerConfigured: boolean;
  auditSyncReachable: boolean;
  checks: DesktopSecurityCheck[];
}

export function defaultDesktopSecurityStatus(): DesktopSecurityStatus {
  return {
    state: "unknown",
    appVersion: DESKTOP_VERSION,
    channel: "preview",
    signing: { macos: "not_signed", windows: false, linux: false },
    applyGate: {
      reason:
        "Local apply requires approval + tenant policy + rollback + reachable audit sink. " +
        "Refused otherwise.",
      blockedByDefault: true,
    },
    handoffSignerConfigured: false,
    auditSyncReachable: false,
    checks: [
      { id: "pairing",     label: "Pairing",               detail: "Not verified in this session.",                                      status: "unknown" },
      { id: "version",     label: "Version",               detail: `v${DESKTOP_VERSION} · preview channel.`,                         status: "warning" },
      { id: "signature",   label: "Code signing",          detail: "Read signing and notarization state from the release manifest.",        status: "unknown" },
      { id: "audit_sync",  label: "Audit sync",            detail: "Reachability has not been checked.",                                   status: "unknown" },
      { id: "redaction",   label: "Log redaction",         detail: "Canonical redaction is configured; runtime coverage still requires verification.", status: "warning" },
      { id: "local_apply", label: "Local Terraform apply", detail: "Disabled by the current desktop safety contract.",                       status: "warning" },
      { id: "handoff_sig", label: "Handoff signer",        detail: "Configuration and signature validity have not been checked.",           status: "unknown" },
    ],
  };
}
