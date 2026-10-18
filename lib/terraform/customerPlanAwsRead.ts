import "server-only";
import { createHash } from "node:crypto";
import { S3Client, GetBucketVersioningCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { awsReadEndpoint, boundedAwsHandler, type AwsResponseBudget } from "@/lib/cloud/aws/ecsObservation/boundedAwsHandler";
import { CUSTOMER_RESPONSE_BUDGET_BYTES, CUSTOMER_STATE_MAX_BYTES, parseCustomerBackendState, parseCustomerPlanProfile, type CustomerBackendState } from "./customerPlanContract";
import { CUSTOMER_RECEIPT_MAX_BYTES } from "./customerPlanContract";
import { MAX_PLAN_BYTES, MAX_SHOW_BYTES } from "./savedPlanArtifact";

interface CustomerPlanAwsInput {
 profile: unknown;
 accountId: string;
 /** Private broker-owned temporary credentials; never accepted from an HTTP payload. */
 credentials: {accessKeyId:string;secretAccessKey:string;sessionToken:string};
 signal: AbortSignal;
 budget?: AwsResponseBudget;
 run?: {id:string;attempt:number};
}
interface CustomerPlanObject {bytes:Uint8Array;versionId:string}
export interface CustomerPlanObjects {binary:CustomerPlanObject;show:CustomerPlanObject;receipt:CustomerPlanObject}
export type CustomerPlanAwsObservation =
 | {kind:"observed_customer_backend";state:CustomerBackendState;lock:"unlocked_at_observation";observedAt:string;artifacts?:CustomerPlanObjects}
 | {kind:"unavailable";reason:"customer_plan_backend_unavailable"|"customer_plan_backend_locked"};

/** Read-only observation, not a lock permit or a claim about the role's IAM policy. */
export async function readCustomerPlanAws(input:CustomerPlanAwsInput):Promise<CustomerPlanAwsObservation> {
 let s3:S3Client|undefined,ddb:DynamoDBClient|undefined;
 try {
  // Parse and snapshot before constructing a native transport or awaiting work.
  const p=parseCustomerPlanProfile(input.profile),credentials={...input.credentials},run=input.run&&{...input.run};
  const budget=input.budget??{remaining:CUSTOMER_RESPONSE_BUDGET_BYTES};
  if(input.accountId!==p.backend.accountId||input.signal.aborted||!Number.isSafeInteger(budget.remaining)||budget.remaining<=0
   ||![credentials.accessKeyId,credentials.secretAccessKey,credentials.sessionToken].every(v=>typeof v==="string"&&v.length>0&&v.length<=4096)
   ||run&&(!/^[1-9]\d{0,31}$/.test(run.id)||!Number.isSafeInteger(run.attempt)||run.attempt<1||run.attempt>2147483647))throw Error("unavailable");
  const signal=AbortSignal.any([input.signal,AbortSignal.timeout(30_000)]);
  const config={region:p.backend.region,credentials,maxAttempts:1,ignoreConfiguredEndpointUrls:true,useFipsEndpoint:false,useDualstackEndpoint:false};
  s3=new S3Client({...config,endpoint:awsReadEndpoint("s3",p.backend.region,"aws"),forcePathStyle:true,followRegionRedirects:false,
   requestChecksumCalculation:"WHEN_REQUIRED",responseChecksumValidation:"WHEN_REQUIRED",
   requestHandler:boundedAwsHandler(signal,budget,{maxBytes:MAX_SHOW_BYTES,headObjectMetadata:true})});
  ddb=new DynamoDBClient({...config,endpoint:awsReadEndpoint("dynamodb",p.backend.region,"aws"),endpointDiscoveryEnabled:false,requestHandler:boundedAwsHandler(signal,budget)});
  const call={abortSignal:signal},bucket={Bucket:p.backend.bucket,ExpectedBucketOwner:p.backend.accountId},object={...bucket,Key:p.backend.key};
  const versioning=await s3.send(new GetBucketVersioningCommand(bucket),call);
  if(versioning.Status!=="Enabled")throw Error("unavailable");
  const before=await s3.send(new HeadObjectCommand(object),call);
  if(!before.VersionId||before.VersionId==="null"||!Number.isSafeInteger(before.ContentLength)||before.ContentLength!<=0||before.ContentLength!>CUSTOMER_STATE_MAX_BYTES)throw Error("unavailable");
  const response=await s3.send(new GetObjectCommand({...object,VersionId:before.VersionId}),call);
  if(response.VersionId!==before.VersionId||response.ContentLength!==before.ContentLength||!response.Body)throw Error("unavailable");
  // The native bounded handler owns the stream first, including error bodies.
  // Collection is additionally bounded here; no state values leave this stack.
  const chunks:Buffer[]=[];let received=0;
  for await(const chunk of response.Body as AsyncIterable<Uint8Array>){
   if(signal.aborted||!(chunk instanceof Uint8Array)||(received+=chunk.byteLength)>CUSTOMER_STATE_MAX_BYTES)throw Error("unavailable");
   chunks.push(Buffer.from(chunk));
  }
  if(received!==before.ContentLength)throw Error("unavailable");
  const bytes=Buffer.concat(chunks),stateJson=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
  if(!stateJson||typeof stateJson!=="object"||Array.isArray(stateJson)||stateJson.version!==4)throw Error("unavailable");
  const state=parseCustomerBackendState({versionId:before.VersionId,digest:createHash("sha256").update(bytes).digest("hex"),lineage:stateJson.lineage,serial:stateJson.serial});
  let artifacts:CustomerPlanObjects|undefined;
  if(run){
   const artifactBucket={Bucket:p.artifacts.bucket,ExpectedBucketOwner:p.backend.accountId};
   if((await s3.send(new GetBucketVersioningCommand(artifactBucket),call)).Status!=="Enabled")throw Error("unavailable");
   const readObject=async(name:string,max:number):Promise<CustomerPlanObject>=>{
    const selector={...artifactBucket,Key:`${p.artifacts.prefix}/${p.repository.remoteId}/${run.id}/${run.attempt}/${name}`};
    const head=await s3!.send(new HeadObjectCommand(selector),call);
    const encrypted=(value:{ServerSideEncryption?:string;SSEKMSKeyId?:string})=>value.ServerSideEncryption==="aws:kms"&&value.SSEKMSKeyId===p.artifacts.kmsKeyArn;
    if(!head.VersionId||head.VersionId==="null"||!Number.isSafeInteger(head.ContentLength)||head.ContentLength!<=0||head.ContentLength!>max||!encrypted(head))throw Error("unavailable");
    const response=await s3!.send(new GetObjectCommand({...selector,VersionId:head.VersionId}),call);
    if(!response.Body||response.VersionId!==head.VersionId||response.ContentLength!==head.ContentLength||!encrypted(response))throw Error("unavailable");
    const pieces:Buffer[]=[];let size=0;
    for await(const chunk of response.Body as AsyncIterable<Uint8Array>){
     if(signal.aborted||!(chunk instanceof Uint8Array)||(size+=chunk.byteLength)>max)throw Error("unavailable");
     pieces.push(Buffer.from(chunk));
    }
    if(size!==head.ContentLength)throw Error("unavailable");
    const final=await s3!.send(new HeadObjectCommand(selector),call);
    if(final.VersionId!==head.VersionId||final.ContentLength!==head.ContentLength||!encrypted(final))throw Error("unavailable");
    return {bytes:Buffer.concat(pieces),versionId:head.VersionId};
   };
   // Fixed selectors only. These private bytes still need independent signature,
   // receipt and subject verification; S3 metadata is not producer authority.
   artifacts={binary:await readObject("plan.tfplan",MAX_PLAN_BYTES),show:await readObject("plan.show.json",MAX_SHOW_BYTES),receipt:await readObject("plan.receipt.json",CUSTOMER_RECEIPT_MAX_BYTES)};
  }
  const lock=await ddb.send(new GetItemCommand({TableName:p.backend.lockTable,ConsistentRead:true,Key:{LockID:{S:p.backend.lockKey}}}),call);
  if(lock.Item!==undefined){
   if(lock.Item.LockID?.S!==p.backend.lockKey)throw Error("unavailable");
   return {kind:"unavailable",reason:"customer_plan_backend_locked"};
  }
  const after=await s3.send(new HeadObjectCommand(object),call);
  if(signal.aborted||after.VersionId!==before.VersionId||after.ContentLength!==before.ContentLength)throw Error("unavailable");
  return {kind:"observed_customer_backend",state,lock:"unlocked_at_observation",observedAt:new Date().toISOString(),...(artifacts?{artifacts}:{})};
 }catch{return {kind:"unavailable",reason:"customer_plan_backend_unavailable"};}
 finally{s3?.destroy();ddb?.destroy();}
}
