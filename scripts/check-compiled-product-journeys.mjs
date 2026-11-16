/** Required owned preproduction gate. Reuses the completed .next; never builds/deploys. */
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync,rmSync,existsSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {randomBytes,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const ROOT=realpathSync(path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'));
export const PRODUCT_CASES=['wire-old-control','wire-direct','wire-pooler','wire-unknown','compiled-http-direct','compiled-http-alternate','remote-transactions'];
export function assessFictionalProductDownload(platform,body,location){
 const expected={
  'mac-arm':['macos-arm','V19_0.0.1_aarch64.dmg'],
  'mac-intel':['macos-intel','V19_0.0.1_x64.dmg'],
  windows:['windows-x64','V19_0.0.1_x64_en-US.msi'],
  linux:['linux-x64','V19_0.0.1_amd64.AppImage'],
 }[platform];
 return !!expected&&body?.status==='available'&&body.platform===platform&&body.version==='desktop-v0.0.1'&&body.asset?.platform===expected[0]&&body.asset?.fileName===expected[1]&&body.asset?.sizeBytes===123&&body.asset?.digest==='sha256:'+'a'.repeat(64)&&body.asset?.downloadUrl==='https://github.com/sahme209/axiom-releases/releases/download/desktop-v0.0.1/'+expected[1]&&location===body.asset.downloadUrl;
}
const hash=x=>createHash('sha256').update(x).digest('hex');
export function assessCompiledProductGate(receipt){
 const fail=[];if(!receipt||receipt.schema!=='axiom.compiled-product-gate/1'||receipt.actualProductionBuild!==true||!/^([a-f0-9]{40})$/.test(receipt.sourceSha||'')||typeof receipt.compiledDigest!=='string'||!/^[a-f0-9]{64}$/.test(receipt.compiledDigest))fail.push('source_or_compiled_binding');
 const cases=receipt?.cases||{};if(Object.keys(cases).sort().join('|')!==[...PRODUCT_CASES].sort().join('|'))fail.push('selected_cases_missing_or_extra');
 for(const mode of ['direct','pooler','unknown']){const x=cases['wire-'+mode];if(!x||x.actualCompiledRoute!==true||x.optionsPresent!==false||x.searchPathPresent!==false||x.authWrites!==0||x.sqlWrites!==0||x.connections!==1||x.realTls!==true||x.verifiedClientCaAndHostname!==true||x.ownedSocketsClosed!==true||x.safeReadinessLogOnly!==true)fail.push('wire_'+mode);}
 const old=cases['wire-old-control'];if(!old||old.oldStartupControl!==true||old.actualCompiledRoute!==false||old.optionsPresent!==true||old.responseStatus!==503||old.authWrites!==0||old.sqlWrites!==0||old.ownedSocketsClosed!==true)fail.push('old_rejection_control');
 for(const mode of ['direct','alternate']){const x=cases['compiled-http-'+mode];if(!x||x.accepted!==true||x.compiledProductionServer!==true||x.actualOwnedPostgres!==true||x.passwordVerificationAndCanonicalSession!==true||x.wrongPasswordAndUnverifiedRefused!==true||x.membershipBootstrap!==true||x.actualCompiledAppTlsSessions!==true||x.googleLinkHttp?.noPlatformSessionMint!==true||x.googleLinkHttp?.intentConsumedOnce!==true||x.googleLinkHttp?.replayRefused!==true||x.googleOAuthVerified!==false||x.liveMailAttempted!==false||x.statusStoresOperational!==true||x.hostileRoleDefaultConfigured!==true||x.fourPlatformFictionalAssets!==(mode==='alternate')||x.googleLinkIntentExplicitlySynthetic!==true||x.downloadStorageGate!==(mode==='direct'?'503_missing_then_404_no_external_asset_then_503_removed':'503_missing_then_200_fictional_assets_then_503_removed'))fail.push('http_'+mode);}
 const tx=cases['remote-transactions'];for(const key of ['accepted','actualPostgres','hostileDefaultsPublic','twoRealBackendSessions','readOnlyAfterShow','isolationAndSavepoint','failedQueryRollback','simulatedCommitDeliveryLoss','committedEffectExactlyOnce','dirtyLeaseDiscarded','ownedPoolDisposed'])if(tx?.[key]!==true)fail.push('transactions_'+key);
 if(receipt?.cancelled===true||receipt?.failure)fail.push('cancelled_or_failed');
 if(receipt?.cleanup?.childGroupsEmpty!==true||receipt?.cleanup?.containerAbsent!==true||receipt?.cleanup?.keysRemoved!==true||receipt?.inputsUnchanged!==true)fail.push('cleanup_or_inputs');
 return {accepted:fail.length===0,releaseAccepted:false,failures:fail,selectedCases:Object.keys(cases).length,realGoogle:'UNVERIFIED',mail:'UNVERIFIED',nativePairing:'UNVERIFIED',limits:['Fictional owned SQL/TLS/auth and release metadata only; not hosted pooler/provider/installer acceptance.','Post-COMMIT acknowledgement loss is explicitly simulated after a real committed effect.']};
}
function compiledDigest(){
 const rows=[];function walk(p){for(const name of readdirSync(p).sort()){const f=path.join(p,name),s=lstatSync(f);if(s.isSymbolicLink())throw Error('compiled_link_refused');if(s.isDirectory())walk(f);else if(s.isFile())rows.push(path.relative(ROOT,f)+':'+hash(readFileSync(f)));}}
 if(!existsSync(path.join(ROOT,'.next/BUILD_ID')))throw Error('production_build_required');walk(path.join(ROOT,'.next/server'));for(const n of ['BUILD_ID','prerender-manifest.json','routes-manifest.json'])rows.push(n+':'+hash(readFileSync(path.join(ROOT,'.next',n))));return hash(rows.join('\n'));
}
const sourceNames=['scripts/check-compiled-product-journeys.mjs','scripts/fixtures/compiled-product-http.cjs','scripts/fixtures/compiled-product-wire.cjs','scripts/fixtures/compiled-product-transactions.cjs','scripts/fixtures/compiled-product-diagnostics.cjs','scripts/fixtures/compiled-product.sql','lib/auth.ts','app/api/auth/[...nextauth]/route.ts','app/api/auth/google-link/route.ts','lib/database/databaseRuntimeTrace.ts','lib/desktop/desktopRuntimeReadiness.ts','lib/database/createDatabaseClient.ts','lib/database/directNeonSession.ts','lib/database/remotePublicScope.ts','lib/database/postgresConnectionPolicy.ts','lib/database/requiredChannelBinding.ts','lib/generated/prisma/client.js','node_modules/pg/package.json','node_modules/pg-pool/package.json','node_modules/@prisma/adapter-pg/package.json'];
const sourceDigest=()=>hash(sourceNames.map(n=>n+':'+hash(readFileSync(path.join(ROOT,n)))).join('\n'));
async function unusedPort(){const server=net.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
/** Own this process group until pipes close AND the group is absent. A leader
 * exit never revokes the deadline's authority over its surviving descendants. */
/** @param {string} file
 * @param {string[]} args
 * @param {{cwd:string,env:NodeJS.ProcessEnv,deadline:number,limit?:number,onOwner?:(child:import('node:child_process').ChildProcess|undefined)=>void,onUnconfirmed?:()=>void}} options */
export async function runOwnedGateCommand(file,args,{cwd,env,deadline,limit=15000,onOwner=()=>{},onUnconfirmed=()=>{}}){
 if(Date.now()>=deadline)throw Error('owned_gate_budget');
 return await new Promise((resolve,reject)=>{
  const child=spawn(file,args,{cwd,env,detached:true,stdio:['ignore','pipe','pipe']});onOwner(child);
  let stdout='',bytes=0,forced=false,settled=false;
  const kill=()=>{forced=true;if(Number.isSafeInteger(child.pid)){try{process.kill(-child.pid,'SIGKILL')}catch(error){if(error.code!=='ESRCH')onUnconfirmed()}}};
  const timer=setTimeout(kill,Math.min(limit,deadline-Date.now()));
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);onOwner(undefined);error?reject(error):resolve(value)};
  for(const [stream,save]of[[child.stdout,true],[child.stderr,false]])stream.on('data',chunk=>{bytes+=chunk.length;if(bytes>1048576){kill();return}if(save)stdout+=chunk});
  child.once('error',error=>finish(error));
  child.once('close',async code=>{
   clearTimeout(timer);let exists=true;
   for(let n=0;n<40;n++){
    try{process.kill(-child.pid,0)}catch(error){if(error.code==='ESRCH'){exists=false;break}onUnconfirmed();break}
    kill();await new Promise(r=>setTimeout(r,25));
   }
   if(exists){onUnconfirmed();finish(Error('owned_child_group_not_empty'));return}
   if(forced||code!==0){const error=Error('owned_command_failed');error.ownedOutput=stdout;finish(error)}else finish(null,stdout);
  });
 });
}
export async function runCompiledProductJourneys(){
 const owned=mkdtempSync(path.join(tmpdir(),'axiom-product-gate-')),name='axiom-product-gate-'+randomBytes(12).toString('hex'),label=randomBytes(24).toString('hex');
 const start=Date.now(),activeDeadline=start+285000,cleanupDeadline=start+330000;let active,armed=false,cancelled=false,compiledBefore,sourceBefore,stage='preflight';const results={};let failure;const cleanup={childGroupsEmpty:true,containerAbsent:false,keysRemoved:false};
 const env={PATH:process.env.PATH||'/usr/bin:/bin',HOME:owned,TMPDIR:owned,LANG:'C.UTF-8',CI:'1'};
 const handlers=new Map();for(const sig of ['SIGINT','SIGTERM','SIGHUP']){const fn=()=>{cancelled=true;if(active?.pid){try{process.kill(-active.pid,'SIGINT')}catch{}}};handlers.set(sig,fn);process.on(sig,fn);}
 async function command(file,args,{limit=15000,clean=false,childEnv=env}={}){
  if(!clean&&(cancelled||Date.now()>=activeDeadline))throw Error('owned_gate_cancelled_or_expired');
  return runOwnedGateCommand(file,args,{cwd:ROOT,env:childEnv,deadline:clean?cleanupDeadline:activeDeadline,limit,onOwner:child=>{active=child},onUnconfirmed:()=>{cleanup.childGroupsEmpty=false}});
 }
 function jsonOutput(text){const lines=text.trim().split('\n');for(let i=lines.length-1;i>=0;i--){try{return JSON.parse(lines[i])}catch{}}throw Error('machine_receipt_missing');}
 try{
  if(['DATABASE_URL','NEXTAUTH_SECRET','AUTH_SECRET','GOOGLE_CLIENT_SECRET','RESEND_API_KEY','DOCKER_HOST','DOCKER_CONTEXT'].some(n=>process.env[n]))throw Error('ambient_private_configuration_refused');for(const n of ['.env','.env.local','.env.production','.env.production.local','prisma/.env'])if(existsSync(path.join(ROOT,n)))throw Error('dotenv_refused');
  compiledBefore=compiledDigest();sourceBefore=sourceDigest();stage='image';await command('docker',['pull','--quiet','postgres:17-alpine'],{limit:45000});
  stage='certificate';writeFileSync(path.join(owned,'ext.cnf'),'subjectAltName=IP:127.0.0.1,DNS:localhost,DNS:ep-fictional-probe.c-4.us-east-1.aws.neon.tech,DNS:ep-fictional-probe-pooler.c-4.us-east-1.aws.neon.tech,DNS:fixture-postgres.invalid\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n',{mode:0o600});
  await command('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=OwnedProductGateCA','-keyout',path.join(owned,'ca.key'),'-out',path.join(owned,'ca.crt')]);await command('openssl',['req','-newkey','rsa:2048','-nodes','-subj','/CN=OwnedProductGate','-keyout',path.join(owned,'server.key'),'-out',path.join(owned,'server.csr')]);await command('openssl',['x509','-req','-in',path.join(owned,'server.csr'),'-CA',path.join(owned,'ca.crt'),'-CAkey',path.join(owned,'ca.key'),'-CAcreateserial','-days','1','-extfile',path.join(owned,'ext.cnf'),'-out',path.join(owned,'server.pem')]);
  const childEnv={...env,NODE_ENV:'production',NODE_EXTRA_CA_CERTS:path.join(owned,'ca.crt'),NEXT_TELEMETRY_DISABLED:'1'};
  for(const mode of ['old-control','direct','pooler','unknown']){stage='wire-'+mode;try{results[stage]=jsonOutput(await command(process.execPath,[path.join(ROOT,'scripts/fixtures/compiled-product-wire.cjs'),ROOT,owned,mode],{limit:30000,childEnv}));}catch(error){try{results[stage]=jsonOutput(error.ownedOutput)}catch{}throw error;}}
  stage='owned_postgres';const password=randomBytes(32).toString('hex');for(const [n,value]of[['password',password],['user-password',randomBytes(24).toString('hex')],['auth-secret',randomBytes(32).toString('hex')]])writeFileSync(path.join(owned,n),value,{mode:0o600});
  armed=true;const id=(await command('docker',['run','--pull=never','-d','--name',name,'--label','axiom.product-gate='+label,'-e','POSTGRES_USER=axiom_local_fixture','-e','POSTGRES_DB=postgres','-e','POSTGRES_PASSWORD='+password,'-e','POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256','-p','127.0.0.1::5432','--mount','type=bind,src='+owned+',dst=/fixture,readonly','postgres:17-alpine','sh','-c','cp /fixture/server.pem /fixture/server.key /tmp/ && chown postgres:postgres /tmp/server.pem /tmp/server.key && chmod 600 /tmp/server.key && exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/tmp/server.pem -c ssl_key_file=/tmp/server.key'],{limit:20000})).trim();if(!/^[a-f0-9]{64}$/.test(id))throw Error('owned_container_identity');
  const inspection=JSON.parse(await command('docker',['inspect',name]))[0];if(inspection.Id!==id||inspection.Config.Labels['axiom.product-gate']!==label||!inspection.Mounts.some(m=>m.Source===owned&&m.Destination==='/fixture'&&m.RW===false))throw Error('container_custody_refused');const published=inspection.NetworkSettings.Ports['5432/tcp'];if(published.length!==1||published[0].HostIp!=='127.0.0.1'||!/^\d+$/.test(published[0].HostPort))throw Error('container_loopback_refused');const pgPort=published[0].HostPort;
  for(let attempt=0;;attempt++){try{await command('docker',['exec',name,'pg_isready','-h','127.0.0.1','-p','5432','-U','axiom_local_fixture'],{limit:3000});break}catch{if(attempt>=39)throw Error('owned_postgres_unready');await new Promise(r=>setTimeout(r,100));}}
  for(const mode of ['direct','alternate']){
   stage='compiled-http-'+mode;const dir=path.join(owned,mode);mkdirSync(dir,{mode:0o700});for(const n of ['ca.crt','password','user-password','auth-secret'])writeFileSync(path.join(dir,n),readFileSync(path.join(owned,n)),{mode:0o600});
   try{await command(process.execPath,[path.join(ROOT,'scripts/fixtures/compiled-product-http.cjs'),ROOT,dir,pgPort,String(await unusedPort()),mode,'/var/lib/postgresql/data'],{limit:75000,childEnv:{...childEnv,NODE_EXTRA_CA_CERTS:path.join(dir,'ca.crt')}});}finally{if(existsSync(path.join(dir,'CLIENT-RESULT.json')))results[stage]=JSON.parse(readFileSync(path.join(dir,'CLIENT-RESULT.json'),'utf8'));}
  }
  stage='remote-transactions';results[stage]=jsonOutput(await command(process.execPath,[path.join(ROOT,'scripts/fixtures/compiled-product-transactions.cjs'),ROOT,owned,pgPort],{limit:45000,childEnv}));
 }catch{failure='owned_gate_failed_at_'+stage;}finally{
  if(active?.pid){try{process.kill(-active.pid,'SIGKILL')}catch{}cleanup.childGroupsEmpty=false;}
  if(armed){try{const inspect=JSON.parse(await command('docker',['inspect',name],{clean:true}))[0];if(inspect.Config.Labels['axiom.product-gate']!==label)throw Error('foreign_container');await command('docker',['rm','-f','-v',inspect.Id],{clean:true});const remaining=(await command('docker',['ps','-aq','--filter','name=^/'+name+'$'],{clean:true})).trim();cleanup.containerAbsent=remaining==='';}catch{cleanup.containerAbsent=false;}}else cleanup.containerAbsent=true;
  try{rmSync(owned,{recursive:true,force:true});cleanup.keysRemoved=!existsSync(owned);}catch{}
  for(const [sig,fn]of handlers)process.off(sig,fn);
 }
 let inputsUnchanged=false;try{inputsUnchanged=!!compiledBefore&&compiledDigest()===compiledBefore&&sourceDigest()===sourceBefore}catch{}
 const receipt={schema:'axiom.compiled-product-gate/1',sourceSha:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),actualProductionBuild:!!compiledBefore,compiledDigest:compiledBefore,sourceDigest:sourceBefore,cancelled,cases:results,cleanup,inputsUnchanged,failure};
 const verdict=assessCompiledProductGate(receipt);console.log(JSON.stringify({...receipt,verdict},null,2));return verdict;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){if(process.argv.length!==2)throw Error('fixed_no_arguments_gate');const verdict=await runCompiledProductJourneys();process.exitCode=verdict.accepted?0:1;}
