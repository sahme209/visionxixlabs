import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {evaluateGovernanceAdmission} from './admission';
import {identifier,digestSchema,scopeSchema,GOVERNED_ACTIONS,type CompiledBaseline,type EvidenceSnapshot} from './contracts';
const contextSchema=z.object({organizationId:identifier,actorUserId:identifier,sessionId:identifier,action:z.enum(GOVERNED_ACTIONS),scope:scopeSchema,planDigest:digestSchema}).strict();
export type GovernanceAdmissionContext=z.infer<typeof contextSchema>;
export interface GovernanceGuardPorts {
 now():number;
 readActive(context:GovernanceAdmissionContext):Promise<CompiledBaseline>;
 readCoverage(context:GovernanceAdmissionContext):Promise<{enrolled:boolean;coveredActions:string[]}>;
 /** Only trusted server composition can construct these inputs, never request/model data. */
 readVerifiedInputs(context:GovernanceAdmissionContext,baseline:CompiledBaseline,phase:'before_claim'|'before_write'):Promise<{evidence:EvidenceSnapshot[];providerAccessVerified:boolean;platformAllowed:boolean;autonomyLevel:number;verifiedEvidence:boolean;rollbackVerified:boolean;approval?:unknown}>;
}
export interface GovernanceAdmissionReceipt {baselineDigest:string;contextDigest:string;checkedAt:number;phase:'before_claim'|'before_write'}
/** A policy check does not claim or execute an action; existing durable executor guards remain mandatory. */
export function createGovernanceAdmissionGuard(ports:GovernanceGuardPorts){return{async assert(raw:unknown,phase:'before_claim'|'before_write',prior?:GovernanceAdmissionReceipt):Promise<GovernanceAdmissionReceipt>{try{const context=contextSchema.parse(raw);if(phase!=='before_claim'&&phase!=='before_write')throw Error();const contextDigest=sha256ContentHash(context),time=ports.now();if(phase==='before_write'&&(!prior||prior.phase!=='before_claim'||prior.contextDigest!==contextDigest||!Number.isFinite(prior.checkedAt)||time<prior.checkedAt||time-prior.checkedAt>15000))throw Error();const baseline=await ports.readActive(context);if(prior&&prior.baselineDigest!==baseline.digest)throw Error();const coverage=await ports.readCoverage(context),facts=await ports.readVerifiedInputs(context,baseline,phase);const decision=evaluateGovernanceAdmission({request:{organizationId:context.organizationId,actorUserId:context.actorUserId,action:context.action,scope:context.scope,planDigest:context.planDigest,providerAccessVerified:facts.providerAccessVerified,platformAllowed:facts.platformAllowed,autonomyLevel:facts.autonomyLevel,verifiedEvidence:facts.verifiedEvidence,rollbackVerified:facts.rollbackVerified},active:{baseline,activeDigest:baseline.digest,approvedDigest:baseline.digest,revoked:false},evidence:facts.evidence,coverage,now:ports.now(),approval:facts.approval});if(!decision.allowed)throw Error();const finished=ports.now();if(!Number.isFinite(finished)||finished<time||finished-time>15000)throw Error();return{baselineDigest:baseline.digest,contextDigest,checkedAt:finished,phase}}catch{throw Error('governance_admission_unavailable')}}}}
