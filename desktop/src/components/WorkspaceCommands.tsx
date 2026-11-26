import {useEffect, useRef, useState} from "react";
import type {CustomerView} from "../App";
import {desktopClient} from "../lib/desktopClient";
import {releaseRequestTone, StatusIconChip} from "./StatusBadge";

type ReleaseHit = {id: string; version: number; title: string; status: string; environment: string | null};
const COMMANDS: Array<{view: CustomerView; label: string; keywords: string}> = [
  {view: "agent", label: "Open Agent", keywords: "chat conversation assistant"},
  {view: "repository-workspace", label: "Open Repositories", keywords: "github repository git files editor changes diff worktree"},
  {view: "deployment-requests", label: "Open Deployments", keywords: "release workspace deploy approvals recovery"},
  {view: "tickets", label: "Open Tickets", keywords: "incident case change tickets"},
  {view: "airflow-automation", label: "Open Batches", keywords: "airflow automation batch dags workflows"},
  {view: "plugins-skills", label: "Open Apps & Skills", keywords: "apps plugins skills connectors integrations outlook capabilities customization MCP"},
  {view: "docs", label: "Open documentation", keywords: "help guidance"},
  {view: "axiom-bot", label: "Open Saved Tasks", keywords: "v19 bot axiom bot task draft automation"},
  {view: "settings", label: "Open settings", keywords: "preferences appearance account billing models permissions"},
];
const DESCRIPTIONS:Record<CustomerView,string>={
 agent:"Research, code and review", "axiom-bot":"Saved tasks and reviewed app actions",
 "repository-workspace":"Files, diffs and repository sync", "deployment-requests":"Scope, approvals and delivery evidence",
 tickets:"Recorded deployment incidents and change tickets", "airflow-automation":"Airflow runs and batch operations", "plugins-skills":"Connections and reusable skills",
 docs:"Guides and operating references", settings:"Account, models and preferences",
};
export function WorkspaceCommands({open, onOpenChange, onNavigate, onOpenRelease}: {open: boolean; onOpenChange: (open: boolean) => void; onNavigate: (view: CustomerView) => void; onOpenRelease?: (release: {id: string; version: number}) => void}) {
  const [query, setQuery] = useState(""), [selected, setSelected] = useState(0);
  const [releases, setReleases] = useState<ReleaseHit[] | null | undefined>();
  const field = useRef<HTMLInputElement>(null), dialog = useRef<HTMLDivElement>(null);
  const needle = query.trim().toLowerCase();
  const destinations = COMMANDS.filter(command => `${command.label} ${command.keywords}`.toLowerCase().includes(needle));
  const releaseHits = onOpenRelease && releases ? releases.filter(release => !needle || `${release.title} ${release.environment ?? ""} ${release.status} v${release.version}`.toLowerCase().includes(needle)).slice(0, needle ? 6 : 3) : [];
  const results: Array<{key: string; label: string; description: string; release?: ReleaseHit; view?: CustomerView}> = [
    ...destinations.map(command => ({key: command.view, label: command.label, description: DESCRIPTIONS[command.view], view: command.view})),
    ...releaseHits.map(release => ({key: `release-${release.id}-${release.version}`, label: `Open release ${release.title}`, description: `Version ${release.version}${release.environment ? ` · ${release.environment}` : ""} · ${release.status}`, release})),
  ];
  useEffect(() => {
    if (!open || !onOpenRelease) return;
    let live = true;
    setReleases(undefined);
    Promise.resolve().then(() => desktopClient.deploymentRequests()).then(result => {
      if (!live) return;
      setReleases(result.ok ? result.data.map(row => ({id: row.id, version: row.version, title: row.title, status: row.status, environment: row.releaseContext.scope.targetEnvironment})) : null);
    }).catch(() => { if (live) setReleases(null); });
    return () => { live = false; };
  }, [open, onOpenRelease]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const commandShortcut = (!event.shiftKey && key === "k") || (event.shiftKey && key === "p");
      if ((event.metaKey || event.ctrlKey) && commandShortcut && !event.altKey && !event.isComposing && event.keyCode !== 229) {
        if (!open && document.activeElement?.closest('[aria-modal="true"]')) return;
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", shortcut); return () => window.removeEventListener("keydown", shortcut);
  }, [open, onOpenChange]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    setQuery(""); setSelected(0); field.current?.focus();
    return () => {if (previous?.isConnected) previous.focus();};
  }, [open]);
  function choose(index: number) {const item = results[index]; if (!item) return; if (item.release) onOpenRelease?.({id: item.release.id, version: item.release.version}); else if (item.view) onNavigate(item.view); onOpenChange(false);}
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-6 pt-[12vh]" onMouseDown={event => {if (event.target === event.currentTarget) onOpenChange(false);}}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-label="Desktop commands" className="w-full max-w-xl overflow-hidden rounded-xl border border-white/15 bg-[#1a1b1e] shadow-2xl" onKeyDown={event => {
      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
      if (event.key === "Escape") {event.preventDefault(); event.stopPropagation(); onOpenChange(false);}
      else if (event.key === "ArrowDown" || event.key === "ArrowUp") {event.preventDefault(); setSelected(index => results.length ? (index + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length : 0);}
      else if (event.key === "Enter" && event.target === field.current) {event.preventDefault(); choose(selected);}
      else if (event.key === "Tab") {
        const focusable = dialog.current?.querySelectorAll<HTMLElement>('input, button:not([tabindex="-1"])');
        const first = focusable?.[0], last = focusable?.[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
      }
    }}>
      <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3"><input ref={field} role="combobox" aria-label="Search desktop commands" aria-expanded="true" aria-controls="desktop-command-results" aria-autocomplete="list" aria-activedescendant={results[selected] ? `desktop-command-${results[selected].key}` : undefined} value={query} onChange={event => {setQuery(event.target.value); setSelected(0);}} placeholder="Where would you like to go?" className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-hidden placeholder:text-zinc-500"/><button type="button" onClick={() => onOpenChange(false)} aria-label="Close commands" className="rounded-sm border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-500">Esc</button></div>
      <div id="desktop-command-results" role="listbox" aria-label="Desktop destinations" className="max-h-80 overflow-y-auto p-2">{results.map((command, index) => <div key={command.key}>{command.release && (index === 0 || !results[index - 1].release) && <p className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wider text-zinc-500" aria-hidden="true">{needle ? "Releases" : "Recent releases"}</p>}<button type="button" role="option" aria-label={command.label} aria-describedby={`desktop-command-description-${command.key}`} aria-selected={index === selected} id={`desktop-command-${command.key}`} tabIndex={-1} onMouseMove={() => setSelected(index)} onClick={() => choose(index)} className={`flex w-full items-start gap-2.5 rounded-md px-3 py-2.5 text-left text-xs transition-colors ${index === selected ? "bg-white/10 text-white" : "text-zinc-400"}`}>{command.release && (() => { const t = releaseRequestTone(command.release.status); return <span className="mt-0.5"><StatusIconChip tone={t.tone} shape={t.shape} size={12}/></span>; })()}<span className="min-w-0"><span className="block truncate text-sm">{command.release ? command.release.title : command.label}</span><span id={`desktop-command-description-${command.key}`} className="mt-1 block text-xs text-zinc-500">{command.description}</span></span></button></div>)}{results.length === 0 && <p role="status" className="px-3 py-5 text-xs text-zinc-500">No matching commands.</p>}{onOpenRelease && releases === undefined && <p role="status" className="px-3 py-2 text-[11px] text-zinc-500">Loading releases…</p>}{onOpenRelease && releases === null && <p role="status" className="px-3 py-2 text-[11px] text-zinc-500">Releases could not be loaded. Destinations still work.</p>}</div>
      <p className="border-t border-white/6 px-4 py-2 text-[10px] text-zinc-500">↑ ↓ navigate · Enter open · Esc close</p>
    </div>
  </div>;
}
