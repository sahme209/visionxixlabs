import 'server-only';
import {preparePlatformLeadDeployment,preparePlatformLeadDeploymentSource} from '@/lib/deploy/platformLeadSource';
import {platformDeploymentSelection} from './deploymentContract';
import type {PlatformTransaction} from './actionStore';
import type {PlatformPlan} from './contracts';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
export async function prepareDeploymentPlatformPlan(tx:PlatformTransaction,input:unknown,effectId?:string){
 const selected=platformDeploymentSelection.parse(input),team=process.env.VERCEL_TEAM_ID??'';
 if(!tx.readDeploymentSource)throw Error('platform_deployment_source_unavailable');
 const row=await tx.readDeploymentSource(selected.leadId),prepared=preparePlatformLeadDeployment(row,selected,team,await tx.now(),effectId);
 if((process.env.VERCEL_TEAM_ID??'')!==team)throw Error('platform_deployment_source_unavailable');return prepared;
}
export function matchesDeploymentSelection(plan:PlatformPlan,input:unknown){
 const selected=platformDeploymentSelection.parse(input);if(plan.effects.length!==1)return false;const e=plan.effects[0];if(e.kind!=='deployment.vercel'||!e.target.leadId||!e.target.leadRevision)return false;
 const normalized={leadId:e.target.leadId,projectName:e.target.projectName,environment:e.target.environment,expiresAt:new Date(plan.expiresAt).toISOString()};
 return sha256ContentHash(normalized)===sha256ContentHash({...selected,expiresAt:new Date(selected.expiresAt).toISOString()});
}

export async function readDeploymentPlatformSource(tx:PlatformTransaction,input:unknown,effectId:string){
 const selected=platformDeploymentSelection.omit({expiresAt:true}).parse(input),team=process.env.VERCEL_TEAM_ID??'';
 if(!tx.readDeploymentSource)throw Error('platform_deployment_source_unavailable');
 const source=preparePlatformLeadDeploymentSource(await tx.readDeploymentSource(selected.leadId),selected,team,await tx.now(),effectId);
 if((process.env.VERCEL_TEAM_ID??'')!==team)throw Error('platform_deployment_source_unavailable');return source;
}
