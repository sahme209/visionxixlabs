import {z} from 'zod';
import {operationalEcsTarget} from './contracts';
import {nativeEcsTargetKey} from './reservationContract';
const id=z.string().regex(/^ecs-svc\/[0-9]{1,32}$/),count=z.number().int().nonnegative().safe();
const response=z.object({$metadata:z.object({httpStatusCode:z.literal(200),requestId:z.string().regex(/^[A-Za-z0-9_-]{1,256}$/)}),failures:z.array(z.unknown()).max(0).optional(),services:z.array(z.object({clusterArn:z.string(),serviceArn:z.string(),taskDefinition:z.string(),status:z.literal('ACTIVE'),deploymentController:z.object({type:z.literal('ECS')}),desiredCount:count,runningCount:count,pendingCount:count,deployments:z.array(z.object({id,status:z.string(),taskDefinition:z.string(),rolloutState:z.enum(['COMPLETED','FAILED','IN_PROGRESS']).optional()})).max(32)})).length(1)});
/** Structural candidate ONLY: a private profile must separately qualify exact
 * request/provenance/controller/health/currentness. No write/rollback authority. */
export function projectOperationalEcsObservation(rawTarget:unknown,rawAcceptedId:unknown,raw:unknown){
 const target=operationalEcsTarget.parse(rawTarget),acceptedId=id.parse(rawAcceptedId),result=response.parse(raw),service=result.services[0];
 const metadata={qualificationRequired:true as const,executionAuthorized:false as const,rollbackAuthorized:false as const,requestId:result.$metadata.requestId,deploymentId:acceptedId};
 if(service.clusterArn!==target.clusterArn||nativeEcsTargetKey({...target,serviceArn:service.serviceArn})!==nativeEcsTargetKey(target)||service.taskDefinition!==target.taskDefinitionArn)return Object.freeze({...metadata,kind:'unknown' as const});
 const exact=service.deployments.filter(d=>d.id===acceptedId),primary=service.deployments.filter(d=>d.status==='PRIMARY');
 if(new Set(service.deployments.map(d=>d.id)).size!==service.deployments.length||exact.length!==1||primary.length!==1||primary[0].id!==acceptedId||exact[0].taskDefinition!==target.taskDefinitionArn)return Object.freeze({...metadata,kind:'unknown' as const});
 const rollout=exact[0].rolloutState;
 const kind=rollout==='FAILED'?'terminal_failure':rollout==='IN_PROGRESS'?'accepted':rollout==='COMPLETED'&&service.pendingCount===0&&service.runningCount===service.desiredCount?'stable':'unknown';
 return Object.freeze({...metadata,kind});
}
