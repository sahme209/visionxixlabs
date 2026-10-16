import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
const root=dirname(dirname(fileURLToPath(import.meta.url)));
export function validateReviewRehearsalTarget(value) {
 let url;try{url=new URL(value);}catch{throw new Error("isolated_ecs_review_target_required");}
 if(!["postgres:","postgresql:"].includes(url.protocol)||url.hostname!=="127.0.0.1"||url.pathname!=="/axiom_ecs_review_rehearsal"||url.search||url.hash)throw new Error("isolated_ecs_review_target_required");
 return url.toString();
}
export async function rehearseReview(value) {
 const target=validateReviewRehearsalTarget(value),temp=mkdtempSync(join(tmpdir(),"axiom-ecs-review-"));
 const client=new PrismaClient({datasources:{db:{url:target}}});
 const sql=readFileSync(join(root,"prisma/migrations/20261016030000_ecs_release_review_core/migration.sql"),"utf8");
 const executeSql=(text)=>{const path=join(temp,"fixture.sql");writeFileSync(path,text);return spawnSync(process.execPath,[join(root,"node_modules/prisma/build/index.js"),"db","execute","--file",path,"--schema",join(root,"prisma/schema.prisma")],{cwd:root,env:{...process.env,DATABASE_URL:target,DIRECT_URL:target},encoding:"utf8"});};
 try {
  const existing=await client.$queryRawUnsafe("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'");assert.equal(existing[0].count,0,"initially_empty_fixture_required");
  assert.equal(executeSql(sql.replace(/COMMIT;\s*$/,"ROLLBACK;")).status,0);
  assert.equal((await client.$queryRawUnsafe("SELECT to_regclass('public.\"EcsReleaseReviewPacket\"') IS NULL AS absent"))[0].absent,true);
  assert.equal(executeSql(sql).status,0);assert.notEqual(executeSql(sql).status,0,"repeat_proposal_must_reject");
  // Synthetic pre-existing authority tables, not a production schema or data clone.
  assert.equal(executeSql('CREATE TABLE "OrgMembership" ("organizationId" text,"userId" text,"acceptedAt" timestamp(3),"role" text,PRIMARY KEY("userId","organizationId")); CREATE TABLE "Environment" ("id" text PRIMARY KEY,"organizationId" text,"approvalPolicyId" text,"updatedAt" timestamp(3)); CREATE TABLE "AxiomApprovalPolicy" ("id" text PRIMARY KEY,"organizationId" text,"enabled" boolean,"blockAction" boolean,"requiredApprovals" integer,"requiredRoles" text[],"updatedAt" timestamp(3));').status,0);
  // Compile only checked-in fixture/core TypeScript using the existing compiler.
  const require=createRequire(import.meta.url),ts=require("typescript"),priorLoader=require.extensions[".ts"];
  let harness;
  try {
   require.extensions[".ts"]=(module,path)=>module._compile(ts.transpileModule(readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,path);
   harness=require(join(root,"scripts/fixtures/ecsReviewHarness.ts"));
  } finally {if(priorLoader)require.extensions[".ts"]=priorLoader;else delete require.extensions[".ts"];}
  const {createReviewCore,postgresReviewStore,evidenceDigest,reviewManifest,reviewNow,syntheticReviewFacts,projectTargetSnapshot,reviewSnapshotRows,reviewSnapshotManifest}=harness;
  const policyTime=new Date("2026-10-16T10:00:00Z");
  await client.$executeRawUnsafe('INSERT INTO "AxiomApprovalPolicy" VALUES ($1,$2,true,false,2,ARRAY[\'admin\',\'owner\'],$3)',"policy","org-1",policyTime);
  await client.$executeRawUnsafe('INSERT INTO "Environment" VALUES ($1,$2,$3,$4)',"stage","org-1","policy",policyTime);
  for(const user of ["author","alice","bob"]) await client.$executeRawUnsafe('INSERT INTO "OrgMembership" VALUES ($1,$2,$3,$4)',"org-1",user,policyTime,"admin");
  const manifest=reviewManifest();manifest.policyDigest=evidenceDigest({id:"policy",updatedAt:policyTime.toISOString(),requiredApprovals:2,allowedRoles:["admin","owner"],allowSelfApproval:false,blocked:false});
  const store=postgresReviewStore(client);let instant=reviewNow;
  const options={id:randomUUID,now:()=>instant,verifier:{inspect:async candidate=>({kind:"independently_verified",facts:syntheticReviewFacts(candidate)})}};
  const core=createReviewCore(store,options),author={organizationId:"org-1",userId:"author"},alice={organizationId:"org-1",userId:"alice"},bob={organizationId:"org-1",userId:"bob"};
  assert.equal((await createReviewCore(store,{id:randomUUID,now:()=>instant}).prepare(author,manifest)).reason,"independent_verifier_unavailable");
  assert.equal((await client.$queryRawUnsafe('SELECT count(*)::int AS count FROM "EcsReleaseReviewPacket"'))[0].count,0);
  const prepared=await core.prepare(author,manifest);assert.equal(prepared.kind,"review_packet_recorded");
  const packetId=prepared.packetId;
  // New source-only variant reads independently persisted target and connection rows.
  assert.equal(executeSql(`CREATE TABLE "DeploymentTarget" ("id" text PRIMARY KEY,"organizationId" text,"environmentId" text UNIQUE,"provider" text,"roleArn" text,"region" text,"ecsCluster" text,"ecsService" text,"updatedAt" timestamp(3));
    CREATE TABLE "CloudAccount" ("id" text PRIMARY KEY,"organizationId" text,"provider" text,"externalAccountId" text,"credentialRef" text,"regions" text[],"enabled" boolean,"updatedAt" timestamp(3));
    CREATE TABLE "CloudAccountCredential" ("id" text PRIMARY KEY,"organizationId" text,"version" integer,"revokedAt" timestamp(3));`).status,0);
  const snapshotRows=reviewSnapshotRows();
  await client.$executeRawUnsafe('INSERT INTO "DeploymentTarget" VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',...Object.values(snapshotRows.target));
  await client.$executeRawUnsafe('INSERT INTO "CloudAccount" VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',...Object.values(snapshotRows.account));
  await client.$executeRawUnsafe('INSERT INTO "CloudAccountCredential" VALUES ($1,$2,$3,$4)',...Object.values(snapshotRows.credential));
  const capturedSnapshot=projectTargetSnapshot(snapshotRows);
  assert.ok(capturedSnapshot);
  const snapshotManifest=reviewSnapshotManifest(capturedSnapshot);snapshotManifest.operationId="snapshot-op";snapshotManifest.policyDigest=manifest.policyDigest;
  // Synthetic build/task evidence only; target token comes from independent fixture rows.
  const snapshotFacts=candidate=>({...syntheticReviewFacts(candidate),target:{...snapshotManifest.target,snapshot:structuredClone(capturedSnapshot)}});
  const snapshotOptions={...options,verifier:{inspect:async candidate=>({kind:"independently_verified",facts:snapshotFacts(candidate)})}};
  // Record native transaction identities for target SELECT and packet INSERT.
  const transactionTrace=[];
  const tracedClient={$transaction:(operation,settings)=>client.$transaction(async tx=>{
    const trace=async phase=>{const [identity]=await tx.$queryRawUnsafe("SELECT txid_current()::text AS id,current_setting('transaction_isolation') AS isolation");transactionTrace.push({phase,...identity});};
    return operation({
      $queryRawUnsafe:async(sql,...args)=>{if(sql.includes('FROM "DeploymentTarget"'))await trace("target_read");return tx.$queryRawUnsafe(sql,...args);},
      $executeRawUnsafe:async(sql,...args)=>{if(sql.startsWith('INSERT INTO "EcsReleaseReviewPacket"'))await trace("packet_insert");return tx.$executeRawUnsafe(sql,...args);},
    });
  },settings)};
  const snapshotCore=createReviewCore(postgresReviewStore(tracedClient),snapshotOptions);
  const snapshotPrepared=await snapshotCore.prepare(author,snapshotManifest);assert.equal(snapshotPrepared.kind,"review_packet_recorded");
  assert.equal(transactionTrace.filter(row=>row.phase==="target_read").length,1);
  assert.equal(transactionTrace.filter(row=>row.phase==="packet_insert").length,1);
  assert.equal(new Set(transactionTrace.map(row=>row.id)).size,1,"target_and_packet_must_share_transaction");
  assert.ok(transactionTrace.every(row=>row.isolation==="serializable"));
  assert.equal((await snapshotCore.prepare(author,snapshotManifest)).replayed,true);
  assert.equal((await store.transaction(tx=>tx.currentTargetSnapshot("foreign","stage","connection-1"))),null);
  assert.equal((await store.transaction(tx=>tx.currentTargetSnapshot("org-1","foreign","connection-1"))),null);
  assert.equal((await store.transaction(tx=>tx.currentTargetSnapshot("org-1","stage","foreign"))),null);
  const driftCases=[
    ['target_recreation','UPDATE "DeploymentTarget" SET "id"=$1','replacement-target','target-1'],
    ['target_configuration','UPDATE "DeploymentTarget" SET "ecsService"=$1','changed','web'],
    ['environment','UPDATE "Environment" SET "updatedAt"=$1',reviewNow,policyTime],
    ['account','UPDATE "CloudAccount" SET "updatedAt"=$1',reviewNow,policyTime],
    ['connection_replacement','UPDATE "CloudAccount" SET "id"=$1','replacement-connection','connection-1'],
    ['credential_generation','UPDATE "CloudAccountCredential" SET "version"=$1',3,2],
    ['credential_revocation','UPDATE "CloudAccountCredential" SET "revokedAt"=$1',reviewNow,null],
  ];
  for(const [mode,sql,changed,original] of driftCases){
    let mutated=false;
    const driftCore=createReviewCore(store,{...snapshotOptions,verifier:{inspect:async candidate=>{
      const facts=snapshotFacts(candidate);if(!mutated){await client.$executeRawUnsafe(sql,changed);mutated=true;}return {kind:"independently_verified",facts};
    }}});
    try{
      assert.equal((await driftCore.prepare(author,{...snapshotManifest,operationId:`drift-${mode}`})).reason,"current_target_snapshot_unavailable",mode);
      assert.equal((await driftCore.prepare(author,snapshotManifest)).reason,"current_target_snapshot_unavailable",`${mode}_replay`);
      assert.equal((await client.$queryRawUnsafe('SELECT count(*)::int AS count FROM "EcsReleaseReviewPacket" WHERE "operationId"=$1',`drift-${mode}`))[0].count,0);
    }finally{await client.$executeRawUnsafe(sql,original);}
  }
  // Throw after a real INSERT inside the same transaction: no partial packet remains.
  const rollbackStore={transaction:operation=>store.transaction(tx=>operation({...tx,createPacket:async packet=>{await tx.createPacket(packet);throw new Error("synthetic_after_insert_failure");}}))};
  assert.equal((await createReviewCore(rollbackStore,snapshotOptions).prepare(author,{...snapshotManifest,operationId:"snapshot-rollback"})).reason,"review_outcome_unknown");
  assert.equal((await client.$queryRawUnsafe('SELECT count(*)::int AS count FROM "EcsReleaseReviewPacket" WHERE "operationId"=$1',"snapshot-rollback"))[0].count,0);

  assert.equal((await core.prepare(author,manifest)).replayed,true);
  assert.equal((await core.decide(author,{packetId,expectedPriorRevision:0,decision:"approved"})).reason,"self_approval_forbidden");
  assert.equal((await core.checkpoint(author,packetId)).reason,"review_quorum_missing");
  assert.equal((await core.decide(alice,{packetId,expectedPriorRevision:0,decision:"approved"})).kind,"review_decision_recorded");
  assert.equal((await core.decide(bob,{packetId,expectedPriorRevision:0,decision:"approved"})).kind,"review_decision_recorded");
  const ready=await core.checkpoint(author,packetId);assert.equal(ready.kind,"review_ready_execution_disabled");assert.equal(ready.executionEnabled,false);
  assert.equal((await core.checkpoint(author,packetId)).checkpointId,ready.checkpointId);
  assert.equal((await core.decide(alice,{packetId,expectedPriorRevision:1,decision:"revoked"})).revision,2);
  assert.equal((await core.checkpoint(author,packetId)).reason,"review_rejected_or_revoked");
  assert.equal((await core.decide(alice,{packetId,expectedPriorRevision:1,decision:"approved"})).reason,"review_decision_conflict");
  // Real two-client Serializable CAS race: same previous voter revision.
  const racerClients=[new PrismaClient({datasources:{db:{url:target}}}),new PrismaClient({datasources:{db:{url:target}}})];
  let arrivals=0;let releaseBarrier;let barrierTimer;const barrier=new Promise((resolve,reject)=>{releaseBarrier=resolve;barrierTimer=setTimeout(()=>reject(new Error("isolated_race_barrier_timeout")),4000);barrierTimer.unref();});
  const racers=racerClients.map(database=>{
   const base=postgresReviewStore(database);
   const racedStore={transaction:fn=>base.transaction(tx=>fn({...tx,latestDecisions:async(...args)=>{const rows=await tx.latestDecisions(...args);arrivals++;if(arrivals===2)releaseBarrier();await barrier;return rows;}}))};
   return createReviewCore(racedStore,options);
  });
  let raced;
  try { raced=await Promise.all(racers.map(racer=>racer.decide(alice,{packetId,expectedPriorRevision:2,decision:"approved"}))); }
  finally {clearTimeout(barrierTimer);await Promise.all(racerClients.map(database=>database.$disconnect()));}
  assert.equal(raced.filter(result=>result.kind==="review_decision_recorded").length,1);
  assert.equal(raced.filter(result=>result.kind==="unavailable").length,1);
  assert.equal((await client.$queryRawUnsafe('SELECT count(*)::int AS count FROM "EcsReleaseReviewDecision" WHERE "packetId"=$1 AND "userId"=$2 AND "revision"=3',packetId,"alice"))[0].count,1);
  assert.equal((await core.checkpoint(author,packetId)).kind,"review_ready_execution_disabled");
  await client.$executeRawUnsafe('UPDATE "OrgMembership" SET "acceptedAt"=NULL WHERE "userId"=$1',"bob");
  assert.equal((await core.checkpoint(author,packetId)).reason,"review_quorum_missing");
  await assert.rejects(client.$executeRawUnsafe('INSERT INTO "EcsReleaseReviewDecision" ("id","packetId","organizationId","userId","revision","decision","manifestDigest","policyDigest","decidedAt","expiresAt") SELECT $1,"id",\'foreign\',\'intruder\',1,\'approved\',"manifestDigest","policyDigest","createdAt","expiresAt" FROM "EcsReleaseReviewPacket" WHERE "id"=$2',randomUUID(),packetId));
  instant=new Date(manifest.expiresAt);assert.equal((await core.checkpoint(author,packetId)).reason,"review_packet_missing_or_expired");
  assert.equal(core.execution().kind,"execution_disabled");
  return {target:"isolated_loopback_empty_fixture",migrationRollback:"passed",repeatedMigration:"rejected",missingVerifier:"no_packet_persisted",syntheticReview:"prepared_voted_checkpointed",appendOnlyRevocation:"invalidates_previous_checkpoint",realSerializableVoterRace:{committed:1,rejected:1},targetSnapshotFence:{protocol:"axiom.ecs.release.v3",sameSerializableTransaction:"target_read_and_packet_insert",driftCreateAndReplay:driftCases.length,foreignScope:"rejected",afterInsertRollback:"no_packet"},crossTenantForeignKey:"rejected",currentMembership:"rechecked",expiry:"rejected",executionEnabled:false,quotaConsumption:"none",providerCalls:"none",production:"untouched",provenance:"synthetic_fixture_only_not_verified"};
 } finally {await client.$disconnect();rmSync(temp,{recursive:true,force:true});}
}
if(process.argv[1]===fileURLToPath(import.meta.url))rehearseReview(process.env.ECS_REVIEW_TEST_DATABASE_URL).then(report=>console.log(JSON.stringify(report,null,2))).catch(()=>{console.error("isolated_ecs_review_rehearsal_failed");process.exitCode=1;});
