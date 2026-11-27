"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { connectorPath, departmentCost, layoutBlueprint, SIGNAL_KEYS, STEP_STATUSES, stepCost, validateBlueprint, type Blueprint, type BlueprintStep, type SignalKey, type StepStatus } from "@/lib/founder/blueprint";
import { TONE_DOT, type StatusTone } from "@/lib/cockpit/statusTone";
import { applySuggestion, suggestBlueprintChanges, type Suggestion } from "@/lib/founder/blueprintSuggestions";

type Signals = Partial<Record<SignalKey, number | null>>;
type Loaded = { blueprint: Blueprint; version: number; saved: boolean; unreadable: boolean; updatedAt: string | null; updatedBy: string | null; signals: Signals };

const STATUS_LABEL: Record<StepStatus, string> = { draft: "Draft", in_progress: "In progress", testing: "Testing", live: "Live", archived: "Archived" };
const STATUS_TONE: Record<StepStatus, StatusTone> = { draft: "idle", in_progress: "running", testing: "attention", live: "success", archived: "idle" };
const SIGNAL_TEXT: Record<SignalKey, string> = {
  feedback_30d: "Feedback, 30 days", leads_30d: "Leads, 30 days", deployments_7d: "Deployments, 7 days", deployments_failed_7d: "Failed deployments, 7 days",
  incidents_open: "Open incidents", freezes_active: "Frozen environments", ai_cost_30d_cents: "AI cost, 30 days", agent_requests_pending: "Agent requests waiting",
  webhook_failures_7d: "Webhooks given up, 7 days", workspaces_total: "Workspaces", workspaces_new_30d: "New workspaces, 30 days",
};
const ATTENTION: ReadonlySet<SignalKey> = new Set(["deployments_failed_7d", "incidents_open", "freezes_active", "agent_requests_pending", "webhook_failures_7d"]);
const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 100 ? 2 : 0 }).format(n);
const signalValue = (k: SignalKey, v: number | null | undefined) => (v === null || v === undefined ? "Unavailable" : k === "ai_cost_30d_cents" ? usd(v / 100) : v.toLocaleString());
const newId = (base: string, taken: Set<string>) => { let i = 1; let id = base; while (taken.has(id)) id = `${base}-${++i}`; return id.slice(0, 48); };

/**
 * Founder operations blueprint: the whole company as one map. Departments hold connected steps and
 * decisions; a menu jumps between departments; pan, zoom and fit move the view; choosing a step opens
 * a details panel with its status, owner, notes and cost. Live V19 signals show on the steps that
 * watch them. Changes stay local until Save, which keeps every version.
 */
export function FounderBlueprint() {
  const [loaded, setLoaded] = useState<Loaded | "error" | null>(null);
  const [doc, setDoc] = useState<Blueprint | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState({ x: 24, y: 24, scale: 0.8 });
  const [mode, setMode] = useState<"map" | "list">("map");
  const [message, setMessage] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Array<{ version: number; summary: string; savedByEmail: string; createdAt: string }> | "error" | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/founder/blueprint", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error();
      setLoaded(body.data); setDoc(body.data.blueprint); setDirty(false);
    } catch { setLoaded("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const layout = useMemo(() => (doc ? layoutBlueprint(doc) : null), [doc]);
  const fit = useCallback((regionId?: string) => {
    const el = viewport.current; if (!el || !layout) return;
    const box = regionId ? layout.regions.find((r) => r.departmentId === regionId) : { x: 0, y: 0, w: layout.width, h: layout.height };
    if (!box) return;
    const scale = Math.min(1.4, Math.max(0.2, Math.min((el.clientWidth - 48) / box.w, (el.clientHeight - 48) / box.h)));
    setView({ scale, x: (el.clientWidth - box.w * scale) / 2 - box.x * scale, y: (el.clientHeight - box.h * scale) / 2 - box.y * scale });
  }, [layout]);
  useEffect(() => { if (layout && mode === "map") fit(); /* fit once when the map first loads */ }, [layout !== null, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  function update(mutator: (b: Blueprint) => void) {
    setDoc((prev) => { if (!prev) return prev; const next = structuredClone(prev); mutator(next); return next; });
    setDirty(true); setMessage(null);
  }
  const step = doc && selected ? doc.steps.find((s) => s.id === selected) ?? null : null;
  function patchStep(p: Partial<BlueprintStep>) { if (!selected) return; update((b) => { const s = b.steps.find((x) => x.id === selected); if (s) Object.assign(s, p); }); }
  function open(id: string, el: HTMLElement | null) { opener.current = el; setSelected(id); }
  function close() { setSelected(null); requestAnimationFrame(() => opener.current?.focus()); }
  function addStep(departmentId: string) {
    if (!doc) return;
    const taken = new Set(doc.steps.map((s) => s.id));
    const rows = doc.steps.filter((s) => s.departmentId === departmentId);
    const row = rows.length ? Math.max(...rows.map((s) => s.row)) + 1 : 0;
    const id = newId(`${departmentId}-step`, taken);
    update((b) => { b.steps.push({ id, departmentId, kind: "step", title: "New step", col: 0, row, status: "draft", owner: "", roles: [], notes: "", cost: { minutesPerRun: 0, runsPerMonth: 0, hourlyRate: 0 }, tools: [], signal: null }); });
    setSelected(id);
  }
  function removeStep(id: string) { update((b) => { b.steps = b.steps.filter((s) => s.id !== id); b.links = b.links.filter((l) => l.from !== id && l.to !== id); }); close(); }

  async function openHistory() {
    setSelected(null);
    try { const res = await fetch("/api/founder/blueprint/revisions", { cache: "no-store" }); const body = await res.json(); setHistory(res.ok && body.ok ? body.data.revisions : "error"); } catch { setHistory("error"); }
  }
  async function restore(version: number) {
    if (!loaded || loaded === "error" || dirty) { setMessage({ tone: "warn", text: "Save or discard your changes before restoring an earlier version." }); return; }
    const res = await fetch("/api/founder/blueprint/revisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version, expectedVersion: loaded.version }) }).catch(() => null);
    const body = await res?.json().catch(() => null) as { ok?: boolean; data?: { version: number }; error?: string } | null;
    if (res?.ok && body?.data) { await load(); setHistory(null); setMessage({ tone: "ok", text: `Restored version ${version} as version ${body.data.version}.` }); }
    else setMessage({ tone: "warn", text: body?.error === "blueprint_changed" ? "The blueprint changed since you opened it. Reload and try again." : "That version could not be restored." });
  }

  async function save() {
    if (!doc || !loaded || loaded === "error") return;
    const valid = validateBlueprint(doc);
    if (!valid.ok) { setMessage({ tone: "warn", text: valid.errors.join(" ") }); return; }
    if (!summary.trim()) { setMessage({ tone: "warn", text: "Describe the change in a few words before saving." }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/founder/blueprint", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blueprint: doc, expectedVersion: loaded.version, summary: summary.trim().slice(0, 200) }) });
      const body = await res.json().catch(() => null) as { ok?: boolean; data?: { version: number }; error?: string; detail?: string; issues?: string[] } | null;
      if (res.ok && body?.data) { setLoaded({ ...loaded, version: body.data.version, saved: true, blueprint: doc }); setDirty(false); setSummary(""); setMessage({ tone: "ok", text: `Saved as version ${body.data.version}.` }); }
      else setMessage({ tone: "warn", text: body?.detail ?? body?.issues?.join(" ") ?? "The blueprint could not be saved. Try again." });
    } catch { setMessage({ tone: "warn", text: "The request could not be reached. Try again." }); }
    finally { setSaving(false); }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button,input,select,textarea,a")) return;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) { const d = drag.current; if (d) setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y })); }
  function onPointerUp() { drag.current = null; }
  function onWheel(e: ReactWheelEvent<HTMLDivElement>) {
    if (e.ctrlKey || e.metaKey) {
      const rect = e.currentTarget.getBoundingClientRect(); const px = e.clientX - rect.left, py = e.clientY - rect.top;
      setView((v) => { const scale = Math.min(1.6, Math.max(0.2, v.scale * (e.deltaY < 0 ? 1.1 : 0.9))); return { scale, x: px - ((px - v.x) * scale) / v.scale, y: py - ((py - v.y) * scale) / v.scale }; });
    } else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
  }
  function onKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    const step = 60;
    if (e.key === "+" || e.key === "=") setView((v) => ({ ...v, scale: Math.min(1.6, v.scale * 1.1) }));
    else if (e.key === "-") setView((v) => ({ ...v, scale: Math.max(0.2, v.scale * 0.9) }));
    else if (e.key === "0") fit();
    else if (e.key === "ArrowLeft") setView((v) => ({ ...v, x: v.x + step }));
    else if (e.key === "ArrowRight") setView((v) => ({ ...v, x: v.x - step }));
    else if (e.key === "ArrowUp") setView((v) => ({ ...v, y: v.y + step }));
    else if (e.key === "ArrowDown") setView((v) => ({ ...v, y: v.y - step }));
    else return;
    e.preventDefault();
  }

  if (loaded === "error") return <p role="alert" className="mt-8 text-sm text-amber-300">The blueprint could not be loaded. Refresh to try again.</p>;
  if (!loaded || !doc || !layout) return <p className="mt-8 text-sm text-zinc-400">Loading the blueprint…</p>;
  const signals = loaded.signals;
  const deptName = new Map(doc.departments.map((d) => [d.id, d.name]));
  const totalMonthly = doc.departments.reduce((n, d) => n + departmentCost(doc, d.id).monthlyTotal, 0);
  const suggestions = suggestBlueprintChanges(doc, signals).filter((x) => !dismissed.has(x.id));
  function act(sg: Suggestion) {
    if (sg.kind === "mark_live") { setDoc(applySuggestion(doc!, sg)); setDirty(true); setMessage({ tone: "ok", text: `${sg.title.replace(/^Mark /, "Marked ")}. Save to keep it.` }); setDismissed(new Set([...dismissed, sg.id])); }
    else if (sg.kind === "add_cost") { setShowSuggestions(false); if (mode === "map") fit(sg.departmentId); }
    else { setShowSuggestions(false); setSelected(sg.stepId); }
  }

  return (
    <div className="flex h-[calc(100vh-96px)] min-h-[560px] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/8 pb-3">
        <label className="sr-only" htmlFor="founder-department">Jump to department</label>
        <select id="founder-department" defaultValue="" onChange={(e) => { if (mode === "map") (e.target.value ? fit(e.target.value) : fit()); }} className="min-h-9 rounded-lg border border-white/10 bg-black/40 px-2 text-sm text-zinc-100">
          <option value="">High-level map</option>
          {[...new Set(doc.departments.map((d) => d.group))].map((g) => <optgroup key={g} label={g}>{doc.departments.filter((d) => d.group === g).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</optgroup>)}
        </select>
        <div role="group" aria-label="Zoom" className="flex items-center gap-1">
          <button type="button" onClick={() => setView((v) => ({ ...v, scale: Math.max(0.2, v.scale * 0.85) }))} className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-zinc-200 hover:bg-white/10" aria-label="Zoom out">−</button>
          <span className="w-12 text-center text-xs tabular-nums text-zinc-400">{Math.round(view.scale * 100)}%</span>
          <button type="button" onClick={() => setView((v) => ({ ...v, scale: Math.min(1.6, v.scale * 1.15) }))} className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-zinc-200 hover:bg-white/10" aria-label="Zoom in">+</button>
          <button type="button" onClick={() => fit()} className="min-h-9 rounded-lg bg-white/5 px-3 text-xs text-zinc-200 hover:bg-white/10">Fit</button>
        </div>
        <button type="button" aria-pressed={showSuggestions} onClick={() => { setShowSuggestions(!showSuggestions); setSelected(null); setHistory(null); }} className="min-h-9 rounded-lg bg-white/5 px-3 text-xs text-zinc-200 hover:bg-white/10">Suggestions{suggestions.length ? ` (${suggestions.length})` : ""}</button>
        <button type="button" disabled={!loaded.saved} onClick={() => void openHistory()} className="min-h-9 rounded-lg bg-white/5 px-3 text-xs text-zinc-200 hover:bg-white/10 disabled:opacity-40">History</button>
        <button type="button" aria-pressed={mode === "list"} onClick={() => setMode(mode === "map" ? "list" : "map")} className="min-h-9 rounded-lg bg-white/5 px-3 text-xs text-zinc-200 hover:bg-white/10">{mode === "map" ? "List view" : "Map view"}</button>
        <span className="ml-auto text-xs text-zinc-400">{doc.steps.length} steps · {usd(totalMonthly)} a month mapped · {loaded.saved ? `version ${loaded.version}` : "default draft, not saved"}{dirty ? " · unsaved changes" : ""}</span>
        {dirty && <><label className="sr-only" htmlFor="founder-change-summary">What changed</label><input id="founder-change-summary" value={summary} maxLength={200} onChange={(e) => setSummary(e.target.value)} placeholder="What changed?" className="min-h-9 w-48 rounded-lg border border-white/10 bg-black/40 px-2.5 text-sm text-zinc-100" /></>}
        <button type="button" disabled={!dirty || saving || !summary.trim()} onClick={() => void save()} className="inline-flex min-h-9 items-center rounded-full bg-zinc-100 px-4 text-sm font-medium text-zinc-950 disabled:opacity-40">{saving ? "Saving…" : "Save"}</button>
      </div>
      <p aria-live="polite" className={`min-h-5 pt-1 text-xs ${message?.tone === "warn" ? "text-amber-300" : "text-zinc-400"}`}>{message?.text ?? (loaded.unreadable ? "The saved blueprint could not be read, so the default draft is shown. Saving replaces it." : "")}</p>

      <div className="relative flex min-h-0 flex-1 gap-3">
        {mode === "map" ? (
          <div ref={viewport} role="application" aria-label="Company blueprint map. Arrow keys pan, plus and minus zoom, 0 fits." tabIndex={0} onKeyDown={onKey} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onWheel={onWheel}
            className="relative min-w-0 flex-1 cursor-grab touch-none overflow-hidden rounded-xl border border-white/8 bg-[#0c0c0c] [background-image:radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40 active:cursor-grabbing">
            <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, width: layout.width, height: layout.height }}>
              {layout.regions.map((r) => {
                const d = doc.departments.find((x) => x.id === r.departmentId)!; const cost = departmentCost(doc, d.id);
                return <section key={r.departmentId} aria-label={d.name} className="absolute rounded-2xl border border-white/10 bg-white/[0.02]" style={{ left: r.x, top: r.y, width: r.w, height: r.h }}>
                  <header className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-2.5">
                    <div className="min-w-0"><h2 className="truncate text-sm font-medium text-zinc-100">{d.name}</h2><p className="truncate text-[11px] text-zinc-500">{d.group}</p></div>
                    <div className="flex items-center gap-2"><span className="text-[11px] tabular-nums text-zinc-400">{cost.live}/{cost.steps} live · {usd(cost.monthlyTotal)}/mo</span><button type="button" onClick={() => addStep(d.id)} className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/10" aria-label={`Add a step to ${d.name}`}>+ Step</button></div>
                  </header>
                </section>;
              })}
              <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={layout.width} height={layout.height} aria-hidden="true">
                <defs><marker id="founder-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="rgba(255,255,255,0.45)" /></marker></defs>
                {doc.links.map((l, i) => { const a = layout.steps.get(l.from), b = layout.steps.get(l.to); if (!a || !b) return null; const d = connectorPath(a, b); const below = b.y >= a.y + a.h; const lx = below ? (a.x + a.w / 2 + b.x + b.w / 2) / 2 : ((b.x > a.x ? a.x + a.w : a.x) + (b.x > a.x ? b.x : b.x + b.w)) / 2 - 18; const ly = below ? (a.y + a.h + b.y) / 2 : Math.min(a.y, b.y) + 12;
                  return <g key={i}><path d={d} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={1.5} markerEnd="url(#founder-arrow)" />{l.label && <text x={below ? lx + 6 : lx} y={below ? ly - 4 : ly} className="fill-zinc-400 text-[11px]">{l.label}</text>}</g>; })}
              </svg>
              {doc.steps.map((s) => {
                const b = layout.steps.get(s.id)!; const v = s.signal ? signals[s.signal] : undefined; const attention = s.signal && ATTENTION.has(s.signal) && typeof v === "number" && v > 0;
                const shape = s.kind === "decision" ? "rounded-md border-dashed" : s.kind === "start" || s.kind === "end" ? "rounded-full" : "rounded-xl";
                return <button key={s.id} type="button" onClick={(e) => open(s.id, e.currentTarget)} aria-pressed={selected === s.id} aria-label={`${s.title}, ${deptName.get(s.departmentId)}, ${STATUS_LABEL[s.status]}${s.kind === "decision" ? ", decision" : ""}${s.signal ? `, ${SIGNAL_TEXT[s.signal]} ${signalValue(s.signal, v)}` : ""}`}
                  className={`absolute flex flex-col justify-between border bg-[#161616] px-3 py-2 text-left shadow-sm transition hover:border-white/30 ${shape} ${selected === s.id ? "border-white/70 ring-2 ring-white/20" : attention ? "border-amber-300/50" : "border-white/12"} ${s.status === "archived" ? "opacity-50" : ""}`}
                  style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
                  <span className="flex items-start gap-1.5"><span aria-hidden className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[STATUS_TONE[s.status]]}`} /><span className="line-clamp-2 text-[12px] leading-4 text-zinc-100">{s.kind === "decision" ? "◇ " : ""}{s.title}</span></span>
                  {s.signal ? <span className={`truncate text-[10px] tabular-nums ${attention ? "text-amber-200" : "text-zinc-400"}`}>{SIGNAL_TEXT[s.signal]}: {signalValue(s.signal, v)}</span> : <span className="truncate text-[10px] text-zinc-500">{s.owner || STATUS_LABEL[s.status]}</span>}
                </button>;
              })}
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1 overflow-auto rounded-xl border border-white/8 p-4">
            {doc.departments.map((d) => { const cost = departmentCost(doc, d.id); return <section key={d.id} aria-labelledby={`list-${d.id}`} className="mb-6">
              <h2 id={`list-${d.id}`} className="text-sm font-medium text-zinc-100">{d.name} <span className="text-xs font-normal text-zinc-500">· {d.group} · {cost.live}/{cost.steps} live · {usd(cost.monthlyTotal)}/mo</span></h2>
              <ol className="mt-2 space-y-1">{doc.steps.filter((s) => s.departmentId === d.id).sort((a, b) => a.row - b.row || a.col - b.col).map((s) => <li key={s.id}><button type="button" onClick={(e) => open(s.id, e.currentTarget)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-zinc-200 hover:bg-white/5"><span aria-hidden className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[STATUS_TONE[s.status]]}`} />{s.kind === "decision" ? "Decision: " : ""}{s.title}<span className="ml-auto text-xs text-zinc-500">{STATUS_LABEL[s.status]}{s.signal ? ` · ${SIGNAL_TEXT[s.signal]} ${signalValue(s.signal, signals[s.signal])}` : ""}</span></button></li>)}</ol>
            </section>; })}
          </div>
        )}

        {showSuggestions && !step && history === null && (
          <aside aria-label="Suggestions" className="absolute inset-y-0 right-0 z-10 w-full max-w-[380px] overflow-y-auto rounded-xl border border-white/10 bg-[#111111] p-4 shadow-2xl md:static md:z-auto md:shadow-none">
            <div className="flex items-center justify-between"><h2 className="text-sm font-medium">Suggestions from V19 records</h2><button type="button" onClick={() => setShowSuggestions(false)} aria-label="Close suggestions" className="rounded-md px-2 py-0.5 text-zinc-400 hover:bg-white/5 hover:text-white">✕</button></div>
            <p className="mt-1 text-xs text-zinc-500">Worked out from this map and live records. Nothing changes until you apply a suggestion and save.</p>
            {suggestions.length === 0 ? <p className="mt-3 text-sm text-zinc-400">Nothing to suggest right now.</p> : (
              <ul className="mt-3 space-y-2">{suggestions.map((sg) => <li key={sg.id} className={`rounded-lg border p-3 text-xs ${sg.kind === "needs_attention" ? "border-amber-300/40" : "border-white/8"}`}>
                <p className="text-zinc-100">{sg.title}</p><p className="mt-0.5 text-zinc-400">{sg.reason}</p>
                <div className="mt-2 flex gap-3"><button type="button" onClick={() => act(sg)} className="text-zinc-200 underline underline-offset-4">{sg.kind === "mark_live" ? "Apply" : sg.kind === "add_cost" ? "Show department" : "Open step"}</button><button type="button" onClick={() => setDismissed(new Set([...dismissed, sg.id]))} className="text-zinc-500 hover:text-zinc-300">Dismiss</button></div>
              </li>)}</ul>)}
          </aside>
        )}
        {history !== null && !step && (
          <aside aria-label="Saved versions" className="absolute inset-y-0 right-0 z-10 w-full max-w-[380px] overflow-y-auto rounded-xl border border-white/10 bg-[#111111] p-4 shadow-2xl md:static md:z-auto md:shadow-none">
            <div className="flex items-center justify-between"><h2 className="text-sm font-medium">Saved versions</h2><button type="button" onClick={() => setHistory(null)} aria-label="Close saved versions" className="rounded-md px-2 py-0.5 text-zinc-400 hover:bg-white/5 hover:text-white">✕</button></div>
            {history === "error" ? <p role="alert" className="mt-3 text-sm text-amber-300">Saved versions could not be loaded.</p> : (
              <ol className="mt-3 space-y-2">{history.map((r) => <li key={r.version} className="rounded-lg border border-white/8 p-3 text-xs">
                <p className="text-zinc-100">Version {r.version}{r.version === loaded.version ? " · current" : ""}</p>
                <p className="mt-0.5 text-zinc-300">{r.summary}</p>
                <p className="mt-0.5 text-zinc-500">{r.savedByEmail} · {new Date(r.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
                {r.version !== loaded.version && <button type="button" onClick={() => void restore(r.version)} className="mt-2 text-zinc-200 underline underline-offset-4">Restore this version</button>}
              </li>)}</ol>)}
          </aside>
        )}
        {step && (
          <aside aria-label={`Step details: ${step.title}`} className="absolute inset-y-0 right-0 z-10 w-full max-w-[380px] overflow-y-auto rounded-xl border border-white/10 bg-[#111111] p-4 shadow-2xl md:static md:z-auto md:shadow-none" onKeyDown={(e) => { if (e.key === "Escape") close(); }}>
            <StepDetails key={step.id} step={step} blueprint={doc} signals={signals} onPatch={patchStep} onClose={close} onRemove={() => removeStep(step.id)}
              onLink={(to, label) => update((b) => { if (to && to !== step.id && !b.links.some((l) => l.from === step.id && l.to === to)) b.links.push({ from: step.id, to, label }); })}
              onUnlink={(to) => update((b) => { b.links = b.links.filter((l) => !(l.from === step.id && l.to === to)); })} />
          </aside>
        )}
      </div>
    </div>
  );
}

function StepDetails({ step, blueprint, signals, onPatch, onClose, onRemove, onLink, onUnlink }: { step: BlueprintStep; blueprint: Blueprint; signals: Signals; onPatch: (p: Partial<BlueprintStep>) => void; onClose: () => void; onRemove: () => void; onLink: (to: string, label: string) => void; onUnlink: (to: string) => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  const c = stepCost(step);
  const [linkTo, setLinkTo] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const outgoing = blueprint.links.filter((l) => l.from === step.id);
  const field = "mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-sm text-zinc-100";
  const num = (v: string) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-zinc-500">{blueprint.departments.find((d) => d.id === step.departmentId)?.name} · {step.kind === "decision" ? "Decision" : step.kind === "start" ? "Start" : step.kind === "end" ? "End" : "Step"}</p>
        <button ref={closeRef} type="button" onClick={onClose} className="rounded-md px-2 py-0.5 text-zinc-400 hover:bg-white/5 hover:text-white" aria-label="Close step details">✕</button>
      </div>
      <label className="block text-xs text-zinc-400">Title<input value={step.title} maxLength={120} onChange={(e) => onPatch({ title: e.target.value })} className={field} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-zinc-400">Status<select value={step.status} onChange={(e) => onPatch({ status: e.target.value as StepStatus })} className={field}>{STEP_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
        <label className="block text-xs text-zinc-400">Shape<select value={step.kind} onChange={(e) => onPatch({ kind: e.target.value as BlueprintStep["kind"] })} className={field}><option value="step">Step</option><option value="decision">Decision</option><option value="start">Start</option><option value="end">End</option></select></label>
      </div>
      <label className="block text-xs text-zinc-400">Owner<input value={step.owner} maxLength={80} onChange={(e) => onPatch({ owner: e.target.value })} placeholder="Samir" className={field} /></label>
      <label className="block text-xs text-zinc-400">Roles (comma separated)<input value={step.roles.join(", ")} onChange={(e) => onPatch({ roles: e.target.value.split(",").map((r) => r.trim()).filter(Boolean).slice(0, 12) })} placeholder="Founder, Claude" className={field} /></label>
      <label className="block text-xs text-zinc-400">Notes<textarea value={step.notes} maxLength={4000} rows={4} onChange={(e) => onPatch({ notes: e.target.value })} className={field} /></label>
      <label className="block text-xs text-zinc-400">Watches a live signal<select value={step.signal ?? ""} onChange={(e) => onPatch({ signal: (e.target.value || null) as SignalKey | null })} className={field}><option value="">None</option>{SIGNAL_KEYS.map((k) => <option key={k} value={k}>{SIGNAL_TEXT[k]}</option>)}</select></label>
      {step.signal && <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-zinc-300">{SIGNAL_TEXT[step.signal]}: <span className="tabular-nums text-zinc-100">{signalValue(step.signal, signals[step.signal])}</span> <span className="text-zinc-500">· live from V19, all workspaces</span></p>}

      <section aria-labelledby="step-cost-heading" className="rounded-xl border border-white/8 p-3">
        <h3 id="step-cost-heading" className="text-xs font-medium text-zinc-200">Process cost</h3>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <label className="text-[11px] text-zinc-400">Minutes per run<input type="number" min={0} value={step.cost.minutesPerRun} onChange={(e) => onPatch({ cost: { ...step.cost, minutesPerRun: num(e.target.value) } })} className={field} /></label>
          <label className="text-[11px] text-zinc-400">Runs per month<input type="number" min={0} value={step.cost.runsPerMonth} onChange={(e) => onPatch({ cost: { ...step.cost, runsPerMonth: num(e.target.value) } })} className={field} /></label>
          <label className="text-[11px] text-zinc-400">$ per hour<input type="number" min={0} value={step.cost.hourlyRate} onChange={(e) => onPatch({ cost: { ...step.cost, hourlyRate: num(e.target.value) } })} className={field} /></label>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          {[["Hours per run", c.hoursPerRun.toString()], ["Cost per run", usd(c.costPerRun)], ["Hours per month", c.hoursPerMonth.toString()], ["Monthly labor", usd(c.monthlyLabor)], ["Annual labor", usd(c.annualLabor)], ["Monthly tools", usd(c.monthlyTools)]].map(([k, v]) => <div key={k}><dt className="text-zinc-500">{k}</dt><dd className="tabular-nums text-zinc-100">{v}</dd></div>)}
        </dl>
      </section>

      <section aria-labelledby="step-tools-heading">
        <h3 id="step-tools-heading" className="text-xs font-medium text-zinc-200">Tools</h3>
        <ul className="mt-2 space-y-1.5">{step.tools.map((t, i) => <li key={i} className="flex items-center gap-2 text-xs">
          <input aria-label="Tool name" value={t.name} maxLength={80} onChange={(e) => onPatch({ tools: step.tools.map((x, j) => (j === i ? { ...x, name: e.target.value || "Tool" } : x)) })} className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100" />
          <input aria-label={`${t.name} monthly cost`} type="number" min={0} value={t.monthlyCost} onChange={(e) => onPatch({ tools: step.tools.map((x, j) => (j === i ? { ...x, monthlyCost: num(e.target.value) } : x)) })} className="w-20 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100" />
          <label className="flex items-center gap-1 text-zinc-400"><input type="checkbox" checked={t.active} onChange={(e) => onPatch({ tools: step.tools.map((x, j) => (j === i ? { ...x, active: e.target.checked } : x)) })} />Active</label>
          <button type="button" aria-label={`Remove ${t.name}`} onClick={() => onPatch({ tools: step.tools.filter((_, j) => j !== i) })} className="text-zinc-500 hover:text-white">✕</button>
        </li>)}</ul>
        {step.tools.length < 20 && <button type="button" onClick={() => onPatch({ tools: [...step.tools, { name: "New tool", monthlyCost: 0, oneTimeCost: 0, active: true }] })} className="mt-2 text-xs text-zinc-300 underline underline-offset-4">Add a tool</button>}
      </section>

      <section aria-labelledby="step-links-heading">
        <h3 id="step-links-heading" className="text-xs font-medium text-zinc-200">Leads to</h3>
        <ul className="mt-2 space-y-1 text-xs">{outgoing.length === 0 ? <li className="text-zinc-500">Nothing yet.</li> : outgoing.map((l) => <li key={l.to} className="flex items-center gap-2 text-zinc-300">{blueprint.steps.find((s) => s.id === l.to)?.title ?? l.to}{l.label && <span className="text-zinc-500">({l.label})</span>}<button type="button" aria-label={`Remove link to ${l.to}`} onClick={() => onUnlink(l.to)} className="ml-auto text-zinc-500 hover:text-white">✕</button></li>)}</ul>
        <div className="mt-2 flex gap-1.5">
          <select aria-label="Link to step" value={linkTo} onChange={(e) => setLinkTo(e.target.value)} className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-1.5 py-1 text-xs text-zinc-100"><option value="">Choose a step…</option>{blueprint.steps.filter((s) => s.id !== step.id).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
          <input aria-label="Link label" value={linkLabel} maxLength={40} onChange={(e) => setLinkLabel(e.target.value)} placeholder="label" className="w-20 rounded-md border border-white/10 bg-black/30 px-1.5 py-1 text-xs text-zinc-100" />
          <button type="button" disabled={!linkTo} onClick={() => { onLink(linkTo, linkLabel.trim()); setLinkTo(""); setLinkLabel(""); }} className="rounded-md bg-white/5 px-2 text-xs text-zinc-200 disabled:opacity-40">Link</button>
        </div>
      </section>
      <button type="button" onClick={() => { if (window.confirm(`Remove "${step.title}" and its links from the blueprint? Saved versions keep it.`)) onRemove(); }} className="text-xs text-rose-300 underline underline-offset-4">Remove step</button>
    </div>
  );
}
