import 'server-only';
import {z} from 'zod';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {compileBaseline,identifier,type CompiledBaseline,type EvidenceSnapshot} from './contracts';
import {validateEvidenceEnvelope,compareEvidenceSources,type EvidenceComparison} from './freshness';
import type {RevisionScope} from './revisionStore';
const principal=z.object({organizationId:identifier,actorUserId:identifier,sessionId:identifier}).strict();
export interface GovernanceDriftReport{baselineDigest:string;observedAt:string;status:'unchanged'|'changed'|'unknown';sources:Array<EvidenceComparison&{approvedDigest:string}>;executionAuthorized:false}
/** Read-only source comparison, never a compliance or remediation decision.
 * Missing/denied evidence is unknown; caller cancellation is a refusal. */
export function createGovernanceDriftReader(ports:{assertCurrent:(scope:RevisionScope,signal:AbortSignal)=>Promise<void>;readHistorical:(scope:RevisionScope,digest:string,signal:AbortSignal)=>Promise<unknown>;readCurrent:(scope:RevisionScope,approved:EvidenceSnapshot,signal:AbortSignal)=>Promise<unknown>;now?:()=>number}){
 const now=ports.now??Date.now;
 return{async read(rawScope:RevisionScope,rawBaseline:CompiledBaseline,parent:AbortSignal):Promise<GovernanceDriftReport>{
  const scope=principal.parse(rawScope),{digest,compilerVersion,...input}=rawBaseline,b=compileBaseline(input),signal=AbortSignal.any([parent,AbortSignal.timeout(15000)]);
  if(scope.organizationId!==b.organizationId||sha256ContentHash(rawBaseline)!==sha256ContentHash(b))throw Error('governance_drift_scope_changed');
  async function bounded<T>(run:()=>Promise<T>){signal.throwIfAborted();return withGithubAbort(run(),signal)}
  const sources:GovernanceDriftReport['sources']=[];await bounded(()=>ports.assertCurrent(scope,signal));
  for(const approvedDigest of b.evidenceDigests){
   await bounded(()=>ports.assertCurrent(scope,signal));let approved:EvidenceSnapshot|undefined;
   try{approved=validateEvidenceEnvelope(await bounded(()=>ports.readHistorical(scope,approvedDigest,signal)))}catch{signal.throwIfAborted()}
   if(approved&&(approved.digest!==approvedDigest||approved.organizationId!==scope.organizationId||!b.scopes.some(s=>sha256ContentHash(s)===sha256ContentHash(approved!.selection))||b.rules.some(r=>r.evidenceDigests.includes(approvedDigest)&&sha256ContentHash(r.scope)!==sha256ContentHash(approved!.selection))))throw Error('governance_drift_source_changed');
   let comparison:EvidenceComparison={status:'unknown',reason:'evidence_unavailable',citations:[]};
   if(approved)try{const current=await bounded(()=>ports.readCurrent(scope,approved!,signal));comparison=compareEvidenceSources(approved,current,now())}catch{signal.throwIfAborted()}
   await bounded(()=>ports.assertCurrent(scope,signal));sources.push({...comparison,approvedDigest});
  }
  signal.throwIfAborted();const at=now();if(!Number.isFinite(at))throw Error('governance_drift_clock_unavailable');
  // A source may expire while another source is collected. Do not report an
  // expired earlier observation as current at final delivery.
  const final=sources.map(s=>s.expiresAt&&Date.parse(s.expiresAt)<=at?{approvedDigest:s.approvedDigest,status:'unknown' as const,reason:'evidence_unavailable' as const,citations:[]}:s);
  const report:GovernanceDriftReport={baselineDigest:b.digest,observedAt:new Date(at).toISOString(),status:final.some(s=>s.status==='unknown')?'unknown':final.some(s=>s.status==='changed')?'changed':'unchanged',sources:final,executionAuthorized:false};
  if(Buffer.byteLength(JSON.stringify(report))>262144)throw Error('governance_drift_response_limit');return report;
 }};
}
