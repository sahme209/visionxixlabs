import {customerProfile,hash} from "./customerPlanFixtures";
export function authorityFixture(){
 const profile=customerProfile(),now=new Date("2026-10-18T12:00:00Z"),principal={organizationId:"org-owned",userId:"user-owned",sessionId:"session-owned"};
 const intake={id:"request-owned",tenantId:"org-owned",title:"Owned configuration review",serviceImpactingNow:false,requestClass:"planned_release",windowStartUtc:"2026-10-19T12:00:00.000Z",windowEndUtc:"2026-10-19T13:00:00.000Z",displayTimeZone:"UTC",changeTypes:["infrastructure_change"],applications:["owned"],clients:["owned"],deploymentContact:"owner@example.test",repositoryUrls:["https://github.com/owned/infra"],productionPrUrls:[],noPrRequired:true,prApprovalStatus:"not_applicable",sourceBranch:"main",targetBranch:"main",deploymentMethod:"manual",workflowName:"plan",targetEnvironment:"Production",workflowInputs:{},manualSteps:[],lowerEnvironmentTested:[],lowerEnvironmentValidation:"not_applicable",developmentReady:true,productionReady:true,validationSteps:[],expectedProductionResult:"Review evidence only",validationOwner:"shared",rollbackAvailability:"not_applicable",rollbackSteps:[],backupRequired:false,backupEvidenceIds:[],changeCreationMethod:"not_applicable",applicationContact:"owner@example.test",escalationContact:"owner@example.test",facts:[]};
 const stamp=new Date("2026-10-18T11:00:00Z");
 const rows={
  device:{id:principal.sessionId,organizationId:principal.organizationId,userId:principal.userId,deviceFingerprint:"owned-device",expiresAt:new Date("2026-10-19T12:00:00Z"),revokedAt:null as Date|null},
  membership:{userId:principal.userId,organizationId:principal.organizationId,role:"admin",acceptedAt:stamp as Date|null,updatedAt:stamp},
  request:{id:profile.deploymentRequestId,organizationId:profile.organizationId,version:1,intakeJson:intake},
  version:{organizationId:profile.organizationId,deploymentRequestId:profile.deploymentRequestId,version:1,intakeJson:structuredClone(intake),contentHash:hash(intake)},
  environment:{id:profile.environmentId,organizationId:profile.organizationId,slug:"production",name:"Production",approvalPolicyId:null as string|null,updatedAt:stamp},
  policy:null as null|{id:string;organizationId:string;enabled:boolean;blockAction:boolean;updatedAt:Date},
  repository:{id:profile.repository.recordId,organizationId:profile.organizationId,provider:"github",remoteOwner:"owned",remoteName:"infra",remoteUrl:"https://github.com/owned/infra.git",updatedAt:stamp},
  installation:{id:"installation-owned",organizationId:profile.organizationId,githubInstallationId:"456",accountLogin:"owned",status:"active",revokedAt:null as Date|null,suspendedAt:null as Date|null,updatedAt:stamp},
  account:{id:profile.connection.id,organizationId:profile.organizationId,provider:"aws",externalAccountId:profile.backend.accountId,credentialRef:`cloud-v2:${profile.connection.id}`,regions:[profile.backend.region],enabled:false,autopilotMode:"observe_only",updatedAt:stamp},
  credential:{id:profile.connection.id,organizationId:profile.organizationId,version:3,revokedAt:null as Date|null},
 };
 return {profile,rows,principal,now};
}
