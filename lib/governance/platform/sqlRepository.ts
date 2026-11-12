import {createDeploymentLiabilitySql} from './deploymentLiabilitySql';
import {readDeploymentRequestReceipt} from './deploymentLiability';
import type {CustodianClosureTransaction} from './operations/custodianClosureSnapshot';
import type {CustodianIntentTransaction} from './operations/custodianIntentAdmission';
import {createCustodianDrainSqlMethods,custodianEventDetail} from './operations/custodianDrainSql';
import type {CustodianDrainTransaction} from './operations/custodianDrainStore';
import {compileOperationalEcsPlan,type EcsPreparationTransaction} from './operations/ecsPreparation';
import {readOperationalEcsResult} from './operations/ecsExecution';
import {readOperationalManifest} from './operations/kernel';
import {compileOperationalSettingsPlan} from './operations/settingsArtifact';
import {readSettingsResult} from './operations/settingsResult';
import {z} from 'zod';
import {nativeSettingsTargetKey} from './operations/settingsReservation';
import type {SettingsArtifactTransaction} from './operations/settingsArtifactStore';
import {settingsArtifactBindingSchema} from './operations/settingsArtifact';
import {operationalArtifactId} from './operations/contracts';
import 'server-only';
import {readPlatformDeletionSource} from '@/lib/growth/linkedin/platformDeletionSource';
import {randomUUID} from 'node:crypto';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {digest,platformPrincipalSchema} from './contracts';
import {operationalEvidenceId} from './operations/contracts';
import {readOperationalTarget,readOperationalTargetReceipt} from './operations/reservationContract';
import {readOperationalDelegation,type OperationalDelegationRepository,type OperationalDelegationTransaction} from './operations/delegationContract';
import {readPlatformAction} from './kernel';
export interface PlatformSql{
 $queryRawUnsafe<T=unknown>(sql:string,...values:unknown[]):Promise<T>;
 $executeRawUnsafe(sql:string,...values:unknown[]):Promise<number>;
}
export interface PlatformSqlDatabase{$transaction<T>(fn:(tx:PlatformSql)=>Promise<T>,options:{isolationLevel:'ReadCommitted';timeout:number;maxWait:number}):Promise<T>}
const fail=():never=>{throw Error('platform_governance_storage_unavailable')};
/** Dedicated platform tables, never a tenant alias. All values parameterized.
 * No retry; uncertain transaction outcomes cannot issue a send proof. */
export function createPlatformSqlRepository(db:PlatformSqlDatabase):{transaction<T>(fn:(tx:OperationalDelegationTransaction & SettingsArtifactTransaction & EcsPreparationTransaction & CustodianDrainTransaction & CustodianIntentTransaction & CustodianClosureTransaction)=>Promise<T>):Promise<T>}{
 return {transaction:fn=>db.$transaction(async sql=>{
  let locked:string|null=null,nativeLocked:string|null=null;
  const check=(id:string)=>{if(locked!==id)fail()};
  const tx:OperationalDelegationTransaction & SettingsArtifactTransaction & EcsPreparationTransaction & CustodianDrainTransaction & CustodianIntentTransaction & CustodianClosureTransaction={
   ...createCustodianDrainSqlMethods(sql,()=>tx,check),
   ...createDeploymentLiabilitySql(sql,()=>locked),
   async readEcsManifest(id){check(id);const rows=await sql.$queryRawUnsafe<Array<{manifest:unknown}>>('SELECT "detailJson"->\'ecsManifest\' AS manifest FROM "PlatformGovernanceEvent" WHERE "actionId"=$1 AND kind=\'proposed\' AND "detailJson" ? \'ecsManifest\' ORDER BY sequence LIMIT 2',id);if(rows.length!==1)fail();const manifest=readOperationalManifest(rows[0].manifest),parent=readPlatformAction(await tx.read(id));if(manifest.kind!=='deployment.ecs'||compileOperationalEcsPlan(manifest).digest!==parent.plan.digest)fail();return manifest},
   async readSettingsManifest(id){check(id);const rows=await sql.$queryRawUnsafe<Array<{manifest:unknown}>>('SELECT "detailJson"->\'settingsManifest\' AS manifest FROM "PlatformGovernanceEvent" WHERE "actionId"=$1 AND kind=\'proposed\' AND "detailJson" ? \'settingsManifest\' ORDER BY sequence LIMIT 2',id);if(rows.length!==1)fail();const manifest=readOperationalManifest(rows[0].manifest),parent=readPlatformAction(await tx.read(id));if(manifest.kind!=='settings.vercel'||compileOperationalSettingsPlan(manifest).digest!==parent.plan.digest)fail();return manifest},
   async readSettingsResults(id){check(id);const rows=await sql.$queryRawUnsafe<Array<{result:unknown}>>('SELECT "detailJson"->\'settingsResult\' AS result FROM "PlatformGovernanceEvent" WHERE "actionId"=$1 AND kind=\'effect.observed\' AND "detailJson" ? \'settingsResult\' ORDER BY sequence LIMIT 33',id);if(rows.length>32)fail();return rows.map(row=>{const result=readSettingsResult(row.result);if(result.actionId!==id)fail();return result})},
   async assertSettingsCreationHeld(raw){const binding=settingsArtifactBindingSchema.parse(raw);check(binding.actionId);const {projectId,teamId,name,environment}=binding.target,key=nativeSettingsTargetKey({projectId,teamId,name,environment});const rows=await sql.$queryRawUnsafe<Array<{publicationKey:string;status:string}>>('SELECT "publicationKey",status FROM "PlatformGovernanceEffect" WHERE "actionId"=$1 AND index=$2',binding.actionId,binding.effectIndex);if(rows.length!==1||rows[0].publicationKey!==key||rows[0].status!=='claimed')fail()},
   async reserveSettingsCreation(raw){
    const binding=settingsArtifactBindingSchema.parse(raw);check(binding.actionId);const parent=readPlatformAction(await tx.read(binding.actionId)),effect=parent.plan.effects[binding.effectIndex];
    if(parent.status!=='claimed'||parent.plan.digest!==binding.planDigest||parent.plan.sourceDigest!==binding.manifestDigest||!effect||effect.kind!=='settings.vercel'||effect.id!==binding.effectId||effect.target.projectId!==binding.target.projectId||parent.requester.userId!==binding.creator.userId||parent.requester.sessionId!==binding.creator.sessionId)fail();
    const saved=await tx.readSettingsArtifact(binding.artifactId);if(!saved||sha256ContentHash(z.object({binding:settingsArtifactBindingSchema}).parse(saved).binding)!==sha256ContentHash(binding))fail();
    const {projectId,teamId,name,environment}=binding.target,key=nativeSettingsTargetKey({projectId,teamId,name,environment});
    const count=await sql.$executeRawUnsafe('UPDATE "PlatformGovernanceEffect" SET "publicationKey"=$1 WHERE "actionId"=$2 AND index=$3 AND status=$4 AND "publicationKey" IS NULL',key,binding.actionId,binding.effectIndex,'claimed');if(count!==1)fail();return key;
   },
   async readSettingsArtifact(id){if(!locked)fail();operationalArtifactId.parse(id);const rows=await sql.$queryRawUnsafe<Array<{actionId:string;effectIndex:number;bindingJson:unknown;envelope:string;createdAtMs:number}>>('SELECT "actionId","effectIndex","bindingJson",envelope,"createdAtMs" FROM "PlatformSettingsArtifact" WHERE id=$1',id);if(!rows.length)return null;if(rows.length!==1)fail();const row=rows[0],binding=settingsArtifactBindingSchema.parse(row.bindingJson);check(binding.actionId);if(binding.artifactId!==id||row.actionId!==binding.actionId||row.effectIndex!==binding.effectIndex||!Number.isSafeInteger(row.createdAtMs)||typeof row.envelope!=='string')fail();return {binding,envelope:row.envelope,createdAt:row.createdAtMs}},
   async insertSettingsArtifact(id,row){const binding=settingsArtifactBindingSchema.parse(row.binding);check(binding.actionId);if(binding.artifactId!==id||!Number.isSafeInteger(row.createdAt)||row.createdAt>=Date.parse(binding.expiresAt)||typeof row.envelope!=='string'||row.envelope.length>87423||!/^v2\.[A-Za-z0-9_-]+$/.test(row.envelope))fail();const parent=readPlatformAction(await tx.read(binding.actionId));if(parent.status!=='proposed'||parent.plan.digest!==binding.planDigest||parent.requester.userId!==binding.creator.userId||parent.requester.sessionId!==binding.creator.sessionId)fail();await sql.$executeRawUnsafe('INSERT INTO "PlatformSettingsArtifact" (id,"actionId","effectIndex","bindingJson",envelope,"createdAtMs") VALUES ($1,$2,$3,$4::jsonb,$5,$6)',id,binding.actionId,binding.effectIndex,JSON.stringify(binding),row.envelope,row.createdAt)},
   async readOperationalFailureReceipt(id,generation){check(id);if(!nativeLocked||!Number.isSafeInteger(generation)||generation<1)fail();const rows=await sql.$queryRawUnsafe<Array<{id:string;receiptJson:unknown;receiptDigest:string;nativeKey:string;generation:number;actionId:string}>>('SELECT id,"receiptJson","receiptDigest","nativeKey",generation,"actionId" FROM "PlatformOperationalTargetReceipt" WHERE "nativeKey"=$1 AND generation=$2 AND "actionId"=$3 AND "receiptJson"->>\'kind\'=\'terminal_failure\' LIMIT 2',nativeLocked,generation,id);if(rows.length>1)fail();if(!rows.length)return null;const row=rows[0],receipt=readOperationalTargetReceipt(row.receiptJson);if(row.id!==receipt.receiptId||row.nativeKey!==nativeLocked||row.generation!==generation||row.actionId!==id||receipt.kind!=='terminal_failure'||receipt.actionId!==id||receipt.generation!==generation||receipt.nativeKey!==nativeLocked||receipt.receiptDigest!==row.receiptDigest)fail();return receipt},
   async readOperationalStabilityEvent(id){check(id);const rows=await sql.$queryRawUnsafe<Array<{detail:unknown}>>('SELECT "detailJson" AS detail FROM "PlatformGovernanceEvent" WHERE "actionId"=$1 AND kind=\'workload.stable_observed\' ORDER BY sequence LIMIT 2',id);if(rows.length>1)fail();return rows[0]?.detail??null},
   async readOperationalEcsResult(id){check(id);const rows=await sql.$queryRawUnsafe<Array<{result:unknown}>>('SELECT "detailJson"->\'operationalResult\' AS result FROM "PlatformGovernanceEvent" WHERE "actionId"=$1 AND kind=\'effect.observed\' AND "detailJson" ? \'operationalResult\' ORDER BY sequence LIMIT 2',id);if(rows.length!==1)fail();const result=readOperationalEcsResult(rows[0].result);if(result.actionId!==id)fail();return result},
   async lockOperationalTarget(key){if(!locked)fail();digest.parse(key);if(nativeLocked!==null){if(nativeLocked!==key)fail();return}await sql.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))','axiom-platform-ecs-target:'+key);nativeLocked=key},
   async readOperationalCredentialLiability(id){if(!locked||!nativeLocked)return fail();const key=nativeLocked;const rows=await sql.$queryRawUnsafe<Array<{stateJson:unknown;manifestDigest:string;parentPlanDigest:string;version:number}>>('SELECT "stateJson","manifestDigest","parentPlanDigest",version FROM "PlatformOperationalDelegation" WHERE "actionId"=$1 FOR SHARE',id);if(rows.length!==1)fail();const state=readOperationalDelegation(rows[0].stateJson);if(state.actionId!==id||state.manifest.digest!==rows[0].manifestDigest||state.parentPlanDigest!==rows[0].parentPlanDigest||state.version!==rows[0].version||state.targetReservation?.nativeKey!==key)fail();const target=await tx.readOperationalTarget(key);if(!target)fail();const checked=readOperationalTarget(target);if(checked.actionId!==id||checked.generation!==state.targetReservation?.generation)fail();return state.credential},
   async readOperationalTarget(key){if(nativeLocked!==key)fail();const rows=await sql.$queryRawUnsafe<Array<{stateJson:unknown;generation:number;version:number;actionId:string}>>('SELECT "stateJson",generation,version,"actionId" FROM "PlatformOperationalTarget" WHERE "nativeKey"=$1',key);if(!rows.length)return null;if(rows.length!==1)fail();const state=readOperationalTarget(rows[0].stateJson);if(state.nativeKey!==key||state.version!==rows[0].version||state.generation!==rows[0].generation||state.actionId!==rows[0].actionId)fail();return state},
   async insertOperationalTarget(key,raw){if(nativeLocked!==key)fail();const state=readOperationalTarget(raw);check(state.actionId);if(state.nativeKey!==key||state.generation!==1||state.version!==0||state.phase!=='reserved')fail();await sql.$executeRawUnsafe('INSERT INTO "PlatformOperationalTarget" ("nativeKey","actionId",generation,version,"stateJson","updatedAt") VALUES ($1,$2,$3,$4,$5::jsonb,clock_timestamp())',key,state.actionId,state.generation,state.version,JSON.stringify(state))},
   async replaceOperationalTarget(key,version,raw){if(nativeLocked!==key)fail();const state=readOperationalTarget(raw);check(state.actionId);if(state.nativeKey!==key||state.version!==version+1)fail();const count=await sql.$executeRawUnsafe('UPDATE "PlatformOperationalTarget" SET "actionId"=$1,generation=$2,version=$3,"stateJson"=$4::jsonb,"updatedAt"=clock_timestamp() WHERE "nativeKey"=$5 AND version=$6',state.actionId,state.generation,state.version,JSON.stringify(state),key,version);if(count!==1)fail()},
   async readOperationalTargetReceipt(id){if(!nativeLocked)fail();operationalEvidenceId.parse(id);const rows=await sql.$queryRawUnsafe<Array<{receiptJson:unknown;receiptDigest:string;nativeKey:string}>>('SELECT "receiptJson","receiptDigest","nativeKey" FROM "PlatformOperationalTargetReceipt" WHERE id=$1',id);if(!rows.length)return null;if(rows.length!==1)fail();const receipt=readOperationalTargetReceipt(rows[0].receiptJson);if(receipt.nativeKey!==nativeLocked||rows[0].nativeKey!==nativeLocked||receipt.receiptId!==id||receipt.receiptDigest!==rows[0].receiptDigest)fail();return receipt},
   async insertOperationalTargetReceipt(raw){const receipt=readOperationalTargetReceipt(raw);check(receipt.actionId);if(nativeLocked!==receipt.nativeKey)fail();await sql.$executeRawUnsafe('INSERT INTO "PlatformOperationalTargetReceipt" (id,"nativeKey",generation,"actionId","receiptDigest","receiptJson") VALUES ($1,$2,$3,$4,$5,$6::jsonb)',receipt.receiptId,receipt.nativeKey,receipt.generation,receipt.actionId,receipt.receiptDigest,JSON.stringify(receipt))},
   async readDelegation(id){check(id);const rows=await sql.$queryRawUnsafe<Array<{stateJson:unknown;manifestDigest:string;parentPlanDigest:string;version:number}>>('SELECT "stateJson","manifestDigest","parentPlanDigest",version FROM "PlatformOperationalDelegation" WHERE "actionId"=$1',id);
    if(!rows.length)return null;if(rows.length!==1)fail();const state=readOperationalDelegation(rows[0].stateJson);if(state.actionId!==id||state.manifest.digest!==rows[0].manifestDigest||state.parentPlanDigest!==rows[0].parentPlanDigest||state.version!==rows[0].version)fail();return state},
   async insertDelegation(id,raw){check(id);const state=readOperationalDelegation(raw);if(state.actionId!==id||state.version!==0)fail();await sql.$executeRawUnsafe('INSERT INTO "PlatformOperationalDelegation" ("actionId","manifestDigest","parentPlanDigest","stateJson",version,"updatedAt") VALUES ($1,$2,$3,$4::jsonb,$5,clock_timestamp())',id,state.manifest.digest,state.parentPlanDigest,JSON.stringify(state),state.version)},
   async writeOperationalSourceCredential(id,version,raw){check(id);const previous=readOperationalDelegation(await tx.readDelegation(id)),next=readOperationalDelegation(raw);if(previous.version!==version||next.version!==version||previous.sourceCredential?.status!=='pending'||next.sourceCredential?.status!=='issued'||previous.credential.status!=='pending'||next.updatedAt<previous.updatedAt)fail();const {sourceCredential:oldSource,updatedAt:oldAt,...oldFields}=previous,{sourceCredential:newSource,updatedAt:newAt,...newFields}=next;if(sha256ContentHash(oldFields)!==sha256ContentHash(newFields)||newSource?.requestedAt!==oldSource?.requestedAt)fail();const count=await sql.$executeRawUnsafe('UPDATE "PlatformOperationalDelegation" SET "stateJson"=$1::jsonb,"updatedAt"=clock_timestamp() WHERE "actionId"=$2 AND version=$3 AND "stateJson"=$4::jsonb',JSON.stringify(next),id,version,JSON.stringify(previous));if(count!==1)fail()},
   async replaceDelegation(id,version,raw){check(id);const state=readOperationalDelegation(raw);if(state.actionId!==id||state.version!==version+1)fail();const count=await sql.$executeRawUnsafe('UPDATE "PlatformOperationalDelegation" SET "stateJson"=$1::jsonb,version=$2,"updatedAt"=clock_timestamp() WHERE "actionId"=$3 AND version=$4 AND "manifestDigest"=$5 AND "parentPlanDigest"=$6',JSON.stringify(state),state.version,id,version,state.manifest.digest,state.parentPlanDigest);if(count!==1)fail()},
   async reserveWorkloadIdentity(key,id,manifestDigest){check(id);digest.parse(key);digest.parse(manifestDigest);const state=await tx.readDelegation(id);if(!state)fail();const checked=readOperationalDelegation(state);if(checked.status!=='delegated'||checked.version!==0||checked.manifest.digest!==manifestDigest)fail();await sql.$executeRawUnsafe('INSERT INTO "PlatformOperationalWorkloadUse" ("replayKey","actionId","manifestDigest") VALUES ($1,$2,$3)',key,id,manifestDigest)},
   async readDeploymentSource(leadId){
    if(!locked)fail();const rows=await sql.$queryRawUnsafe<unknown[]>('SELECT id,"updatedAt","fullPayload"->\'aiPackage\' AS "aiPackage" FROM "Lead" WHERE id=$1 FOR SHARE',leadId);
    if(rows.length!==1)fail();return rows[0];
   },
   async readSourcePage(kind,cursor){
    check('platform-source-directory');
    if(kind==='drafts')return sql.$queryRawUnsafe('SELECT id,left(title,240) AS label,(char_length(title)>240) AS "labelTruncated",status,"updatedAt" FROM "LinkedInPostDraft" WHERE ($1::text IS NULL OR id<$1::text) ORDER BY id DESC LIMIT 21',cursor);
    if(kind==='leads')return sql.$queryRawUnsafe(`SELECT id,left(CASE WHEN jsonb_typeof("fullPayload"->'aiPackage'->'companyName')='string' THEN "fullPayload"->'aiPackage'->>'companyName' ELSE 'Lead record' END,240) AS label,(CASE WHEN jsonb_typeof("fullPayload"->'aiPackage'->'companyName')='string' THEN char_length("fullPayload"->'aiPackage'->>'companyName')>240 ELSE false END) AS "labelTruncated",status,"updatedAt",COALESCE(jsonb_typeof("fullPayload"->'aiPackage')='object',false) AS "hasSavedPackage" FROM "Lead" WHERE ($1::text IS NULL OR id<$1::text) ORDER BY id DESC LIMIT 21`,cursor);
    if(kind==='accounts')return sql.$queryRawUnsafe('SELECT id,left(COALESCE("linkedinName",\'LinkedIn account\'),240) AS label,(char_length(COALESCE("linkedinName",\'LinkedIn account\'))>240) AS "labelTruncated",COALESCE("organizationUrn","linkedinUrn") AS author,status,"updatedAt","expiresAt" FROM "LinkedInAccountConnection" WHERE ($1::text IS NULL OR id<$1::text) ORDER BY id DESC LIMIT 21',cursor);
    return fail();
   },
   async readActionPage(cursor){
    check('platform-history-directory');
    return cursor?sql.$queryRawUnsafe('SELECT id,"createdAt","stateJson","planDigest",version FROM "PlatformGovernanceAction" WHERE ("createdAt",id)<($1::timestamp,$2::text) ORDER BY "createdAt" DESC,id DESC LIMIT 21',new Date(cursor.createdAt),cursor.actionId):sql.$queryRawUnsafe('SELECT id,"createdAt","stateJson","planDigest",version FROM "PlatformGovernanceAction" ORDER BY "createdAt" DESC,id DESC LIMIT 21');
   },
   async readGrowthDeletionSource(draftId,connectionId){if(!locked)fail();return readPlatformDeletionSource(sql,draftId,connectionId)},
   async readGrowthPostingSource(draftId,connectionId){
    if(!locked)fail();
    const drafts=await sql.$queryRawUnsafe<unknown[]>('SELECT id,title,hook,body,cta,hashtags,"imageUrn",status,"scheduledFor","updatedAt" FROM "LinkedInPostDraft" WHERE id=$1 FOR SHARE',draftId);
    const connections=await sql.$queryRawUnsafe<unknown[]>('SELECT id,"linkedinUrn","organizationUrn",scopes,status,"expiresAt","updatedAt" FROM "LinkedInAccountConnection" WHERE id=$1 FOR SHARE',connectionId);
    if(drafts.length!==1||connections.length!==1)fail();return {draft:drafts[0],connection:connections[0]};
   },
   ...createPlatformIdentitySqlReader(sql,()=>{if(!locked)fail()}),
   async lock(id){if(locked!==null)fail();await sql.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))','axiom-platform-governance:'+id);locked=id},
   async now(){if(!locked)fail();const rows=await sql.$queryRawUnsafe<Array<{now:number}>>('SELECT floor(extract(epoch FROM clock_timestamp())*1000)::double precision AS now');if(rows.length!==1||!Number.isSafeInteger(rows[0].now))fail();return rows[0].now},
   async read(id){check(id);const rows=await sql.$queryRawUnsafe<Array<{stateJson:unknown;planDigest:string;version:number}>>('SELECT "stateJson","planDigest",version FROM "PlatformGovernanceAction" WHERE id=$1',id);
    if(!rows.length)return null;if(rows.length!==1)fail();const state=readPlatformAction(rows[0].stateJson);if(state.plan.digest!==rows[0].planDigest||state.version!==rows[0].version)fail();return state},
   async insert(id,raw){check(id);const state=readPlatformAction(raw);await sql.$executeRawUnsafe('INSERT INTO "PlatformGovernanceAction" (id,"planDigest","stateJson",version,"updatedAt") VALUES ($1,$2,$3::jsonb,$4,clock_timestamp())',id,state.plan.digest,JSON.stringify(state),state.version)},
   async replace(id,version,raw){check(id);const state=readPlatformAction(raw);if(state.version!==version+1)fail();
    const count=await sql.$executeRawUnsafe('UPDATE "PlatformGovernanceAction" SET "stateJson"=$1::jsonb,version=$2,"updatedAt"=clock_timestamp() WHERE id=$3 AND version=$4 AND "planDigest"=$5',JSON.stringify(state),state.version,id,version,state.plan.digest);if(count!==1)fail()},
   async event(event){check(event.actionId);readPlatformAction(event.state);
    const custodianDetail=await custodianEventDetail(tx,event);
    const sequence=await sql.$queryRawUnsafe<Array<{next:number}>>('SELECT COALESCE(max(sequence),-1)+1 AS next FROM "PlatformGovernanceEvent" WHERE "actionId"=$1',event.actionId);
    if(sequence.length!==1||!Number.isSafeInteger(sequence[0].next)||sequence[0].next<0||sequence[0].next>1000)fail();
    if(event.operationalDigest!==undefined)digest.parse(event.operationalDigest);
    if(event.kind==='workload.stable_observed'){
     platformPrincipalSchema.shape.userId.parse(event.operationalObserverUserId);operationalEvidenceId.parse(event.operationalStabilityReceiptId);digest.parse(event.operationalCommandReceiptDigest);
     if(event.state.status!=='confirmed'||event.state.plan.effects.length!==1||event.state.plan.effects[0].kind!=='deployment.ecs')fail();
     const native=readOperationalTargetReceipt(await tx.readOperationalTargetReceipt(event.operationalStabilityReceiptId!)),original=readOperationalEcsResult(await tx.readOperationalEcsResult(event.actionId));
     if(native.kind!=='stable'||native.actionId!==event.actionId||native.manifestDigest!==event.state.plan.sourceDigest||original.kind!=='accepted'||original.receiptDigest!==event.operationalCommandReceiptDigest||original.nativeKey!==native.nativeKey||original.generation!==native.generation||original.deploymentId!==('deploymentId' in native.detail?native.detail.deploymentId:null))fail();
    }else if(event.operationalStabilityReceiptId!==undefined||event.operationalCommandReceiptDigest!==undefined||event.operationalObserverUserId!==undefined)fail();
    const operationalResult=event.operationalResult===undefined?undefined:readOperationalEcsResult(event.operationalResult);
    if(operationalResult){if(event.kind!=='effect.observed'||event.effectIndex!==0||operationalResult.actionId!==event.actionId||operationalResult.manifestDigest!==event.state.plan.sourceDigest||event.outcome!==(operationalResult.kind==='accepted'?'confirmed':'unknown'))fail();const record=readOperationalDelegation(await tx.readDelegation(event.actionId));if(record.credential.status!=='issued'||record.credential.leaseRef!==operationalResult.leaseRef||record.targetReservation?.nativeKey!==operationalResult.nativeKey||record.targetReservation.generation!==operationalResult.generation)fail()}
    const ecsManifest=event.ecsManifest===undefined?undefined:readOperationalManifest(event.ecsManifest);
    if(ecsManifest&&(event.kind!=='proposed'||event.state.status!=='proposed'||event.state.version!==0||ecsManifest.kind!=='deployment.ecs'||compileOperationalEcsPlan(ecsManifest).digest!==event.state.plan.digest||event.settingsManifest!==undefined))fail();
    const settingsManifest=event.settingsManifest===undefined?undefined:readOperationalManifest(event.settingsManifest);
    if(settingsManifest&&(event.kind!=='proposed'||event.state.status!=='proposed'||event.state.version!==0||settingsManifest.kind!=='settings.vercel'||compileOperationalSettingsPlan(settingsManifest).digest!==event.state.plan.digest))fail();
    const settingsResult=event.settingsResult===undefined?undefined:readSettingsResult(event.settingsResult);
    if(settingsResult&&(event.kind!=='effect.observed'||settingsResult.actionId!==event.actionId||settingsResult.effectIndex!==event.effectIndex||settingsResult.outcome!==event.outcome||settingsResult.planDigest!==event.state.plan.digest||settingsResult.manifestDigest!==event.state.plan.sourceDigest))fail();
    const deploymentReceipt=event.deploymentReceipt===undefined?undefined:readDeploymentRequestReceipt(event.deploymentReceipt);
    if(deploymentReceipt){if(event.kind!=='effect.observed'||deploymentReceipt.actionId!==event.actionId||deploymentReceipt.effectIndex!==event.effectIndex||deploymentReceipt.planDigest!==event.state.plan.digest||deploymentReceipt.sourceDigest!==event.state.plan.sourceDigest||event.outcome!==(deploymentReceipt.outcome==='accepted'?'confirmed':deploymentReceipt.outcome))fail();const saved=await tx.readDeploymentRequestReceipts?.(event.actionId);if(!saved?.some(r=>r.receiptDigest===deploymentReceipt.receiptDigest))fail()}
    const detail={...(event.kind==='proposed'&&event.state.plan.effects.some(e=>e.kind==='deployment.vercel')?{deploymentTracking:'platform_deployment_liability_v1'}:{}),...(deploymentReceipt===undefined?{}:{deploymentReceipt}),...custodianDetail,...(event.kind==='workload.stable_observed'?{operationalObserverUserId:event.operationalObserverUserId,operationalStabilityReceiptId:event.operationalStabilityReceiptId,operationalCommandReceiptDigest:event.operationalCommandReceiptDigest}:{}),...(ecsManifest===undefined?{}:{ecsManifest}),...(operationalResult===undefined?{}:{operationalResult}),...(settingsManifest===undefined?{}:{settingsManifest}),...(settingsResult===undefined?{}:{settingsResult}),...(event.operationalDigest===undefined?{}:{operationalDigest:event.operationalDigest}),planDigest:event.state.plan.digest,stateDigest:sha256ContentHash(event.state),status:event.state.status,attemptCount:event.state.attemptCount,...(event.effectIndex===undefined?{}:{effectIndex:event.effectIndex}),...(event.outcome?{outcome:event.outcome}:{})};
    await sql.$executeRawUnsafe('INSERT INTO "PlatformGovernanceEvent" (id,"actionId",sequence,kind,"detailJson") VALUES ($1,$2,$3,$4,$5::jsonb)',randomUUID(),event.actionId,sequence[0].next,event.kind,JSON.stringify(detail));
   },
   async reservePostDeletion(id,index,postUrn){
    check(id);if(!Number.isSafeInteger(index)||index<0||index>31||!/^urn:li:(share|ugcPost):[A-Za-z0-9_-]+$/.test(postUrn))fail();
    const key=sha256ContentHash({kind:'growth.post.delete',postUrn});
    const count=await sql.$executeRawUnsafe('UPDATE "PlatformGovernanceEffect" SET "publicationKey"=$1 WHERE "actionId"=$2 AND index=$3 AND status=$4 AND "publicationKey" IS NULL',key,id,index,'claimed');
    if(count!==1)fail();
   },
   async reservePublication(id,index,draftId){
    check(id);if(!Number.isSafeInteger(index)||index<0||index>31||typeof draftId!=='string'||!draftId.length||draftId.length>256)fail();
    const key=sha256ContentHash({kind:'growth.post.publish',draftId});
    const count=await sql.$executeRawUnsafe('UPDATE "PlatformGovernanceEffect" SET "publicationKey"=$1 WHERE "actionId"=$2 AND index=$3 AND status=$4 AND "publicationKey" IS NULL',key,id,index,'claimed');
    if(count!==1)fail();
   },
   async readEffect(id,index){check(id);if(!Number.isSafeInteger(index)||index<0||index>31)fail();const rows=await sql.$queryRawUnsafe<Array<{status:string}>>('SELECT status FROM "PlatformGovernanceEffect" WHERE "actionId"=$1 AND index=$2',id,index);
    if(!rows.length)return null;if(rows.length!==1||!['claimed','confirmed','refused','unknown'].includes(rows[0].status))fail();return rows[0].status},
   async writeEffect(id,index,expected,status){check(id);if(!Number.isSafeInteger(index)||index<0||index>31||!['claimed','confirmed','refused','unknown'].includes(status))fail();
    if(expected===null){if(status!=='claimed')fail();await sql.$executeRawUnsafe('INSERT INTO "PlatformGovernanceEffect" ("actionId",index,status) VALUES ($1,$2,$3)',id,index,status)}
    else{if(expected!=='claimed'||status==='claimed')fail();const count=await sql.$executeRawUnsafe('UPDATE "PlatformGovernanceEffect" SET status=$1 WHERE "actionId"=$2 AND index=$3 AND status=$4',status,id,index,expected);if(count!==1)fail()}
   },
  };
  return fn(tx);
 },{isolationLevel:'ReadCommitted',timeout:10000,maxWait:5000})};
}

/** Shared current-identity SQL only; every consumer must hold its transaction lock. */
export function createPlatformIdentitySqlReader(sql:PlatformSql,assertLocked:()=>void){return {
   async readSessionPrincipal(sessionId:string){
    assertLocked();
    const rows=await sql.$queryRawUnsafe<Array<{userId:string;sessionId:string}>>('SELECT u.id AS "userId", s.id AS "sessionId" FROM "DesktopSessionRecord" s JOIN "User" u ON u.id=s."userId" WHERE s.id=$1 FOR SHARE OF s,u',sessionId);
    if(rows.length!==1)fail();return rows[0];
   },
   async readPrincipal(principal:import('./contracts').PlatformPrincipal){
    assertLocked();
    const rows=await sql.$queryRawUnsafe<Array<{userId:string;sessionId:string;email:string;live:boolean}>>('SELECT u.id AS "userId", s.id AS "sessionId", u.email, (s."revokedAt" IS NULL AND s."issuedAt" <= clock_timestamp() AND s."expiresAt" > clock_timestamp() AND m."acceptedAt" IS NOT NULL) AS live FROM "DesktopSessionRecord" s JOIN "User" u ON u.id=s."userId" JOIN "OrgMembership" m ON m."userId"=s."userId" AND m."organizationId"=s."organizationId" WHERE s.id=$1 AND u.id=$2 FOR SHARE OF s,u,m',principal.sessionId,principal.userId);
    if(rows.length!==1)fail();return rows[0];
   },
 };}
