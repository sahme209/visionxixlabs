import {useEffect,useRef,useState} from 'react';
import {desktopClient} from '../lib/desktopClient';
import type {TicketGovernanceReview} from '../lib/ticketGovernance';
/** Prepares evidence review only. It cannot approve, dispatch or resend a note. */
export function ServiceNowWrittenObservationCreator({review,actionId,actionVersion,onPrepared}:{review:TicketGovernanceReview;actionId:string;actionVersion:number;onPrepared:(review:TicketGovernanceReview)=>void}){
 const[busy,setBusy]=useState(false),[hold,setHold]=useState(false),[done,setDone]=useState(false),[message,setMessage]=useState(''),[requestId,setRequestId]=useState('');
 const alive=useRef(true),active=useRef<AbortController|undefined>(undefined),nonce=useRef<string|undefined>(undefined),owner=useRef({config:desktopClient.config,revision:desktopClient.getContextRevision()}).current;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort()}},[]);
 const current=()=>alive.current&&owner.config===desktopClient.config&&owner.revision===desktopClient.getContextRevision();
 const valid=review.binding.kind==='ticket_release_association'&&review.binding.ticket.provider==='servicenow'&&review.current&&review.status==='approved'&&Date.parse(review.binding.expiresAt)>Date.now();
 async function run(lookup=false){if(busy||done||!current()||!lookup&&(hold||!valid))return;if(lookup&&!nonce.current)return;
  const selected={kind:'servicenow_written_link_observation_request' as const,actionId,expectedVersion:actionVersion,association:{reviewId:review.id,bindingDigest:review.bindingDigest}};
  nonce.current??=crypto.randomUUID();setRequestId(nonce.current);const controller=new AbortController();active.current=controller;setBusy(true);setMessage('');
  try{const result=lookup?await desktopClient.lookupServiceNowWrittenObservation(nonce.current,selected,controller.signal):await desktopClient.prepareServiceNowWrittenObservation(selected,nonce.current,controller.signal);if(!current())return;if(result.ok){setDone(true);onPrepared(result.data)}else{if(result.outcomeUnconfirmed)setHold(true);setMessage(result.outcomeUnconfirmed?'The observation review outcome is unconfirmed. Find the saved review before another preparation.':'The exact observation could not be verified. No note was sent.')}}catch{if(current()){setHold(true);setMessage('The observation review outcome is unconfirmed. Find the saved review before another preparation.')}}finally{if(current())setBusy(false)}
 }
 return <section aria-label="Reconcile existing ServiceNow note" className="space-y-2 text-xs text-zinc-400">
  <p>Verify the existing note without sending it again. The consumed attempt stays unknown; a separate human must review the exact journal proof.</p>
  <button type="button" className="btn-secondary" disabled={busy||hold||done||!valid} onClick={()=>void run()}>Review the existing written note</button>
  {hold&&<><p className="break-all">Saved observation request ID: {requestId}</p><button type="button" className="btn-secondary" disabled={busy||done} onClick={()=>void run(true)}>Find this saved observation review</button></>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
