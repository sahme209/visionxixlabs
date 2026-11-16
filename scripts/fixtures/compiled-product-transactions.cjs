'use strict';
// Actual installed PrismaPg/pg and owned PG. Only post-COMMIT delivery loss is injected.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),dns=require('node:dns');
const [root,owned,portText]=process.argv.slice(2),port=Number(portText),host='ep-fictional-probe-pooler.c-4.us-east-1.aws.neon.tech';
const local=require('node:module').createRequire(path.join(root,'package.json')),ts=local('typescript'),{Client}=local('pg');
require.extensions['.ts']=(module,file)=>{assert(fs.realpathSync(file).startsWith(fs.realpathSync(root)+path.sep));module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file)};
const net=require('node:net'),tls=require('node:tls'),dgram=require('node:dgram');const connect=net.Socket.prototype.connect;net.Socket.prototype.connect=function(...args){let a=args[0];if(Array.isArray(a))a=a[0];const p=typeof a==='object'?a.port:a,h=typeof a==='object'?a.host:args[1];assert.equal(Number(p),port);assert(['127.0.0.1',host].includes(h));return Reflect.apply(connect,this,args)};global.fetch=async()=>{throw Error('owned_external_fetch_refused')};for(const k of ['send','connect'])dgram.Socket.prototype[k]=()=>{throw Error('owned_external_socket_refused')};
const originalLookup=dns.lookup.bind(dns);dns.lookup=(name,...args)=>{assert(['127.0.0.1',host].includes(name));return originalLookup('127.0.0.1',...args)};for(const api of [dns,dns.promises])for(const key of Object.keys(api))if(/^(resolve|reverse)/.test(key)&&typeof api[key]==='function')api[key]=()=>{throw Error('owned_dns_only')};dns.promises.lookup=()=>{throw Error('owned_dns_only')};
const password=fs.readFileSync(path.join(owned,'password'),'utf8').trim(),q=sql=>({sql,args:[],argTypes:[]});
const admin=new Client({host:'127.0.0.1',port,user:'axiom_local_fixture',database:'postgres',password,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:5000,query_timeout:5000});
const {postgresConnectionOptions}=require(path.join(root,'lib/database/postgresConnectionPolicy.ts')),{directNeonSessionOptions}=require(path.join(root,'lib/database/directNeonSession.ts')),{connectRemotePublicScope}=require(path.join(root,'lib/database/remotePublicScope.ts'));
let dropCommit=false,drops=0,committedBackend,adapter;
class DeliveryLossClient extends Client{
 query(...args){
  const value=typeof args[0]==='string'?args[0]:args[0]?.text;
  if(value!=='COMMIT'||!dropCommit)return super.query(...args);
  dropCommit=false;const callback=typeof args.at(-1)==='function'?args.pop():null;
  const lose=(error,ack)=>{if(error){if(callback)return callback(error);throw error}assert.equal(ack.command,'COMMIT');committedBackend=this.processID;drops++;const lost=Object.assign(Error('synthetic_post_commit_delivery_loss'),{code:'ECONNRESET'});if(callback)return callback(lost);throw lost};
  if(callback)return super.query(...args,lose);
  return super.query(...args).then(ack=>lose(null,ack));
 }
}
const timer=setTimeout(()=>process.exit(2),45000);
(async()=>{
 await admin.connect();await admin.query('SET search_path TO public; CREATE SCHEMA IF NOT EXISTS shadow; CREATE SCHEMA IF NOT EXISTS axiom_local_fixture; DROP TABLE IF EXISTS public."GateSentinel",shadow."GateSentinel",axiom_local_fixture."GateSentinel",public."GateCounter"; CREATE TABLE public."GateSentinel" (value text); INSERT INTO public."GateSentinel" VALUES (\'public\'); CREATE TABLE shadow."GateSentinel" (value text); INSERT INTO shadow."GateSentinel" VALUES (\'shadow\'); CREATE TABLE axiom_local_fixture."GateSentinel" (value text); INSERT INTO axiom_local_fixture."GateSentinel" VALUES (\'private\'); CREATE TABLE public."GateCounter" (id int PRIMARY KEY,n int); INSERT INTO public."GateCounter" VALUES (1,0); ALTER ROLE axiom_local_fixture SET search_path TO axiom_local_fixture,shadow,public');
 const options=directNeonSessionOptions(postgresConnectionOptions(`postgresql://axiom_local_fixture:${encodeURIComponent(password)}@${host}:${port}/postgres?sslmode=verify-full&connection_limit=2&connect_timeout=5&application_name=owned_gate_scope`));
 // Preserve the real startup filter while observing real query completion only.
 const Base=options.Client||Client;const original=DeliveryLossClient.prototype.query;class Instrumented extends Base{query(...args){return Reflect.apply(original,this,args)}}
 adapter=await connectRemotePublicScope({...options,Client:Instrumented});
 const value=await adapter.queryRaw(q('SELECT value FROM "GateSentinel"'));assert.equal(value.rows[0][0],'public');
 const simultaneous=await Promise.all([adapter.queryRaw(q('WITH wait AS (SELECT pg_sleep(0.05)) SELECT pg_backend_pid(),value FROM "GateSentinel" CROSS JOIN wait')),adapter.queryRaw(q('WITH wait AS (SELECT pg_sleep(0.05)) SELECT pg_backend_pid(),value FROM "GateSentinel" CROSS JOIN wait'))]);assert.equal(new Set(simultaneous.map(x=>x.rows[0][0])).size,2);assert(simultaneous.every(x=>x.rows[0][1]==='public'));
 const readOnly=await adapter.startTransaction('READ COMMITTED');await readOnly.executeRaw(q('SET TRANSACTION READ ONLY'));assert.equal((await readOnly.queryRaw(q('SHOW transaction_read_only'))).rows[0][0],'on');await readOnly.executeRaw(q('ROLLBACK'));await readOnly.rollback();
 const tx=await adapter.startTransaction('SERIALIZABLE');assert.equal((await tx.queryRaw(q('SHOW transaction_isolation'))).rows[0][0],'serializable');await tx.executeRaw(q('SAVEPOINT owned_gate'));await tx.executeRaw(q('UPDATE "GateCounter" SET n=n+10 WHERE id=1'));await tx.executeRaw(q('ROLLBACK TO SAVEPOINT owned_gate'));assert.equal((await tx.queryRaw(q('SELECT n FROM "GateCounter" WHERE id=1'))).rows[0][0],0);await tx.executeRaw(q('COMMIT'));await tx.commit();
 await assert.rejects(adapter.queryRaw(q('SELECT * FROM "OwnedMissingTable"')));assert.equal((await adapter.queryRaw(q('SELECT value FROM "GateSentinel"'))).rows[0][0],'public');
 dropCommit=true;await assert.rejects(adapter.executeRaw(q('UPDATE "GateCounter" SET n=n+1 WHERE id=1')));assert.equal(drops,1);assert.equal((await admin.query('SELECT n FROM public."GateCounter" WHERE id=1')).rows[0].n,1);const afterLoss=await adapter.queryRaw(q('SELECT pg_backend_pid(),n FROM "GateCounter" WHERE id=1'));assert.equal(afterLoss.rows[0][1],1);assert.notEqual(afterLoss.rows[0][0],committedBackend);
 await adapter.dispose();adapter=null;assert.equal((await admin.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name='owned_gate_scope'")).rows[0].n,0);
 process.stdout.write(JSON.stringify({accepted:true,actualPostgres:true,hostileDefaultsPublic:true,twoRealBackendSessions:true,readOnlyAfterShow:true,isolationAndSavepoint:true,failedQueryRollback:true,simulatedCommitDeliveryLoss:true,committedEffectExactlyOnce:true,dirtyLeaseDiscarded:true,ownedPoolDisposed:true})+'\n');
})().catch(()=>{process.exitCode=1;process.stdout.write(JSON.stringify({accepted:false,failure:'owned_remote_transaction_gate_failed'})+'\n')}).finally(async()=>{clearTimeout(timer);try{await adapter?.dispose();await admin.end()}finally{process.exit(process.exitCode||0)}});
