// PREPARED ONLY. Actual compiled Next routes + owned PostgreSQL/TLS. No mocks of
// auth, Prisma, pool, SQL, status or readiness. No external network permitted.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {classify}=require('./diagnostics.cjs');
const write=process.stdout.write.bind(process.stdout);let stage='bootstrap',scenario='none';
const trace=[];
function emit(kind,details={}){const row={kind,stage,scenario,...details};if(trace.length<100)trace.push(row);write('[OWNED_DIAGNOSTIC] '+JSON.stringify(row)+'\n')}
function phase(value){stage=value;emit('phase')}
// Suppress library/runtime output rather than risk serializing a raw native,
// Next, Prisma or authentication error. Only emit() writes diagnostic rows.
for(const stream of [process.stdout,process.stderr])stream.write=function(_data,encoding,callback){if(typeof encoding==='function')encoding();if(typeof callback==='function')callback();return true};
for(const name of ['log','info','warn','error','debug'])console[name]=()=>undefined;
process.on('uncaughtException',error=>{emit('uncaught_failure',classify(error));process.exit(1)});
process.on('unhandledRejection',error=>{emit('unhandled_failure',classify(error));process.exit(1)});

const net=require('node:net'),tls=require('node:tls'),dns=require('node:dns'),dgram=require('node:dgram');
const {createRequire}=require('node:module'),{createHash}=require('node:crypto');
const [root,owned,pgText,httpText]=process.argv.slice(2),pgPort=Number(pgText),port=Number(httpText);
const need=(ok,code)=>{if(!ok)throw Error(code)};
need(fs.realpathSync(root)===root&&fs.realpathSync(owned)===owned,'canonical_owned_paths');
for(const file of ['.env','.env.local','.env.production','.env.production.local'])need(!fs.existsSync(path.join(root,file)),'ambient_dotenv_forbidden');
need(process.env.DATABASE_URL===undefined&&process.env.NEXTAUTH_SECRET===undefined&&process.env.NODE_EXTRA_CA_CERTS===path.join(owned,'ca.crt'),'clean_fixture_environment');
emit('phase');const local=require('node:module').createRequire(path.join(root,'package.json'));
let denied=0;
const reject=()=>{denied++;throw Error('owned_loopback_network_only')};
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){let o=args[0];if(Array.isArray(o))o=o[0];const p=typeof o==='object'?o.port:o,h=typeof o==='object'?o.host:args[1];if(h!=='127.0.0.1'||![pgPort,port].includes(Number(p))){emit('network_refusal',{reason:h===undefined?'missing_host':h!=='127.0.0.1'?'non_exact_loopback_host':'unexpected_port'});return reject();}return Reflect.apply(connect,this,args)};
require('./literal-dns.cjs')(dns,reject);
for(const k of ['send','connect'])dgram.Socket.prototype[k]=reject;
const originalFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{const u=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(u.origin!==`http://127.0.0.1:${port}`)return Promise.reject(Error('owned_loopback_network_only'));return originalFetch(input,init)};
require('node:module').syncBuiltinESMExports();
const password=fs.readFileSync(path.join(owned,'password'),'utf8').trim();
const userPassword=fs.readFileSync(path.join(owned,'user-password'),'utf8');
process.env.NODE_ENV='production';process.env.NEXT_TELEMETRY_DISABLED='1';
process.env.DATABASE_URL=`postgresql://axiom_local_fixture:${encodeURIComponent(password)}@127.0.0.1:${pgPort}/postgres?sslmode=verify-full&channel_binding=require&connection_limit=2&connect_timeout=5&pool_timeout=5&socket_timeout=5&application_name=owned_compiled_http`;
process.env.NEXTAUTH_URL=`http://127.0.0.1:${port}`;process.env.NEXTAUTH_SECRET=fs.readFileSync(path.join(owned,'auth-secret'),'utf8');
const {Client}=local('pg'),bcrypt=local('bcryptjs');
const admin=new Client({host:'127.0.0.1',port:pgPort,user:'axiom_local_fixture',database:'postgres',password:()=>password,ssl:{rejectUnauthorized:true},enableChannelBinding:true,connectionTimeoutMillis:5000,query_timeout:5000});
const allowed=new Map([['GET',new Set(['/api/status','/api/auth/csrf','/api/auth/providers','/api/auth/session','/api/desktop/download'])],['POST',new Set(['/api/auth/callback/credentials'])]]);
let app,server,closing=false;const receipt={accepted:false,compiledProductionServer:true,actualOwnedPostgres:true,strictRequireConfigured:true,googleOAuthVerified:false,installerAvailable:false,productionAccess:false};
async function close(){if(closing)return;closing=true;if(server){server.closeAllConnections();await new Promise(r=>server.close(r))}try{await app?.close()}finally{await admin.end()}}
const expiry=setTimeout(()=>{emit('failure',classify(Error('owned_compiled_http_deadline')));close().finally(()=>process.exit(1))},75000);
for(const signal of ['SIGINT','SIGTERM','SIGHUP'])process.on(signal,()=>{close().finally(()=>process.exit(1))});
async function request(route,jar,init={}){const response=await fetch(process.env.NEXTAUTH_URL+route,{...init,redirect:'manual',headers:{...(init.headers||{}),cookie:[...jar.values()].join('; ')}});for(const item of response.headers.getSetCookie()){const pair=item.split(';')[0];jar.set(pair.slice(0,pair.indexOf('=')),pair)}return response}
async function sessionAttempt(email,pass,accepted){const jar=new Map();phase('auth_csrf_http');const csrfResponse=await request('/api/auth/csrf',jar);emit('http_response',{endpoint:'csrf',status:csrfResponse.status});phase('auth_csrf_parse');const csrf=await csrfResponse.json();need(typeof csrf.csrfToken==='string','csrf_missing');phase('auth_callback_http');const r=await request('/api/auth/callback/credentials',jar,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:process.env.NEXTAUTH_URL},body:new URLSearchParams({csrfToken:csrf.csrfToken,email,password:pass,callbackUrl:process.env.NEXTAUTH_URL+'/control',json:'true'})});emit('http_response',{endpoint:'credentials',status:r.status});need([200,401,302].includes(r.status),'credentials_response');phase('auth_session_http');const sessionResponse=await request('/api/auth/session',jar);emit('http_response',{endpoint:'session',status:sessionResponse.status});phase('auth_session_parse');const session=await sessionResponse.json();emit('session_shape',{hasUser:!!session.user,expectedEmail:session.user?.email===email,canonicalId:session.user?.id==='owned-verified'});need(accepted?session.user?.email===email&&session.user?.id==='owned-verified':!session.user,'session_verification');return jar}
async function download(expected){const r=await request('/api/desktop/download?platform=mac-arm&format=json',new Map());emit('http_response',{endpoint:'download',status:r.status,expected});need(r.status===expected,'download_gate_status');const b=await r.json();need(b.status===(expected===503?'temporarily_unavailable':'unavailable'),'download_gate_body')}
(async()=>{
 phase('admin_connect');await admin.connect();phase('identity_query');const identity=(await admin.query("SELECT current_user AS owner,current_setting('data_directory') AS directory,(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls")).rows[0];need(identity.owner==='axiom_local_fixture'&&fs.realpathSync(identity.directory)===path.join(owned,'data')&&identity.tls===true,'owned_pg_identity');
 phase('schema_setup');await admin.query(fs.readFileSync(path.join(__dirname,'fixture.sql'),'utf8'));
 phase('password_hash');const hash=await bcrypt.hash(userPassword,10);
 phase('user_seed');await admin.query('INSERT INTO "User" (id,email,name,"passwordHash","emailVerifiedAt","updatedAt") VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),($5,$6,$7,$4,NULL,CURRENT_TIMESTAMP)',['owned-verified','verified@example.invalid','Owned verified',hash,'owned-unverified','unverified@example.invalid','Owned unverified']);
 phase('next_imports');const nextRoot=root+'/node_modules/next',load=require(nextRoot+'/dist/server/config').default,nextPhase=require(nextRoot+'/constants').PHASE_PRODUCTION_SERVER;
 stage='next_config';emit('phase');const conf=await load(nextPhase,root);stage='next_construct';emit('phase');app=local('next')({dev:false,dir:root,conf,hostname:'127.0.0.1',port});phase('next_prepare');await app.prepare();phase('next_prepared');
 phase('http_listen');server=http.createServer((req,res)=>{try{const u=new URL(req.url,process.env.NEXTAUTH_URL);if(req.headers.host!==`127.0.0.1:${port}`||!allowed.get(req.method)?.has(u.pathname)){res.writeHead(403).end();return}Promise.resolve(app.getRequestHandler()(req,res)).catch(error=>{emit('handler_failure',classify(error));res.writeHead(500).end('owned_route_failed')})}catch{res.writeHead(400).end()}});server.on('upgrade',(_,socket)=>socket.destroy());await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host:'127.0.0.1',port,exclusive:true},resolve)});
 phase('status_http');const statusResponse=await request('/api/status',new Map());emit('http_response',{endpoint:'status',status:statusResponse.status});phase('status_parse');const report=await statusResponse.json();phase('status_assert');emit('storage_verdicts',{components:['autonomy_loop','outbound_channel','billing_plane'].map(id=>({id,verdict:['operational','degraded','down','unknown'].includes(report.components?.find(c=>c.id===id)?.verdict)?report.components.find(c=>c.id===id).verdict:'unclassified'}))});for(const id of ['autonomy_loop','outbound_channel','billing_plane'])need(report.components?.find(c=>c.id===id)?.verdict==='operational','compiled_storage_component');receipt.statusStoresOperational=true;
 phase('providers_http');const providersResponse=await request('/api/auth/providers',new Map());emit('http_response',{endpoint:'providers',status:providersResponse.status});phase('providers_parse');const providers=await providersResponse.json();need(Object.keys(providers).length===1&&providers.credentials,'synthetic_credentials_provider_only');
 scenario='wrong_password';await sessionAttempt('verified@example.invalid',userPassword+'-wrong',false);scenario='unverified';await sessionAttempt('unverified@example.invalid',userPassword,false);scenario='verified';await sessionAttempt('verified@example.invalid',userPassword,true);scenario='none';receipt.passwordVerificationAndCanonicalSession=true;receipt.wrongPasswordAndUnverifiedRefused=true;
 phase('membership_query');const org='ws_'+createHash('sha256').update('verified@example.invalid').digest('hex').slice(0,16);const member=(await admin.query('SELECT role,"acceptedAt" FROM "OrgMembership" WHERE "userId"=$1 AND "organizationId"=$2',['owned-verified',org])).rows;need(member.length===1&&member[0].role==='owner'&&member[0].acceptedAt,'membership_bootstrap');receipt.membershipBootstrap=true;
 phase('download_missing');await download(503);phase('download_tables');await admin.query('CREATE TABLE "DesktopPairingChallengeRecord" (id TEXT PRIMARY KEY); CREATE TABLE "DesktopSessionRecord" (id TEXT PRIMARY KEY); CREATE TABLE "TauriDeploymentRequest" (id TEXT PRIMARY KEY); CREATE TABLE "TauriPlaybook" (id TEXT PRIMARY KEY)');phase('download_ready');await download(404);phase('download_drop');await admin.query('DROP TABLE "DesktopSessionRecord"');phase('download_removed');await download(503);receipt.downloadStorageGate='503_missing_then_404_no_external_asset_then_503_removed';
 phase('compiled_sessions');const sessions=await admin.query("SELECT count(*)::int AS count FROM pg_stat_activity a JOIN pg_stat_ssl s USING(pid) WHERE a.application_name='owned_compiled_http' AND s.ssl=true");need(sessions.rows[0].count>0,'compiled_tls_sessions_observed');receipt.actualCompiledAppTlsSessions=true;receipt.buildId=fs.readFileSync(root+'/.next/BUILD_ID','utf8').trim();receipt.accepted=true;
})().catch(error=>{receipt.failure={stage,scenario,...classify(error)};emit('failure',receipt.failure);process.exitCode=1}).finally(async()=>{clearTimeout(expiry);try{phase('shutdown');await close()}catch(error){receipt.accepted=false;receipt.cleanupFailure=classify(error);emit('cleanup_failure',receipt.cleanupFailure);process.exitCode=1}fs.writeFileSync(path.join(owned,'CLIENT-RESULT.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});emit('result',{accepted:receipt.accepted,failure:receipt.failure||null});process.exit(process.exitCode||0)});
