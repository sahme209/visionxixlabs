import {useEffect, useId, useRef, useState, type FormEvent} from "react";
import {DesktopDialog} from "../components/DesktopDialog";
import {desktopClient} from "../lib/desktopClient";
import {readIncidentReportReleases, reportDeploymentIncident} from "../lib/ticketDirectoryClient";
import {incidentReportRequest, incidentReportSeverities, type IncidentReportRequest} from "../../../lib/tauri/incidentReportContract";

const field = "mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200 disabled:opacity-50";
const emptyDraft = {releaseId: "", severity: "high" as IncidentReportRequest["severity"], title: "", summary: ""};

export function IncidentReportDialog({open, workspaceId, actorId, revision, onClose, onReported}: {
  open: boolean;
  workspaceId: string;
  actorId: string;
  revision: number;
  onClose: () => void;
  onReported: (id: string) => void;
}) {
  const releaseListId = useId();
  const [draft, setDraft] = useState(emptyDraft);
  const [releases, setReleases] = useState<NonNullable<Awaited<ReturnType<typeof readIncidentReportReleases>>>["releases"]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState<IncidentReportRequest>();
  const flight = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    const config = desktopClient.config;
    const controller = new AbortController();
    setReleases([]);
    setLoadFailed(false);
    void readIncidentReportReleases(config.apiBase, config.sessionToken, controller.signal).then(result => {
      if (controller.signal.aborted || config !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
      if (result?.actorId === actorId && result.workspaceId === workspaceId) setReleases(result.releases);
      else setLoadFailed(true);
    });
    return () => controller.abort();
  }, [open, workspaceId, actorId, revision]);

  useEffect(() => () => flight.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flight.current || !open || revision !== desktopClient.getContextRevision()) return;
    const report = incidentReportRequest.safeParse(unconfirmed ?? {
      ...draft, releaseId: draft.releaseId.trim(), workspaceId, actorId, attemptId: crypto.randomUUID(),
    });
    if (!report.success) {
      setMessage("Enter a recorded release ID and a title.");
      return;
    }
    const config = desktopClient.config;
    const controller = new AbortController();
    flight.current = controller;
    setPending(true);
    setMessage("");
    const result = await reportDeploymentIncident(config.apiBase, config.sessionToken, controller.signal, report.data);
    flight.current = null;
    if (controller.signal.aborted || config !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
    setPending(false);
    if (result?.state === "saved") {
      setUnconfirmed(undefined);
      setDraft(emptyDraft);
      onReported(result.incidentId);
    } else if (result?.state === "missing_release" && !unconfirmed) {
      setMessage("That release is unavailable in this workspace. Check the release ID.");
    } else {
      setUnconfirmed(report.data);
      setMessage(result?.state === "denied" ? "Reporting permission is unavailable. Your draft is still here." :
        "The report could not be confirmed. Retry this same report to avoid creating a duplicate.");
    }
  }

  if (!open) return null;
  const editingLocked = pending || Boolean(unconfirmed);
  return <DesktopDialog label="Report deployment incident" onClose={onClose} busy={pending} role="dialog" isolate>
    <form className="space-y-4" onSubmit={submit}>
      <h2 className="text-lg font-medium">Report deployment incident</h2>
      <label className="block text-sm">
        Release ID
        <input type="text" list={releaseListId} maxLength={160} required className={field} value={draft.releaseId}
          disabled={editingLocked} onChange={event => setDraft({...draft, releaseId: event.target.value})}/>
        <datalist id={releaseListId}>{releases.map(release => <option key={release.id} value={release.id}>{release.tag}</option>)}</datalist>
      </label>
      {loadFailed && <p role="status" className="text-sm text-zinc-400">Recent releases are unavailable. You can enter a recorded release ID.</p>}
      <label className="block text-sm">
        Severity
        <select className={field} value={draft.severity} disabled={editingLocked}
          onChange={event => {
            const severity = incidentReportSeverities.find(value => value === event.target.value);
            if (severity) setDraft({...draft, severity});
          }}>
          {incidentReportSeverities.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        Title
        <input type="text" maxLength={200} required className={field} value={draft.title}
          disabled={editingLocked} onChange={event => setDraft({...draft, title: event.target.value})}/>
      </label>
      <label className="block text-sm">
        Summary (optional)
        <textarea maxLength={600} rows={3} className={field} value={draft.summary}
          disabled={editingLocked} onChange={event => setDraft({...draft, summary: event.target.value})}/>
      </label>
      {message && <p role="status" className="text-sm text-zinc-400">{message}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" disabled={pending} onClick={onClose}>Close</button>
        <button type="submit" className="btn-primary" disabled={pending || !draft.releaseId.trim() || !draft.title.trim()}>
          {pending ? "Reporting…" : unconfirmed ? "Retry report" : "Report incident"}
        </button>
      </div>
    </form>
  </DesktopDialog>;
}
