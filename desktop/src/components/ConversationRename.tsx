import {useEffect, useRef, useState} from "react";
import {desktopClient} from "../lib/desktopClient";
export function ConversationRename({id, title, disabled = false, onRenamed, onBusyChange}: {id: string; title: string | null; disabled?: boolean; onRenamed: (id: string, title: string | null) => void; onBusyChange?: (busy: boolean) => void}) {
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(title ?? "");
  const [notice, setNotice] = useState<string | null>(null), [busy, setBusy] = useState(false), [verified, setVerified] = useState(true);
  const mounted = useRef(false), pending = useRef(false), expected = useRef(title);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  useEffect(() => {if (!editing) {expected.current = title; setDraft(title ?? "");}}, [title, editing]);
  const renderContext = desktopClient.config;
  async function run(write: boolean) {
    if (renderContext !== desktopClient.config) return;
    if (disabled || pending.current || (write && (!verified || !draft.trim()))) return;
    const context = desktopClient.config, intended = draft.trim();
    const owns = () => mounted.current && context === desktopClient.config;
    pending.current = true; setBusy(true); onBusyChange?.(true); setNotice(null);
    let accepted = false;
    try {
      if (write) {
        try {const result = await desktopClient.renameAgentConversation(id, intended, expected.current); accepted = result.ok && result.data.id === id && result.data.title === intended;} catch { /* Read the authoritative title without replaying the write. */ }
      }
      if (!owns()) return;
      const current = await desktopClient.getAgentConversation(id);
      if (!owns()) return;
      if (!current.ok || current.data.id !== id || !(current.data.title === null || typeof current.data.title === "string")) throw Error("title_unverified");
      expected.current = current.data.title; setVerified(true); onRenamed(id, current.data.title);
      if (write && current.data.title === intended) {setEditing(false); setNotice("Conversation title saved.");}
      else setNotice(accepted ? "Title changed again after saving. The latest service title is shown; review before saving." : "Title refreshed from the service. Review it before saving again.");
    } catch {if (owns()) {setVerified(false); setNotice("The title could not be verified. Refresh title before saving again.");}}
    finally {pending.current = false; if (mounted.current) {setBusy(false); onBusyChange?.(false); if (!owns()) setVerified(false);}}
  }
  return <div className="relative shrink-0">
    <button data-help-id="agent.workspace.rename-open" type="button" disabled={disabled || busy} onClick={() => {setEditing(value => !value); setNotice(null);}} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 disabled:opacity-40">Rename chat</button>
    {editing && <form aria-label="Rename conversation" onSubmit={event => {event.preventDefault(); void run(true);}} className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-white/15 bg-[#1a1b1e] p-3 shadow-xl">
      <label className="text-xs text-zinc-400">Conversation title<input data-help-id="agent.workspace.rename-title" autoFocus aria-label="Conversation title" maxLength={200} value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} onKeyDown={event => {if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {if (event.key === "Enter") event.preventDefault(); return;} if (event.key === "Escape") {event.preventDefault(); setEditing(false);}}} className="mt-2 w-full rounded-md border border-white/10 bg-black/20 px-2 py-2 text-xs text-zinc-100"/></label>
      <div className="mt-3 flex gap-2"><button data-help-id="agent.workspace.rename-save" type="submit" disabled={disabled || busy || !verified || !draft.trim()} className="rounded-md bg-white px-2 py-1.5 text-xs text-black disabled:opacity-40">Save title</button><button data-help-id="agent.workspace.rename-refresh" type="button" disabled={busy} onClick={() => void run(false)} className="text-xs text-zinc-400 underline">Refresh title</button><button data-help-id="agent.workspace.rename-cancel" type="button" disabled={busy} onClick={() => setEditing(false)} className="ml-auto text-xs text-zinc-500">Cancel</button></div>
      {notice && <p role="status" className="mt-2 text-xs leading-5 text-zinc-400">{notice}</p>}
    </form>}
    {!editing && notice && <p role="status" className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-white/10 bg-[#1a1b1e] p-2 text-xs text-zinc-400">{notice}</p>}
  </div>;
}
