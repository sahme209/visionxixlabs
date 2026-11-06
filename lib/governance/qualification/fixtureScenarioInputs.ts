import 'server-only';
import {z} from 'zod';
import type {DeploymentIntake} from '@/lib/tauri/deploymentOperations';
import {buildReleaseMergePlan} from '@/lib/tauri/releaseMergePlan';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {releaseOperationPlanId} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {FIXTURE_CASE_IDS,FIXTURE_TENANT} from './fixtureAuthorizationFrame';
export const FIXTURE_GROUPS=['enrolled','cancel','unknown','revoke-claim','revoke-await','revoke-send']as const;
export type FixtureGroup=typeof FIXTURE_GROUPS[number];
export const FIXTURE_CASE_GROUP:Readonly<Record<typeof FIXTURE_CASE_IDS[number],FixtureGroup>>=Object.freeze({read_execution:'enrolled',prepare_enrolled:'enrolled',execute_enrolled:'enrolled',cancel_prepared:'cancel',read_operation:'unknown',execute_unknown:'unknown',recover_unknown:'unknown',revoke_before_claim:'revoke-claim',revoke_after_await:'revoke-await',revoke_before_send:'revoke-send'});
export function fixtureRepository(group:FixtureGroup){return 'axiom-qualification/'+group;}
export function fixtureInstallation(group:FixtureGroup){return String(9000+FIXTURE_GROUPS.indexOf(group));}
export function fixtureSha(group:FixtureGroup,kind:'head'|'base'|'merged'){return (kind==='head'?'b':kind==='base'?'a':'e').repeat(39)+FIXTURE_GROUPS.indexOf(group).toString(16);}
function intakeTemplate():DeploymentIntake{return {
    id: "dep-demo-1",
    tenantId: "tenant-fictional",
    title: "Synthetic qualification merge",
    serviceImpactingNow: false,
    requestClass: "planned_release",
    windowStartUtc: "2026-10-10T18:00:00.000Z",
    windowEndUtc: "2026-10-10T20:00:00.000Z",
    displayTimeZone: "ET",
    changeTypes: ["configuration_change"],
    applications: ["Synthetic qualification"],
    clients: ["Fixture client"],
    deploymentContact: "requester@example.invalid",
    repositoryUrls: ["https://git.example.test/demo/checkout"],
    productionPrUrls: ["https://git.example.test/demo/checkout/pull/42"],
    noPrRequired: false,
    prApprovalStatus: "approved",
    sourceBranch: "release/demo",
    targetBranch: "main",
    deploymentMethod: "GitHub Actions Manual Workflow",
    workflowName: "Deploy Config",
    targetEnvironment: "Production",
    workflowInputs: { branch: "main", environment: "Production", client: "Fixture client" },
    manualSteps: [],
    lowerEnvironmentTested: ["Stage"],
    lowerEnvironmentValidation: "yes",
    developmentReady: true,
    productionReady: true,
    validationSteps: [{
      id: "validate-config",
      instruction: "Confirm the expected fictional configuration is present.",
      owner: "application_team",
      evidenceRequired: true,
      completed: false,
    }],
    expectedProductionResult: "The fictional configuration matches the approved pull request.",
    validationOwner: "shared",
    rollbackAvailability: "yes",
    rollbackSteps: [{
      id: "rollback",
      instruction: "Redeploy the prior known-good configuration.",
      owner: "devops",
      evidenceRequired: true,
      completed: false,
    }],
    rollbackOwner: "requester@example.invalid",
    backupRequired: false,
    backupEvidenceIds: [],
    changeCreationMethod: "manual_servicenow",
    applicationContact: "reviewer@example.invalid",
    escalationContact: "reviewer@example.invalid",
    facts: [{
      id: "fact-1",
      classification: "confirmed",
      value: "Publishing is manual.",
      sourceEvidenceId: "evidence-1",
      confirmedBy: "qualification_requester",
    }],
  };}
/** Data only; no DB, approval, credential, provider or executing authority. */
export function buildFixedFixtureScenarioInputs(capturedAt:Date,clientRequestIds:readonly string[]){
 if(!Number.isFinite(capturedAt.getTime())||clientRequestIds.length!==FIXTURE_CASE_IDS.length||new Set(clientRequestIds).size!==clientRequestIds.length)throw Error('fixed_fixture_scenario_inputs_invalid');for(const id of clientRequestIds)z.string().regex(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i).parse(id);
 const at=capturedAt.toISOString();const groups=FIXTURE_GROUPS.map(group=>{
  const requestId='qualification_'+group.replaceAll('-','_'),repository=fixtureRepository(group),connectionId='qualification_connection_'+group.replaceAll('-','_');
  const intake:DeploymentIntake={...intakeTemplate(),id:requestId,tenantId:FIXTURE_TENANT,title:'Synthetic '+group+' merge',windowStartUtc:new Date(capturedAt.getTime()-60000).toISOString(),windowEndUtc:new Date(capturedAt.getTime()+15*60000).toISOString(),repositoryUrls:['https://github.com/'+repository],productionPrUrls:['https://github.com/'+repository+'/pull/1'],sourceBranch:'feature',targetBranch:'main',targetEnvironment:'production'};
  const request={id:requestId,organizationId:FIXTURE_TENANT,requesterUserId:'qualification_requester',status:'submitted',version:1,intakeJson:intake};
  const built=buildReleaseMergePlan(request,{organizationId:FIXTURE_TENANT,requestId,expectedVersion:1,expectedDigest:sha256ContentHash({requestVersion:1,intake}),method:'squash',observation:{connectionId,connectionRevision:at,repositoryFullName:repository,number:1,headRepositoryFullName:repository,headRef:'feature',headSha:fixtureSha(group,'head'),baseRef:'main',baseSha:fixtureSha(group,'base'),state:'open',draft:false,merged:false}});
  if(!built.ok)throw Error('fixed_fixture_scenario_plan_invalid');return Object.freeze({group,request,connection:{id:connectionId,organizationId:FIXTURE_TENANT,githubInstallationId:fixtureInstallation(group),accountLogin:'axiom-qualification',accountType:'Organization',repositorySelection:'selected',status:'active',sourceFlow:'manual',updatedAt:at},plan:built.plan,planDigest:built.digest,planId:releaseOperationPlanId(FIXTURE_TENANT,requestId,1,built.digest)});
 });
 const scenarios=FIXTURE_CASE_IDS.map((caseId,index)=>{const group=groups.find(item=>item.group===FIXTURE_CASE_GROUP[caseId])!;return Object.freeze({caseId,requestId:group.request.id,planId:group.planId,expectedVersion:caseId==='recover_unknown'?2:0,clientRequestId:clientRequestIds[index]});});return Object.freeze({format:'axiom.fixed-fixture-scenario-inputs/1' as const,capturedAt:at,groups:Object.freeze(groups),scenarios:Object.freeze(scenarios)});
}
export type FixedFixtureScenarioInputs=ReturnType<typeof buildFixedFixtureScenarioInputs>;
