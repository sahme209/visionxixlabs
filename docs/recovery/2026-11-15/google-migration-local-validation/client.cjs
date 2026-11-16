// LOCAL FICTIONAL PG17 ONLY. Provider coordinates are NEVER connection inputs.
'use strict';
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),dns=require('node:dns'),{createRequire}=require('node:module'),{randomUUID,createHash}=require('node:crypto');
const write=process.stdout.write.bind(process.stdout);
for(const stream of [process.stdout,process.stderr])stream.write=function(_v,a,b){if(typeof a==='function')a();if(typeof b==='function')b();return true};
for(const name of ['log','info','warn','error','debug'])console[name]=()=>{};
const [root,owned,portText]=process.argv.slice(2),port=Number(portText),HERE=__dirname;
const receipt={accepted:false,ownedPostgres17:true,fixtureOnly:true,productionAccess:false,productionMigrationAuthorized:false,driverWireQualification:false,cases:[]};
function need(ok,code){if(!ok)throw Error(code)}
const ownAssertions=new Set(['owned_path_or_port','clean_owned_environment','owned_loopback_only','owned_database_name','atomic_baseline_not_preserved','owned_database_identity','packet_shape','pristine_apply_failed','post_apply_shape','fictional_user_changed','receipt_exact','reapply_mutated','refusal_expected','unexpected_refusal_category','negative_fixture_changed','negative_case_created_target','negative_case_created_oauth','injected_failure_expected','rollback_user_changed','exactly_one_apply_required','concurrent_ledger_shape','fresh_post_lock_user_catalog_required','expected_ddl_lock_timeout','held_user_lock_required','unpinned_runtime_module']);
const safeCodes=new Set(['55P03','40001','23505','22012','42501','42P01','P0001','42601']);
const packet=JSON.parse(fs.readFileSync(path.join(HERE,'CONDITIONAL-APPLY.json'),'utf8'));
const statements=packet.args.sql_statements;
let currentCase='bootstrap',currentStatement=-1;
const guardMessages=new Set(statements.flatMap(sql=>[...sql.matchAll(/RAISE EXCEPTION '(GIM_[0-9]{3}_[a-z0-9_]+)'/g)].map(match=>match[1])));
function safe(error){return {assertion:ownAssertions.has(error?.message)?error.message:null,guard:guardMessages.has(error?.message)?error.message:null,sqlState:safeCodes.has(error?.code)?error.code:null}}
function emit(value){write('[OWNED_GOOGLE_MIGRATION] '+JSON.stringify(value)+'\n')}
need(fs.realpathSync(root)===root&&fs.realpathSync(owned)===owned&&Number.isInteger(port)&&port>1024&&port<65536,'owned_path_or_port');
need(process.env.NODE_EXTRA_CA_CERTS===path.join(owned,'ca.crt')&&['DATABASE_URL','NEXTAUTH_SECRET','PGHOST','PGPORT','PGUSER','PGPASSWORD'].every(key=>process.env[key]===undefined),'clean_owned_environment');
const originalConnect=net.Socket.prototype.connect;
const deny=()=>{throw Error('owned_loopback_only')};
net.Socket.prototype.connect=function(...args){let o=args[0];if(Array.isArray(o))o=o[0];const p=typeof o==='object'?o.port:o,h=typeof o==='object'?o.host:args[1];need(h==='127.0.0.1'&&Number(p)===port,'owned_loopback_only');return Reflect.apply(originalConnect,this,args)};
require('./literal-dns.cjs')(dns,deny);
for(const api of [require('node:http'),require('node:https')])for(const key of ['get','request'])api[key]=deny;
for(const key of ['connect','send'])require('node:dgram').Socket.prototype[key]=deny;globalThis.fetch=async()=>deny();require('node:module').syncBuiltinESMExports();
const local=createRequire(path.join(root,'package.json')),{Client}=local('pg');
const manifest=JSON.parse(fs.readFileSync(path.join(HERE,'INPUTS.json'),'utf8')),allowed=new Set([...Object.keys(manifest.files),...Object.entries(manifest.cacheInventory).filter(([,v])=>v.kind==='file').map(([name])=>name)]);
function verifyModules(){need(Object.keys(require.cache).every(name=>allowed.has(name)),'unpinned_runtime_module')}
verifyModules();
const password=fs.readFileSync(path.join(owned,'password'),'utf8').trim(),clients=new Set();
async function connect(database){need(['postgres','neondb'].includes(database),'owned_database_name');const client=new Client({host:'127.0.0.1',port,user:'neondb_owner',database,password:()=>password,ssl:{rejectUnauthorized:true},enableChannelBinding:true,connectionTimeoutMillis:5000,query_timeout:5000});clients.add(client);await client.connect();return client}
async function end(client){if(!clients.has(client))return;await client.end();clients.delete(client)}
const source=JSON.parse(fs.readFileSync(path.join(HERE,'SOURCE-MIGRATIONS.json'),'utf8')),baseline=source.migrations.filter(row=>row.name!==packet.sourceMigration.name),fixture=fs.readFileSync(path.join(HERE,'fixture.sql'),'utf8');
let admin,closing=false;
async function close(){if(closing)return;closing=true;await Promise.allSettled([...clients].map(end))}
const expiry=setTimeout(()=>{emit({failure:'owned_deadline'});close().finally(()=>process.exit(1))},120000);
for(const signal of ['SIGTERM','SIGINT','SIGHUP'])process.on(signal,()=>{close().finally(()=>process.exit(1))});
process.on('uncaughtException',error=>{emit({failure:'uncaught',...safe(error)});close().finally(()=>process.exit(1))});
process.on('unhandledRejection',error=>{emit({failure:'unhandled',...safe(error)});close().finally(()=>process.exit(1))});
async function apply(client,hook){await client.query('BEGIN');try{for(let i=0;i<statements.length;i++){currentStatement=i;if(hook)await hook(i,client);await client.query(statements[i])}await client.query('COMMIT');return {accepted:true}}catch(error){await client.query('ROLLBACK');return {accepted:false,...safe(error)}}}
async function shape(client){const row=(await client.query(`SELECT (SELECT count(*)::int FROM public."_prisma_migrations") AS ledger,(SELECT count(*)::int FROM public."_prisma_migrations" WHERE migration_name=$1) AS target,to_regclass('public."OAuthIdentity"') IS NOT NULL AS oauth,to_regclass('public."PendingGoogleIdentityLink"') IS NOT NULL AS pending`,[packet.sourceMigration.name])).rows[0];return row}
async function untouched(client){const state=await shape(client);need(state.ledger===120&&state.target===0&&!state.oauth&&!state.pending,'atomic_baseline_not_preserved')}
async function ledgerDigest(client){return createHash('sha256').update(JSON.stringify((await client.query('SELECT * FROM public."_prisma_migrations" ORDER BY id')).rows)).digest('hex')}
async function userDigest(client){return createHash('sha256').update(JSON.stringify((await client.query('SELECT * FROM public."User" ORDER BY id')).rows)).digest('hex')}
async function withFixture(name,run){currentCase=name;currentStatement=-1;emit({phase:'case_start',case:name});await admin.query('CREATE DATABASE neondb');const client=await connect('neondb');try{await client.query(fixture);for(const row of baseline)await client.query('INSERT INTO public."_prisma_migrations"(id,checksum,migration_name,finished_at,applied_steps_count) VALUES($1,$2,$3,CURRENT_TIMESTAMP,1)',[randomUUID(),row.checksum,row.name]);const result=await run(client);receipt.cases.push({case:name,passed:true,...result});emit({phase:'case_pass',case:name})}finally{for(const current of [...clients])if(current!==admin)await end(current);await admin.query('DROP DATABASE neondb')}}
async function refused(client,expected){const result=await apply(client);need(!result.accepted,'refusal_expected');if(expected)need(result.guard===expected||result.sqlState===expected,'unexpected_refusal_category');return result}
(async()=>{
 admin=await connect('postgres');const identity=(await admin.query("SELECT current_database() AS db,current_user AS owner,current_setting('data_directory') AS directory,(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls")).rows[0];need(identity.db==='postgres'&&identity.owner==='neondb_owner'&&fs.realpathSync(identity.directory)===path.join(owned,'data')&&identity.tls===true,'owned_database_identity');need(baseline.length===120&&statements.length===17,'packet_shape');
 await withFixture('pristine_success_and_reapply',async c=>{const before=await userDigest(c),result=await apply(c);need(result.accepted,'pristine_apply_failed');const state=await shape(c);need(state.ledger===121&&state.target===1&&state.oauth&&state.pending,'post_apply_shape');need(await userDigest(c)===before,'fictional_user_changed');const row=(await c.query('SELECT checksum,applied_steps_count,logs FROM public."_prisma_migrations" WHERE migration_name=$1',[packet.sourceMigration.name])).rows[0];need(row.checksum===packet.sourceMigration.checksum&&row.applied_steps_count===1&&row.logs===null,'receipt_exact');const again=await refused(c);need((await shape(c)).ledger===121,'reapply_mutated');return {userUnchanged:true,oneReceipt:true,reapplyRefused:true,refusal:again.guard}});
 for(const [name,sql] of [
  ['missing_ledger_row','DELETE FROM public."_prisma_migrations" WHERE id=(SELECT id FROM public."_prisma_migrations" LIMIT 1)'],
  ['unknown_ledger_name',"UPDATE public.\"_prisma_migrations\" SET migration_name='unknown_synthetic' WHERE id=(SELECT id FROM public.\"_prisma_migrations\" LIMIT 1)"],
  ['checksum_drift',"UPDATE public.\"_prisma_migrations\" SET checksum=repeat('0',64) WHERE id=(SELECT id FROM public.\"_prisma_migrations\" LIMIT 1)"],
  ['unfinished_ledger',"UPDATE public.\"_prisma_migrations\" SET finished_at=NULL WHERE id=(SELECT id FROM public.\"_prisma_migrations\" LIMIT 1)"],
  ['rolledback_ledger',"UPDATE public.\"_prisma_migrations\" SET rolled_back_at=CURRENT_TIMESTAMP WHERE id=(SELECT id FROM public.\"_prisma_migrations\" LIMIT 1)"],
  ['duplicate_ledger_name',"UPDATE public.\"_prisma_migrations\" SET migration_name=(SELECT migration_name FROM public.\"_prisma_migrations\" ORDER BY id LIMIT 1),checksum=(SELECT checksum FROM public.\"_prisma_migrations\" ORDER BY id LIMIT 1) WHERE id=(SELECT id FROM public.\"_prisma_migrations\" ORDER BY id OFFSET 1 LIMIT 1)"],
  ['existing_target_table','CREATE TABLE public."OAuthIdentity"(id text)'],
  ['existing_target_type',"CREATE TYPE public.\"OAuthIdentity\" AS ENUM('fictional')"],
  ['existing_index_name','CREATE TABLE public."OAuthIdentity_pkey"(id text)'],
  ['user_type_drift','ALTER TABLE public."User" ALTER COLUMN email TYPE varchar(254)'],
  ['user_nullability_drift','ALTER TABLE public."User" ALTER COLUMN email DROP NOT NULL'],
  ['user_default_drift','ALTER TABLE public."User" ALTER COLUMN "createdAt" DROP DEFAULT'],
  ['user_email_index_drift','DROP INDEX public."User_email_key"'],
  ['ledger_structure_drift','ALTER TABLE public."_prisma_migrations" ALTER COLUMN checksum TYPE text'],
  ['ledger_constraint_drift','ALTER TABLE public."_prisma_migrations" ADD CHECK(applied_steps_count>=0)'],
  ['implicit_public_grant','ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO PUBLIC'],
  ['ledger_hook',`CREATE FUNCTION public.fixture_hook() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;CREATE TRIGGER fixture_hook BEFORE INSERT ON public."_prisma_migrations" FOR EACH ROW EXECUTE FUNCTION public.fixture_hook()`],
  ['ddl_hook',`CREATE FUNCTION public.fixture_event_hook() RETURNS event_trigger LANGUAGE plpgsql AS $$BEGIN NULL; END$$;CREATE EVENT TRIGGER fixture_event_hook ON ddl_command_start EXECUTE FUNCTION public.fixture_event_hook()`]
 ])await withFixture(name,async c=>{await c.query(sql);const priorLedger=await ledgerDigest(c),priorUser=await userDigest(c);const result=await refused(c);need(await ledgerDigest(c)===priorLedger&&await userDigest(c)===priorUser,'negative_fixture_changed');const state=await shape(c);need(state.target===0&&!state.pending,'negative_case_created_target');if(name!=='existing_target_table')need(!state.oauth,'negative_case_created_oauth');return result});
 await withFixture('temporary_namespace',async c=>{await c.query('CREATE TEMP TABLE fictional_temp(id text)');const result=await refused(c,'GIM_002_temporary_namespace_refused');await untouched(c);return result});
 await withFixture('wrong_role',async c=>{await c.query('SET ROLE pg_read_all_data');const result=await refused(c,'GIM_001_identity_or_transaction_refused');await c.query('RESET ROLE');await untouched(c);return result});
 await withFixture('wrong_database',async c=>{const result=await refused(admin,'GIM_001_identity_or_transaction_refused');await untouched(c);return result});
 for(const [name,index] of [['rollback_after_first_ddl',9],['rollback_before_receipt',15],['rollback_after_receipt',16]])await withFixture(name,async c=>{const before=await userDigest(c),result=await apply(c,async i=>{if(i===index)await c.query('SELECT 1/0')});need(!result.accepted&&result.sqlState==='22012','injected_failure_expected');await untouched(c);need(await userDigest(c)===before,'rollback_user_changed');return {atomicRollback:true,...result}});
 await withFixture('advisory_contention',async c=>{const blocker=await connect('neondb');await blocker.query('BEGIN');await blocker.query('SELECT pg_advisory_xact_lock(20261115,180000)');try{const result=await refused(c,'GIM_003_migration_lock_unavailable');await untouched(c);return result}finally{await blocker.query('ROLLBACK');await end(blocker)}});
 for(const [name,table] of [['ledger_lock_contention','_prisma_migrations'],['user_lock_contention','User']])await withFixture(name,async c=>{const blocker=await connect('neondb');await blocker.query('BEGIN');await blocker.query('LOCK TABLE public."'+table+'" IN ACCESS EXCLUSIVE MODE');try{const result=await refused(c,'55P03');return {...result,boundedLockRefusal:true}}finally{await blocker.query('ROLLBACK');await end(blocker);await untouched(c)}});
 await withFixture('concurrent_exactly_once',async c=>{const second=await connect('neondb');const results=await Promise.all([apply(c),apply(second)]);need(results.filter(v=>v.accepted).length===1,'exactly_one_apply_required');need((await shape(c)).ledger===121,'concurrent_ledger_shape');await end(second);return {exactlyOneApply:true}});
 await withFixture('winning_user_ddl_before_lock',async c=>{const changer=await connect('neondb');const result=await apply(c,async i=>{if(i===6)await changer.query('ALTER TABLE public."User" ALTER COLUMN email TYPE varchar(254)')});need(!result.accepted&&result.guard==='GIM_013_user_column_drift','fresh_post_lock_user_catalog_required');await untouched(c);await end(changer);return {freshCatalogRefusal:true,...result}});
 await withFixture('user_ddl_after_lock_waits',async c=>{const changer=await connect('neondb');await changer.query("SET lock_timeout='500ms'");let refusedDdl=false;const result=await apply(c,async i=>{if(i===7){try{await changer.query('ALTER TABLE public."User" ALTER COLUMN email TYPE varchar(254)')}catch(error){need(error.code==='55P03','expected_ddl_lock_timeout');refusedDdl=true}}});need(result.accepted&&refusedDdl,'held_user_lock_required');await end(changer);return {competingDdlRefused:true}});
 verifyModules();
 receipt.accepted=true;receipt.currentReadCommittedPacket=true;receipt.exactMigrationSha256=packet.sourceMigration.checksum;receipt.caseCount=receipt.cases.length;
})().catch(error=>{receipt.failure={category:'owned_case_failed',case:currentCase,statement:currentStatement,...safe(error)};emit(receipt.failure);process.exitCode=1}).finally(async()=>{clearTimeout(expiry);await close();receipt.clientsDisconnected=clients.size===0;fs.writeFileSync(path.join(owned,'CLIENT-RESULT.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});emit({accepted:receipt.accepted,cases:receipt.cases.length,clientsDisconnected:receipt.clientsDisconnected});process.exit(process.exitCode||0)});
