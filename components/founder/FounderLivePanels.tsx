"use client";
import { useEffect, useRef, useState } from "react";
import { activityBySignal, timeAgo, type ActivityEvent } from "@/lib/founder/activity";
import { departmentCost, stepCost, type Blueprint, type SignalKey } from "@/lib/founder/blueprint";
import { TONE_DOT, TONE_TEXT } from "@/lib/cockpit/statusTone";
import type { FounderLive, LiveSignals } from "./useFounderActivity";
import { AUTOMATION_SHORT, SIGNAL_TEXT, STATUS_LABEL, STATUS_TONE, signalValue, usd } from "./founderText";

const DAY = 86_400_000;

/** One counter that briefly highlights when its value changes between reads. */
function Counter({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "attention" | "failure" | null }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => { if (prev.current !== value) { prev.current = value; setFlash(true); const t = setTimeout(() => setFlash(false), 1600); return () => clearTimeout(t); } }, [value]);
  return (
    <div className={`min-w-[132px] flex-1 rounded-xl border px-3 py-2 transition-colors duration-700 ${flash ? "border-sky-300/60 bg-sky-400/10" : "border-white/8 bg-white/[0.02]"}`}>
      <p className="truncate text-[11px] text-zinc-400">{label}</p>
      <p className={`mt-0.5 text-lg font-medium tabular-nums ${tone === "failure" ? "text-rose-300" : tone === "attention" ? "text-amber-200" : "text-zinc-50"}`}>{value}</p>
      {sub && <p className="truncate text-[11px] text-zinc-500">{sub}</p>}
    </div>
  );
}

/** The live strip across the top: company counters from V19 records and how fresh they are. */
export function LiveBar({ live, signals, doc }: { live: FounderLive; signals: LiveSignals; doc: Blueprint }) {
  const v = (k: SignalKey) => signals[k];
  const n = (k: SignalKey) => signalValue(k, v(k));
  const pos = (k: SignalKey) => typeof v(k) === "number" && (v(k) as number) > 0;
  const active = doc.steps.filter((s) => s.status !== "archived");
  const automated = active.filter((s) => s.automation.mode === "autonomous" || s.automation.mode === "approval").length;
  const mapped = doc.departments.reduce((t, d) => t + departmentCost(doc, d.id).monthlyTotal, 0);
  const day = live.events.filter((e) => live.now - Date.parse(e.at) <= DAY).length;
  const status = live.state === "live" ? { dot: "bg-sky-400", text: `Live · read ${live.readAt ? timeAgo(new Date(live.readAt).toISOString(), live.now) : ""}`, pulse: true }
    : live.state === "paused" ? { dot: "bg-amber-300", text: "Paused while this tab is hidden", pulse: false }
    : live.state === "error" ? { dot: "bg-rose-400", text: "Live records could not be read. Showing the last read.", pulse: false }
    : { dot: "bg-zinc-500", text: "Connecting to live records…", pulse: false };
  return (
    <section aria-label="Company right now" className="pb-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
        <span className="relative flex h-2 w-2">{status.pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400/70 motion-reduce:hidden" />}<span className={`relative inline-flex h-2 w-2 rounded-full ${status.dot}`} /></span>
        <span aria-live="polite">{status.text}</span>
        <span className="text-zinc-600">·</span><span>{day} event{day === 1 ? "" : "s"} in the last 24 hours, all workspaces</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Counter label="Workspaces" value={n("workspaces_total")} sub={pos("workspaces_new_30d") ? `+${v("workspaces_new_30d")} in 30 days` : "No new ones in 30 days"} />
        <Counter label="Deployments, 7 days" value={n("deployments_7d")} sub={pos("deployments_failed_7d") ? `${v("deployments_failed_7d")} failed` : "None failed"} tone={pos("deployments_failed_7d") ? "failure" : null} />
        <Counter label="Open incidents" value={n("incidents_open")} tone={pos("incidents_open") ? "failure" : null} />
        <Counter label="Agent requests waiting" value={n("agent_requests_pending")} tone={pos("agent_requests_pending") ? "attention" : null} />
        <Counter label="Frozen environments" value={n("freezes_active")} tone={pos("freezes_active") ? "attention" : null} />
        <Counter label="AI cost, 30 days" value={n("ai_cost_30d_cents")} />
        <Counter label="Leads and feedback, 30 days" value={`${n("leads_30d")} · ${n("feedback_30d")}`} sub="leads · feedback" />
        <Counter label="Mapped cost" value={`${usd(mapped)}/mo`} sub={`${automated} of ${active.length} steps run by agents`} />
      </div>
    </section>
  );
}

interface NeedItem { key: string; text: string; tone: "attention" | "failure"; href?: string; onClick?: () => void; action: string }

/** Right rail when nothing else is open: what needs the founder, then the live event stream. */
export function ActivityRail({ live, signals, doc, suggestionsCount, onOpenSuggestions, onSelectStep }: { live: FounderLive; signals: LiveSignals; doc: Blueprint; suggestionsCount: number; onOpenSuggestions: () => void; onSelectStep: (stepId: string) => void }) {
  const [filter, setFilter] = useState<"all" | "problems">("all");
  const num = (k: SignalKey) => (typeof signals[k] === "number" ? (signals[k] as number) : 0);
  const needs: NeedItem[] = [];
  if (num("incidents_open")) needs.push({ key: "inc", text: `${num("incidents_open")} open incident${num("incidents_open") === 1 ? "" : "s"} across workspaces`, tone: "failure", href: "/control/releases", action: "Open releases" });
  if (num("deployments_failed_7d")) needs.push({ key: "dep", text: `${num("deployments_failed_7d")} failed deployment${num("deployments_failed_7d") === 1 ? "" : "s"} this week`, tone: "failure", href: "/control/releases", action: "Open releases" });
  if (num("agent_requests_pending")) needs.push({ key: "agent", text: `${num("agent_requests_pending")} agent request${num("agent_requests_pending") === 1 ? " is" : "s are"} waiting for approval`, tone: "attention", href: "/control/agent-gateway", action: "Review requests" });
  if (num("freezes_active")) needs.push({ key: "frz", text: `${num("freezes_active")} environment${num("freezes_active") === 1 ? " is" : "s are"} frozen`, tone: "attention", href: "/control", action: "Open overview" });
  if (num("webhook_failures_7d")) needs.push({ key: "wh", text: `${num("webhook_failures_7d")} webhook deliver${num("webhook_failures_7d") === 1 ? "y" : "ies"} given up this week`, tone: "attention", href: "/control/webhooks", action: "Open webhooks" });
  if (suggestionsCount) needs.push({ key: "sug", text: `${suggestionsCount} suggested change${suggestionsCount === 1 ? "" : "s"} to this map`, tone: "attention", onClick: onOpenSuggestions, action: "Review suggestions" });

  const stepFor = (signal: SignalKey) => doc.steps.find((s) => s.signal === signal && s.status !== "archived") ?? doc.steps.find((s) => s.signal === signal);
  const deptName = new Map(doc.departments.map((d) => [d.id, d.name]));
  const shown = live.events.filter((e) => filter === "all" || e.tone === "failed" || e.tone === "attention").slice(0, 80);

  return (
    <div className="space-y-5 text-sm">
      <section aria-labelledby="needs-heading">
        <h2 id="needs-heading" className="text-sm font-medium text-zinc-100">Needs attention</h2>
        {needs.length === 0 ? <p className="mt-2 text-xs text-zinc-400">Nothing needs you right now.</p> : (
          <ul className="mt-2 space-y-1.5">{needs.map((n) => (
            <li key={n.key} className={`rounded-lg border px-3 py-2 text-xs ${n.tone === "failure" ? "border-rose-400/30 bg-rose-400/5" : "border-amber-300/30 bg-amber-300/5"}`}>
              <p className="text-zinc-100">{n.text}</p>
              {n.href ? <a href={n.href} className="mt-1 inline-block text-zinc-300 underline underline-offset-4">{n.action}</a> : <button type="button" onClick={n.onClick} className="mt-1 text-zinc-300 underline underline-offset-4">{n.action}</button>}
            </li>))}</ul>)}
      </section>

      <section aria-labelledby="activity-heading">
        <div className="flex items-center justify-between gap-2">
          <h2 id="activity-heading" className="text-sm font-medium text-zinc-100">Live activity</h2>
          <div role="group" aria-label="Show" className="flex rounded-lg bg-white/5 p-0.5 text-[11px]">
            {(["all", "problems"] as const).map((f) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`rounded-md px-2 py-0.5 ${filter === f ? "bg-white/15 text-zinc-50" : "text-zinc-400"}`}>{f === "all" ? "All" : "Problems"}</button>)}
          </div>
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">From V19 records across all workspaces, newest first. No customer content is shown.</p>
        {live.unavailable.length > 0 && <p className="mt-1 text-[11px] text-amber-300">Could not read: {live.unavailable.join(", ")}.</p>}
        {live.state === "loading" && live.events.length === 0 ? <p className="mt-3 text-xs text-zinc-400">Loading activity…</p>
          : shown.length === 0 ? <p className="mt-3 text-xs text-zinc-400">{filter === "all" ? "Quiet: nothing recorded in the last 7 days." : "No problems in the last 7 days."}</p> : (
          <ol aria-label="Events" className="mt-2 space-y-1">{shown.map((e) => {
            const st = stepFor(e.signal);
            const fresh = live.now - Date.parse(e.at) < 10 * 60_000;
            return (
              <li key={e.id}>
                <button type="button" disabled={!st} onClick={() => st && onSelectStep(st.id)} className="group flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.04] disabled:cursor-default">
                  <span className="relative mt-1.5 flex h-2 w-2 shrink-0">{fresh && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 motion-reduce:hidden ${TONE_DOT[e.tone]}`} />}<span aria-hidden className={`relative inline-flex h-2 w-2 rounded-full ${TONE_DOT[e.tone]}`} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2"><span className={`truncate text-[13px] ${e.tone === "failed" ? TONE_TEXT.failed : "text-zinc-100"}`}>{e.title}</span><time dateTime={e.at} className="shrink-0 text-[11px] tabular-nums text-zinc-500">{timeAgo(e.at, live.now)}</time></span>
                    <span className="block truncate text-[11px] text-zinc-400">{e.detail}</span>
                    {st && <span className="block truncate text-[11px] text-zinc-500 group-hover:text-zinc-300">{deptName.get(st.departmentId)} › {st.title}</span>}
                  </span>
                </button>
              </li>);
          })}</ol>)}
      </section>
    </div>
  );
}

/** Department rollup: labor and tool costs summed from its steps, as in the reel's section summary. */
export function DepartmentPanel({ doc, departmentId, live, onSelectStep, onClose }: { doc: Blueprint; departmentId: string; live: FounderLive; onSelectStep: (id: string) => void; onClose: () => void }) {
  const dept = doc.departments.find((d) => d.id === departmentId);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, [departmentId]);
  if (!dept) return null;
  const steps = doc.steps.filter((s) => s.departmentId === departmentId && s.status !== "archived");
  const c = departmentCost(doc, departmentId);
  const lines = steps.map((s) => ({ s, c: stepCost(s) })).sort((a, b) => b.c.monthlyTotal - a.c.monthlyTotal);
  const tools = steps.flatMap((s) => s.tools.map((t) => ({ ...t, step: s.title })));
  const signals = new Set(steps.map((s) => s.signal).filter(Boolean) as SignalKey[]);
  const recent = activityBySignal(live.events.filter((e) => signals.has(e.signal)), live.now, DAY);
  const recentCount = [...recent.values()].reduce((t, r) => t + r.count, 0);
  const mix = { autonomous: 0, approval: 0, assisted: 0, manual: 0 };
  for (const s of steps) mix[s.automation.mode] += 1;
  const stat = (label: string, value: string) => <div><dt className="text-[11px] text-zinc-500">{label}</dt><dd className="text-sm tabular-nums text-zinc-100">{value}</dd></div>;
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div><p className="text-xs text-zinc-500">{dept.group} · department</p><h2 className="text-base font-medium text-zinc-50">{dept.name}</h2>{dept.description && <p className="mt-0.5 text-xs text-zinc-400">{dept.description}</p>}</div>
        <button ref={closeRef} type="button" onClick={onClose} className="rounded-md px-2 py-0.5 text-zinc-400 hover:bg-white/5 hover:text-white" aria-label="Close department summary">✕</button>
      </div>
      <p className="text-xs text-zinc-400">{c.live} of {c.steps} steps live · {recentCount} event{recentCount === 1 ? "" : "s"} in 24 hours · {mix.autonomous} autonomous, {mix.approval} with your approval, {mix.assisted} assisted, {mix.manual} by a person</p>
      <section aria-labelledby="dept-labor" className="rounded-xl border border-white/8 p-3">
        <h3 id="dept-labor" className="text-xs font-medium text-zinc-200">Labor costs</h3>
        <p className="text-[11px] text-zinc-500">Rolls up the time and rate on every step in this department.</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">{stat("Hours per run", c.hoursPerRun.toString())}{stat("Cost per run", usd(c.costPerRun))}{stat("Hours per month", c.hoursPerMonth.toString())}{stat("Monthly cost", usd(c.monthlyLabor))}{stat("Hours per year", (Math.round(c.hoursPerMonth * 12 * 100) / 100).toString())}{stat("Annual cost", usd(c.annualLabor))}</dl>
        <ul className="mt-3 space-y-0.5">{lines.map(({ s, c: sc }) => <li key={s.id}><button type="button" onClick={() => onSelectStep(s.id)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-white/[0.04]"><span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[STATUS_TONE[s.status]]}`} /><span className="min-w-0 flex-1 truncate text-zinc-200">{s.title}</span><span className="text-[10px] text-zinc-500">{AUTOMATION_SHORT[s.automation.mode]}</span><span className="w-16 text-right tabular-nums text-zinc-300">{usd(sc.monthlyTotal)}</span></button></li>)}</ul>
      </section>
      <section aria-labelledby="dept-tools" className="rounded-xl border border-white/8 p-3">
        <h3 id="dept-tools" className="text-xs font-medium text-zinc-200">Tool costs</h3>
        <dl className="mt-2 grid grid-cols-3 gap-x-3">{stat("Monthly", usd(c.monthlyTools))}{stat("Annual", usd(c.monthlyTools * 12))}{stat("One-time", usd(c.oneTimeTools))}</dl>
        {tools.length === 0 ? <p className="mt-2 text-xs text-zinc-500">No tools recorded on these steps yet.</p> : (
          <ul className="mt-2 space-y-1 text-xs">{tools.map((t, i) => <li key={i} className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-zinc-200">{t.name} <span className="text-zinc-500">· {t.step}</span></span><span className={t.active ? "text-emerald-300" : "text-zinc-500"}>{t.active ? "Active" : "Cancelled"}</span><span className="w-14 text-right tabular-nums text-zinc-300">{usd(t.monthlyCost)}</span></li>)}</ul>)}
      </section>
      <section aria-labelledby="dept-signals">
        <h3 id="dept-signals" className="text-xs font-medium text-zinc-200">Live signals</h3>
        {signals.size === 0 ? <p className="mt-1 text-xs text-zinc-500">No step here watches a live signal yet.</p> : <ul className="mt-1 space-y-1 text-xs">{[...signals].map((k) => <li key={k} className="flex justify-between gap-2 text-zinc-300"><span>{SIGNAL_TEXT[k]}</span><span className="tabular-nums text-zinc-100">{signalValue(k, live.signals?.[k])}</span></li>)}</ul>}
      </section>
      <p className="text-[11px] text-zinc-500">Statuses: {steps.map((s) => STATUS_LABEL[s.status]).filter((v, i, a) => a.indexOf(v) === i).join(", ") || "none"}.</p>
    </div>
  );
}

interface AutopilotState { paused: boolean; runs: Array<{ version: number; summary: string; createdAt: string }> }

/** Autopilot switch, last run and "Run now". Changes reload the map through onChanged. */
export function AutopilotControl({ version, now, onChanged, onMessage }: { version: number; now: number; onChanged: () => Promise<void>; onMessage: (tone: "ok" | "warn", text: string) => void }) {
  const [state, setState] = useState<AutopilotState | "error" | null>(null);
  const [busy, setBusy] = useState(false);
  const read = async () => {
    try { const res = await fetch("/api/founder/autopilot", { cache: "no-store" }); const body = await res.json(); setState(res.ok && body.ok ? body.data : "error"); } catch { setState("error"); }
  };
  useEffect(() => { void read(); }, [version]);
  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/founder/autopilot", { method: "POST" });
      const body = await res.json().catch(() => null) as { ok?: boolean; data?: { outcome: string; actions: Array<{ text: string }>; proposals: unknown[] } } | null;
      if (!res.ok || !body?.data) onMessage("warn", "The autopilot could not run. Try again.");
      else if (body.data.outcome === "applied") { await onChanged(); onMessage("ok", `Autopilot made ${body.data.actions.length} change${body.data.actions.length === 1 ? "" : "s"}: ${body.data.actions.map((a) => a.text).join(" ")}`); }
      else onMessage("ok", body.data.outcome === "paused" ? "The autopilot is paused." : body.data.outcome === "changed_meanwhile" ? "The map changed while the autopilot ran. Nothing was saved; it will try again." : `Autopilot checked everything: nothing to change.${body.data.proposals.length ? ` ${body.data.proposals.length} change${body.data.proposals.length === 1 ? " waits" : "s wait"} for your approval.` : ""}`);
    } catch { onMessage("warn", "The autopilot could not be reached."); }
    finally { setBusy(false); void read(); }
  }
  async function toggle(paused: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/founder/autopilot", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paused, expectedVersion: version }) });
      if (res.ok) { await onChanged(); onMessage("ok", paused ? "Autopilot paused. It will not change the map until you resume it." : "Autopilot resumed."); }
      else onMessage("warn", res.status === 409 ? "Save or discard your changes first; the map changed since it loaded." : "The autopilot setting could not be changed.");
    } catch { onMessage("warn", "The autopilot could not be reached."); }
    finally { setBusy(false); void read(); }
  }
  if (state === null) return <span className="text-xs text-zinc-500">Autopilot…</span>;
  if (state === "error") return <span className="text-xs text-amber-300">Autopilot unavailable</span>;
  const last = state.runs[0];
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Autopilot">
      <button type="button" disabled={busy} aria-pressed={!state.paused} onClick={() => void toggle(!state.paused)} className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs ${state.paused ? "bg-amber-300/10 text-amber-100" : "bg-sky-400/10 text-sky-100"} disabled:opacity-50`}>
        <span aria-hidden className={`h-2 w-2 rounded-full ${state.paused ? "bg-amber-300" : "bg-sky-400"}`} />{state.paused ? "Autopilot paused" : "Autopilot on"}
      </button>
      <button type="button" disabled={busy || state.paused} onClick={() => void run()} className="min-h-9 rounded-lg bg-white/5 px-3 text-xs text-zinc-200 hover:bg-white/10 disabled:opacity-40">{busy ? "Running…" : "Run now"}</button>
      <span className="hidden text-[11px] text-zinc-500 xl:inline">{last ? `Last change ${timeAgo(last.createdAt, now)}` : "Runs hourly"}</span>
    </div>
  );
}

/** Autopilot section of the activity rail: what it changed, and what waits for the founder. */
export function AutopilotLog({ proposals, onApprove, version }: { proposals: Array<{ stepId: string; text: string }>; onApprove: (stepId: string) => void; version: number }) {
  const [runs, setRuns] = useState<AutopilotState["runs"] | null>(null);
  useEffect(() => { fetch("/api/founder/autopilot", { cache: "no-store" }).then((r) => r.json()).then((b) => setRuns(b?.ok ? b.data.runs : [])).catch(() => setRuns([])); }, [version]);
  return (
    <section aria-labelledby="autopilot-heading">
      <h2 id="autopilot-heading" className="text-sm font-medium text-zinc-100">Autopilot</h2>
      {proposals.length > 0 && <ul className="mt-2 space-y-1.5">{proposals.map((p) => <li key={p.stepId} className="rounded-lg border border-amber-300/30 bg-amber-300/5 px-3 py-2 text-xs"><p className="text-zinc-100">Waiting for you: {p.text}</p><button type="button" onClick={() => onApprove(p.stepId)} className="mt-1 text-zinc-200 underline underline-offset-4">Approve and save</button></li>)}</ul>}
      {runs === null ? <p className="mt-2 text-xs text-zinc-500">Loading…</p> : runs.length === 0 ? <p className="mt-2 text-xs text-zinc-400">No changes made by the autopilot yet. It runs every hour and when you choose Run now.</p> : (
        <ol className="mt-2 space-y-1 text-xs">{runs.slice(0, 6).map((r) => <li key={r.version} className="flex justify-between gap-2"><span className="text-zinc-300">{r.summary}</span><span className="shrink-0 text-zinc-500">v{r.version}</span></li>)}</ol>)}
      <p className="mt-1 text-[11px] text-zinc-500">Each change is saved as a version you can restore from History.</p>
    </section>
  );
}
