/** Inactive customer-owned manual CI proposal, never called by Axiom routes.
 * No installer, arbitrary shell, upload endpoint, CI dispatch, apply or unlock.
 * A reviewed executable and protected workflow must be provisioned separately. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile, realpath, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PLAN_MAX=16*1024*1024,SHOW_MAX=32*1024*1024,STATE_MAX=16*1024*1024,TTL=15*60_000;
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
const normalize=value=>Array.isArray(value)?value.map(normalize):value&&typeof value==="object"?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,normalize(v)])):value;
const hash=value=>sha(JSON.stringify(normalize(value)));
function requireValue(value){if(!value)throw Error("customer_plan_producer_unavailable");}
const hex=v=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
const safePath=v=>typeof v==="string"&&v.length<=512&&/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(v)&&!v.split("/").some(s=>s==="."||s==="..");
function exact(value,keys){requireValue(value&&typeof value==="object"&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k)));return value;}
async function privateFile(file,max){const stat=await lstat(file);requireValue(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=max);const bytes=await readFile(file);requireValue(bytes.length===stat.size);return bytes;}

function plain(value){return value!==null&&typeof value==="object"&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;}
function closedJson(bytes){
 const text=new TextDecoder("utf-8",{fatal:true}).decode(bytes),value=JSON.parse(text);
 const pending=[{value,depth:0}];let nodes=0;
 while(pending.length){
  const {value:child,depth}=pending.pop();requireValue(++nodes<=10_000&&depth<=32);
  if(child&&typeof child==="object"){
   requireValue(Array.isArray(child)||plain(child));const entries=Object.entries(child);requireValue(entries.length<=1000);
   for(const [key,value] of entries){requireValue(key.length<=256&&!["__proto__","constructor","prototype"].includes(key));pending.push({value,depth:depth+1});}
  }
 }
 // Exact canonical bytes, not a regex HCL parser. Duplicate/escaped keys,
 // comments and alternative representations cannot survive this round-trip.
 requireValue(plain(value)&&Buffer.from(JSON.stringify(normalize(value)),"utf8").equals(bytes));return value;
}
/** Slice1 intentionally accepts ONLY canonical JSON Terraform configuration.
 * Scan real filesystem entries (including ignored/untracked files), not only
 * Git status. There is no HCL converter, parser or permissive init fallback. */
async function inspectClosedRoot(checkout,root,lockDigest){
 requireValue(await realpath(checkout)===path.resolve(checkout)&&root.startsWith(checkout+path.sep));
 const ancestors=[checkout];let current=checkout;
 for(const part of path.relative(checkout,root).split(path.sep)){current=path.join(current,part);ancestors.push(current);}
 for(const directory of ancestors){
  const stat=await lstat(directory);requireValue(stat.isDirectory()&&!stat.isSymbolicLink()&&await realpath(directory)===path.resolve(directory));
  try{await lstat(path.join(directory,".terraform"));throw Error("customer_plan_producer_unavailable");}catch(error){requireValue(error?.code==="ENOENT");}
 }
 const entries=await readdir(root,{withFileTypes:true});requireValue(entries.length>0&&entries.length<=1000);
 const names=entries.map(e=>e.name).sort(),records=new Map();let total=0;
 for(const entry of entries){
  const name=entry.name,lower=name.toLowerCase();requireValue(Buffer.byteLength(name)<=255&&!entry.isSymbolicLink());
  if(name===".terraform.lock.hcl"){
   const bytes=await privateFile(path.join(root,name),128*1024);requireValue(sha(bytes)===lockDigest);
   const stat=await lstat(path.join(root,name));records.set(name,{sha:createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex"),mode:stat.mode&0o111?"100755":"100644"});continue;
  }
  requireValue(!lower.startsWith(".terraform")&&!lower.includes(".tfstate")&&!/\.tf$|\.hcl$|\.tfvars(?:\.json)?$|(?:^|_)override\.tf\.json$/.test(lower));
  if(!lower.endsWith(".tf.json"))continue;
  requireValue(name.endsWith(".tf.json")&&!name.startsWith(".")&&safePath(name)&&entry.isFile());
  const bytes=await privateFile(path.join(root,name),128*1024);requireValue((total+=bytes.length)<=1024*1024);const config=closedJson(bytes);
  requireValue(Object.keys(config).every(k=>["terraform","provider","resource","data","variable","locals","output","check","moved","import","removed","module"].includes(k)));
  if(name==="backend.tf.json")requireValue(bytes.toString("utf8")===JSON.stringify(normalize({terraform:{backend:{s3:{}}}})));
  else if(Object.hasOwn(config,"terraform")){
   requireValue(plain(config.terraform)&&Object.keys(config.terraform).every(k=>["required_version","required_providers"].includes(k)));
   if(Object.hasOwn(config.terraform,"required_version"))requireValue(typeof config.terraform.required_version==="string"&&config.terraform.required_version.length<=256);
   if(Object.hasOwn(config.terraform,"required_providers"))requireValue(plain(config.terraform.required_providers));
  }
  if(Object.hasOwn(config,"module"))requireValue(plain(config.module)&&Object.keys(config.module).length===0);
  const stat=await lstat(path.join(root,name));records.set(name,{sha:createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex"),mode:stat.mode&0o111?"100755":"100644"});
 }
 requireValue(records.has("backend.tf.json")&&records.has(".terraform.lock.hcl")&&JSON.stringify((await readdir(root)).sort())===JSON.stringify(names));
 return records;
}

/** No work occurs on import. The CLI entry below uses only its fixed workflow
 * environment. Test composition replaces child_process/fetch, not verification. */
export async function produceCustomerPlan(environment){
 const env={...environment};let privateRoot;
 try{
  requireValue(env.GITHUB_ACTIONS==="true"&&env.GITHUB_EVENT_NAME==="workflow_dispatch"&&typeof env.AXIOM_PROFILE_EXPORT_JSON==="string"&&Buffer.byteLength(env.AXIOM_PROFILE_EXPORT_JSON)<=64*1024);
  const exported=exact(JSON.parse(env.AXIOM_PROFILE_EXPORT_JSON),["schema","profile","requestContentHash","targetDigest","toolchain"]);
  requireValue(exported.schema==="axiom.terraform.profile-export.v2"&&hex(exported.requestContentHash)&&hex(exported.targetDigest));
  const p=exact(exported.profile,["schema","id","organizationId","deploymentRequestId","requestVersion","environmentId","revision","repository","producer","configuration","backend","artifacts","connection"]);
  const r=exact(p.repository,["recordId","remoteId","fullName","sourceRef","sourceSha"]),w=exact(p.producer,["workflowPath","workflowSha","workflowDigest","scriptPath","scriptDigest","trustProfileId","toolchainProfileId","planRoleArn"]);
  const c=exact(p.configuration,["root","treeDigest","providerLockDigest"]),b=exact(p.backend,["kind","accountId","region","bucket","key","workspace","lockTable","lockKey"]),a=exact(p.artifacts,["bucket","region","prefix","kmsKeyArn"]);
  const toolchain=exact(exported.toolchain,["version","executableDigest"]);
  exact(p.connection,["id","version"]);
  const bucket=v=>typeof v==="string"&&/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(v)&&!v.endsWith("--x-s3");
  requireValue(p.schema==="axiom.terraform.customer-profile.v2"&&safePath(c.root)&&safePath(w.scriptPath)&&safePath(w.workflowPath)&&safePath(b.key)&&safePath(a.prefix)
   &&[w.workflowDigest,w.scriptDigest,c.treeDigest,c.providerLockDigest,toolchain.executableDigest].every(hex)&&/^1\.\d+\.\d+$/.test(toolchain.version)
   &&b.kind==="s3_dynamodb"&&b.workspace==="default"&&/^\d{12}$/.test(b.accountId)&&/^[a-z]{2}(?:-[a-z]+)+-\d$/.test(b.region)&&!b.region.startsWith("cn-")&&!b.region.startsWith("us-gov-")
   &&a.region===b.region&&bucket(b.bucket)&&bucket(a.bucket)&&a.bucket!==b.bucket&&b.lockKey===`${b.bucket}/${b.key}`&&/^[A-Za-z0-9_.-]{3,255}$/.test(b.lockTable)
   &&new RegExp(`^arn:aws:iam::${b.accountId}:role/[A-Za-z0-9_+=,.@/-]{1,512}$`).test(w.planRoleArn)&&new RegExp(`^arn:aws:kms:${b.region}:${b.accountId}:key/[a-f0-9-]{36}$`).test(a.kmsKeyArn));
  requireValue(env.GITHUB_REPOSITORY===r.fullName&&env.GITHUB_REPOSITORY_ID===r.remoteId&&env.GITHUB_SHA===r.sourceSha&&/^[a-f0-9]{40}$/.test(r.sourceSha)
   &&env.GITHUB_REF===r.sourceRef&&w.workflowSha===r.sourceSha&&env.GITHUB_WORKFLOW_SHA===w.workflowSha&&env.GITHUB_WORKFLOW_REF===`${r.fullName}/${w.workflowPath}@${r.sourceRef}`
   &&/^[1-9]\d{0,31}$/.test(env.GITHUB_RUN_ID)&&/^[1-9]\d{0,8}$/.test(env.GITHUB_RUN_ATTEMPT));
  const runId=env.GITHUB_RUN_ID,attempt=Number(env.GITHUB_RUN_ATTEMPT),started=Date.now();
  const checkout=env.GITHUB_WORKSPACE,temp=env.RUNNER_TEMP,executable=env.AXIOM_TERRAFORM_EXECUTABLE;
  requireValue([checkout,temp,executable].every(v=>typeof v==="string"&&path.isAbsolute(v)&&v.length<=1024&&path.resolve(v)===v)&&temp!==checkout&&!temp.startsWith(checkout+path.sep));
  requireValue(sha(await privateFile(executable,128*1024*1024))===toolchain.executableDigest);
  const child={PATH:"/usr/local/bin:/usr/bin:/bin",LANG:"C.UTF-8",AWS_REGION:b.region,AWS_DEFAULT_REGION:b.region,AWS_EC2_METADATA_DISABLED:"true",AWS_PAGER:"",AWS_MAX_ATTEMPTS:"1",AWS_CLI_AUTO_PROMPT:"off"};
  for(const name of ["HTTP_PROXY","HTTPS_PROXY","ALL_PROXY","NO_PROXY","http_proxy","https_proxy","all_proxy","no_proxy","NODE_EXTRA_CA_CERTS","AWS_CA_BUNDLE","REQUESTS_CA_BUNDLE","SSL_CERT_FILE","SSL_CERT_DIR"]){if(typeof env[name]==="string")child[name]=env[name];}
  privateRoot=await mkdtemp(path.join(temp,"axiom-plan-private-"));
  // Omitting HOME alone does not prevent AWS tools from discovering a runner
  // home through the OS account database. Pin all profile/config readers to
  // one owned empty file; only this job's verified CI role credentials follow.
  const emptyConfig=path.join(privateRoot,"empty-config");await writeFile(emptyConfig,"",{mode:0o600,flag:"wx"});
  child.AWS_CONFIG_FILE=emptyConfig;child.AWS_SHARED_CREDENTIALS_FILE=emptyConfig;child.BOTO_CONFIG=emptyConfig;
  child.GIT_CONFIG_NOSYSTEM="1";child.GIT_CONFIG_GLOBAL=emptyConfig;child.GIT_TERMINAL_PROMPT="0";
  child.TF_DATA_DIR=path.join(privateRoot,"terraform-data");child.TF_CLI_CONFIG_FILE=path.join(privateRoot,"terraform.rc");child.TF_IN_AUTOMATION="true";child.TF_INPUT="0";child.TF_WORKSPACE="default";
  await writeFile(child.TF_CLI_CONFIG_FILE,'disable_checkpoint = true\nprovider_installation {\n  direct {}\n}\n',{mode:0o600});
  const root=path.join(checkout,c.root),call=(file,args,{max=512*1024,timeout=60_000,cwd=root}={})=>{
   requireValue(Date.now()-started<TTL);return execFileSync(file,args,{cwd,env:{...child},maxBuffer:max,timeout,stdio:["ignore","pipe","pipe"],windowsHide:true});
  };
  const git=args=>call("/usr/bin/git",args,{cwd:checkout,max:2*1024*1024}).toString("utf8");
  const tf=(args,options={})=>call(executable,args,options);
  async function checkSource(){
   const configs=await inspectClosedRoot(checkout,root,c.providerLockDigest);
   requireValue(git(["rev-parse","HEAD"]).trim()===r.sourceSha&&git(["status","--porcelain","--untracked-files=all"])==="");
   requireValue(sha(await privateFile(path.join(checkout,w.workflowPath),128*1024))===w.workflowDigest&&sha(await privateFile(path.join(checkout,w.scriptPath),128*1024))===w.scriptDigest
    &&sha(await privateFile(path.join(root,".terraform.lock.hcl"),128*1024))===c.providerLockDigest&&sha(await privateFile(executable,128*1024*1024))===toolchain.executableDigest);
   const entries=git(["ls-tree","-rz",r.sourceSha,"--",c.root]).split("\0").filter(Boolean);requireValue(entries.length>0&&entries.length<=1000);
   const tree=[];let total=0;
   for(const entry of entries){
    const match=/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(entry);requireValue(match&&match[3].startsWith(c.root+"/"));
    const relative=match[3].slice(c.root.length+1);requireValue(safePath(relative)&&!relative.startsWith(".terraform/"));
    const bytes=await privateFile(path.join(checkout,match[3]),STATE_MAX);requireValue((total+=bytes.length)<=STATE_MAX&&createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex")===match[2]);
    if(configs.has(relative)){const config=configs.get(relative);requireValue(config.sha===match[2]&&config.mode===match[1]);configs.delete(relative);}
    tree.push({path:relative,mode:match[1],sha:match[2]});
   }
   tree.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);requireValue(configs.size===0&&hash(tree)===c.treeDigest);
  }
  await checkSource();
  requireValue(JSON.parse(tf(["version","-json"]).toString("utf8")).terraform_version===toolchain.version);
  const oidcUrl=new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  requireValue(oidcUrl.protocol==="https:"&&!oidcUrl.username&&!oidcUrl.password&&!oidcUrl.port&&oidcUrl.hostname.endsWith(".actions.githubusercontent.com")&&typeof env.ACTIONS_ID_TOKEN_REQUEST_TOKEN==="string"&&env.ACTIONS_ID_TOKEN_REQUEST_TOKEN.length>0);
  oidcUrl.searchParams.set("audience","sts.amazonaws.com");
  const tokenResponse=await fetch(oidcUrl,{headers:{Authorization:`Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`},redirect:"error",signal:AbortSignal.timeout(10_000)});
  requireValue(tokenResponse.ok&&tokenResponse.body&&(!tokenResponse.headers.get("content-length")||/^\d+$/.test(tokenResponse.headers.get("content-length"))&&Number(tokenResponse.headers.get("content-length"))<=64*1024));
  const tokenParts=[];let tokenSize=0;
  const tokenReader=tokenResponse.body.getReader();
  try{while(true){const part=await tokenReader.read();if(part.done)break;requireValue((tokenSize+=part.value.byteLength)<=64*1024);tokenParts.push(Buffer.from(part.value));}}finally{await tokenReader.cancel();}
  const jwt=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(tokenParts))).value;requireValue(typeof jwt==="string"&&jwt.length>0&&jwt.length<=32*1024);
  const tokenFile=path.join(privateRoot,"oidc-token");await writeFile(tokenFile,jwt,{mode:0o600});
  const aws=(service,operation,args=[],outputFile)=>{
   const endpoint=`https://${service=== "s3api"?"s3":service}.${b.region}.amazonaws.com`;
   const argv=[service,operation,...args,"--region",b.region,"--endpoint-url",endpoint,"--output","json","--no-cli-pager",...(outputFile?[outputFile]:[])];
   return JSON.parse(call("/usr/local/bin/aws",argv).toString("utf8"));
  };
  const sessionName=`axiom-plan-${runId}-${attempt}`;requireValue(sessionName.length<=64);
  const assumed=aws("sts","assume-role-with-web-identity",["--role-arn",w.planRoleArn,"--role-session-name",sessionName,"--web-identity-token",`file://${tokenFile}`,"--duration-seconds","900"]);
  await rm(tokenFile,{force:true});
  const roleName=w.planRoleArn.split("/").at(-1),expectedArn=`arn:aws:sts::${b.accountId}:assumed-role/${roleName}/${sessionName}`;
  requireValue(assumed.AssumedRoleUser?.Arn===expectedArn&&[assumed.Credentials?.AccessKeyId,assumed.Credentials?.SecretAccessKey,assumed.Credentials?.SessionToken].every(v=>typeof v==="string"&&v.length>0));
  child.AWS_ACCESS_KEY_ID=assumed.Credentials.AccessKeyId;child.AWS_SECRET_ACCESS_KEY=assumed.Credentials.SecretAccessKey;child.AWS_SESSION_TOKEN=assumed.Credentials.SessionToken;
  function checkIdentity(){const identity=aws("sts","get-caller-identity");requireValue(identity.Account===b.accountId&&identity.Arn===expectedArn);}
  checkIdentity();
  const owner=["--expected-bucket-owner",b.accountId],stateSelector=["--bucket",b.bucket,"--key",b.key,...owner];
  requireValue(aws("s3api","get-bucket-versioning",["--bucket",b.bucket,...owner]).Status==="Enabled"&&aws("s3api","get-bucket-versioning",["--bucket",a.bucket,...owner]).Status==="Enabled");
  async function readState(){
   const head=aws("s3api","head-object",stateSelector);requireValue(typeof head.VersionId==="string"&&head.VersionId!=="null"&&head.VersionId.length>0&&Number.isSafeInteger(head.ContentLength)&&head.ContentLength>0&&head.ContentLength<=STATE_MAX);
   const file=path.join(privateRoot,"state.json"),get=aws("s3api","get-object",[...stateSelector,"--version-id",head.VersionId],file);
   const bytes=await privateFile(file,STATE_MAX);requireValue(get.VersionId===head.VersionId&&bytes.length===head.ContentLength);
   const value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));requireValue(value.version===4&&typeof value.lineage==="string"&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.lineage)&&Number.isSafeInteger(value.serial)&&value.serial>=0);
   requireValue(aws("s3api","head-object",stateSelector).VersionId===head.VersionId);
   return {versionId:head.VersionId,digest:sha(bytes),lineage:value.lineage,serial:value.serial};
  }
  function unlocked(){const lock=aws("dynamodb","get-item",["--table-name",b.lockTable,"--key",JSON.stringify({LockID:{S:b.lockKey}}),"--consistent-read"]);requireValue(lock.Item===undefined);}
  unlocked();const stateBefore=await readState();
  // Revalidate the actual closed root and immutable tracked bytes immediately
  // before credentials can reach init. Retain the post-init checks below.
  await checkSource();
  tf(["init","-input=false","-no-color","-lockfile=readonly",`-backend-config=bucket=${b.bucket}`,`-backend-config=key=${b.key}`,`-backend-config=region=${b.region}`,`-backend-config=dynamodb_table=${b.lockTable}`,"-backend-config=encrypt=true",`-backend-config=allowed_account_ids=[\"${b.accountId}\"]`],{timeout:180_000});
  // Provider lock pins providers only. Init may download modules, so refuse ALL
  // non-root entries before planning; remote/local modules are outside slice1.
  const modules=JSON.parse((await privateFile(path.join(child.TF_DATA_DIR,"modules/modules.json"),128*1024)).toString("utf8"));
  requireValue(Array.isArray(modules.Modules)&&modules.Modules.length===1&&modules.Modules[0].Key===""&&modules.Modules[0].Source===""&&modules.Modules[0].Dir===".");
  const metadata=JSON.parse((await privateFile(path.join(child.TF_DATA_DIR,"terraform.tfstate"),512*1024)).toString("utf8"));
  requireValue(metadata.backend?.type==="s3");const backend=metadata.backend.config;
  const expected={bucket:b.bucket,key:b.key,region:b.region,dynamodb_table:b.lockTable,encrypt:true,allowed_account_ids:[b.accountId]};
  for(const [key,value] of Object.entries(expected))requireValue(hash(backend[key])===hash(value));
  // Reject endpoint, role, profile, alternate workspace or credential overrides.
  // Version-specific null/default fields are allowed; any unknown nondefault
  // setting needs a separately reviewed toolchain/protocol revision.
  for(const [key,value] of Object.entries(backend))if(!Object.hasOwn(expected,key))requireValue(value===null||value===false||Array.isArray(value)&&value.length===0||key==="workspace_key_prefix"&&value==="env:");
  requireValue(tf(["workspace","show"]).toString("utf8").trim()==="default");await checkSource();
  const binaryFile=path.join(privateRoot,"plan.tfplan");
  tf(["plan","-input=false","-no-color","-lock=true","-lock-timeout=60s",`-out=${binaryFile}`],{timeout:300_000});
  const binary=await privateFile(binaryFile,PLAN_MAX),binaryDigest=sha(binary);
  const show=tf(["show","-json",binaryFile],{max:SHOW_MAX,timeout:60_000});requireValue(show.length>0&&show.length<=SHOW_MAX&&sha(await privateFile(binaryFile,PLAN_MAX))===binaryDigest);
  const showJson=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(show));requireValue(showJson.terraform_version===toolchain.version&&showJson.format_version==="1.2"&&Array.isArray(showJson.resource_changes)&&showJson.errored!==true);
  await checkSource();checkIdentity();unlocked();const stateAfter=await readState();requireValue(hash(stateAfter)===hash(stateBefore)&&Date.now()-started<TTL);
  const receipt={schema:"axiom.terraform.plan-receipt.v2",profileDigest:hash(p),requestContentHash:exported.requestContentHash,targetDigest:exported.targetDigest,
   producer:{repositoryId:r.remoteId,repositoryFullName:r.fullName,sourceRef:r.sourceRef,sourceSha:r.sourceSha,workflowPath:w.workflowPath,workflowSha:w.workflowSha,runId,runAttempt:attempt,roleArn:w.planRoleArn},
   backendIdentityDigest:hash(b),workspace:"default",stateBefore,stateAfter,lock:"released",configurationDigest:c.treeDigest,providerLockDigest:c.providerLockDigest,terraformVersion:toolchain.version,executableDigest:toolchain.executableDigest,
   binary:{digest:binaryDigest,bytes:binary.length},show:{digest:sha(show),bytes:show.length},createdAt:new Date(started).toISOString(),expiresAt:new Date(started+TTL).toISOString()};
  const receiptBytes=Buffer.from(JSON.stringify(receipt));requireValue(receiptBytes.length<=64*1024);
  const output=path.join(temp,"axiom-customer-plan");await mkdir(output,{mode:0o700});
  for(const [name,bytes] of [["plan.tfplan",binary],["plan.show.json",show],["plan.receipt.json",receiptBytes]]){
   const file=path.join(output,name);await writeFile(file,bytes,{mode:0o600,flag:"wx"});
   const uploaded=aws("s3api","put-object",["--bucket",a.bucket,"--key",`${a.prefix}/${r.remoteId}/${runId}/${attempt}/${name}`,"--body",file,...owner,"--server-side-encryption","aws:kms","--ssekms-key-id",a.kmsKeyArn,"--checksum-algorithm","SHA256","--checksum-sha256",createHash("sha256").update(bytes).digest("base64"),"--if-none-match","*"]);
   requireValue(typeof uploaded.VersionId==="string"&&uploaded.VersionId.length>0&&uploaded.VersionId!=="null");
  }
  return {kind:"customer_plan_emitted",directory:output,subjects:["plan.tfplan","plan.show.json","plan.receipt.json"]};
 }catch{throw Error("customer_plan_producer_unavailable");}
 finally{if(privateRoot)await rm(privateRoot,{recursive:true,force:true});}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 produceCustomerPlan(process.env).catch(()=>{process.stderr.write("customer_plan_producer_unavailable\n");process.exitCode=1;});
}
