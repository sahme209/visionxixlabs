import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
const f=vi.hoisted(()=>({repo:undefined as any,org:'',expiry:0}));
vi.mock('@/lib/db',()=>({get prisma(){return f.repo}}));
vi.mock('@/lib/auth',()=>({authOptions:{}}));
// Browser authentication is simulated; persisted membership, barrier metadata,
// configuration responder/upsert and two-connection locks are actual PostgreSQL.
vi.mock('next-auth',()=>({getServerSession:async()=>({user:{id:'admin'},expires:new Date(f.expiry).toISOString()})}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:async()=>({isAuthenticated:true,userId:'admin',sessionUserId:'admin',organizationId:f.org,roles:['admin']})}));
import {POST} from '@/app/api/dashboard/slack-config/route';
const socket=process.env.AXIOM_TICKET_GOVERNANCE_PG_SOCKET;
describe.skipIf(!socket)('web notification configuration on owned PostgreSQL; browser pairing simulated',()=>{
 let db:any,other:any;
 beforeAll(async()=>{const generated=process.env.AXIOM_TICKET_GOVERNANCE_PG_CLIENT;if(!socket||!/^\/private\/tmp\/axiom-ticket-governance-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||!generated||!/^\/private\/tmp\/axiom-provider-approval-pg-evidence-[^/]+\/generated\/index\.js$/.test(generated))throw Error('owned_fixture_required');const Client=createRequire(import.meta.url)(generated).PrismaClient,options={datasources:{db:{url:`postgresql://recovery_fixture@localhost/neondb?host=${encodeURIComponent(socket)}&connection_limit=1`}}};db=new Client(options);other=new Client(options);const[r]=await db.$queryRawUnsafe("SELECT current_database()='neondb' AND current_user='recovery_fixture' AND current_setting('listen_addresses')='' AS private");if(!r?.private)throw Error('owned_fixture_required')});
 afterAll(async()=>{await other?.$disconnect();await db?.$disconnect()});
 async function fixture(){f.org='notification-'+randomUUID();f.expiry=Date.now()+60000;f.repo=db;await db.orgMembership.create({data:{organizationId:f.org,userId:'admin',role:'admin',acceptedAt:new Date()}})}
 const post=(body:any={webhookUrl:'https://hooks.slack.com/services/SYNTHETIC',enabled:true})=>POST(new NextRequest('https://fixture.invalid/api/dashboard/slack-config',{method:'POST',headers:{origin:'https://fixture.invalid','content-type':'application/json'},body:JSON.stringify(body)}));
 const saved=()=>db.slackNotificationConfig.findUnique({where:{organizationId:f.org}});
 async function enroll(tx:any){await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(f.org)}))`;await tx.durableAgentWorkflow.create({data:{id:'governance_active_'+randomUUID(),organizationId:f.org,workflowKind:'governance_baseline_active_v1',objective:'SIMULATED enrollment metadata only',autonomyLevel:'observe',requestedByUserId:'admin',inputJson:{},stateJson:{}}})}
 it('commits the actual upsert only for current persisted administrator; later cached browser role cannot bypass revocation',async()=>{await fixture();expect((await post()).status).toBe(200);expect(await saved()).toMatchObject({enabled:true});await db.orgMembership.updateMany({where:{organizationId:f.org},data:{role:'read_only'}});expect((await post({webhookUrl:'https://hooks.slack.com/services/OTHER'})).status).toBeGreaterThanOrEqual(400);expect(await saved()).toMatchObject({webhookUrl:'https://hooks.slack.com/services/SYNTHETIC'})});
 it('waits for an earlier organization enrollment transaction then refuses without a config upsert',async()=>{await fixture();let entered!:()=>void,release!:()=>void;const ready=new Promise<void>(r=>entered=r),hold=new Promise<void>(r=>release=r);const enrolling=other.$transaction(async(tx:any)=>{await enroll(tx);entered();await hold});await ready;let settled=false;const writing=post().then(r=>{settled=true;return r});try{await new Promise(r=>setTimeout(r,40));expect(settled).toBe(false)}finally{release();await enrolling}expect((await writing).status).toBe(409);expect(await saved()).toBeNull()});
 it('keeps a real config mutation rollback-safe when the original browser session expires during SQL work',async()=>{await fixture();f.expiry=Date.now()+1000;let wrote=false;f.repo=new Proxy(db,{get(target,key){if(key==='$transaction')return(fn:any,options:any)=>target.$transaction((tx:any)=>fn(new Proxy(tx,{get(inner,field){if(field==='slackNotificationConfig')return new Proxy(inner.slackNotificationConfig,{get(model,method){if(method==='upsert')return async(args:any)=>{const row=await model.upsert(args);wrote=true;await inner.$queryRaw`SELECT true FROM pg_sleep(1.1)`;return row};return Reflect.get(model,method)}});return Reflect.get(inner,field)}})),options);return Reflect.get(target,key)}});expect((await post()).status).toBe(409);expect(wrote).toBe(true);expect(await saved()).toBeNull()});
 it('preserves exact safety pause after enrollment without changing the stored webhook or filters',async()=>{await fixture();expect((await post()).status).toBe(200);const original=await saved();await other.$transaction(enroll);expect((await post({enabled:false})).status).toBe(200);expect(await saved()).toMatchObject({enabled:false,webhookUrl:original.webhookUrl,enabledSignalKindsJson:original.enabledSignalKindsJson})});
});
