import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {parseEvidenceSnapshot,digestSchema,type EvidenceSnapshot} from './contracts';
export function validateEvidenceEnvelope(raw:unknown):EvidenceSnapshot{const{digest,...source}=z.object({digest:digestSchema}).passthrough().parse(raw),actual=parseEvidenceSnapshot(source);if(actual.digest!==digest)throw Error('governance_evidence_changed');return actual}
const identity=(e:EvidenceSnapshot)=>({organizationId:e.organizationId,source:e.source,connectionId:e.connectionId,connectionRevision:e.source==='document'?'document_content_bound':e.connectionRevision,collectorVersion:e.collectorVersion,collectionOperations:e.collectionOperations,selection:e.selection});
const content=(e:EvidenceSnapshot)=>sha256ContentHash({sourceDigest:e.sourceDigest,facts:[...e.facts].sort((a,b)=>sha256ContentHash(a).localeCompare(sha256ContentHash(b)))});
export type EvidenceComparison={status:'unchanged'|'changed'|'unknown';reason:'current_source_matches'|'source_content_changed'|'source_identity_changed'|'evidence_unavailable';approvedDigest?:string;currentDigest?:string;observedAt?:string;expiresAt?:string;citations:string[]};
/** Compare immutable observations. No expired digest is rewritten or extended;
 * an unchanged source is established by a separate complete current snapshot. */
export function compareEvidenceSources(rawApproved:unknown,rawCurrent:unknown,now:number):EvidenceComparison{
 const unavailable:EvidenceComparison={status:'unknown',reason:'evidence_unavailable',citations:[]};
 try{const approved=validateEvidenceEnvelope(rawApproved),current=validateEvidenceEnvelope(rawCurrent),observed=Date.parse(current.observedAt),expires=Date.parse(current.expiresAt);
  if(!Number.isFinite(now)||now<0||approved.completeness!=='complete'||current.completeness!=='complete'||observed>now||observed<Date.parse(approved.observedAt)||expires<=now||expires-observed>300000)return unavailable;
  // Uploaded-document revisions are raw content digests, not credential
  // revisions. Validate that relation before distinguishing content drift.
  if(approved.source==='document'||current.source==='document'){for(const e of [approved,current]){const name=e.connectionId.slice(7);if(e.source!=='document'||e.collectorVersion!=='governance-document-v2'||e.connectionRevision!==e.sourceDigest||!e.connectionId.startsWith('upload:')||! /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,119}\.(md|txt)$/i.test(name)||name.includes('..'))return unavailable}}
  if(sha256ContentHash(identity(approved))!==sha256ContentHash(identity(current)))return{status:'unknown',reason:'source_identity_changed',citations:[]};
  const changed=content(approved)!==content(current);return{status:changed?'changed':'unchanged',reason:changed?'source_content_changed':'current_source_matches',approvedDigest:approved.digest,currentDigest:current.digest,observedAt:current.observedAt,expiresAt:current.expiresAt,citations:[...new Set([...approved.facts,...current.facts].map(f=>f.locator))].slice(0,100)};
 }catch{return unavailable}
}
export function verifyCurrentEvidence(approved:unknown,current:unknown,now:number){const result=compareEvidenceSources(approved,current,now);if(result.status!=='unchanged')throw Error('governance_current_evidence_unavailable');return result}
