import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { customerProfile } from "./customerPlanFixtures";
const m=vi.hoisted(()=>({sts:vi.fn(),read:vi.fn(),configs:[] as Array<Record<string,unknown>>}));
vi.mock("@aws-sdk/client-sts",()=>({STSClient:class{constructor(c:Record<string,unknown>){m.configs.push(c);}send(c:unknown){return m.sts(c);}destroy(){}},AssumeRoleCommand:class{constructor(readonly input:unknown){}},GetCallerIdentityCommand:class{constructor(readonly input:unknown){}}}));
vi.mock("../customerPlanAwsRead",()=>({readCustomerPlanAws:m.read}));
import { readVerifiedTerraformBackend } from "@/lib/cloud/aws/enrollment/stsValidation";
import { __resetEnvCacheForTest } from "@/lib/config/env";
const request=()=>({expectedAccountId:"123456789012",roleArn:"arn:aws:iam::123456789012:role/ReadOnly",region:"us-east-1",externalId:"axiom-"+"a".repeat(32),sessionName:"axiom-terraform-owned"});
beforeEach(()=>{
 vi.clearAllMocks();m.configs=[];__resetEnvCacheForTest();
 vi.stubEnv("AWS_CONNECTOR_BROKER_ACCESS_KEY_ID","synthetic-broker");vi.stubEnv("AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY","synthetic-broker-secret");vi.stubEnv("AWS_SCAN_MODE","live");vi.stubEnv("ENABLE_CLOUD_CONNECTORS_AWS","true");
 const arn="arn:aws:sts::123456789012:assumed-role/ReadOnly/axiom-terraform-owned";
 m.sts.mockImplementation(async(c:{input:{RoleArn?:string}})=>c.input.RoleArn?{AssumedRoleUser:{Arn:arn},Credentials:{AccessKeyId:"synthetic-temp",SecretAccessKey:"synthetic-temp-secret",SessionToken:"synthetic-temp-token"}}:{Account:"123456789012",Arn:arn});
 m.read.mockResolvedValue({kind:"observed_customer_backend",lock:"unlocked_at_observation",state:{serial:9}});
});
afterEach(()=>{vi.unstubAllEnvs();__resetEnvCacheForTest();});
it("keeps verified temporary credentials inside the broker stack and passes one bounded deadline/budget",async()=>{
 const result=await readVerifiedTerraformBackend(request(),customerProfile(),new AbortController().signal,{id:"888",attempt:1});
 expect(result).toMatchObject({kind:"observed_customer_backend"});expect(JSON.stringify(result)).not.toContain("synthetic-temp");
 expect(m.read).toHaveBeenCalledWith(expect.objectContaining({accountId:"123456789012",credentials:{accessKeyId:"synthetic-temp",secretAccessKey:"synthetic-temp-secret",sessionToken:"synthetic-temp-token"},run:{id:"888",attempt:1},budget:{remaining:96*1024*1024}}));
 expect(m.configs).toHaveLength(2);expect(m.configs.every(c=>c.endpoint==="https://sts.us-east-1.amazonaws.com"&&c.ignoreConfiguredEndpointUrls===true&&c.maxAttempts===1)).toBe(true);
});
it.each(["sameRole","foreignAccount","wrongRegion","invalidProfile","aborted"])("refuses %s before assuming a role",async mode=>{
 const r=request(),p=customerProfile(),c=new AbortController();
 if(mode==="sameRole")r.roleArn=p.producer.planRoleArn;if(mode==="foreignAccount")r.expectedAccountId="999999999999";
 if(mode==="wrongRegion")r.region="us-west-2";if(mode==="invalidProfile")p.backend.workspace="other";if(mode==="aborted")c.abort();
 await expect(readVerifiedTerraformBackend(r,p,c.signal)).rejects.toThrow();expect(m.sts).not.toHaveBeenCalled();expect(m.read).not.toHaveBeenCalled();
});
it("does not read S3 or lock state after STS identity denial",async()=>{
 m.sts.mockResolvedValue({});await expect(readVerifiedTerraformBackend(request(),customerProfile(),new AbortController().signal)).rejects.toThrow();expect(m.read).not.toHaveBeenCalled();
});
it("snapshots the reviewed profile, role and run before the first await",async()=>{
 const p=customerProfile(),r=request(),run={id:"888",attempt:1};
 const pending=readVerifiedTerraformBackend(r,p,new AbortController().signal,run);
 p.backend.accountId="999999999999";r.roleArn=p.producer.planRoleArn;run.id="999";
 expect(await pending).toMatchObject({kind:"observed_customer_backend"});
 expect(m.read).toHaveBeenCalledWith(expect.objectContaining({profile:expect.objectContaining({backend:expect.objectContaining({accountId:"123456789012"})}),run:{id:"888",attempt:1}}));
});
it.each([0,Number.NaN,Number.POSITIVE_INFINITY,1.5,96*1024*1024+1])("refuses invalid/exhausted shared budget %s before STS",async remaining=>{
 await expect(readVerifiedTerraformBackend(request(),customerProfile(),new AbortController().signal,undefined,{remaining})).rejects.toThrow();expect(m.sts).not.toHaveBeenCalled();expect(m.read).not.toHaveBeenCalled();
});
it("reuses one owned budget across initial/final observations without resetting its balance",async()=>{
 const budget={remaining:1024};m.read.mockImplementation(async(input:{budget:{remaining:number}})=>{expect(input.budget).toBe(budget);input.budget.remaining-=128;return {kind:"observed_customer_backend"};});
 const signal=new AbortController().signal;await readVerifiedTerraformBackend(request(),customerProfile(),signal,undefined,budget);await readVerifiedTerraformBackend(request(),customerProfile(),signal,undefined,budget);expect(budget.remaining).toBe(768);
});
