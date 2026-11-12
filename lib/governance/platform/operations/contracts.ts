import {z} from 'zod';
import {digest} from '../contracts';
const id=z.string().regex(/^[-A-Za-z0-9_]{1,256}$/),sha=z.string().regex(/^[a-f0-9]{40}$/);
const uuid='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
export const operationalEvidenceId=z.string().regex(new RegExp('^platform_evidence_'+uuid+'$'));
export const operationalArtifactId=z.string().regex(new RegExp('^platform_artifact_'+uuid+'$'));
const actionId=z.string().regex(new RegExp('^platform_action_'+uuid+'$'));
const base={format:z.literal(1),scope:z.literal('platform'),expiresAt:z.string().max(40).datetime()};
const repository=z.literal('sahme209/visionxixlabs');
const source=z.object({repository,branch:z.literal('main'),commit:sha}).strict();
const ci=z.object({name:z.string().min(1).max(128).refine(v=>v.trim()===v&&!/[\x00-\x1f]/.test(v)),receiptId:operationalEvidenceId,commit:sha}).strict();
/** References describe what must be qualified later; they are not green checks. */
export const operationalReleaseManifest=z.object({...base,kind:z.literal('release.manual'),source,
 target:z.object({projectId:id,teamId:id,environment:z.literal('production')}).strict(),
 sourceHashes:z.object({workflow:digest,build:digest,configuration:digest,lock:digest,schema:digest}).strict(),
 artifactEvidenceId:operationalEvidenceId,ciEvidence:z.array(ci).min(1).max(64),compatibilityEvidenceId:operationalEvidenceId,recoveryEvidenceId:operationalEvidenceId,smokeProfileId:id,
}).strict().superRefine((value,c)=>{
 if(new Set(value.ciEvidence.map(e=>e.name)).size!==value.ciEvidence.length||value.ciEvidence.some(e=>e.commit!==value.source.commit))c.addIssue({code:'custom',message:'CI references must be unique and match the exact source'});
});
const account=z.string().regex(/^\d{12}$/),region=z.string().max(64).regex(/^[a-z]{2}(?:-[a-z0-9]+)+-\d+$/);
const clusterArn=/^arn:aws:ecs:([a-z0-9-]+):(\d{12}):cluster\/([A-Za-z0-9_-]{1,255})$/;
const serviceArn=/^arn:aws:ecs:([a-z0-9-]+):(\d{12}):service\/(?:([A-Za-z0-9_-]{1,255})\/)?([A-Za-z0-9_-]{1,255})$/;
const taskArn=/^arn:aws:ecs:([a-z0-9-]+):(\d{12}):task-definition\/[A-Za-z0-9_-]{1,255}:[1-9]\d*$/;
const roleArn=/^arn:aws:iam::(\d{12}):role\/[A-Za-z0-9+=,.@_\/-]{1,512}$/;
export const operationalEcsTarget=z.object({accountId:account,region,clusterArn:z.string().max(512).regex(clusterArn),serviceArn:z.string().max(768).regex(serviceArn),taskDefinitionArn:z.string().max(512).regex(taskArn)}).strict().superRefine((v,c)=>{
 const cluster=clusterArn.exec(v.clusterArn),service=serviceArn.exec(v.serviceArn),task=taskArn.exec(v.taskDefinitionArn);
 if(!cluster||!service||!task)return;
 if([cluster,service,task].some(a=>a[1]!==v.region||a[2]!==v.accountId)||service[3]&&service[3]!==cluster[3])c.addIssue({code:'custom',message:'Mismatched ECS target'});
});
export const operationalWorkloadReference=z.object({repository,ref:z.literal('refs/heads/main'),commit:sha,workflowCommit:sha,workflowPath:z.literal('.github/workflows/axiom-deploy-aws-ecs.yml'),workflowSha256:digest,
 runId:z.string().regex(/^[1-9]\d{0,19}$/).refine(v=>/^[1-9]\d{0,19}$/.test(v)&&BigInt(v)<=BigInt('18446744073709551615')),attempt:z.number().int().min(1).max(1000),
}).strict().refine(v=>v.commit===v.workflowCommit,{message:'Workflow and source commit must match'});
const ecsBase={...base,kind:z.literal('deployment.ecs'),target:operationalEcsTarget,roleArn:z.string().max(768).regex(roleArn),workload:operationalWorkloadReference,sourceEvidenceId:operationalEvidenceId};
const rollbackCondition=z.object({kind:z.literal('verified_terminal_failure'),failedActionId:actionId,failureReceiptId:operationalEvidenceId,priorDeploymentReceiptId:operationalEvidenceId,generation:z.number().int().positive().safe(),failedTaskDefinitionArn:z.string().max(512).regex(taskArn)}).strict();
export const operationalEcsManifest=z.discriminatedUnion('operation',[
 z.object({...ecsBase,operation:z.literal('force')}).strict(),
 z.object({...ecsBase,operation:z.literal('rollback'),condition:rollbackCondition}).strict(),
]).superRefine((v,c)=>{
 const role=roleArn.exec(v.roleArn);if(role&&role[1]!==v.target.accountId)c.addIssue({code:'custom',message:'Mismatched credential account'});
 if(v.operation==='rollback'){const failed=taskArn.exec(v.condition.failedTaskDefinitionArn);if(failed&&(failed[1]!==v.target.region||failed[2]!==v.target.accountId))c.addIssue({code:'custom',message:'Mismatched failed task target'});}
});
const currentSetting=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('absent'),receiptId:operationalEvidenceId}).strict(),
 z.object({kind:z.literal('present'),id,updatedAt:z.number().int().nonnegative().safe(),receiptId:operationalEvidenceId}).strict(),
]);
const setting=z.object({name:z.string().regex(/^[A-Z][A-Z0-9_]{0,127}$/),environment:z.enum(['production','preview','development']),type:z.enum(['encrypted','plain']),sensitivity:z.enum(['secret','nonsecret']),artifactId:operationalArtifactId,current:currentSetting}).strict().refine(v=>v.sensitivity!=='secret'||v.type==='encrypted',{message:'Secret settings require encrypted type'});
export const operationalSettingsManifest=z.object({...base,kind:z.literal('settings.vercel'),target:z.object({projectId:id,teamId:id}).strict(),settings:z.array(setting).min(1).max(32)}).strict().superRefine((value,c)=>{
 if(new Set(value.settings.map(s=>s.environment+':'+s.name)).size!==value.settings.length)c.addIssue({code:'custom',message:'Duplicate physical setting target'});
});
export const operationalManifestSchema=z.union([operationalReleaseManifest,operationalEcsManifest,operationalSettingsManifest]);
export type OperationalManifestInput=z.infer<typeof operationalManifestSchema>;
export const operationalFailureObservation=z.object({kind:z.literal('provider_terminal_failure'),actionId,receiptId:operationalEvidenceId,generation:z.number().int().positive().safe(),accountId:account,region,clusterArn:z.string().max(512).regex(clusterArn),serviceArn:z.string().max(768).regex(serviceArn),failedTaskDefinitionArn:z.string().max(512).regex(taskArn)}).strict();
