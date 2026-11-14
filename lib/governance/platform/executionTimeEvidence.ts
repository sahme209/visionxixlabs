import {executionTimeSummarySchema} from './executionTimeView';
import 'server-only';
import {z} from 'zod';
import type {ExecutionTimeObservation,ExecutionTimeWindow,ExecutionTimeCheck} from './executionTime';
import {readOperationalTimeObservation} from './nativeTime/operationalSource';
const stamp=z.number().int().nonnegative().safe(),window=z.object({notBefore:stamp.optional(),expiresAt:stamp.optional()}).strict();
export const executionTimeEvidenceSchema=z.discriminatedUnion('assurance',[
 z.object({format:z.literal(1),assurance:z.literal('physical-utc-interval-v1'),earliest:stamp,latest:stamp,window}).strict().refine(v=>v.earliest<=v.latest),
 z.object({format:z.literal(1),assurance:z.literal('aws-linux-operational-v1'),unixTimeNs:z.string().regex(/^(0|[1-9][0-9]{0,18})$/),monotonicBeforeNs:z.string(),monotonicAfterNs:z.string(),profileDigest:z.string().regex(/^[a-f0-9]{64}$/),revision:z.number().int().positive().safe(),hostGeneration:z.string(),sourceGeneration:z.string(),publication:z.string(),disruptionMarker:z.string(),physicalUtcClosureProven:z.literal(false),window}).strict(),
]);
export type ExecutionTimeEvidence=z.infer<typeof executionTimeEvidenceSchema>;
const owners=new WeakMap<object,Readonly<ExecutionTimeEvidence>>(),checks=new WeakMap<ExecutionTimeCheck,Readonly<ExecutionTimeEvidence>>();
function summary(value:ExecutionTimeObservation,restriction:ExecutionTimeWindow):Readonly<ExecutionTimeEvidence>{
 const o=readOperationalTimeObservation(value);
 const evidence=o?{format:1,assurance:o.assurance,unixTimeNs:String(o.unixTimeNs),monotonicBeforeNs:String(o.monotonicBeforeNs),monotonicAfterNs:String(o.monotonicAfterNs),profileDigest:o.profileDigest,revision:o.revision,hostGeneration:o.hostGeneration,sourceGeneration:o.sourceGeneration,publication:String(o.publication),disruptionMarker:String(o.disruptionMarker),physicalUtcClosureProven:false,window:{...restriction}}:'assurance' in value?undefined:{format:1,assurance:'physical-utc-interval-v1',earliest:value.earliest,latest:value.latest,window:{...restriction}};
 const result=executionTimeEvidenceSchema.parse(evidence);Object.freeze(result.window);return Object.freeze(result);
}
/** Audit metadata only, never a qualifier or executable proof. Association is
 * the original transaction/one-use native callback, not an action-ID lookup. */
export function recordExecutionTimeEvidence(owner:object,value:ExecutionTimeObservation,restriction:ExecutionTimeWindow){owners.set(owner,summary(value,restriction))}
export function recordExecutionTimeCheck(check:ExecutionTimeCheck,value:ExecutionTimeObservation,restriction:ExecutionTimeWindow){checks.set(check,summary(value,restriction))}
export function recordExecutionTimeCheckForOwner(owner:object,check:ExecutionTimeCheck){const e=checks.get(check);if(e)owners.set(owner,e)}
export function executionTimeEvidenceForOwner(owner:object){return owners.get(owner)}

export function projectExecutionTimeEvidence(raw:unknown){const e=executionTimeEvidenceSchema.parse(raw);return executionTimeSummarySchema.parse({format:1,assurance:e.assurance,...(e.assurance==='aws-linux-operational-v1'?{profileDigest:e.profileDigest,physicalUtcClosureProven:false}:{}),authority:'history_only',executionAuthorized:false})}
