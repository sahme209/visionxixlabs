import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
import {withUnenrolledConfigurationMutation} from '../configurationMutationRefusal';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {buildEnvironmentCreateResponse} from '@/lib/releaseops/environmentCreateResponder';
const socket=process.env.AXIOM_TICKET_GOVERNANCE_PG_SOCKET;
// Owned socket-only DB. Authentication callback is explicitly SIMULATED; actual
// membership/session, metadata, organization locks, responder and writes are real.
describe.skipIf(!socket)('configuration mutation versus baseline enrollment on owned PostgreSQL',()=>{
 let db:any,activation:any;
 beforeAll(async()=>{
  const generated=process.env.AXIOM_TICKET_GOVERNANCE_PG_CLIENT;
  if(!socket||!/^\/private\/tmp\/axiom-ticket-governance-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||!generated||!/^\/private\/tmp\/axiom-provider-approval-pg-evidence-[^/]+\/generated\/index\.js$/.test(generated))throw Error('owned_fixture_required');
  const Client=createRequire(import.meta.url)(generated).PrismaClient,url=`postgresql://recovery_fixture@localhost/neondb?host=${encodeURIComponent(socket)}&connection_limit=1`;
  db=new Client({datasources:{db:{url}}});activation=new Client({datasources:{db:{url}}});
  const[r]=await db.$queryRawUnsafe("SELECT current_database()='neondb' AND current_user='recovery_fixture' AND current_setting('listen_addresses')='' AS private");if(r?.private!==true)throw Error('owned_fixture_required');
  await db.$executeRawUnsafe('CREATE TEMP TABLE "Environment" ("id" TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"slug" TEXT NOT NULL,"name" TEXT NOT NULL,"tier" TEXT NOT NULL,"displayOrder" INTEGER NOT NULL)');
 });
 afterAll(async()=>{await activation?.$disconnect();await db?.$disconnect()});
 async function fixture(){const organizationId='config-'+randomUUID(),userId='owner',sessionId='session-'+randomUUID();await db.orgMembership.create({data:{organizationId,userId,role:'admin',acceptedAt:new Date()}});await db.desktopSessionRecord.create({data:{id:sessionId,organizationId,userId,expiresAt:new Date(Date.now()+60000)}});return{organizationId,userId,sessionId}}
 async function enroll(tx:any,s:any){await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(s.organizationId)}))`;await tx.durableAgentWorkflow.create({data:{id:'governance_active_'+randomUUID(),organizationId:s.organizationId,workflowKind:'governance_baseline_active_v1',objective:'Explicit fixture-only enrollment metadata',autonomyLevel:'observe',requestedByUserId:s.userId,inputJson:{},stateJson:{}}})}
 async function write(tx:any,s:any){return buildEnvironmentCreateResponse({environment:{findUnique:async()=>null,create:async({data}:any)=>{const rows=await tx.$queryRaw`INSERT INTO "Environment"("id","organizationId","slug","name","tier","displayOrder") VALUES (${randomUUID()},${data.organizationId},${data.slug},${data.name},${data.tier},${data.displayOrder}) RETURNING *`;return rows[0]}}}as never,{organizationId:s.organizationId,slug:'dev',name:'Development',tier:'dev'})}
 const count=(s:any)=>db.$queryRaw`SELECT count(*)::integer AS count FROM "Environment" WHERE "organizationId"=${s.organizationId}`;
 const run=(s:any,mutate=(tx:any)=>write(tx,s))=>withUnenrolledConfigurationMutation(db,s,new AbortController().signal,async()=>{},mutate);
 it('commits actual responder mutation only for current persisted admin/session and positive metadata absence',async()=>{const s=await fixture();expect(await run(s)).toMatchObject({status:201,body:{ok:true}});expect(await count(s)).toEqual([{count:1}]);await db.orgMembership.updateMany({where:{organizationId:s.organizationId},data:{role:'read_only'}});await expect(run(s)).rejects.toThrow('governance_configuration_mutation_unavailable');expect(await count(s)).toEqual([{count:1}])});
 it('waits for earlier enrollment transaction and refuses without creating configuration',async()=>{
  const s=await fixture();let locked!:()=>void,release!:()=>void;const ready=new Promise<void>(r=>{locked=r}),hold=new Promise<void>(r=>{release=r});
  const enrolling=activation.$transaction(async(tx:any)=>{await enroll(tx,s);locked();await hold});await ready;
  let settled=false;const mutation=run(s).then(()=>{settled=true;return null},error=>{settled=true;return error});
  try{await new Promise(r=>setTimeout(r,40));expect(settled).toBe(false)}finally{release()}
  await enrolling;expect(await mutation).toMatchObject({message:'governance_configuration_mutation_unavailable'});expect(await count(s)).toEqual([{count:0}]);
 });
 it('keeps enrollment blocked until an already admitted DB configuration mutation commits',async()=>{
  const s=await fixture();let admitted!:()=>void,release!:()=>void;const ready=new Promise<void>(r=>{admitted=r}),hold=new Promise<void>(r=>{release=r});
  const mutation=run(s,async tx=>{admitted();await hold;return write(tx,s)});await ready;
  let activated=false;const enrolling=activation.$transaction(async(tx:any)=>{await enroll(tx,s);activated=true});
  try{await new Promise(r=>setTimeout(r,40));expect(activated).toBe(false)}finally{release()}
  expect(await mutation).toMatchObject({status:201});await enrolling;expect(await count(s)).toEqual([{count:1}]);await expect(run(s)).rejects.toThrow('governance_configuration_mutation_unavailable');
 });
 it('rolls back a DB mutation when the original session expires while its transaction is waiting',async()=>{
  const s=await fixture();let wrote=false;await db.desktopSessionRecord.update({where:{id:s.sessionId},data:{expiresAt:new Date(Date.now()+1000)}});
  await expect(run(s,async tx=>{const result=await write(tx,s);wrote=result.body.ok;await tx.$queryRaw`SELECT true FROM pg_sleep(1.1)`;return result})).rejects.toThrow('governance_configuration_mutation_unavailable');expect(wrote).toBe(true);expect(await count(s)).toEqual([{count:0}]);
 });
});
