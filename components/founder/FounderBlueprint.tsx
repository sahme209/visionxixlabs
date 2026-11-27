"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { AUTOMATION_MODES, connectorPath, departmentCost, layoutBlueprint, SIGNAL_KEYS, STEP_STATUSES, stepCost, validateBlueprint, type AutomationMode, type Blueprint, type BlueprintStep, type SignalKey, type StepStatus } from "@/lib/founder/blueprint";
import { TONE_DOT } from "@/lib/cockpit/statusTone";
import { applySuggestion, suggestBlueprintChanges, type Suggestion } from "@/lib/founder/blueprintSuggestions";
import { activityBySignal, liveness, timeAgo } from "@/lib/founder/activity";
import { useFounderActivity, type FounderLive } from "./useFounderActivity";
import { ActivityRail, AutopilotControl, AutopilotLog, DepartmentPanel, LiveBar } from "./FounderLivePanels";
import { planAutopilot } from "@/lib/founder/autopilot";
import { ATTENTION_SIGNALS as ATTENTION, AUTOMATION_HELP, AUTOMATION_LABEL, AUTOMATION_SHORT, SIGNAL_TEXT, STATUS_LABEL, STATUS_TONE, signalValue, usd } from "./founderText";

type Signals = Partial<Record<SignalKey, number | null>>;
type Loaded = { blueprint: Blueprint; version: number; saved: boolean; unreadable: boolean; updatedAt: string | null; updatedBy: string | null; signals: Signals };

const DAY = 86_400_000;
/** Below this zoom the map shows readable department tiles over the cards. */
const TILE_SCALE = 0.55;
const newId = (base: string, taken: Set<string>) => { let i = 1; let id = base; while (taken.has(id)) id = `${base}-${++i}`; return id.slice(0, 48); };
const AUTOMATION_GLYPH: Record<AutomationMode, string> = { manual: "", assisted: "◐", approval: "◇", autonomous: "◆" };

/**
 * Founder operations blueprint: the whole company as one live map. Departments hold connected steps
 * and decisions; a menu jumps between departments; pan, zoom and fit move the view. Real activity from
 * V19 records streams in on the right: the steps it moves pulse and the lines into them flow, and the
 * counters at the top update on their own. Each step says who runs it (a person, an agent with the
 * founder's approval, or V19 on its own). Choosing a step or department opens its details and costs.
 * Map changes stay local until Save, which keeps every version.
 */
export function FounderBlueprint() {
  const [loaded, setLoaded] = useState<Loaded | "error" | null>(null);
  const [doc, setDoc] = useState<Blueprint | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [deptPanel, setDeptPanel] = useState<string | null>(null);
  const [showActivity, setShowActivity] = useState(true);
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
  const live = useFounderActivity(loaded !== null && loaded !== "error");

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
  function open(id: string, el: HTMLElement | null) { opener.current = el; setDeptPanel(null); setSelected(id); }
  function close() { setSelected(null); requestAnimationFrame(() => opener.current?.focus()); }
  function openDept(id: string, el: HTMLElement | null) { opener.current = el; setSelected(null); setHistory(null); setShowSuggestions(false); setDeptPanel(id); }
  function closeDept() { setDeptPanel(null); requestAnimationFrame(() => opener.current?.focus()); }
  function addStep(departmentId: string) {
    if (!doc) return;
    const taken = new Set(doc.steps.map((s) => s.id));
    const rows = doc.steps.filter((s) => s.departmentId === departmentId);
    const row = rows.length ? Math.max(...rows.map((s) => s.row)) + 1 : 0;
    const id = newId(`${departmentId}-step`, taken);
    update((b) => { b.steps.push({ id, departmentId, kind: "step", title: "New step", col: 0, row, status: "draft", owner: "", roles: [], notes: "", cost: { minutesPerRun: 0, runsPerMonth: 0, hourlyRate: 0 }, tools: [], signal: null, automation: { mode: "manual", agent: "" } }); });
    setDeptPanel(null); setSelected(id);
  }
  function removeStep(id: string) { update((b) => { b.steps = b.steps.filter((s) => s.id !== id); b.links = b.links.filter((l) => l.from !== id && l.to !== id); }); close(); }

  async function openHistory() {
    setSelected(null); setDeptPanel(null);
    try { const res = await fetch("/api/founder/blueprint/revisions", { cache: "no-store" }); const body = await res.json(); setHistory(res.ok && body.ok ? body.data.revisions : "error"); } catch { setHistory("error"); }
  }
  async function restore(version: number) {
    if (!loaded || loaded === "error" || dirty) { setMessage({ tone: "warn", text: "Save or discard your changes before restoring an earlier version." }); return; }
    const res = await fetch("/api/founder/blueprint/revisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version, expectedVersion: loaded.version }) }).catch(() => null);
    const body = await res?.json().catch(() => null) as { ok?: boolean; data?: { version: number }; error?: string } | null;
    if (res?.ok && body?.data) { await load(); setHistory(null); setMessage({ tone: "ok", text: `Restored version ${version} as version ${body.data.version}.` }); }
    else setMessage({ tone: "warn", text: body?.error === "blueprint_changed" ? "The blueprint changed since you opened it. Reload and try again." : "That version could not be restored." });
  }

  async function saveDoc(next: Blueprint, text: string): Promise<boolean> {
    if (!loaded || loaded === "error") return false;
    const valid = validateBlueprint(next);
    if (!valid.ok) { setMessage({ tone: "warn", text: valid.errors.join(" ") }); return false; }
    setSaving(true);
    try {
      const res = await fetch("/api/founder/blueprint", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blueprint: next, expectedVersion: loaded.version, summary: text.trim().slice(0, 200) }) });
      const body = await res.json().catch(() => null) as { ok?: boolean; data?: { version: number }; error?: string; detail?: string; issues?: string[] } | null;
      if (res.ok && body?.data) { setLoaded({ ...loaded, version: body.data.version, saved: true, blueprint: next }); setDoc(next); setDirty(false); setSummary(""); setMessage({ tone: "ok", text: `Saved as version ${body.data.version}.` }); return true; }
      setMessage({ tone: "warn", text: body?.detail ?? body?.issues?.join(" ") ?? "The blueprint could not be saved. Try again." });
    } catch { setMessage({ tone: "warn", text: "The request could not be reached. Try again." }); }
    finally { setSaving(false); }
    return false;
  }
  async function save() {
    if (!doc) return;
    if (!summary.trim()) { setMessage({ tone: "warn", text: "Describe the change in a few words before saving." }); return; }
    await saveDoc(doc, summary);
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
  const signals: Signals = live.signals ?? loaded.signals;
  const deptName = new Map(doc.departments.map((d) => [d.id, d.name]));
  const totalMonthly = doc.departments.reduce((n, d) => n + departmentCost(doc, d.id).monthlyTotal, 0);
  const suggestions = suggestBlueprintChanges(doc, signals).filter((x) => !dismissed.has(x.id));
  const recent = activityBySignal(live.events, live.now, DAY);
  const stepLive = (s: BlueprintStep) => (s.signal ? liveness(recent.get(s.signal)?.latest, live.now) : "quiet");
  const tiles = mode === "map" && view.scale < TILE_SCALE;
  const proposals = planAutopilot(doc, signals, new Date(live.now)).proposals;
  async function approve(stepId: string) {
    if (dirty) { setMessage({ tone: "warn", text: "Save or discard your changes before approving, so the approval is saved on its own." }); return; }
    const p = proposals.find((x) => x.stepId === stepId); if (!p || !doc) return;
    const next = structuredClone(doc); const s = next.steps.find((x) => x.id === stepId); if (!s) return;
    if (p.kind === "mark_live") s.status = "live";
    else s.notes = `${s.notes ? `${s.notes.trimEnd()}\n` : ""}Approved ${new Date(live.now).toISOString().slice(0, 10)}: ${p.text}`.slice(-4000);
    await saveDoc(next, `Approved autopilot proposal: ${p.text}`);
  }
  function act(sg: Suggestion) {
    if (sg.kind === "mark_live") { setDoc(applySuggestion(doc!, sg)); setDirty(true); setMessage({ tone: "ok", text: `${sg.title.replace(/^Mark /, "Marked ")}. Save to keep it.` }); setDismissed(new Set([...dismissed, sg.id])); }
    else if (sg.kind === "add_cost") { setShowSuggestions(false); if (mode === "map") fit(sg.departmentId); }
    else { setShowSuggestions(false); setSelected(sg.stepId); }
  }
  const rail = step ? "step" : deptPanel ? "dept" : showSuggestions ? "suggestions" : history !== null ? "history" : showActivity ? "activity" : null;
  const railClass = "absolute inset-y-0 right-0 z-10 w-full max-w-[380px] overflow-y-auto rounded-xl border border-white/10 bg-[#111111] p-4 shadow-2xl md:static md:z-auto md:shadow-none";

  return (
    <div className="flex h-[calc(100vh-96px)] min-h-[640px] flex-col">
      <style>{`@keyframes founder-flow { to { stroke-dashoffset: -24; } } .founder-flow { stroke-dasharray: 6 6; animation: founder-flow 1.2s linear infinite; } @keyframes founder-pulse { 0% { box-shadow: 0 0 0 0 rgba(56,189,248,0.55); } 100% { box-shadow: 0 0 0 14px rgba(56,189,248,0); } } .founder-pulse { animation: founder-pulse 1.8s ease-out infinite; } @media (prefers-reduced-motion: reduce) { .founder-flow, .founder-pulse { animation: none; } }`}</style>
      <LiveBar live={live} signals={signals} doc={doc} />
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
        <AutopilotControl version={loaded.version} now={live.now} onChanged={async () => { if (dirty) setMessage({ tone: "warn", text: "The autopilot saved a new version. Reload to see it; your unsaved changes would need to be made again." }); else await load(); }} onMessage={(tone, text) => setMessage({ tone, text })} />
        <button type="button" aria-pressed={rail === "activity"} onClick={() => { setSelected(null); setDeptPanel(null); setShowSuggestions(false); setHistory(null); setShowActivity(rail !== "activity"); }} className="min-h-9 rounded-lg bg-white/5 px-3 text-xs text-zinc-200 hover:bg-white/10">Activity</button>
        <button type="button" aria-pressed={showSuggestions} onClick={() => { setShowSuggestions(!showSuggestions); setSelected(null); setDeptPanel(null); setHistory(null); }} className="min-h-9 rounded-lg bg-white/5 px-3 text-xs text-zinc-200 hover:bg-white/10">Suggestions{suggestions.length ? ` (${suggestions.length})` : ""}</button>
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
                    <button type="button" onClick={(e) => openDept(d.id, e.currentTarget)} className="min-w-0 text-left hover:opacity-80" aria-label={`${d.name} summary and costs`}><h2 className="truncate text-sm font-medium text-zinc-100">{d.name}</h2><p className="truncate text-[11px] text-zinc-500">{d.group}</p></button>
                    <div className="flex items-center gap-2"><span className="text-[11px] tabular-nums text-zinc-400">{cost.live}/{cost.steps} live · {usd(cost.monthlyTotal)}/mo</span><button type="button" onClick={() => addStep(d.id)} className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/10" aria-label={`Add a step to ${d.name}`}>+ Step</button></div>
                  </header>
                </section>;
              })}
              <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={layout.width} height={layout.height} aria-hidden="true">
                <defs>
                  <marker id="founder-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="rgba(255,255,255,0.45)" /></marker>
                  <marker id="founder-arrow-live" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="rgb(125,211,252)" /></marker>
                </defs>
                {doc.links.map((l, i) => { const a = layout.steps.get(l.from), b = layout.steps.get(l.to); if (!a || !b) return null; const d = connectorPath(a, b); const below = b.y >= a.y + a.h; const lx = below ? (a.x + a.w / 2 + b.x + b.w / 2) / 2 : ((b.x > a.x ? a.x + a.w : a.x) + (b.x > a.x ? b.x : b.x + b.w)) / 2 - 18; const ly = below ? (a.y + a.h + b.y) / 2 : Math.min(a.y, b.y) + 12;
                  const target = doc.steps.find((s) => s.id === l.to); const flow = target ? stepLive(target) : "quiet";
                  return <g key={i}><path d={d} fill="none" stroke={flow === "quiet" ? "rgba(255,255,255,0.28)" : flow === "pulse" ? "rgb(125,211,252)" : "rgba(125,211,252,0.55)"} strokeWidth={flow === "quiet" ? 1.5 : 2} className={flow === "quiet" ? undefined : "founder-flow"} markerEnd={flow === "quiet" ? "url(#founder-arrow)" : "url(#founder-arrow-live)"} />{l.label && <text x={below ? lx + 6 : lx} y={below ? ly - 4 : ly} className="fill-zinc-400 text-[11px]">{l.label}</text>}</g>; })}
              </svg>
              {doc.steps.map((s) => {
                const b = layout.steps.get(s.id)!; const v = s.signal ? signals[s.signal] : undefined; const attention = s.signal && ATTENTION.has(s.signal) && typeof v === "number" && v > 0;
                const lv = stepLive(s); const hits = s.signal ? recent.get(s.signal)?.count ?? 0 : 0;
                const shape = s.kind === "decision" ? "rounded-md border-dashed" : s.kind === "start" || s.kind === "end" ? "rounded-full" : "rounded-xl";
                const auto = s.automation.mode;
                return <button key={s.id} type="button" onClick={(e) => open(s.id, e.currentTarget)} aria-pressed={selected === s.id} aria-label={`${s.title}, ${deptName.get(s.departmentId)}, ${STATUS_LABEL[s.status]}${s.kind === "decision" ? ", decision" : ""}${s.signal ? `, ${SIGNAL_TEXT[s.signal]} ${signalValue(s.signal, v)}` : ""}${auto !== "manual" ? `, ${AUTOMATION_LABEL[auto]}` : ""}${hits ? `, ${hits} event${hits === 1 ? "" : "s"} today` : ""}`}
                  className={`absolute flex flex-col justify-between border bg-[#161616] px-3 py-2 text-left shadow-sm transition hover:border-white/30 ${shape} ${selected === s.id ? "border-white/70 ring-2 ring-white/20" : attention ? "border-amber-300/50" : lv !== "quiet" ? "border-sky-300/50" : "border-white/12"} ${lv === "pulse" ? "founder-pulse" : ""} ${s.status === "archived" ? "opacity-50" : ""} ${tiles ? "opacity-30" : ""}`}
                  style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
                  <span className="flex items-start gap-1.5"><span aria-hidden className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[STATUS_TONE[s.status]]}`} /><span className="line-clamp-2 flex-1 text-[12px] leading-4 text-zinc-100">{s.kind === "decision" ? "◇ " : ""}{s.title}</span>{auto !== "manual" && <span aria-hidden title={AUTOMATION_LABEL[auto]} className={`shrink-0 rounded px-1 text-[9px] leading-4 ${auto === "autonomous" ? "bg-sky-400/15 text-sky-200" : auto === "approval" ? "bg-amber-300/15 text-amber-100" : "bg-white/10 text-zinc-300"}`}>{AUTOMATION_GLYPH[auto]} {AUTOMATION_SHORT[auto]}</span>}</span>
                  {s.signal ? <span className={`truncate text-[10px] tabular-nums ${attention ? "text-amber-200" : "text-zinc-400"}`}>{SIGNAL_TEXT[s.signal]}: {signalValue(s.signal, v)}{hits ? <span className="text-sky-300"> · +{hits} today</span> : null}</span> : <span className="truncate text-[10px] text-zinc-500">{s.owner || s.automation.agent || STATUS_LABEL[s.status]}</span>}
                </button>;
              })}
              {tiles && layout.regions.map((r) => {
                const d = doc.departments.find((x) => x.id === r.departmentId)!; const cost = departmentCost(doc, d.id);
                const own = doc.steps.filter((s) => s.departmentId === d.id && s.status !== "archived");
                const events = own.reduce((t, s) => t + (s.signal ? recent.get(s.signal)?.count ?? 0 : 0), 0);
                const seen = new Set<SignalKey>(); let eventsUnique = 0; for (const s of own) if (s.signal && !seen.has(s.signal)) { seen.add(s.signal); eventsUnique += recent.get(s.signal)?.count ?? 0; }
                const automated = own.filter((s) => s.automation.mode === "autonomous" || s.automation.mode === "approval").length;
                const problem = own.some((s) => s.signal && ATTENTION.has(s.signal) && typeof signals[s.signal] === "number" && (signals[s.signal] as number) > 0);
                const pulsing = own.some((s) => stepLive(s) === "pulse");
                // Text grows as the map shrinks, but never beyond what fits inside the tile.
                const em = Math.min(13 / view.scale, r.w / 15, r.h / 8.5);
                return <button key={`tile-${r.departmentId}`} type="button" onClick={() => fit(d.id)} aria-label={`${d.name}: ${cost.live} of ${cost.steps} live, ${usd(cost.monthlyTotal)} a month, ${eventsUnique} events today. Zoom in.`}
                  className={`absolute flex flex-col items-start justify-center gap-[0.4em] rounded-2xl border bg-[#101010]/85 text-left backdrop-blur-[1px] transition hover:border-white/40 ${problem ? "border-rose-400/50" : pulsing ? "border-sky-300/60 founder-pulse" : "border-white/15"}`}
                  style={{ left: r.x, top: r.y, width: r.w, height: r.h, padding: em * 1.1, fontSize: em }}>
                  <span className="flex items-center gap-[0.5em]"><span aria-hidden className={`inline-block h-[0.7em] w-[0.7em] rounded-full ${problem ? "bg-rose-400" : pulsing || events ? "bg-sky-400" : cost.live ? "bg-emerald-400" : "bg-zinc-500"}`} /><span className="line-clamp-2 break-words font-medium text-zinc-50" style={{ fontSize: "1.55em", lineHeight: 1.1 }}>{d.name}</span></span>
                  <span className="text-zinc-400">{d.group}</span>
                  <span className="tabular-nums text-zinc-200" style={{ fontSize: "1.1em" }}>{cost.live}/{cost.steps} live · {usd(cost.monthlyTotal)}/mo</span>
                  <span className="tabular-nums text-zinc-300">{eventsUnique ? `${eventsUnique} event${eventsUnique === 1 ? "" : "s"} today` : "Quiet today"} · {automated}/{own.length} run by agents</span>
                </button>;
              })}
            </div>
            {tiles && <p className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-[11px] text-zinc-400">Zoomed out: departments shown as summaries. Choose one or zoom in for its steps.</p>}
          </div>
        ) : (
          <div className="min-w-0 flex-1 overflow-auto rounded-xl border border-white/8 p-4">
            {doc.departments.map((d) => { const cost = departmentCost(doc, d.id); return <section key={d.id} aria-labelledby={`list-${d.id}`} className="mb-6">
              <h2 id={`list-${d.id}`} className="text-sm font-medium text-zinc-100">{d.name} <span className="text-xs font-normal text-zinc-500">· {d.group} · {cost.live}/{cost.steps} live · {usd(cost.monthlyTotal)}/mo</span></h2>
              <ol className="mt-2 space-y-1">{doc.steps.filter((s) => s.departmentId === d.id).sort((a, b) => a.row - b.row || a.col - b.col).map((s) => <li key={s.id}><button type="button" onClick={(e) => open(s.id, e.currentTarget)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-zinc-200 hover:bg-white/5"><span aria-hidden className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[STATUS_TONE[s.status]]}`} />{s.kind === "decision" ? "Decision: " : ""}{s.title}<span className="ml-auto text-xs text-zinc-500">{STATUS_LABEL[s.status]} · {AUTOMATION_LABEL[s.automation.mode]}{s.signal ? ` · ${SIGNAL_TEXT[s.signal]} ${signalValue(s.signal, signals[s.signal])}` : ""}</span></button></li>)}</ol>
            </section>; })}
          </div>
        )}

        {rail === "activity" && (
          <aside aria-label="Activity" className={railClass}>
            <div className="mb-5"><AutopilotLog proposals={proposals} onApprove={(id) => void approve(id)} version={loaded.version} /></div>
            <ActivityRail live={live} signals={signals} doc={doc} suggestionsCount={suggestions.length} onOpenSuggestions={() => setShowSuggestions(true)} onSelectStep={(id) => { setDeptPanel(null); setSelected(id); }} />
          </aside>
        )}
        {rail === "dept" && deptPanel && (
          <aside aria-label="Department summary" className={railClass} onKeyDown={(e) => { if (e.key === "Escape") closeDept(); }}>
            <DepartmentPanel doc={doc} departmentId={deptPanel} live={live} onSelectStep={(id) => { setDeptPanel(null); setSelected(id); }} onClose={closeDept} />
          </aside>
        )}
        {rail === "suggestions" && (
          <aside aria-label="Suggestions" className={railClass}>
            <div className="flex items-center justify-between"><h2 className="text-sm font-medium">Suggestions from V19 records</h2><button type="button" onClick={() => setShowSuggestions(false)} aria-label="Close suggestions" className="rounded-md px-2 py-0.5 text-zinc-400 hover:bg-white/5 hover:text-white">✕</button></div>
            <p className="mt-1 text-xs text-zinc-500">Worked out from this map and live records. Nothing changes until you apply a suggestion and save.</p>
            {suggestions.length === 0 ? <p className="mt-3 text-sm text-zinc-400">Nothing to suggest right now.</p> : (
              <ul className="mt-3 space-y-2">{suggestions.map((sg) => <li key={sg.id} className={`rounded-lg border p-3 text-xs ${sg.kind === "needs_attention" ? "border-amber-300/40" : "border-white/8"}`}>
                <p className="text-zinc-100">{sg.title}</p><p className="mt-0.5 text-zinc-400">{sg.reason}</p>
                <div className="mt-2 flex gap-3"><button type="button" onClick={() => act(sg)} className="text-zinc-200 underline underline-offset-4">{sg.kind === "mark_live" ? "Apply" : sg.kind === "add_cost" ? "Show department" : "Open step"}</button><button type="button" onClick={() => setDismissed(new Set([...dismissed, sg.id]))} className="text-zinc-500 hover:text-zinc-300">Dismiss</button></div>
              </li>)}</ul>)}
          </aside>
        )}
        {rail === "history" && history !== null && (
          <aside aria-label="Saved versions" className={railClass}>
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
        {rail === "step" && step && (
          <aside aria-label={`Step details: ${step.title}`} className={railClass} onKeyDown={(e) => { if (e.key === "Escape") close(); }}>
            <StepDetails key={step.id} step={step} blueprint={doc} signals={signals} live={live} onPatch={patchStep} onClose={close} onRemove={() => removeStep(step.id)}
              onLink={(to, label) => update((b) => { if (to && to !== step.id && !b.links.some((l) => l.from === step.id && l.to === to)) b.links.push({ from: step.id, to, label }); })}
              onUnlink={(to) => update((b) => { b.links = b.links.filter((l) => !(l.from === step.id && l.to === to)); })} />
          </aside>
        )}
      </div>
    </div>
  );
}

type Tab = "overview" | "activity" | "cost" | "automation";
const TAB_LABEL: Record<Tab, string> = { overview: "Overview", activity: "Activity", cost: "Cost", automation: "Automation" };

function StepDetails({ step, blueprint, signals, live, onPatch, onClose, onRemove, onLink, onUnlink }: { step: BlueprintStep; blueprint: Blueprint; signals: Signals; live: FounderLive; onPatch: (p: Partial<BlueprintStep>) => void; onClose: () => void; onRemove: () => void; onLink: (to: string, label: string) => void; onUnlink: (to: string) => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  const [tab, setTab] = useState<Tab>("overview");
  const c = stepCost(step);
  const [linkTo, setLinkTo] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const outgoing = blueprint.links.filter((l) => l.from === step.id);
  const incoming = blueprint.links.filter((l) => l.to === step.id);
  const field = "mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-sm text-zinc-100";
  const num = (v: string) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };
  const events = step.signal ? live.events.filter((e) => e.signal === step.signal) : [];
  const title = (id: string) => blueprint.steps.find((s) => s.id === id)?.title ?? id;
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><p className="text-xs text-zinc-500">{blueprint.departments.find((d) => d.id === step.departmentId)?.name} · {step.kind === "decision" ? "Decision" : step.kind === "start" ? "Start" : step.kind === "end" ? "End" : "Step"}</p><p className="mt-0.5 truncate text-base font-medium text-zinc-50">{step.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]"><span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-zinc-200"><span aria-hidden className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[STATUS_TONE[step.status]]}`} />{STATUS_LABEL[step.status]}</span><span className="rounded-full bg-white/5 px-2 py-0.5 text-zinc-200">{AUTOMATION_LABEL[step.automation.mode]}{step.automation.agent ? ` · ${step.automation.agent}` : ""}</span><span className="rounded-full bg-white/5 px-2 py-0.5 tabular-nums text-zinc-200">{usd(c.monthlyTotal)}/mo</span></p>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} className="rounded-md px-2 py-0.5 text-zinc-400 hover:bg-white/5 hover:text-white" aria-label="Close step details">✕</button>
      </div>
      <div role="tablist" aria-label="Step sections" className="flex gap-1 rounded-lg bg-white/5 p-0.5 text-xs">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex-1 rounded-md px-2 py-1 ${tab === t ? "bg-white/15 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"}`}>{TAB_LABEL[t]}{t === "activity" && events.length ? ` (${events.length})` : ""}</button>)}
      </div>

      {tab === "overview" && <div role="tabpanel" aria-label="Overview" className="space-y-4">
        <label className="block text-xs text-zinc-400">Title<input value={step.title} maxLength={120} onChange={(e) => onPatch({ title: e.target.value })} className={field} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-zinc-400">Status<select value={step.status} onChange={(e) => onPatch({ status: e.target.value as StepStatus })} className={field}>{STEP_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
          <label className="block text-xs text-zinc-400">Shape<select value={step.kind} onChange={(e) => onPatch({ kind: e.target.value as BlueprintStep["kind"] })} className={field}><option value="step">Step</option><option value="decision">Decision</option><option value="start">Start</option><option value="end">End</option></select></label>
        </div>
        <label className="block text-xs text-zinc-400">Owner<input value={step.owner} maxLength={80} onChange={(e) => onPatch({ owner: e.target.value })} placeholder="Samir" className={field} /></label>
        <label className="block text-xs text-zinc-400">Roles (comma separated)<input value={step.roles.join(", ")} onChange={(e) => onPatch({ roles: e.target.value.split(",").map((r) => r.trim()).filter(Boolean).slice(0, 12) })} placeholder="Founder, Claude" className={field} /></label>
        <label className="block text-xs text-zinc-400">Notes<textarea value={step.notes} maxLength={4000} rows={5} onChange={(e) => onPatch({ notes: e.target.value })} placeholder="How this step works, links, agenda…" className={field} /></label>
        <label className="block text-xs text-zinc-400">Watches a live signal<select value={step.signal ?? ""} onChange={(e) => onPatch({ signal: (e.target.value || null) as SignalKey | null })} className={field}><option value="">None</option>{SIGNAL_KEYS.map((k) => <option key={k} value={k}>{SIGNAL_TEXT[k]}</option>)}</select></label>
        {step.signal && <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-zinc-300">{SIGNAL_TEXT[step.signal]}: <span className="tabular-nums text-zinc-100">{signalValue(step.signal, signals[step.signal])}</span> <span className="text-zinc-500">· live from V19, all workspaces</span></p>}
        <section aria-labelledby="step-links-heading">
          <h3 id="step-links-heading" className="text-xs font-medium text-zinc-200">Leads to</h3>
          <ul className="mt-2 space-y-1 text-xs">{outgoing.length === 0 ? <li className="text-zinc-500">Nothing yet.</li> : outgoing.map((l) => <li key={l.to} className="flex items-center gap-2 text-zinc-300">{title(l.to)}{l.label && <span className="text-zinc-500">({l.label})</span>}<button type="button" aria-label={`Remove link to ${l.to}`} onClick={() => onUnlink(l.to)} className="ml-auto text-zinc-500 hover:text-white">✕</button></li>)}</ul>
          {incoming.length > 0 && <p className="mt-2 text-[11px] text-zinc-500">Comes after: {incoming.map((l) => title(l.from)).join(", ")}</p>}
          <div className="mt-2 flex gap-1.5">
            <select aria-label="Link to step" value={linkTo} onChange={(e) => setLinkTo(e.target.value)} className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-1.5 py-1 text-xs text-zinc-100"><option value="">Choose a step…</option>{blueprint.steps.filter((s) => s.id !== step.id).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
            <input aria-label="Link label" value={linkLabel} maxLength={40} onChange={(e) => setLinkLabel(e.target.value)} placeholder="label" className="w-20 rounded-md border border-white/10 bg-black/30 px-1.5 py-1 text-xs text-zinc-100" />
            <button type="button" disabled={!linkTo} onClick={() => { onLink(linkTo, linkLabel.trim()); setLinkTo(""); setLinkLabel(""); }} className="rounded-md bg-white/5 px-2 text-xs text-zinc-200 disabled:opacity-40">Link</button>
          </div>
        </section>
        <button type="button" onClick={() => { if (window.confirm(`Remove "${step.title}" and its links from the blueprint? Saved versions keep it.`)) onRemove(); }} className="text-xs text-rose-300 underline underline-offset-4">Remove step</button>
      </div>}

      {tab === "activity" && <div role="tabpanel" aria-label="Activity" className="space-y-2">
        {!step.signal ? <p className="text-xs text-zinc-400">This step does not watch a live signal, so no activity is linked to it. Choose one under Overview.</p>
          : events.length === 0 ? <p className="text-xs text-zinc-400">Nothing recorded for {SIGNAL_TEXT[step.signal].toLowerCase()} in the last 7 days.</p> : (
          <ol className="space-y-1.5">{events.slice(0, 50).map((e) => <li key={e.id} className="flex items-start gap-2 text-xs"><span aria-hidden className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[e.tone]}`} /><span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><span className="text-zinc-100">{e.title}</span><time dateTime={e.at} className="shrink-0 tabular-nums text-zinc-500">{timeAgo(e.at, live.now)}</time></span><span className="block text-zinc-400">{e.detail}</span></span></li>)}</ol>)}
      </div>}

      {tab === "cost" && <div role="tabpanel" aria-label="Cost" className="space-y-4">
        <section aria-labelledby="step-cost-heading" className="rounded-xl border border-white/8 p-3">
          <h3 id="step-cost-heading" className="text-xs font-medium text-zinc-200">Process cost</h3>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <label className="text-[11px] text-zinc-400">Minutes per run<input type="number" min={0} value={step.cost.minutesPerRun} onChange={(e) => onPatch({ cost: { ...step.cost, minutesPerRun: num(e.target.value) } })} className={field} /></label>
            <label className="text-[11px] text-zinc-400">Runs per month<input type="number" min={0} value={step.cost.runsPerMonth} onChange={(e) => onPatch({ cost: { ...step.cost, runsPerMonth: num(e.target.value) } })} className={field} /></label>
            <label className="text-[11px] text-zinc-400">$ per hour<input type="number" min={0} value={step.cost.hourlyRate} onChange={(e) => onPatch({ cost: { ...step.cost, hourlyRate: num(e.target.value) } })} className={field} /></label>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            {[["Hours per run", c.hoursPerRun.toString()], ["Cost per run", usd(c.costPerRun)], ["Hours per month", c.hoursPerMonth.toString()], ["Monthly labor", usd(c.monthlyLabor)], ["Annual labor", usd(c.annualLabor)], ["Monthly tools", usd(c.monthlyTools)], ["One-time tools", usd(c.oneTimeTools)], ["Monthly total", usd(c.monthlyTotal)]].map(([k, v]) => <div key={k}><dt className="text-zinc-500">{k}</dt><dd className="tabular-nums text-zinc-100">{v}</dd></div>)}
          </dl>
        </section>
        <section aria-labelledby="step-tools-heading">
          <h3 id="step-tools-heading" className="text-xs font-medium text-zinc-200">Tools</h3>
          <ul className="mt-2 space-y-1.5">{step.tools.map((t, i) => <li key={i} className="flex items-center gap-2 text-xs">
            <input aria-label="Tool name" value={t.name} maxLength={80} onChange={(e) => onPatch({ tools: step.tools.map((x, j) => (j === i ? { ...x, name: e.target.value || "Tool" } : x)) })} className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100" />
            <input aria-label={`${t.name} monthly cost`} type="number" min={0} value={t.monthlyCost} onChange={(e) => onPatch({ tools: step.tools.map((x, j) => (j === i ? { ...x, monthlyCost: num(e.target.value) } : x)) })} className="w-16 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100" />
            <input aria-label={`${t.name} one-time cost`} type="number" min={0} value={t.oneTimeCost} onChange={(e) => onPatch({ tools: step.tools.map((x, j) => (j === i ? { ...x, oneTimeCost: num(e.target.value) } : x)) })} className="w-16 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100" />
            <label className="flex items-center gap-1 text-zinc-400"><input type="checkbox" checked={t.active} onChange={(e) => onPatch({ tools: step.tools.map((x, j) => (j === i ? { ...x, active: e.target.checked } : x)) })} />Active</label>
            <button type="button" aria-label={`Remove ${t.name}`} onClick={() => onPatch({ tools: step.tools.filter((_, j) => j !== i) })} className="text-zinc-500 hover:text-white">✕</button>
          </li>)}</ul>
          {step.tools.length > 0 && <p className="mt-1 text-[11px] text-zinc-500">Columns: name, monthly, one-time.</p>}
          {step.tools.length < 20 && <button type="button" onClick={() => onPatch({ tools: [...step.tools, { name: "New tool", monthlyCost: 0, oneTimeCost: 0, active: true }] })} className="mt-2 text-xs text-zinc-300 underline underline-offset-4">Add a tool</button>}
        </section>
      </div>}

      {tab === "automation" && <div role="tabpanel" aria-label="Automation" className="space-y-3">
        <fieldset>
          <legend className="text-xs text-zinc-400">Who runs this step</legend>
          <div className="mt-2 space-y-1.5">{AUTOMATION_MODES.map((m) => <label key={m} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs ${step.automation.mode === m ? "border-white/40 bg-white/[0.05]" : "border-white/8"}`}><input type="radio" name={`automation-${step.id}`} checked={step.automation.mode === m} onChange={() => onPatch({ automation: { ...step.automation, mode: m } })} className="mt-0.5" /><span><span className="block text-zinc-100">{AUTOMATION_LABEL[m]}</span><span className="block text-zinc-400">{AUTOMATION_HELP[m]}</span></span></label>)}</div>
        </fieldset>
        {step.automation.mode !== "manual" && <label className="block text-xs text-zinc-400">Agent or system<input value={step.automation.agent} maxLength={80} onChange={(e) => onPatch({ automation: { ...step.automation, agent: e.target.value } })} placeholder="Claude, V19 gates, GitHub Actions…" className={field} /></label>}
        <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-[11px] leading-5 text-zinc-400">This records how the step runs today. Agents act through V19&apos;s own gates, approvals and audit; this map does not grant an agent any permission.</p>
      </div>}
    </div>
  );
}
