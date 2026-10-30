import 'server-only';
import {z} from 'zod';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import type {ReleaseOperationPlanTransaction as Tx} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {compileBaseline,identifier,digestSchema,type CompiledBaseline,type EvidenceSnapshot} from './contracts';
import {validateEvidenceEnvelope,verifyCurrentEvidence} from './freshness';
const scopeSchema=z.object({organizationId:identifier,actorUserId:identifier,sessionId:identifier}).strict();
type Scope=z.infer<typeof scopeSchema>;
interface Ports{
 assertCurrent:(scope:Scope,signal:AbortSignal)=>Promise<void>;
 readHistorical:(scope:Scope,digest:string,signal:AbortSignal)=>Promise<unknown>;
 readCurrent:(scope:Scope,approved:EvidenceSnapshot,signal:AbortSignal)=>Promise<unknown>;
 /** DB/current-source authority only. Never perform provider I/O under locks. */
 recheckLocked:(tx:Tx,scope:Scope,approved:EvidenceSnapshot,current:EvidenceSnapshot)=>Promise<void>;
 now?:()=>number;
}
function baseline(raw:unknown){const{digest,compilerVersion,...input}=z.object({digest:digestSchema,compilerVersion:z.string()}).passthrough().parse(raw),value=compileBaseline(input);if(sha256ContentHash(value)!==sha256ContentHash(raw))throw Error('governance_baseline_changed');return value}
type Receipt={evidence:EvidenceSnapshot[];evidenceRefreshes:Array<{approvedDigest:string;current:EvidenceSnapshot}>;expiresAt:number};
/** Short request-local proof. Historical snapshots remain immutable; a separate
 * current observation establishes that the approved source is still identical. */
export function createGovernanceEvidencePreflight(ports:Ports){
 const now=ports.now??Date.now,receipts=new Map<string,Receipt>(),generations=new Map<string,number>();
 const key=(s:Scope,b:CompiledBaseline)=>sha256ContentHash({scope:s,baselineDigest:b.digest});
 function live(id:string,generation:number|undefined,receipt:Receipt){const at=now();if(generations.get(id)!==generation||receipts.get(id)!==receipt||!Number.isFinite(at)||receipt.expiresAt<=at)throw Error('governance_evidence_preflight_expired')}
 return{
  async warm(rawScope:Scope,rawBaseline:CompiledBaseline,parent:AbortSignal){
   const s=scopeSchema.parse(rawScope),b=baseline(rawBaseline),id=key(s,b),signal=AbortSignal.any([parent,AbortSignal.timeout(15000)]);
   if(b.organizationId!==s.organizationId)throw Error('governance_evidence_scope_changed');if(!generations.has(id)&&generations.size>=10)throw Error('governance_evidence_preflight_bound');
   const generation=(generations.get(id)??0)+1;generations.set(id,generation);receipts.delete(id);const evidence:EvidenceSnapshot[]=[],refreshes:Receipt['evidenceRefreshes']=[];
   async function bounded<T>(read:()=>Promise<T>){signal.throwIfAborted();return withGithubAbort(read(),signal)}
   await bounded(()=>ports.assertCurrent(s,signal));
   for(const digest of b.evidenceDigests){const approved=validateEvidenceEnvelope(await bounded(()=>ports.readHistorical(s,digest,signal)));
    if(approved.digest!==digest||approved.organizationId!==s.organizationId||!b.scopes.some(scope=>sha256ContentHash(scope)===sha256ContentHash(approved.selection))||b.rules.some(rule=>rule.evidenceDigests.includes(digest)&&sha256ContentHash(rule.scope)!==sha256ContentHash(approved.selection)))throw Error('governance_evidence_selection_changed');
    await bounded(()=>ports.assertCurrent(s,signal));const current=validateEvidenceEnvelope(await bounded(()=>ports.readCurrent(s,approved,signal)));verifyCurrentEvidence(approved,current,now());await bounded(()=>ports.assertCurrent(s,signal));evidence.push(approved);refreshes.push({approvedDigest:digest,current});
   }
   signal.throwIfAborted();if(generations.get(id)!==generation)throw Error('governance_evidence_preflight_superseded');const at=now();if(!Number.isFinite(at))throw Error('governance_evidence_clock_unavailable');const receipt={evidence,evidenceRefreshes:refreshes,expiresAt:Math.min(at+30000,...refreshes.map(r=>Date.parse(r.current.expiresAt)))};receipts.set(id,structuredClone(receipt));return structuredClone(receipt);
  },
  async read(tx:Tx,rawScope:Scope,rawBaseline:CompiledBaseline){
   const s=scopeSchema.parse(rawScope),b=baseline(rawBaseline),id=key(s,b),generation=generations.get(id),receipt=receipts.get(id);if(!receipt||s.organizationId!==b.organizationId)throw Error('governance_evidence_preflight_required');live(id,generation,receipt);
   for(const approved of receipt.evidence){const current=receipt.evidenceRefreshes.find(r=>r.approvedDigest===approved.digest)!.current;verifyCurrentEvidence(approved,current,now());await ports.recheckLocked(tx,s,structuredClone(approved),structuredClone(current));live(id,generation,receipt)}
   return structuredClone(receipt);
  },
 };
}
