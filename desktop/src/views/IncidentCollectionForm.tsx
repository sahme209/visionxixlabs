import {useEffect,useRef,useState,type FormEvent} from "react";
import {incidentCollectionRequest,type IncidentCollectionRequest} from "../../../lib/tauri/incidentCollectionContract";
import type {IncidentSourceEvidence} from "../../../lib/tauri/incidentSourceEvidenceContract";
import {desktopClient} from "../lib/desktopClient";
import {saveIncidentCollection} from "../lib/ticketDirectoryClient";

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
  const [busy,setBusy] = useState(false);
  const [saved,setSaved] = useState(false);
  const [changed,setChanged] = useState(false);
  const flight = useRef<AbortController|null>(null);
  useEffect(() => () => flight.current?.abort(),[]);
  const run = runs.find(row => row.runId === runId);

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flight.current || saved || changed || revision !== desktopClient.getContextRevision()) return;
    if (!attempt && (!certified || !run || !recorded?.comparison)) return;
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
    setBusy(true);
    const result = await saveIncidentCollection(config.apiBase,config.sessionToken,controller.signal,command);
    flight.current = null;
    if (controller.signal.aborted || config !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
    setBusy(false);
    if (!result) return;
    attempts.delete(key);
    if (result === "changed") {
      setChanged(true);
      return;
    }
    setSaved(true);
  }

  if (!available && !attempt) return null;
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
      {busy ? "Recording…" : attempt ? "Retry evidence collection" : "Record evidence collection"}
    </button>
    {saved && <p role="status">Evidence collection recorded.</p>}
    {changed && <p role="status">The ticket or release evidence changed. Refresh and review it before recording collection.</p>}
    {attempt && !busy && <p role="status">Evidence collection is unconfirmed. Retry the same record.</p>}
  </form>;
}
