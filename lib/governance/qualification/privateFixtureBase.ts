import 'server-only';
import type {PrismaClient,Prisma} from '@/lib/prismaClient';
import {generateKeyPairSync,randomUUID} from 'node:crypto';
import {createPrivateCredentialVault} from '@/lib/security/privateCredentialVault';
import {credentialContext} from '@/lib/connectors/github/platformGithubAppCredentialContext';
import {buildFixedFixtureScenarioInputs} from './fixtureScenarioInputs';
import {FIXTURE_CASE_IDS,FIXTURE_TENANT} from './fixtureAuthorizationFrame';
export const FIXTURE_SCHEDULE_ID='qualification_fixture_schedule_v1';
/** Preboot fixed fixture data only. No approval, coverage pointer or execution claim. */
export async function prepareFixedFixtureBase(client:PrismaClient,vaultKey:Uint8Array,at:Date){
 if(!(vaultKey instanceof Uint8Array)||vaultKey.byteLength!==32||!Number.isFinite(at.getTime()))throw Error('fixed_fixture_unavailable');
 const inputs=buildFixedFixtureScenarioInputs(at,FIXTURE_CASE_IDS.map(()=>randomUUID()));
 const vault=createPrivateCredentialVault(vaultKey);
 const pair=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 await client.tenantBillingPlan.create({data:{organizationId:FIXTURE_TENANT,tier:'growth',status:'active',cancelAtPeriodEnd:false}});
 await client.platformGithubAppCredential.create({data:{id:'qualification_platform_app',singletonKey:'platform_github_app',appId:900,slug:'qualification',name:'Synthetic qualification',clientId:'qualification',encryptedClientSecret:vault.encryptScopedCredential('synthetic-unused-client',credentialContext('clientSecret')),encryptedWebhookSecret:vault.encryptScopedCredential('synthetic-unused-webhook',credentialContext('webhookSecret')),encryptedPrivateKey:vault.encryptScopedCredential(pair.privateKey,credentialContext('privateKey')),htmlUrl:'https://example.invalid/qualification',createdByUserId:'qualification_requester'}});
 for(const g of inputs.groups){await client.gitHubInstallation.create({data:{...g.connection,updatedAt:new Date(g.connection.updatedAt),installedByUserId:'qualification_requester'}});await client.tauriDeploymentRequest.create({data:{...g.request,intakeJson:g.request.intakeJson as unknown as Prisma.InputJsonValue,title:'Synthetic '+g.group+' qualification',correlationId:g.request.id,submittedAt:at}});}
 await client.durableAgentWorkflow.create({data:{id:FIXTURE_SCHEDULE_ID,organizationId:FIXTURE_TENANT,workflowKind:'qualification_fixture_schedule',objective:'Fixed simulated-review qualification schedule; not customer approval',status:'completed',autonomyLevel:'observe',currentStep:'base_inputs',inputJson:{...inputs,providerPublicKey:pair.publicKey} as unknown as Prisma.InputJsonValue,stateJson:{classification:'SIMULATED REVIEW AUTHORITY'},requestedByUserId:'qualification_requester',attemptCount:0,maxAttempts:1,version:0}});
 return inputs;
}
