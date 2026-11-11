import type {TicketGovernanceReview} from '../lib/ticketGovernance';
type Observation=Extract<TicketGovernanceReview['binding'],{kind:'servicenow_written_link_observation_v1'}>;
export function ServiceNowWrittenObservationFacts({binding:b}:{binding:Observation}){
 const facts={'Instance':b.instanceOrigin,'Connection':b.connectionId,'Connection revision':b.connectionRevision,'Original action':`${b.originalActionId} · version ${b.originalVersion}`,'Original candidate digest':b.originalCandidateDigest,'Reviewed payload digest':b.payloadDigest,'Logical note marker':b.logicalMarker,'Journal entry ID':b.proof.entry.id,'Journal entry created':`${b.proof.entry.createdAt} UTC`,'Exact note digest':b.proof.entryDigest,'Proof observed':`${b.proof.observedAt} UTC`,'Approved association':b.association.reviewId,'Association digest':b.association.bindingDigest};
 return <section aria-label="Written ServiceNow note observation" className="space-y-2 text-xs text-zinc-400">
  <h6 className="font-medium text-zinc-200">Written evidence note · {b.issue.number}</h6>
  <p>The exact journal note is present. The original attempt remains unknown and consumed; this observation does not resend it, overwrite its outcome, or approve closure.</p>
  <p className="break-all">Ticket ID: {b.issue.sysId} · Original attempts: {b.originalAttemptCount}</p>
  <dl className="space-y-1 wrap-break-word">{Object.entries(facts).map(([label,value])=><div key={label}><dt className="font-medium">{label}</dt><dd>{value}</dd></div>)}</dl>
 </section>;
}
