import {useEffect, useRef, useState} from "react";
import type {CustomerView} from "../App";
const COMMANDS: Array<{view: CustomerView; label: string; keywords: string}> = [
  {view: "agent", label: "Open Agent", keywords: "chat conversation assistant"},
  {view: "repository-workspace", label: "Open Repositories", keywords: "github repository git files editor changes diff worktree"},
  {view: "deployment-requests", label: "Open Releases", keywords: "release workspace deploy approvals recovery"},
  {view: "airflow-automation", label: "Open Batches", keywords: "airflow automation batch dags workflows"},
  {view: "plugins-skills", label: "Open Apps & skills", keywords: "apps plugins skills connectors integrations outlook capabilities customization MCP"},
  {view: "docs", label: "Open documentation", keywords: "help guidance"},
  {view: "axiom-bot", label: "Open Axiom Bot", keywords: "task draft automation"},
  {view: "settings", label: "Open settings", keywords: "preferences appearance account billing models permissions"},
];
const DESCRIPTIONS:Record<CustomerView,string>={
 agent:"Research, code and review", "axiom-bot":"Saved tasks and reviewed app actions",
 "repository-workspace":"Files, diffs and repository sync", "deployment-requests":"Scope, approvals and delivery evidence",
 "airflow-automation":"Airflow runs and batch operations", "plugins-skills":"Connections and reusable skills",
 docs:"Guides and operating references", settings:"Account, models and preferences",
};
export function WorkspaceCommands({open, onOpenChange, onNavigate}: {open: boolean; onOpenChange: (open: boolean) => void; onNavigate: (view: CustomerView) => void}) {
  const [query, setQuery] = useState(""), [selected, setSelected] = useState(0);
  const field = useRef<HTMLInputElement>(null), dialog = useRef<HTMLDivElement>(null);
  const results = COMMANDS.filter(command => `${command.label} ${command.keywords}`.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && !event.isComposing && event.key.toLowerCase() === "p") {event.preventDefault(); onOpenChange(!open);}
    };
    window.addEventListener("keydown", shortcut); return () => window.removeEventListener("keydown", shortcut);
  }, [open, onOpenChange]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    setQuery(""); setSelected(0); field.current?.focus();
    return () => {if (previous?.isConnected) previous.focus();};
  }, [open]);
  function choose(index: number) {const command = results[index]; if (command) {onNavigate(command.view); onOpenChange(false);}}
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-6 pt-[12vh]" onMouseDown={event => {if (event.target === event.currentTarget) onOpenChange(false);}}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-label="Desktop commands" className="w-full max-w-xl overflow-hidden rounded-xl border border-white/15 bg-[#1a1b1e] shadow-2xl" onKeyDown={event => {
      if (event.nativeEvent.isComposing) return;
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
      <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3"><input ref={field} role="combobox" aria-label="Search desktop commands" aria-expanded="true" aria-controls="desktop-command-results" aria-autocomplete="list" aria-activedescendant={results[selected] ? `desktop-command-${results[selected].view}` : undefined} value={query} onChange={event => {setQuery(event.target.value); setSelected(0);}} placeholder="Where would you like to go?" className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"/><button type="button" onClick={() => onOpenChange(false)} aria-label="Close commands" className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-500">Esc</button></div>
      <div id="desktop-command-results" role="listbox" aria-label="Desktop destinations" className="max-h-80 overflow-y-auto p-2">{results.map((command, index) => <button type="button" role="option" aria-label={command.label} aria-describedby={`desktop-command-description-${command.view}`} aria-selected={index === selected} id={`desktop-command-${command.view}`} key={command.view} tabIndex={-1} onMouseMove={() => setSelected(index)} onClick={() => choose(index)} className={`block w-full rounded-md px-3 py-2.5 text-left text-xs ${index === selected ? "bg-white/10 text-white" : "text-zinc-400"}`}><span className="block text-sm">{command.label}</span><span id={`desktop-command-description-${command.view}`} className="mt-1 block text-xs text-zinc-500">{DESCRIPTIONS[command.view]}</span></button>)}{results.length === 0 && <p role="status" className="px-3 py-5 text-xs text-zinc-500">No matching commands.</p>}</div>
      <p className="border-t border-white/[0.06] px-4 py-2 text-[10px] text-zinc-500">↑ ↓ navigate · Enter open · Esc close</p>
    </div>
  </div>;
}
