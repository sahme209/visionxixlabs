import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { JiraTicketDiscovery } from "./JiraTicketDiscovery";
import { desktopClient } from "../lib/desktopClient";

/** Capture what the requester knows; execution prerequisites stay in the complete intake. */
export function ResolutionDraftForm({ onSaved, onBack, active = true }: { onSaved: () => void; onBack?: () => void; active?: boolean }) {
  const revision = useSyncExternalStore(desktopClient.subscribeContext, desktopClient.getContextRevision, desktopClient.getContextRevision);
  const owner = useRef({ config: desktopClient.config, revision });
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const ownsCompletion = () => mounted.current && owner.current.config === desktopClient.config && owner.current.revision === desktopClient.getContextRevision();
  const [showJira, setShowJira] = useState(false);
  const [title, setTitle] = useState("");
  const [applications, setApplications] = useState("");
  const [details, setDetails] = useState("");
  const [ticket, setTicket] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const last = useRef<{ content: string; id: string } | undefined>(undefined);
  const changed = owner.current.config !== desktopClient.config || owner.current.revision !== revision;
  async function save() {
    if (changed || saved || running.current) return;
    const apps = applications.split(/[,\n]/).map(value => value.trim()).filter(Boolean);
    if (!title.trim() || !apps.length || !details.trim()) { setError("Add a title, application and request details before saving."); return; }
    const payload = { title: title.trim(), applications: apps, requestDetails: details.trim(), ...(ticket.trim() ? { ticketUrl: ticket.trim() } : {}), ...(contact.trim() ? { applicationContact: contact.trim() } : {}) };
    const content = JSON.stringify(payload);
    if (last.current?.content !== content) last.current = { content, id: crypto.randomUUID() };
    running.current = true; setBusy(true); setError(undefined);
    try {
      const result = await desktopClient.createReleaseResolutionDraft(payload, last.current.id);
      if (!ownsCompletion()) return;
      if (!result.ok) { setError(`Draft was not confirmed saved: ${result.error}. Your details are retained.`); return; }
      setSaved(true); onSaved();
    } catch { if (ownsCompletion()) setError("Draft was not confirmed saved. Your details are retained; retry uses the same request identity."); }
    finally { running.current = false; if (ownsCompletion()) setBusy(false); }
  }
  const input = "w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200";
  return <section className="glass-card space-y-4 p-4" aria-label="Ticket-first release draft">
    <div><h2 className="text-sm font-semibold text-white">Start with what you know</h2><p className="mt-1 text-xs text-zinc-400">Save the ticket and application first. A release owner can resolve repository, workflow, batch dependencies and approvals before submission.</p></div>
    {changed && <p role="alert" className="text-xs text-amber-300">Workspace changed. Close this draft and start again in the selected workspace.</p>}
    <fieldset disabled={busy || changed || saved} className="grid gap-3 md:grid-cols-2">
      <label className="space-y-1 text-xs text-zinc-400"><span>Request title</span><input aria-label="Request title" className={input} maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="space-y-1 text-xs text-zinc-400"><span>Applications</span><input aria-label="Applications" className={input} value={applications} maxLength={2500} placeholder="Application names, separated by commas" onChange={event => setApplications(event.target.value)} /></label>
      <label className="space-y-1 text-xs text-zinc-400 md:col-span-2"><span>What needs to be released?</span><textarea aria-label="What needs to be released?" className={input} rows={3} maxLength={10000} value={details} onChange={event => setDetails(event.target.value)} /></label>
      <label className="space-y-1 text-xs text-zinc-400"><span>Ticket link (optional)</span><input aria-label="Ticket link (optional)" className={input} maxLength={2048} value={ticket} onChange={event => setTicket(event.target.value)} /></label>
      <label className="space-y-1 text-xs text-zinc-400"><span>Application owner (optional)</span><input aria-label="Application owner (optional)" className={input} maxLength={200} value={contact} onChange={event => setContact(event.target.value)} /></label>
    </fieldset>
    <div className="space-y-3">
      <button type="button" className="btn-secondary" disabled={busy || changed || saved} onClick={() => setShowJira(value => !value)}>{showJira ? "Hide Jira field preview" : "Explore Jira ticket fields"}</button>
      {showJira && active && !changed && (owner.current.config.sessionToken?.startsWith("axm.desk.") ? <JiraTicketDiscovery owner={owner.current} readCurrentOwner={() => ({ config: desktopClient.config, revision: desktopClient.getContextRevision() })} /> : <p className="text-xs text-zinc-400">A paired administrator session is required to explore Jira fields. You can still enter an existing ticket link and save this draft.</p>)}
    </div>
    {error && <p role="alert" className="text-xs text-amber-300">{error}</p>}
    {saved && <p role="status" className="text-xs text-emerald-300">Draft saved. Release details are still required before submission.</p>}
    {onBack && <button type="button" className="btn-secondary" disabled={busy} onClick={onBack}>Back to release requests</button>}
    <div className="flex items-center justify-between gap-3"><p className="text-[11px] text-zinc-500">Saving a draft does not create a playbook, approve a change or run a deployment.</p><button type="button" className="btn-primary shrink-0" disabled={busy || changed || saved} onClick={() => void save()}>{busy ? "Saving…" : "Save draft"}</button></div>
  </section>;
}
