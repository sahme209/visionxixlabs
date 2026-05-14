/**
 * Desktop-side security view. Renders the trust posture the desktop runtime
 * reports to the web — paired status, version, audit sync, local-execution
 * gates. Shapes mirror `lib/desktop/desktopSecurity.ts` + `desktopShellState.ts`
 * in the parent project.
 */

interface SecurityCheck {
  id: string;
  label: string;
  detail: string;
  semantic: "neutral" | "success" | "warning" | "error";
  action?: string;
}

const CHECKS: SecurityCheck[] = [
  { id: "pairing",      label: "Pairing",                detail: "Desktop is paired with the web workspace and trusted.",          semantic: "success" },
  { id: "version",      label: "Version",                detail: "v0.1.0 · preview channel · within tenant policy.",               semantic: "success" },
  { id: "signature",    label: "Code signing",           detail: "Unsigned build (preview). Signed builds ship in 1.0.",            semantic: "warning", action: "View packaging roadmap" },
  { id: "keychain",     label: "OS keychain",            detail: "Available — macOS Keychain detected.",                            semantic: "success" },
  { id: "audit_sync",   label: "Audit sync",             detail: "All local audit events have synced to the web store.",            semantic: "success" },
  { id: "local_apply",  label: "Local Terraform apply",  detail: "Disabled — approval-gated. Re-enable via tenant policy.",         semantic: "warning", action: "Open governance" },
  { id: "redaction",    label: "Log redaction",          detail: "Every log line passes through canonical redaction.",              semantic: "success" },
  { id: "offline",      label: "Offline mode",           detail: "Disabled by tenant policy — audit sync is required.",             semantic: "neutral" },
];

export function SecurityView() {
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Desktop Security</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          What the desktop has access to, how it protects it, and what is still on the roadmap.
        </p>
      </div>

      <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4 text-xs text-zinc-300 leading-relaxed">
        <span className="font-semibold text-emerald-300">Approval-gated.</span> The desktop runtime never bypasses
        web approval, governance policy, RBAC, or audit. Destructive operations require all four gates to pass —
        this surface shows the current state of each.
      </div>

      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800/60 text-xs font-semibold text-zinc-300 uppercase tracking-widest">
          Posture checks
        </div>
        <ul className="divide-y divide-zinc-800/50">
          {CHECKS.map((c) => (
            <li key={c.id} className="px-4 py-3 flex items-start gap-3">
              <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                c.semantic === "success" ? "bg-emerald-400" :
                c.semantic === "warning" ? "bg-amber-400"  :
                c.semantic === "error"   ? "bg-red-400"    :
                                           "bg-zinc-500"
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-zinc-100">{c.label}</p>
                  <span className={`text-[9px] font-semibold uppercase tracking-wider border rounded-full px-1.5 py-px ${
                    c.semantic === "success" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" :
                    c.semantic === "warning" ? "text-amber-300 bg-amber-500/10 border-amber-500/20" :
                    c.semantic === "error"   ? "text-red-300 bg-red-500/10 border-red-500/20" :
                                                "text-zinc-400 bg-zinc-700/30 border-zinc-700/40"
                  }`}>{c.semantic}</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{c.detail}</p>
                {c.action && (
                  <button className="mt-1.5 text-[11px] font-semibold text-violet-300 hover:text-violet-200">
                    {c.action} →
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/30 p-4 text-xs text-zinc-400 leading-relaxed">
        <p className="font-semibold text-zinc-200 mb-2">If your security team asks…</p>
        <ul className="space-y-1.5">
          {[
            ["Does the desktop store credentials?",   "Only via the OS keychain (planned). The local audit log is redacted before write."],
            ["Can the desktop execute Terraform?",   "Preview only today. Apply requires approval + tenant policy + rollback + reachable audit sink."],
            ["Does it require approval?",             "Yes. Approval is granted on the web; the desktop refuses destructive operations otherwise."],
            ["Does it sync audit logs?",              "Yes. Local audit events sync to the web store; sync state appears here and in the web Audit Center."],
            ["What platforms are supported?",         "macOS / Windows / Linux. macOS preview ships first; signing/notarization ship in 1.0."],
            ["What if the desktop is offline?",       "Bundles queue locally. Apply is disabled by default until audit sync resumes."],
          ].map(([q, a]) => (
            <li key={q}>
              <span className="text-zinc-200 font-semibold">{q}</span> <span className="text-zinc-500">{a}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
