import {useEffect, useId, useLayoutEffect, useRef, useState} from "react";
import {Ellipsis} from "lucide-react";
import {INCIDENT_TRANSITIONS, planTransition, type IncidentTransition} from "../../../lib/releaseops/deploymentIncidentLifecycle";
import {incidentTransitionRequest, type IncidentTransitionReceipt, type IncidentTransitionRequest} from "../../../lib/tauri/incidentTransitionContract";
import type {TicketRecord} from "../../../lib/tauri/ticketDirectoryContract";
import {desktopClient} from "../lib/desktopClient";
import {changeIncidentStatus} from "../lib/ticketDirectoryClient";

const labels: Record<IncidentTransition, string> = {
  mitigate: "Mark mitigated", resolve: "Resolve incident", reopen: "Reopen incident", wont_fix: "Close without a fix",
};

export function IncidentStatusActions({incident, attempts, active, actorId, workspaceId, revision, onResult}: {
  incident: Extract<TicketRecord, {kind: "incident"}>;
  attempts: Map<string, IncidentTransitionRequest>;
  active: boolean;
  actorId: string;
  workspaceId: string;
  revision: number;
  onResult: (result: IncidentTransitionReceipt | "changed") => void;
}) {
  const key = JSON.stringify([incident.id, incident.releaseId]);
  const attempt = attempts.get(key);
  const [action, setAction] = useState<IncidentTransition>();
  const [open, setOpen] = useState(!!attempt);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const pendingControl = useRef<HTMLButtonElement>(null);
  const cancelControl = useRef<HTMLButtonElement>(null);
  const flight = useRef<AbortController | null>(null);
  const config = desktopClient.config;
  const status = incident.status;
  const available = status === "unknown" ? [] : INCIDENT_TRANSITIONS.filter(value =>
    planTransition(status, value, {actorUserId:actorId, now:new Date(0)}).ok);

  useEffect(() => {
    if (!active) setBusy(false);
    return () => {flight.current?.abort(); flight.current = null;};
  }, [active, config, revision]);

  useLayoutEffect(() => {
    if (open && !attempt && action) cancelControl.current?.focus();
  }, [open, action, attempt]);

  useLayoutEffect(() => {
    if (busy) pendingControl.current?.focus();
  }, [busy]);

  async function submit() {
    if (!active || flight.current || config !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
    const parsed = incidentTransitionRequest.safeParse(attempt ?? {
      workspaceId, actorId, incidentId:incident.id, releaseId:incident.releaseId, expectedRevision:incident.revision,
      previousStatus:status, action, attemptId:crypto.randomUUID(),
    });
    if (!parsed.success) return;
    const command = parsed.data;
    attempts.set(key,command);
    const controller = new AbortController();
    flight.current = controller;
    setBusy(true);
    const result = await changeIncidentStatus(config.apiBase,config.sessionToken,controller.signal,command);
    if (flight.current !== controller || controller.signal.aborted ||
      config !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
    flight.current = null;
    setBusy(false);
    if (!result) return;
    attempts.delete(key);
    onResult(result);
  }

  if (!available.length && !attempt) return null;
  return <div className="studio-incident-status-actions" onKeyDown={event => {
    if (event.key !== "Escape" || flight.current) return;
    event.stopPropagation();
    setAction(undefined);
    setOpen(false);
    trigger.current?.focus();
  }}>
    <button type="button" className="studio-ticket-status-trigger" aria-label="Incident status actions" ref={trigger}
      aria-expanded={open} aria-controls={open ? id : undefined} aria-disabled={busy}
      onClick={() => {if (!flight.current) setOpen(value => !value);}}>
      <Ellipsis aria-hidden="true" size={16}/>
    </button>
    {open && <section id={id} className="studio-incident-status-panel" aria-label="Change incident status">
      {attempt ? <>
        <p role="status">{busy ? "Saving incident status…" : "The status change is unconfirmed."}</p>
        <button type="button" ref={pendingControl} className="btn-secondary" aria-disabled={busy}
          onClick={() => void submit()}>{busy ? "Saving…" : "Retry same status change"}</button>
      </> : action ? <>
        <p>{labels[action]} for {incident.title || incident.id}?</p>
        <button type="button" ref={cancelControl} className="btn-secondary" onClick={() => {
          setAction(undefined);
          setOpen(false);
          trigger.current?.focus();
        }}>Cancel</button>
        <button type="button" className="btn-primary" onClick={() => void submit()}>Confirm status change</button>
      </> : available.map(value =>
        <button type="button" className="btn-secondary" key={value} onClick={() => setAction(value)}>{labels[value]}</button>,
      )}
    </section>}
  </div>;
}
