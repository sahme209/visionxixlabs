import {useEffect,useRef,useState,type FormEvent} from "react";
import {incidentCollectionRequest,type IncidentCollectionRequest} from "../../../lib/tauri/incidentCollectionContract";
import type {IncidentSourceEvidence} from "../../../lib/tauri/incidentSourceEvidenceContract";
import {desktopClient} from "../lib/desktopClient";
import {readIncidentCollectionReceipt,saveIncidentCollection} from "../lib/ticketDirectoryClient";

export function IncidentCollectionForm({workspaceId,actorId,incidentId,releaseId,incidentRevision,revision,attempts,sources}: {
  workspaceId:string; actorId:string; incidentId:string; releaseId:string; incidentRevision:string; revision:number;
  attempts:Map<string,IncidentCollectionRequest>; sources?:IncidentSourceEvidence;
}) {
  const key = JSON.stringify([incidentId,releaseId,incidentRevision]);
  const attempt = attempts.get(key);
  const recorded = sources?.state === "recorded" ? sources : undefined;
  const runs = recorded?.runs?.filter(run => run.status === "completed") ?? [];
  const available = !!recorded?.comparison && runs.length > 0;
  const [runId,setRunId] = useState(runs.length === 1 ? runs[0].runId : "");
  const [certified,setCertified] = useState(false);
  const [busy,setBusy] = useState<"recording" | "checking">();
  const [saved,setSaved] = useState<"recorded" | "recovered">();
  const [checkNotice,setCheckNotice] = useState<string>();
  const focusReceipt = useRef(false);
  const [changed,setChanged] = useState(false);
  const flight = useRef<AbortController|null>(null);
  useEffect(() => () => flight.current?.abort(),[]);
  const run = runs.find(row => row.runId === runId);

  async function settleCollection(check: boolean, control?: HTMLButtonElement) {
    if (flight.current || saved || changed || revision !== desktopClient.getContextRevision()) return;
    if (!attempt && (check || !certified || !run || !recorded?.comparison)) return;
    const parsed = incidentCollectionRequest.safeParse(attempt ?? {
      workspaceId,actorId,incidentId,releaseId,incidentRevision,repository:recorded?.repository,commit:recorded?.commit,
      baselineCommit:recorded?.comparison?.baselineCommit,runId:run?.runId,observedAt:run?.observedAt,attemptId:crypto.randomUUID(),
    });
    if (!parsed.success) return;
    const command = parsed.data;
    attempts.set(key,command);
    const config = desktopClient.config;
    const controller = new AbortController();
    flight.current = controller;
    setCheckNotice(undefined);
    setBusy(check ? "checking" : "recording");
    const result = await (check ? readIncidentCollectionReceipt : saveIncidentCollection)(config.apiBase,config.sessionToken,controller.signal,command);
    flight.current = null;
    if (controller.signal.aborted || config !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
    setBusy(undefined);
    if (!result) {
      if (check) setCheckNotice(result === null ? "No receipt was found for this attempt." : "The original receipt could not be verified.");
      return;
    }
    attempts.delete(key);
    if (result === "changed") {
      setChanged(true);
      return;
    }
    focusReceipt.current = !!control && document.activeElement === control;
    setSaved(check ? "recovered" : "recorded");
  }

  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void settleCollection(false);
  }

  if (!available && !attempt && !saved && !changed) return null;
  const canSubmit = !busy && !saved && !changed && (!!attempt || (!!run && certified));
  return <form className="studio-ticket-collection" aria-label="Record evidence collection" onSubmit={submit}>
    {available && !attempt && !saved && !changed && <>
      <label>Collected workflow run
        <select value={runId} onChange={event => {setRunId(event.target.value);setCertified(false);}}>
          <option value="">Choose a saved run</option>
          {runs.map(row => <option key={row.runId} value={row.runId}>{row.name} · run {row.runId}</option>)}
        </select>
      </label>
      <label><input type="checkbox" checked={certified} onChange={event => setCertified(event.target.checked)}/>
        I collected the selected workflow logs and reviewed the commit comparison.
      </label>
    </>}
    <button type="submit" className="btn-secondary" aria-disabled={!canSubmit}>
      {busy === "recording" ? "Recording…" : attempt ? "Retry evidence collection" : "Record evidence collection"}
    </button>
    {attempt && <button type="button" className="btn-secondary" aria-disabled={!!busy}
      onClick={event => void settleCollection(true, event.currentTarget)}>
      {busy === "checking" ? "Checking collection…" : "Check collection receipt"}
    </button>}
    {saved && <p role="status" tabIndex={-1} ref={element => {
      if (element && focusReceipt.current) {
        focusReceipt.current = false;
        element.focus();
      }
    }}>{saved === "recovered" ? "The original collection was recorded. Review current evidence separately." : "Evidence collection recorded."}</p>}
    {changed && <p role="status">The ticket or release evidence changed. Refresh and review it before recording collection.</p>}
    {attempt && !busy && <p role="status">{checkNotice ?? "Evidence collection is unconfirmed. Check the receipt or retry the same record."}</p>}
  </form>;
}
