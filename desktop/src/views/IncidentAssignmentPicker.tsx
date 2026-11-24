import {useEffect,useId,useRef,useState,type FormEvent} from "react";
import type {z} from "zod";
import type {incidentAssignmentOptions,IncidentAssignmentRequest} from "../../../lib/tauri/incidentAssignmentContract";
import type {TicketRecord} from "../../../lib/tauri/ticketDirectoryContract";
import {desktopClient} from "../lib/desktopClient";
import {readIncidentAssignment,saveIncidentAssignment} from "../lib/ticketDirectoryClient";

export function IncidentAssignmentPicker({incident,workspaceId,actorId,revision,attempts,onSaved}: {
  incident:Extract<TicketRecord,{kind:"incident"}>; workspaceId:string; actorId:string; revision:number;
  attempts:Map<string,IncidentAssignmentRequest>; onSaved:() => void;
}) {
  const incidentRevision = incident.revision!;
  const key = JSON.stringify([incident.id,incident.releaseId,incidentRevision]);
  const attempt = attempts.get(key);
  const [open,setOpen] = useState(!!attempt);
  const [options,setOptions] = useState<z.infer<typeof incidentAssignmentOptions>|null>();
  const [choice,setChoice] = useState("");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const flight = useRef<AbortController|null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  useEffect(() => () => flight.current?.abort(),[]);

  async function load() {
    if (flight.current || revision !== desktopClient.getContextRevision()) return;
    setOpen(true);
    setOptions(undefined);
    setChoice("");
    setMessage("");
    const config = desktopClient.config;
    const controller = new AbortController();
    flight.current = controller;
    const result = await readIncidentAssignment(config.apiBase,config.sessionToken,controller.signal,incident.id);
    if (controller.signal.aborted || config !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
    flight.current = null;
    setOptions(result?.workspaceId === workspaceId && result.actorId === actorId && result.incidentId === incident.id &&
      result.releaseId === incident.releaseId && result.incidentRevision === incidentRevision ? result : null);
  }

  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flight.current || revision !== desktopClient.getContextRevision() || (!attempt && (!options || !choice))) return;
    const command = attempt ?? {
      workspaceId,actorId,incidentId:incident.id,releaseId:incident.releaseId,incidentRevision,ownerUserId:choice === "clear" ? null : choice.slice(5),
      expectedAssignmentRevision:options!.assignmentRevision,attemptId:crypto.randomUUID(),
    };
    attempts.set(key,command);
    const config = desktopClient.config;
    const controller = new AbortController();
    flight.current = controller;
    setBusy(true);
    setMessage("");
    const result = await saveIncidentAssignment(config.apiBase,config.sessionToken,controller.signal,command);
    if (controller.signal.aborted || config !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
    flight.current = null;
    setBusy(false);
    if (!result) {
      setMessage("Owner update unconfirmed. Retry the same update.");
      return;
    }
    attempts.delete(key);
    if (result === "changed") {
      setOptions(null);
      setMessage("The ticket or assignment changed. Refresh the ticket and check the owner before trying again.");
      return;
    }
    onSaved();
  }

  function close() {
    if (flight.current) return;
    setOpen(false);
    button.current?.focus();
  }

  return <div className="studio-ticket-owner" onKeyDown={event => {
    if (event.key === "Escape" && open && !flight.current) {event.stopPropagation();close();}
  }}>
    <button type="button" ref={button} className="studio-ticket-release-action" aria-expanded={open} aria-controls={open ? panelId : undefined}
      onClick={() => open ? close() : attempt ? setOpen(true) : void load()}>
      {attempt ? "Pending owner update" : incident.owner?.state === "unassigned" ? "Assign owner" : "Change owner"}
    </button>
    {open && <form id={panelId} aria-label="Incident assignment" onSubmit={save}>
      {!attempt && options && <label>Assign to
        <select value={choice} onChange={event => setChoice(event.target.value)}>
          <option value="">Choose a workspace member</option>
          <option value="clear">Unassigned</option>
          {options.candidates.map(member => <option key={member.userId} value={`user:${member.userId}`}>{member.displayName}</option>)}
        </select>
      </label>}
      {!attempt && options?.limited && <small>Showing the first 100 eligible members.</small>}
      {message && <p role="status">{message}</p>}
      {!attempt && options === null && !message && <p role="status">Incident assignment is unavailable.</p>}
      {!attempt && options === undefined && <p role="status">Loading eligible workspace members…</p>}
      {(attempt || options) && <button className="btn-secondary" type="submit" aria-disabled={busy || (!attempt && !choice)}>
        {busy ? "Saving…" : attempt ? "Retry same owner update" : "Save owner"}
      </button>}
      <button type="button" className="btn-secondary" aria-disabled={busy} onClick={close}>Close assignment</button>
    </form>}
  </div>;
}
