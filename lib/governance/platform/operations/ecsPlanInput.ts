import type {OperationalEcsManifestMetadata} from './contracts';
/** Pure cross-surface input projection. This constructs no authority or digest. */
export function operationalEcsPlanInput(m:OperationalEcsManifestMetadata){return {format:1 as const,scope:'platform' as const,sourceDigest:m.digest,expiresAt:m.expiresAt,effects:[{id:'ecs',kind:'deployment.ecs' as const,target:{accountId:m.target.accountId,region:m.target.region,cluster:m.target.clusterArn,service:m.target.serviceArn,taskDefinitionArn:m.target.taskDefinitionArn,operation:m.operation,configurationDigest:m.digest}}]}}
