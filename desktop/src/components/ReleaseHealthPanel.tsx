import { useState } from "react";
import { desktopClient, type ReleaseSignalsDto } from "../lib/desktopClient";

/** Release health after a deployment, from connected read-only signals and Verify checks. Reading changes nothing. */
const VERDICT: Record<ReleaseSignalsDto["verification"]["verdict"], { label: string; tone: string }> = {
  healthy: { label: "Healthy", tone: "text-emerald-300" },
  investigate: { label: "Investigate", tone: "text-amber-300" },
  unhealthy: { label: "Unhealthy", tone: "text-rose-300" },
  no_signals: { label: "No signals connected", tone: "text-zinc-400" },
};

export function ReleaseHealthPanel({ defaultRelease, commit }: { defaultRelease: string; commit: string | null }) {
  const [release, setRelease] = useState(defaultRelease);
  const [state, setState] = useState<{ kind: "idle" | "busy" } | { kind: "done"; data: ReleaseSignalsDto } | { kind: "error"; message: string }>({ kind: "idle" });
  async function check() {
    setState({ kind: "busy" });
    const r = await desktopClient.releaseSignals(release.trim(), commit).catch(() => ({ ok: false as const, error: "unavailable" }));
    setState(r.ok ? { kind: "done", data: r.data } : { kind: "error", message: r.error === "invalid_query" ? "Use the release name your error tracker uses, for example web@1.4.0." : "Release health could not be read. Try again." });
  }
  const d = state.kind === "done" ? state.data : null;
  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[12px]">
      <p className="text-zinc-300">Release health</p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="text-[11px] text-zinc-500">Release name in your tools
          <input value={release} onChange={(e) => { setRelease(e.target.value); setState({ kind: "idle" }); }} spellCheck={false} className="mt-1 block w-48 rounded-md border border-white/10 bg-black/30 px-2 py-1 font-mono text-[12px] text-zinc-200" />
        </label>
        <button data-help-id="settings.workspace.release-health" type="button" disabled={!release.trim() || state.kind === "busy"} onClick={() => void check()} className="rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-white/6 disabled:opacity-50">{state.kind === "busy" ? "Checking…" : "Check release health"}</button>
      </div>
      <div aria-live="polite">
        {state.kind === "error" && <p className="mt-2 text-amber-300">{state.message}</p>}
        {d && <div className="mt-2 space-y-1">
          <p className={VERDICT[d.verification.verdict].tone}>{VERDICT[d.verification.verdict].label}</p>
          {d.verification.reasons.map((r) => <p key={r} className="text-zinc-300">{r}</p>)}
          {(d.incidents.pagerduty !== null || d.incidents.opsgenie !== null) && <p className="text-zinc-400">Open incidents: {[d.incidents.pagerduty !== null ? `PagerDuty ${d.incidents.pagerduty}` : null, d.incidents.opsgenie !== null ? `Opsgenie ${d.incidents.opsgenie}` : null].filter(Boolean).join(" · ")}</p>}
          {d.staleFlags && d.staleFlags.length > 0 && <p className="text-zinc-400">Temporary flags still on after 30 days: {d.staleFlags.join(", ")}</p>}
          {d.verification.missing.length > 0 && <p className="text-zinc-500">Not available: {d.verification.missing.join(", ")}.</p>}
        </div>}
      </div>
    </div>);
}
