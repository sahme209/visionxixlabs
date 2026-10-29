import 'server-only';
export const RELEASE_ACCEPTANCE_REPOSITORY='sahme209/axiom-release-acceptance';
/** Explicit, default-off acceptance gate. It never enables customer repositories. */
export function releaseAcceptanceEnabled(organizationId?:string){const org=process.env.AXIOM_RELEASE_ACCEPTANCE_ORGANIZATION_ID;return process.env.AXIOM_RELEASE_ACCEPTANCE_ENABLED==='true'&&!!org&&/^[A-Za-z0-9_-]{1,160}$/.test(org)&&(!organizationId||organizationId===org)}
export function releaseAcceptancePlanAllowed(plan:{organizationId:string;repositoryFullName:string}){return releaseAcceptanceEnabled(plan.organizationId)&&plan.repositoryFullName===RELEASE_ACCEPTANCE_REPOSITORY}

import {parseDeploymentIntake} from '@/lib/tauri/deploymentIntakeSchema';
export async function releaseAcceptanceRequestAllowed(repo:{tauriDeploymentRequest:{findFirst:(args:unknown)=>Promise<unknown>}},organizationId:string,requestId:string){
 if(!releaseAcceptanceEnabled(organizationId))return false;
 const row=await repo.tauriDeploymentRequest.findFirst({where:{id:requestId,organizationId},select:{id:true,organizationId:true,intakeJson:true}});
 if(!row||typeof row!=='object'||!('id' in row)||row.id!==requestId||!('organizationId' in row)||row.organizationId!==organizationId||!('intakeJson' in row))return false;
 const p=parseDeploymentIntake(row.intakeJson);return p.ok&&p.intake.tenantId===organizationId&&p.intake.repositoryUrls.length===1&&p.intake.repositoryUrls[0]==='https://github.com/'+RELEASE_ACCEPTANCE_REPOSITORY&&p.intake.workflowSource?.repositoryFullName===RELEASE_ACCEPTANCE_REPOSITORY;
}
