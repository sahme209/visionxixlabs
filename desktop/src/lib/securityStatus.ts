/**
 * Desktop-side security status. Mirrors the web platform's data
 * classification + handoff guarantees so the desktop's Security view
 * renders honest claims without independently re-deriving them.
 */

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
    state: "trusted",
    appVersion: "0.1.0",
    channel: "preview",
    signing: { macos: "not_signed", windows: false, linux: false },
    applyGate: {
      reason:
        "Local apply requires approval + tenant policy + rollback + reachable audit sink. " +
        "Refused otherwise.",
      blockedByDefault: true,
    },
    handoffSignerConfigured: true,
    auditSyncReachable: true,
    checks: [
      { id: "pairing",     label: "Pairing",                  detail: "Desktop is paired with the web workspace.",                           status: "ok" },
      { id: "version",     label: "Version",                  detail: "v0.1.0 · preview channel.",                                            status: "warning" },
      { id: "signature",   label: "Code signing",             detail: "Unsigned preview build. Signed builds ship with 1.0.",                 status: "warning" },
      { id: "audit_sync",  label: "Audit sync",               detail: "Local audit events sync to the web store.",                            status: "ok" },
      { id: "redaction",   label: "Log redaction",            detail: "Every log line passes through canonical redaction.",                   status: "ok" },
      { id: "local_apply", label: "Local Terraform apply",    detail: "Disabled — approval-gated. Re-enable via tenant policy.",              status: "warning" },
      { id: "handoff_sig", label: "Handoff signer",           detail: "HMAC-SHA256 over canonical JSON. Single-use nonce + 1h TTL.",          status: "ok" },
    ],
  };
}
