import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { beforeEach, expect, it, vi } from "vitest";
import { customerProfile } from "./customerPlanFixtures";
const m=vi.hoisted(()=>({requests:[] as Array<{method:string;hostname:string;path:string;query:Record<string,string>;headers:Record<string,string>;body?:string}>,mode:"ok",native:vi.fn(),destroy:vi.fn(),bytes:0,bodies:[] as import("node:http").IncomingMessage[]}));
// Actual AWS SDK serialization/deserialization + actual bounded stream handler;
// only its lowest native transport is replaced. No connect/DNS/send occurs.
vi.mock("@smithy/node-http-handler",()=>({NodeHttpHandler:class {
 constructor(){m.native();}
 async handle(request:{method:string;hostname:string;path:string;query:Record<string,string>;headers:Record<string,string>;body?:string}){
  m.requests.push(request);let status=200,data="";const headers:Record<string,string>={};
  if(request.hostname==="dynamodb.us-east-1.amazonaws.com"){
   if(request.headers["x-amz-target"]!=="DynamoDB_20120810.GetItem")throw Error("unexpected synthetic operation");
   if(m.mode==="lockDenied"){status=403;data=JSON.stringify({__type:"AccessDeniedException",message:"synthetic denial"});}
   else data=JSON.stringify(m.mode==="locked"?{Item:{LockID:{S:"customer-state/infra/terraform.tfstate"},Info:{S:"synthetic private lock"}}}:m.mode==="malformedLock"?{Item:{}}:{});
   headers["content-type"]="application/x-amz-json-1.0";
  }else if(request.hostname==="s3.us-east-1.amazonaws.com"){
   if(["/customer-state/","/customer-state","/customer-plan-artifacts/","/customer-plan-artifacts"].includes(request.path))data=m.mode==="http200Error"?'<Error><Code>AccessDenied</Code></Error>':m.mode==="stall"||m.mode==="sourceError"?'<VersioningConfiguration>':`<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Status>${m.mode==="unversioned"?"Suspended":"Enabled"}</Status></VersioningConfiguration>`;
   else if(request.path.startsWith("/customer-plan-artifacts/axiom-plans/12345/888/1/")){
    const file=request.path.split("/").at(-1)!;
    if(!["plan.tfplan","plan.show.json","plan.receipt.json"].includes(file))throw Error("unexpected synthetic artifact");
    const bytes=`synthetic-${file}`;data=request.method==="HEAD"?"":bytes;
    headers["content-length"]=String(Buffer.byteLength(bytes));headers["x-amz-version-id"]="artifact-version";
    headers["x-amz-server-side-encryption"]=m.mode==="artifactUnencrypted"?"AES256":"aws:kms";
    headers["x-amz-server-side-encryption-aws-kms-key-id"]=m.mode==="artifactWrongKms"?"wrong-key":customerProfile().artifacts.kmsKeyArn;
   }
   else if(request.path==="/customer-state/infra/terraform.tfstate"){
    const state=JSON.stringify({version:4,terraform_version:"1.9.8",lineage:"00000000-0000-0000-0000-000000000002",serial:9,resources:[],outputs:{secret:{value:"DO-NOT-LEAK"}}});
    data=request.method==="HEAD"?"":m.mode==="invalidState"?state.replace('"version":4','"version":3'):state;headers["x-amz-version-id"]=m.mode==="changedVersion"&&m.requests.filter(r=>r.method==="HEAD").length>1||m.mode==="getVersionMismatch"&&request.method==="GET"?"changed-state-version":m.mode==="nullVersion"?"null":"owned-state-version";
    headers["content-length"]=String(Buffer.byteLength(state));headers["x-amz-server-side-encryption"]="AES256";
    if(m.mode==="oversized")headers["content-length"]=String(33*1024*1024);
   }else throw Error(`unexpected synthetic path:${request.path}`);
   headers["content-type"]="application/xml";
  }else throw Error("unmatched synthetic endpoint");
  const body=new IncomingMessage(new Socket());m.bodies.push(body);m.bytes+=Buffer.byteLength(data);body.push(Buffer.from(data));
  if(m.mode==="sourceError")setImmediate(()=>body.destroy(Error("synthetic source failure")));else if(m.mode!=="stall")body.push(null);
  return {response:{statusCode:status,reason:"synthetic",headers,body}};
 }
 destroy(){m.destroy();}
}}));
import { readCustomerPlanAws } from "../customerPlanAwsRead";
beforeEach(()=>{m.requests=[];m.mode="ok";m.native.mockClear();m.destroy.mockClear();m.bytes=0;m.bodies=[];});
const input=()=>({profile:customerProfile(),credentials:{accessKeyId:"ASIA-SYNTHETIC-ONLY",secretAccessKey:"synthetic-secret-not-real",sessionToken:"synthetic-session-not-real"},accountId:"123456789012",signal:new AbortController().signal});
it("uses actual SDK fixed S3 reads and strongly consistent GetItem without returning state values or credentials",async()=>{
 const result=await readCustomerPlanAws(input());
 expect(result).toMatchObject({kind:"observed_customer_backend",state:{versionId:"owned-state-version",serial:9},lock:"unlocked_at_observation"});
 expect(JSON.stringify(result)).not.toContain("DO-NOT-LEAK");expect(JSON.stringify(result)).not.toContain("synthetic-secret");
 const ddb=m.requests.find(r=>r.hostname.startsWith("dynamodb."));expect(JSON.parse(ddb!.body!)).toMatchObject({TableName:"terraform-locks",ConsistentRead:true,Key:{LockID:{S:"customer-state/infra/terraform.tfstate"}}});
 expect(m.requests.every(r=>r.hostname==="s3.us-east-1.amazonaws.com"||r.hostname==="dynamodb.us-east-1.amazonaws.com")).toBe(true);
 expect(m.requests.filter(r=>r.hostname.startsWith("s3.")).every(r=>r.method==="GET"||r.method==="HEAD")).toBe(true);
 expect(m.requests.filter(r=>r.hostname.startsWith("s3.")).every(r=>r.headers["x-amz-expected-bucket-owner"]==="123456789012")).toBe(true);
 expect(m.requests.find(r=>r.path.endsWith("terraform.tfstate")&&r.method==="GET")?.query.versionId).toBe("owned-state-version");
});
it.each(["locked","lockDenied","changedVersion","oversized","malformedLock","unversioned","invalidState","getVersionMismatch","nullVersion"])("fails closed on %s without silently returning unlocked/current",async mode=>{
 m.mode=mode;const result=await readCustomerPlanAws(input());expect(result.kind).toBe("unavailable");
 if(mode==="locked")expect(result).toMatchObject({reason:"customer_plan_backend_locked"});
});
it("rejects foreign identities/unsupported targets/aborted work before native transport construction",async()=>{
 const value=input();value.accountId="999999999999";expect((await readCustomerPlanAws(value)).kind).toBe("unavailable");expect(m.native).not.toHaveBeenCalled();
 const other=input();other.profile.backend.workspace="other";expect((await readCustomerPlanAws(other)).kind).toBe("unavailable");expect(m.native).not.toHaveBeenCalled();
 const controller=new AbortController();controller.abort();expect((await readCustomerPlanAws({...input(),signal:controller.signal})).kind).toBe("unavailable");expect(m.native).not.toHaveBeenCalled();
});
it("reads only the three fixed run-scoped version-pinned SSE-KMS objects as untrusted private bytes",async()=>{
 const result=await readCustomerPlanAws({...input(),run:{id:"888",attempt:1}});
 expect(result).toMatchObject({kind:"observed_customer_backend",artifacts:{binary:{versionId:"artifact-version"},show:{versionId:"artifact-version"},receipt:{versionId:"artifact-version"}}});
 if(result.kind!=="observed_customer_backend")throw Error("expected observation");
 expect(Buffer.from(result.artifacts!.binary.bytes).toString()).toBe("synthetic-plan.tfplan");
 const reads=m.requests.filter(r=>r.method==="GET"&&r.path.startsWith("/customer-plan-artifacts/axiom-plans/"));
 expect(reads).toHaveLength(3);expect(reads.every(r=>r.query.versionId==="artifact-version")).toBe(true);
});
it.each(["artifactUnencrypted","artifactWrongKms"])("refuses %s artifact metadata without returning a partial bundle",async mode=>{
 m.mode=mode;expect(await readCustomerPlanAws({...input(),run:{id:"888",attempt:1}})).toMatchObject({kind:"unavailable"});
});
it.each([0,Number.NaN,Number.POSITIVE_INFINITY,1.5,96*1024*1024+1])("rejects invalid/exhausted owned budget %s before native construction",async remaining=>{
 expect(await readCustomerPlanAws({...input(),budget:{remaining}})).toMatchObject({kind:"unavailable"});expect(m.native).not.toHaveBeenCalled();
});
it("debits actual response bytes and refuses a final observation once the shared budget is exhausted",async()=>{
 const budget={remaining:64};expect(await readCustomerPlanAws({...input(),budget})).toMatchObject({kind:"unavailable"});expect(budget.remaining).toBe(0);
 m.native.mockClear();expect(await readCustomerPlanAws({...input(),budget})).toMatchObject({kind:"unavailable"});expect(m.native).not.toHaveBeenCalled();
});
it("charges native response bytes once while actual S3 middleware collects/inspects the body",async()=>{
 const budget={remaining:96*1024*1024};expect((await readCustomerPlanAws({...input(),budget})).kind).toBe("observed_customer_backend");expect(budget.remaining).toBe(96*1024*1024-m.bytes);expect(m.destroy).toHaveBeenCalledTimes(2);
});
it.each(["sourceError","http200Error"])("retains actual S3 %s failure classification without extra requests or leaked body values",async mode=>{
 m.mode=mode;const budget={remaining:96*1024*1024};const result=await readCustomerPlanAws({...input(),budget});expect(result).toEqual({kind:"unavailable",reason:"customer_plan_backend_unavailable"});
 expect(m.requests).toHaveLength(1);expect(budget.remaining).toBe(96*1024*1024-m.bytes);expect(m.destroy).toHaveBeenCalledTimes(2);expect(m.bodies.every(b=>b.destroyed)).toBe(true);
});
it.each(["abort","deadline"])("settles actual S3 collector %s and cleans native ownership",async mode=>{
 m.mode="stall";const parent=new AbortController(),budget={remaining:96*1024*1024};
 const signal=mode==="deadline"?AbortSignal.any([parent.signal,AbortSignal.timeout(100)]):parent.signal;
 const pending=readCustomerPlanAws({...input(),signal,budget});
 if(mode==="abort"){await vi.waitFor(()=>expect(m.requests).toHaveLength(1));parent.abort();}
 try{expect(await pending).toEqual({kind:"unavailable",reason:"customer_plan_backend_unavailable"});expect(m.requests).toHaveLength(1);expect(m.destroy).toHaveBeenCalledTimes(2);expect(m.bodies.every(b=>b.destroyed)).toBe(true);expect(budget.remaining).toBe(96*1024*1024-m.bytes);}
 finally{parent.abort();}
});
// Reviewed middleware-sdk-s3 3.972.89 collects once and replays bounded bytes;
// it no longer creates the second tee branch that the old SDK could orphan.
it.each(["sourceError","abort"])("retains %s through the actual SDK collector without creating orphan tee branches",async mode=>{
 const spy=vi.spyOn(ReadableStream.prototype,"tee");
 const parent=new AbortController(),budget={remaining:96*1024*1024};m.mode=mode==="abort"?"stall":"sourceError";
 try{
  const pending=readCustomerPlanAws({...input(),signal:parent.signal,budget});if(mode==="abort"){await vi.waitFor(()=>expect(m.requests).toHaveLength(1));parent.abort();}
  expect(await pending).toEqual({kind:"unavailable",reason:"customer_plan_backend_unavailable"});
  expect(spy).not.toHaveBeenCalled();expect(m.requests).toHaveLength(1);
  expect(budget.remaining).toBe(96*1024*1024-m.bytes);
  expect(m.bodies.every(b=>b.destroyed)).toBe(true);expect(m.destroy).toHaveBeenCalledTimes(2);
 }finally{parent.abort();spy.mockRestore();}
});
