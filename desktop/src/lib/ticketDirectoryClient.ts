import {incidentAssignmentOptions,incidentAssignmentReceipt,matchesAssignment,type IncidentAssignmentRequest,type IncidentAssignmentReceipt} from "../../../lib/tauri/incidentAssignmentContract";
import {incidentCollectionRequest, incidentCollectionReceipt, incidentCollectionStatus, sameCollection, type IncidentCollectionRequest, type IncidentCollectionReceipt} from "../../../lib/tauri/incidentCollectionContract";
import {incidentRemediationReviewSchema} from "../../../lib/tauri/incidentRemediationReviewContract";
import {incidentTransitionReceipt, matchesIncidentTransition, type IncidentTransitionReceipt, type IncidentTransitionRequest} from "../../../lib/tauri/incidentTransitionContract";
import {incidentUpdateList, incidentUpdateReceipt, type IncidentUpdateList, type IncidentUpdateReceipt, type IncidentUpdateRequest} from "../../../lib/tauri/incidentUpdateContract";
import {incidentReportReceipt, incidentReportReleases, type IncidentReportRequest} from "../../../lib/tauri/incidentReportContract";
import {type IncidentRelease, incidentActivitySchema, incidentReleaseSchema, incidentTriageSchema, ticketDirectoryBodyLimit, ticketDirectorySchema, ticketLinkId, ticketReleaseLinksSchema} from "../../../lib/tauri/ticketDirectoryContract";

export function readTicketDirectory(base: string, token: string | undefined, signal: AbortSignal) {
  return readTicketProjection(base, token, signal, "/api/desktop/tickets", data => {
    const parsed = ticketDirectorySchema.safeParse(data);
    return parsed.success ? parsed.data : undefined;
  });
}

export async function readTicketReleaseLinks(base: string, token: string | undefined, signal: AbortSignal, ticketId: string) {
  if (!ticketLinkId.safeParse(ticketId).success) return;
  const query = new URLSearchParams({changeTicketId: ticketId});
  return readTicketProjection(base, token, signal, `/api/desktop/tickets?${query}`, data => {
    const parsed = ticketReleaseLinksSchema.safeParse(data);
    return parsed.success && parsed.data.ticketId === ticketId ? parsed.data : undefined;
  });
}

export function readIncidentActivity(base: string, token: string | undefined, signal: AbortSignal, incidentId: string) {
  if (!ticketLinkId.safeParse(incidentId).success) return;
  const query = new URLSearchParams({incidentActivityId: incidentId});
  return readTicketProjection(base, token, signal, `/api/desktop/tickets?${query}`, data => {
    const parsed = incidentActivitySchema.safeParse(data);
    return parsed.success && parsed.data.incidentId === incidentId ? parsed.data : undefined;
  });
}

export function readIncidentRemediationReview(base: string, token: string | undefined, signal: AbortSignal, incidentId: string) {
  if (!ticketLinkId.safeParse(incidentId).success) return;
  const query = new URLSearchParams({incidentRemediationId:incidentId});
  return readTicketProjection(base,token,signal,`/api/desktop/tickets?${query}`,data => {
    const parsed = incidentRemediationReviewSchema.safeParse(data);
    return parsed.success && parsed.data.incidentId === incidentId ? parsed.data : undefined;
  });
}

export function readIncidentTriage(base: string, token: string | undefined, signal: AbortSignal, incidentId: string) {
  if (!ticketLinkId.safeParse(incidentId).success) return;
  const query = new URLSearchParams({incidentTriageId: incidentId});
  return readTicketProjection(base, token, signal, `/api/desktop/tickets?${query}`, data => {
    const parsed = incidentTriageSchema.safeParse(data);
    return parsed.success && parsed.data.incidentId === incidentId ? parsed.data : undefined;
  });
}

export async function readIncidentRelease(base: string, token: string | undefined, signal: AbortSignal, incidentId: string, include: "evidence" | "recovery" | "sources" | undefined) {
  if (!ticketLinkId.safeParse(incidentId).success) return;
  const query = new URLSearchParams({deploymentIncidentId: incidentId});
  if (include === "sources") query.set("includeIncidentSources","1");
  if (include === "evidence") query.set("includeReleaseEvidence","1");
  if (include === "recovery") query.set("includeReleaseRecovery","1");
  function decode(data: unknown) {
    const parsed = incidentReleaseSchema.safeParse(data);
    return parsed.success && parsed.data.incidentId === incidentId ? parsed.data : undefined;
  }
  const current = await readTicketProjection<IncidentRelease | "legacy">(
    base,token,signal,`/api/desktop/tickets?${query}`,(data,status) =>
      include === "sources" && status === 400 && data === "invalid_ticket_directory_request" ? "legacy" : decode(data),
    undefined, include === "sources",
  );
  if (current !== "legacy") return current;
  query.delete("includeIncidentSources");
  query.set("includeReleaseEvidence","1");
  return readTicketProjection(base,token,signal,`/api/desktop/tickets?${query}`,decode);
}

const incidentReportPath = "/api/desktop/tickets/incident-report";

export function readIncidentReportReleases(base: string, token: string | undefined, signal: AbortSignal) {
  return readTicketProjection(base, token, signal, incidentReportPath, data => {
    const parsed = incidentReportReleases.safeParse(data);
    return parsed.success ? parsed.data : undefined;
  });
}

export function reportDeploymentIncident(base: string, token: string | undefined, signal: AbortSignal, report: IncidentReportRequest) {
  return readTicketProjection(base, token, signal, incidentReportPath, (data, status) => {
    if (status === 404 && data === "incident_release_not_found") return {state: "missing_release"} as const;
    if (status === 403 && (data === "incident_permission_required" || data === "incident_membership_required" ||
      data === "incident_session_required")) return {state: "denied"} as const;
    const parsed = incidentReportReceipt.safeParse(data);
    const saved = parsed.success ? parsed.data : undefined;
    if (saved?.workspaceId === report.workspaceId && saved.actorId === report.actorId &&
      saved.attemptId === report.attemptId && saved.releaseId === report.releaseId) return {state: "saved", incidentId: saved.incidentId} as const;
  }, report);
}

const incidentUpdatePath = "/api/desktop/tickets/incident-updates";

export async function readIncidentUpdates(base: string, token: string | undefined, signal: AbortSignal, incidentId: string, releaseId: string) {
  if (!ticketLinkId.safeParse(incidentId).success || !ticketLinkId.safeParse(releaseId).success) return;
  const query = new URLSearchParams({incidentId, releaseId});
  function decode(data: unknown) {
    const parsed = incidentUpdateList.safeParse(data);
    return parsed.success && parsed.data.incidentId === incidentId && parsed.data.releaseId === releaseId ? parsed.data : undefined;
  }
  const current = await readTicketProjection<IncidentUpdateList | "legacy">(
    base, token, signal, `${incidentUpdatePath}?${query}&includeEvidence=1`,
    (data, status) => status === 400 && data === "invalid_incident_update" ? "legacy" : decode(data),
    undefined, true,
  );
  if (current === "legacy") return readTicketProjection(base, token, signal, `${incidentUpdatePath}?${query}`, decode);
  return current;
}

export function saveIncidentUpdate(base: string, token: string | undefined, signal: AbortSignal, command: IncidentUpdateRequest) {
  return readTicketProjection<IncidentUpdateReceipt | {state: "evidence_changed"}>(base, token, signal, incidentUpdatePath, (data, status) => {
    if (status === 409 && data === "incident_update_evidence_changed" && command.evidence) return {state: "evidence_changed"};
    const parsed = incidentUpdateReceipt.safeParse(data);
    if (!parsed.success) return;
    const receipt = parsed.data;
    if (receipt.workspaceId === command.workspaceId && receipt.actorId === command.actorId &&
      receipt.incidentId === command.incidentId && receipt.releaseId === command.releaseId &&
      receipt.attemptId === command.attemptId && receipt.note.body === command.body && receipt.note.authoredByYou &&
      receipt.note.evidence?.digest === command.evidence?.digest && receipt.note.evidence?.commit === command.evidence?.commit) return receipt;
  }, command);
}

export function changeIncidentStatus(base: string, token: string | undefined, signal: AbortSignal, command: IncidentTransitionRequest) {
  return readTicketProjection<IncidentTransitionReceipt | "changed">(
    base, token, signal, "/api/desktop/tickets/incident-transition", (data, status) => {
      if (status === 409 && data === "incident_transition_changed") return "changed";
      const parsed = incidentTransitionReceipt.safeParse(data);
      return parsed.success && matchesIncidentTransition(parsed.data, command) ? parsed.data : undefined;
    }, command,
  );
}

const incidentCollectionPath = "/api/desktop/tickets/incident-collection";

export function readIncidentCollection(base: string, token: string | undefined, signal: AbortSignal, incidentId: string) {
  if (!ticketLinkId.safeParse(incidentId).success) return;
  return readTicketProjection(base,token,signal,`${incidentCollectionPath}?${new URLSearchParams({incidentId})}`,data => {
    const parsed = incidentCollectionStatus.safeParse(data);
    return parsed.success && parsed.data.incidentId === incidentId ? parsed.data : undefined;
  });
}

export function readIncidentCollectionReceipt(base: string, token: string | undefined, signal: AbortSignal, command: IncidentCollectionRequest) {
  if (!incidentCollectionRequest.safeParse(command).success) return;
  const query = new URLSearchParams({incidentId: command.incidentId, attemptId: command.attemptId});
  return readTicketProjection(base, token, signal, `${incidentCollectionPath}?${query}`, data => {
    if (data === null) return null;
    const parsed = incidentCollectionReceipt.safeParse(data);
    return parsed.success && sameCollection(parsed.data, command) ? parsed.data : undefined;
  });
}

export function saveIncidentCollection(base: string, token: string | undefined, signal: AbortSignal, command: IncidentCollectionRequest) {
  return readTicketProjection<IncidentCollectionReceipt | "changed">(base,token,signal,incidentCollectionPath,(data,status) => {
    if (status === 409 && data === "incident_collection_changed") return "changed";
    const parsed = incidentCollectionReceipt.safeParse(data);
    return parsed.success && sameCollection(parsed.data,command) ? parsed.data : undefined;
  },command);
}

const incidentAssignmentPath = "/api/desktop/tickets/incident-assignment";

export function readIncidentAssignment(base:string,token:string|undefined,signal:AbortSignal,incidentId:string) {
  if (!ticketLinkId.safeParse(incidentId).success) return;
  return readTicketProjection(base,token,signal,`${incidentAssignmentPath}?${new URLSearchParams({incidentId})}`,data => {
    const parsed = incidentAssignmentOptions.safeParse(data);
    return parsed.success && parsed.data.incidentId === incidentId ? parsed.data : undefined;
  });
}

export function saveIncidentAssignment(base:string,token:string|undefined,signal:AbortSignal,command:IncidentAssignmentRequest) {
  return readTicketProjection<IncidentAssignmentReceipt|"changed">(base,token,signal,incidentAssignmentPath,(data,status) => {
    if (status === 409 && (data === "incident_assignment_changed" || data === "incident_assignment_owner_unavailable")) return "changed";
    const parsed = incidentAssignmentReceipt.safeParse(data);
    return parsed.success && matchesAssignment(parsed.data,command) ? parsed.data : undefined;
  },command);
}

async function readTicketProjection<T>(base: string, token: string | undefined, signal: AbortSignal, path: string, decode: (data: unknown, status: number) => T | undefined, command?: IncidentReportRequest | IncidentUpdateRequest | IncidentTransitionRequest | IncidentCollectionRequest | IncidentAssignmentRequest, readBadRequest = false) {
  if (!token?.startsWith("axm.desk.") || signal.aborted) return;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, {once: true});
  const stopped = new Promise<undefined>(resolve => controller.signal.addEventListener("abort", () => resolve(undefined), {once: true}));
  const timeout = setTimeout(abort, 15000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const url = new URL(base);
    if (url.origin !== base || (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "127.0.0.1"))) return;
    const response = await Promise.race([fetch(`${base}${path}`, {
      method: command ? "POST" : "GET",
      headers: {Authorization: `Bearer ${token}`, ...(command && {"Content-Type": "application/json"})},
      ...(command && {body: JSON.stringify(command)}), credentials: "omit",
      redirect: "error", cache: "no-store", signal: controller.signal,
    }), stopped]);
    if (!response) return;
    reader = response.body?.getReader();
    if ((!response.ok && !command && !(readBadRequest && response.status === 400)) || !reader) return;
    const decoder = new TextDecoder("utf-8", {fatal: true});
    let size = 0;
    let body = "";
    while (!controller.signal.aborted) {
      const chunk = await Promise.race([reader.read(), stopped]);
      if (!chunk) return;
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > ticketDirectoryBodyLimit) return;
      body += decoder.decode(chunk.value, {stream: true});
    }
    if (controller.signal.aborted) return;
    const envelope = JSON.parse(body + decoder.decode());
    if (!response.ok) return envelope?.ok === false ? decode(envelope.error, response.status) : undefined;
    if (envelope?.ok !== true) return;
    return decode(envelope.data, response.status);
  } catch {
    // The view exposes a stable unavailable state and explicit retry.
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
    if (reader) void reader.cancel().catch(() => undefined);
    controller.abort();
  }
}
