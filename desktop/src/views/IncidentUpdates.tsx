import {useEffect, useId, useRef, useState, type FormEvent, type Ref} from "react";
import {ArrowRight, Paperclip} from "lucide-react";
import {desktopClient} from "../lib/desktopClient";
import {readIncidentUpdates, saveIncidentUpdate} from "../lib/ticketDirectoryClient";
import {incidentUpdateLimit, incidentUpdateRequest, type IncidentUpdateEvidence, type IncidentUpdateList} from "../../../lib/tauri/incidentUpdateContract";

export interface IncidentUpdateDraft {body: string; attemptId?: string; evidence?: IncidentUpdateEvidence}
export interface IncidentEvidenceHistory {
  incidentId: string;
  releaseId: string;
  workspaceId: string;
  actorId: string;
  revision: number;
  attachedAt: string[];
  latestNoteAt?: string;
  limited: boolean;
}

const emptyDraft: IncidentUpdateDraft = {body: ""};

function EvidenceSnapshot({evidence}: {evidence: IncidentUpdateEvidence}) {
  return <dl className="studio-incident-evidence-snapshot">
    <div><dt>Commit</dt><dd><code>{evidence.commit}</code></dd></div>
    <div><dt>Evidence digest</dt><dd><code>{evidence.digest}</code></dd></div>
    <div><dt>Generated</dt><dd><time dateTime={evidence.generatedAt}>{new Date(evidence.generatedAt).toLocaleString()}</time></dd></div>
    <div><dt>Branch checks</dt><dd>{evidence.branchCheckCount}</dd></div>
    <div><dt>Change tickets</dt><dd>{evidence.changeTicketCount}</dd></div>
  </dl>;
}

export function IncidentUpdates({visible, workspaceId, actorId, incidentId, releaseId, revision, drafts, onEvidenceHistory, latestAttachmentRef}: {
  visible: boolean;
  workspaceId: string;
  actorId: string;
  incidentId: string;
  releaseId: string;
  revision: number;
  drafts: Map<string, IncidentUpdateDraft>;
  onEvidenceHistory: (history: IncidentEvidenceHistory | undefined) => void;
  latestAttachmentRef: Ref<HTMLDetailsElement>;
}) {
  const key = JSON.stringify([incidentId, releaseId]);
  const [draft, setDraft] = useState(() => drafts.get(key) ?? emptyDraft);
  const [list, setList] = useState<IncidentUpdateList | null>();
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [review, setReview] = useState<IncidentUpdateEvidence>();
  const reviewId = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const write = useRef<AbortController | null>(null);
  const readGeneration = useRef(0);

  function updateDraft(next: IncidentUpdateDraft) {
    if (next.body || next.evidence) drafts.set(key, next);
    else drafts.delete(key);
    setDraft(next);
  }

  useEffect(() => {
    if (!visible) return;
    const config = desktopClient.config;
    const controller = new AbortController();
    const generation = ++readGeneration.current;
    void Promise.resolve(readIncidentUpdates(config.apiBase, config.sessionToken, controller.signal, incidentId, releaseId)).then(result => {
      if (generation !== readGeneration.current || controller.signal.aborted || config !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
      setList(result?.workspaceId === workspaceId && result.actorId === actorId &&
        result.incidentId === incidentId && result.releaseId === releaseId ? result : null);
    });
    return () => controller.abort();
  }, [visible, workspaceId, actorId, incidentId, releaseId, revision, refresh]);

  useEffect(() => {
    if (!visible || list?.attachableEvidence === undefined) return;
    onEvidenceHistory({
      incidentId, releaseId, workspaceId, actorId, revision, limited: list.limited,
      attachedAt: list.notes.filter(note => note.evidence).map(note => note.recordedAt),
      latestNoteAt: list.notes.find(note => !note.evidence)?.recordedAt,
    });
    return () => onEvidenceHistory(undefined);
  }, [visible, list, onEvidenceHistory, incidentId, releaseId, workspaceId, actorId, revision]);

  useEffect(() => () => write.current?.abort(), []);

  async function addUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!visible || write.current || !list?.canWrite || revision !== desktopClient.getContextRevision() || !draft.body.trim()) return;
    const evidence = draft.evidence;
    const parsed = incidentUpdateRequest.safeParse({
      workspaceId, actorId, incidentId, releaseId, body: draft.body, attemptId: draft.attemptId ?? crypto.randomUUID(),
      ...(evidence && {evidence: {commit: evidence.commit, digest: evidence.digest}}),
    });
    if (!parsed.success) {
      setMessage("Enter an update of up to 1,200 characters.");
      return;
    }
    const command = parsed.data;
    const config = desktopClient.config;
    const controller = new AbortController();
    updateDraft({...draft, body: command.body, attemptId: command.attemptId});
    setReview(undefined);
    write.current = controller;
    setBusy(true);
    setMessage("");
    const receipt = await saveIncidentUpdate(config.apiBase, config.sessionToken, controller.signal, command);
    write.current = null;
    if (controller.signal.aborted || config !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
    setBusy(false);
    if (!receipt) {
      setMessage("The update could not be confirmed. Retry the same update.");
      return;
    }
    if ("state" in receipt) {
      updateDraft({body: command.body});
      setList(current => current ? {...current, attachableEvidence: null} : current);
      setRefresh(value => value + 1);
      setMessage("The saved release evidence changed. Review it again before attaching it.");
      input.current?.focus();
      return;
    }
    updateDraft(emptyDraft);
    readGeneration.current++;
    setList(current => {
      if (!current) return current;
      const notes = [receipt.note, ...current.notes.filter(note => note.id !== receipt.note.id)]
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id));
      return {...current, notes: notes.slice(0, incidentUpdateLimit), limited: current.limited || notes.length > incidentUpdateLimit};
    });
    setMessage("Investigation update added.");
  }

  if (!visible) return null;
  if (list === undefined) return <p role="status" className="studio-incident-updates">Loading investigation updates…</p>;
  if (list === null) return <div className="studio-incident-updates">
    <p role="status">Investigation updates are unavailable.</p>
    <button type="button" className="btn-secondary" onClick={() => setRefresh(value => value + 1)}>Retry updates</button>
  </div>;

  if (!list.canWrite && !list.notes.length) return null;
  const latestAttachment = list.notes.find(note => note.evidence);
  const candidate = list.attachableEvidence;
  const locked = busy || !!draft.attemptId;
  const reviewOpen = !!review && review.digest === candidate?.digest && review.commit === candidate?.commit;
  return <section className="studio-incident-updates" aria-label="Investigation updates">
    {list.notes.length > 0 && <>
      <h3>Investigation updates</h3>
      {list.limited && <p>Showing the 20 most recent updates.</p>}
      <ol>{list.notes.map(note => <li key={note.id}>
        <p>{note.body}</p>
        {note.evidence && <details className="studio-incident-attachment" ref={note === latestAttachment ? latestAttachmentRef : undefined}>
          <summary>Release evidence snapshot</summary>
          <EvidenceSnapshot evidence={note.evidence}/>
        </details>}
        <small>{note.authoredByYou ? "You" : "Workspace member"} · <time dateTime={note.recordedAt}>{new Date(note.recordedAt).toLocaleString()}</time></small>
      </li>)}</ol>
    </>}
    {list.canWrite && <form onSubmit={addUpdate}>
      {draft.evidence && <div className="studio-incident-attachment">
        <details>
          <summary>Attached release evidence</summary>
          <EvidenceSnapshot evidence={draft.evidence}/>
        </details>
        {!locked && <button type="button" className="btn-secondary" onClick={() => {
          updateDraft({body: draft.body});
          input.current?.focus();
        }}>Remove evidence</button>}
      </div>}
      <div className="studio-incident-update-composer">
        <textarea ref={input} aria-label="Investigation note" placeholder="Add an investigation note…" rows={1} maxLength={1200}
          value={draft.body} readOnly={locked} onChange={event => updateDraft({...draft, body: event.target.value})}/>
        {candidate && !draft.evidence && !locked && <button type="button" className="btn-secondary"
          title="Review release evidence" aria-label="Review release evidence" aria-expanded={reviewOpen}
          aria-controls={reviewOpen ? reviewId : undefined}
          onClick={() => setReview(reviewOpen ? undefined : candidate)}>
          <Paperclip aria-hidden="true" size={16}/>
        </button>}
        <button className="btn-secondary" type="submit" aria-disabled={busy || !draft.body.trim()}>
          <ArrowRight aria-hidden="true" size={16}/>{busy ? "Adding update…" : draft.attemptId ? "Retry update" : "Add update"}
        </button>
      </div>
      {review && reviewOpen && !locked && <div id={reviewId} className="studio-incident-attachment">
        <EvidenceSnapshot evidence={review}/>
        <button type="button" className="btn-secondary" onClick={() => {
          updateDraft({...draft, evidence: review});
          setReview(undefined);
          input.current?.focus();
        }}>Attach reviewed evidence</button>
      </div>}
    </form>}
    {message && <p role="status">{message}</p>}
  </section>;
}
