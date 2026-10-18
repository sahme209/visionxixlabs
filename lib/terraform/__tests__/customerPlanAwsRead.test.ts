import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { beforeEach, expect, it, vi } from "vitest";
import { customerProfile } from "./customerPlanFixtures";
const m=vi.hoisted(()=>({requests:[] as Array<{method:string;hostname:string;path:string;query:Record<string,string>;headers:Record<string,string>;body?:string}>,mode:"ok",native:vi.fn()}));
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
   if(["/customer-state/","/customer-state","/customer-plan-artifacts/","/customer-plan-artifacts"].includes(request.path))data=`<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Status>${m.mode==="unversioned"?"Suspended":"Enabled"}</Status></VersioningConfiguration>`;
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
  const body=new IncomingMessage(new Socket());body.push(Buffer.from(data));body.push(null);
  return {response:{statusCode:status,reason:"synthetic",headers,body}};
 }
 destroy(){}
}}));
import { readCustomerPlanAws } from "../customerPlanAwsRead";
beforeEach(()=>{m.requests=[];m.mode="ok";m.native.mockClear();});
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
