import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import path from "node:path";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { customerProfile,hash } from "./customerPlanFixtures";
import { bytesDigest } from "../savedPlanArtifact";
const m=vi.hoisted(()=>({exec:vi.fn(),mode:"ok",root:"",sourceSha:"",tree:"",state:"",role:"",outputs:[] as Array<Record<string,unknown>>}));
// Every child process and OIDC HTTP request is replaced. The only real IO is
// owned temporary files; synthetic output is never a genuine Terraform fixture.
vi.mock("node:child_process",()=>({execFileSync:m.exec}));
import { produceCustomerPlan } from "../../../scripts/terraform/customer-plan-producer.mjs";
let owned="",env:Record<string,string>,profile:ReturnType<typeof customerProfile>;
beforeEach(async()=>{
 m.exec.mockReset();m.mode="ok";m.outputs=[];owned=await mkdtemp(path.join(tmpdir(),"axiom-producer-pure-"));
 const checkout=path.join(owned,"checkout"),temp=path.join(owned,"runner-temp"),cli=path.join(owned,"terraform");
 await mkdir(path.join(checkout,"infra"),{recursive:true});await mkdir(path.join(checkout,".github/workflows"),{recursive:true});await mkdir(path.join(checkout,"scripts/terraform"),{recursive:true});await mkdir(temp);
 await writeFile(cli,"SYNTHETIC-EXECUTABLE-NEVER-RUN");await writeFile(path.join(checkout,".github/workflows/plan.yml"),"fixture-workflow");await writeFile(path.join(checkout,"scripts/terraform/customer-plan-producer.mjs"),"fixture-script");await writeFile(path.join(checkout,"infra/.terraform.lock.hcl"),"fixture-lock");
 profile=customerProfile();profile.producer.workflowDigest=bytesDigest("fixture-workflow");profile.producer.scriptDigest=bytesDigest("fixture-script");profile.configuration.providerLockDigest=bytesDigest("fixture-lock");
 const blob=createHash("sha1").update(`blob ${Buffer.byteLength("fixture-lock")}\0fixture-lock`).digest("hex");
 const tree=[{path:".terraform.lock.hcl",mode:"100644",sha:blob}];profile.configuration.treeDigest=hash(tree);
 m.root=checkout;m.sourceSha=profile.repository.sourceSha;m.tree=`100644 blob ${blob}\tinfra/.terraform.lock.hcl\0`;
 m.state=JSON.stringify({version:4,lineage:"00000000-0000-0000-0000-000000000002",serial:9,outputs:{secret:{value:"DO-NOT-LEAK"}}});m.role="arn:aws:sts::123456789012:assumed-role/customer-ci-plan/axiom-plan-888-1";
 env={GITHUB_ACTIONS:"true",GITHUB_EVENT_NAME:"workflow_dispatch",GITHUB_WORKSPACE:checkout,RUNNER_TEMP:temp,GITHUB_REPOSITORY:profile.repository.fullName,GITHUB_REPOSITORY_ID:profile.repository.remoteId,GITHUB_SHA:profile.repository.sourceSha,GITHUB_REF:profile.repository.sourceRef,GITHUB_WORKFLOW_REF:`${profile.repository.fullName}/${profile.producer.workflowPath}@${profile.repository.sourceRef}`,GITHUB_WORKFLOW_SHA:profile.producer.workflowSha,GITHUB_RUN_ID:"888",GITHUB_RUN_ATTEMPT:"1",ACTIONS_ID_TOKEN_REQUEST_URL:"https://pipelines.actions.githubusercontent.com/owned/idtoken",ACTIONS_ID_TOKEN_REQUEST_TOKEN:"synthetic-oidc-request",AXIOM_TERRAFORM_EXECUTABLE:cli,AXIOM_PROFILE_EXPORT_JSON:"",HOME:"must-not-forward",NODE_OPTIONS:"must-not-forward",DATABASE_URL:"must-not-forward",GITHUB_TOKEN:"must-not-forward",AWS_ACCESS_KEY_ID:"must-not-forward",HTTPS_PROXY:"http://managed-proxy.invalid",NODE_EXTRA_CA_CERTS:"/managed/ca.pem"};
 env.AXIOM_PROFILE_EXPORT_JSON=JSON.stringify({schema:"axiom.terraform.profile-export.v2",profile,requestContentHash:hash("request"),targetDigest:hash("target"),toolchain:{version:"1.9.8",executableDigest:bytesDigest("SYNTHETIC-EXECUTABLE-NEVER-RUN")}});
 vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({value:"synthetic-oidc-jwt"}),{headers:{"content-type":"application/json"}})));
 m.exec.mockImplementation((file:string,args:string[],options:{env:Record<string,string>;cwd:string})=>{
  const command=path.basename(file);
  if(command==="git")return Buffer.from(args[0]==="rev-parse"?m.sourceSha:args[0]==="status"?"":m.tree);
  if(command==="aws"){
   if(args[0]==="sts")return Buffer.from(JSON.stringify(args[1]==="assume-role-with-web-identity"?{AssumedRoleUser:{Arn:m.role},Credentials:{AccessKeyId:"synthetic-ci-key",SecretAccessKey:"synthetic-ci-secret",SessionToken:"synthetic-ci-token"}}:{Account:"123456789012",Arn:m.role}));
   if(args[0]==="dynamodb")return Buffer.from(JSON.stringify(m.mode==="heldLock"?{Item:{LockID:{S:profile.backend.lockKey}}}:{}));
   if(args[1]==="get-bucket-versioning")return Buffer.from('{"Status":"Enabled"}');
   if(args[1]==="head-object")return Buffer.from(JSON.stringify({VersionId:m.mode==="changedState"&&m.exec.mock.calls.some(([,a])=>(a as string[])[0]==="plan")?"changed-version":"state-version",ContentLength:Buffer.byteLength(m.state)}));
   if(args[1]==="get-object"){writeFileSync(args.at(-1)!,m.state);return Buffer.from(JSON.stringify({VersionId:"state-version",ContentLength:Buffer.byteLength(m.state)}));}
   if(args[1]==="put-object"){m.outputs.push({args:[...args],bytes:readFileSync(args[args.indexOf("--body")+1])});return Buffer.from('{"VersionId":"artifact-version"}');}
   throw Error("unmatched synthetic AWS operation");
  }
  if(command==="terraform"){
   if(args[0]==="version")return Buffer.from('{"terraform_version":"1.9.8"}');
   if(args[0]==="init"){
    const data=options.env.TF_DATA_DIR;mkdirSync(path.join(data,"modules"),{recursive:true});
    writeFileSync(path.join(data,"modules/modules.json"),JSON.stringify({Modules:[{Key:"",Source:"",Dir:"."},...(m.mode==="remoteModule"?[{Key:"unsafe",Source:"github.com/example/module",Dir:".terraform/modules/unsafe"}]:[])]}));
    writeFileSync(path.join(data,"terraform.tfstate"),JSON.stringify({backend:{type:"s3",config:{bucket:profile.backend.bucket,key:profile.backend.key,region:profile.backend.region,dynamodb_table:profile.backend.lockTable,encrypt:true,allowed_account_ids:["123456789012"],...(m.mode==="backendEndpoint"?{endpoint:"https://unmatched.invalid"}:{})}}}));return Buffer.from("");
   }
   if(args[0]==="workspace")return Buffer.from("default\n");
   if(args[0]==="plan"){if(m.mode==="planFailure")throw Error("private CLI failure");if(m.mode==="changedLock")writeFileSync(path.join(m.root,"infra/.terraform.lock.hcl"),"CHANGED");writeFileSync(args.find(s=>s.startsWith("-out="))!.slice(5),"SYNTHETIC-PLAN-BYTES");return Buffer.from("");}
   if(args[0]==="show"){if(m.mode==="changedBinary")writeFileSync(args.at(-1)!,"CHANGED");if(m.mode==="changedExecutable")writeFileSync(file,"CHANGED");return Buffer.from(JSON.stringify({format_version:"1.2",terraform_version:"1.9.8",resource_changes:[]}));}
  }
  throw Error(`unmatched synthetic command:${command}`);
 });
});
afterEach(async()=>{vi.unstubAllGlobals();await rm(owned,{recursive:true,force:true});});
it("produces only the exact binary/own-show/receipt tuple with locking and an isolated child environment (synthetic protocol test)",async()=>{
 const result=await produceCustomerPlan(env);expect(result).toMatchObject({kind:"customer_plan_emitted"});expect(m.outputs).toHaveLength(3);
 const receipt=JSON.parse(await readFile(path.join(env.RUNNER_TEMP,"axiom-customer-plan/plan.receipt.json"),"utf8"));
 expect(receipt).toMatchObject({schema:"axiom.terraform.plan-receipt.v2",profileDigest:hash(profile),lock:"released",workspace:"default",producer:{runId:"888",runAttempt:1,roleArn:profile.producer.planRoleArn},binary:{digest:bytesDigest("SYNTHETIC-PLAN-BYTES")}});
 expect(JSON.stringify(result)).not.toContain("DO-NOT-LEAK");expect(JSON.stringify(receipt)).not.toContain("DO-NOT-LEAK");
 const plan=m.exec.mock.calls.find(([,a])=>(a as string[])[0]==="plan")!;expect(plan[1]).toEqual(expect.arrayContaining(["-lock=true","-lock-timeout=60s"]));
 expect(m.exec.mock.calls.every(([,args])=>!(args as string[]).includes("apply")&&!(args as string[]).includes("force-unlock"))).toBe(true);
 for(const [,,options] of m.exec.mock.calls){const e=options.env;expect(e).not.toHaveProperty("HOME");expect(e).not.toHaveProperty("GITHUB_TOKEN");expect(e).not.toHaveProperty("NODE_OPTIONS");expect(e).not.toHaveProperty("DATABASE_URL");expect(e.HTTPS_PROXY).toBe(env.HTTPS_PROXY);expect(e.NODE_EXTRA_CA_CERTS).toBe(env.NODE_EXTRA_CA_CERTS);expect(e.AWS_ACCESS_KEY_ID).not.toBe("must-not-forward");}
});
it.each(["remoteModule","planFailure","changedBinary","changedExecutable","changedState","heldLock","changedLock","backendEndpoint"])("refuses %s and publishes no objects",async mode=>{
 m.mode=mode;await expect(produceCustomerPlan(env)).rejects.toThrow();expect(m.outputs).toHaveLength(0);
 if(mode==="remoteModule"||mode==="heldLock")expect(m.exec.mock.calls.some(([,a])=>(a as string[])[0]==="plan")).toBe(false);
});
it.each(["event","repository","source","workflow","toolchain"])("refuses unreviewed %s before cloud or Terraform commands",async mode=>{
 if(mode==="event")env.GITHUB_EVENT_NAME="push";if(mode==="repository")env.GITHUB_REPOSITORY="foreign/repo";if(mode==="source")env.GITHUB_SHA="f".repeat(40);if(mode==="workflow")env.GITHUB_WORKFLOW_SHA="f".repeat(40);if(mode==="toolchain")await writeFile(env.AXIOM_TERRAFORM_EXECUTABLE,"CHANGED");
 await expect(produceCustomerPlan(env)).rejects.toThrow();expect(m.exec).not.toHaveBeenCalled();
});
it("denies an unmatched OIDC origin without requesting a token or AWS access",async()=>{
 env.ACTIONS_ID_TOKEN_REQUEST_URL="https://unmatched.invalid/token";await expect(produceCustomerPlan(env)).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();expect(m.exec.mock.calls.some(([file])=>path.basename(file)==="aws")).toBe(false);
});
it("never invokes Axiom planning or an installer and leaves no owned state/token files",async()=>{
 const result=await produceCustomerPlan(env);expect(result.directory).toBe(path.join(env.RUNNER_TEMP,"axiom-customer-plan"));
 const {readdir}=await import("node:fs/promises");expect(await readdir(env.RUNNER_TEMP)).toEqual(["axiom-customer-plan"]);
 expect(m.exec.mock.calls.every(([file])=>["git","aws","terraform"].includes(path.basename(file)))).toBe(true);
});
