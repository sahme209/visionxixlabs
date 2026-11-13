import 'server-only';
import {UpdateServiceCommand} from '@aws-sdk/client-ecs';
import {z} from 'zod';
import {readOperationalManifest} from './kernel';
import {nativeEcsTargetKey} from './reservationContract';
const id=z.string().regex(/^ecs-svc\/[0-9]{1,32}$/);
const reply=z.object({$metadata:z.object({httpStatusCode:z.literal(200),requestId:z.string().regex(/^[A-Za-z0-9_-]{1,256}$/)}),service:z.object({clusterArn:z.string(),serviceArn:z.string(),taskDefinition:z.string(),status:z.literal('ACTIVE'),deploymentController:z.object({type:z.literal('ECS')}),deployments:z.array(z.object({id,status:z.string(),taskDefinition:z.string()})).min(1).max(32)})});
const fail=():never=>{throw Error('operational_ecs_protocol_unavailable')};
/** Command construction alone grants no authority or credentials and sends
 * nothing. A qualified private executor must enforce claims/leases/reservations. */
export function buildOperationalEcsUpdate(raw:unknown){const manifest=readOperationalManifest(raw);if(manifest.kind!=='deployment.ecs')return fail();return new UpdateServiceCommand({cluster:manifest.target.clusterArn,service:manifest.target.serviceArn,taskDefinition:manifest.target.taskDefinitionArn,forceNewDeployment:manifest.operation==='force'})}
/** Parse an actual update response as acceptance ONLY. Prior identity is from
 * the private held native snapshot, never a caller's success/rollback boolean.
 * Shape/digest matching does not qualify provenance or immutable image content. */
export function projectOperationalEcsAcceptance(rawManifest:unknown,rawPriorId:unknown,rawResponse:unknown){
 try{const manifest=readOperationalManifest(rawManifest),prior=id.parse(rawPriorId),result=reply.parse(rawResponse);if(manifest.kind!=='deployment.ecs')return fail();const s=result.service;
  if(s.clusterArn!==manifest.target.clusterArn||s.taskDefinition!==manifest.target.taskDefinitionArn||nativeEcsTargetKey({...manifest.target,serviceArn:s.serviceArn})!==nativeEcsTargetKey(manifest.target))return fail();
  const primary=s.deployments.filter(d=>d.status==='PRIMARY');if(primary.length!==1||primary[0].taskDefinition!==manifest.target.taskDefinitionArn||primary[0].id===prior||new Set(s.deployments.map(d=>d.id)).size!==s.deployments.length)return fail();
  return Object.freeze({kind:'accepted' as const,deploymentId:primary[0].id,requestId:result.$metadata.requestId,taskDefinitionArn:manifest.target.taskDefinitionArn,stable:false as const,rollbackAuthorized:false as const});
 }catch{return fail()}
}
