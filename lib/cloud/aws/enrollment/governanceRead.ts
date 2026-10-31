import 'server-only';
import {z} from 'zod';
import {IAMClient,ListRolesCommand,ListPoliciesCommand} from '@aws-sdk/client-iam';
import {EC2Client,DescribeInstancesCommand} from '@aws-sdk/client-ec2';
import {boundedAwsHandler,type AwsResponseBudget} from '../ecsObservation/boundedAwsHandler';
const operations=['iam.roles','iam.policy_versions','infrastructure.inventory']as const;
const inputSchema=z.object({accountId:z.string().regex(/^\d{12}$/),region:z.string().regex(/^[a-z]{2}(?:-[a-z]+)+-\d$/),operation:z.enum(operations),cursor:z.string().min(1).max(512).nullable()}).strict();
const text=z.string().min(1).max(1024),marker=text.max(512),iamPagination=z.object({IsTruncated:z.boolean(),Marker:marker.optional()});
/** Internal broker-owned read. Receives temporary credentials only after STS
 * identity verification. No provider payload or credentials leave this stack. */
export async function readGovernanceAwsMetadata(input:{credentials:{accessKeyId:string;secretAccessKey:string;sessionToken:string};accountId:string;region:string;operation:string;cursor:string|null;signal:AbortSignal;budget:AwsResponseBudget}){
 const p=inputSchema.parse({accountId:input.accountId,region:input.region,operation:input.operation,cursor:input.cursor});input.signal.throwIfAborted();
 if(!Number.isSafeInteger(input.budget.remaining)||input.budget.remaining<=0||input.budget.remaining>2*1024*1024)throw Error('governance_aws_read_unavailable');
 const signal=AbortSignal.any([input.signal,AbortSignal.timeout(6000)]),config={region:p.region,credentials:input.credentials,maxAttempts:1,ignoreConfiguredEndpointUrls:true,useFipsEndpoint:false,useDualstackEndpoint:false,requestHandler:boundedAwsHandler(signal,input.budget,{maxBytes:262144})};
 const partition=p.region.startsWith('cn-')?'aws-cn':p.region.startsWith('us-gov-')?'aws-us-gov':'aws';
 const arn=(kind:'role'|'policy')=>z.string().max(1024).refine(v=>{const prefix='arn:'+partition+':iam::'+p.accountId+':'+kind+'/';return v.startsWith(prefix)&&v.length>prefix.length&&!/[\x00-\x20\x7f]/.test(v)});
 const client=p.operation==='infrastructure.inventory'?new EC2Client(config):new IAMClient(config);
 try{
  let projection:unknown[],nextCursor:string|null=null;
  if(p.operation==='iam.roles'){
   const raw=await (client as IAMClient).send(new ListRolesCommand({MaxItems:100,...(p.cursor?{Marker:p.cursor}:{})}),{abortSignal:signal});
   const data=iamPagination.extend({Roles:z.array(z.object({Arn:arn('role'),RoleId:text,RoleName:text,Path:text}).strip()).max(100)}).parse(raw);
   if(data.IsTruncated&&!data.Marker)throw Error('governance_aws_pagination_unavailable');nextCursor=data.IsTruncated?data.Marker!:null;
   projection=data.Roles.map(r=>({arn:r.Arn,id:r.RoleId,name:r.RoleName,path:r.Path})).sort((a,b)=>a.arn.localeCompare(b.arn));
  }else if(p.operation==='iam.policy_versions'){
   // ListPolicies returns DefaultVersionId metadata, not policy documents or
   // an evaluation of effective IAM access. No wildcard/admin finding follows.
   const raw=await (client as IAMClient).send(new ListPoliciesCommand({Scope:'Local',MaxItems:100,...(p.cursor?{Marker:p.cursor}:{})}),{abortSignal:signal});
   const data=iamPagination.extend({Policies:z.array(z.object({Arn:arn('policy'),PolicyId:text,DefaultVersionId:z.string().regex(/^v[1-9]\d*$/)}).strip()).max(100)}).parse(raw);
   if(data.IsTruncated&&!data.Marker)throw Error('governance_aws_pagination_unavailable');nextCursor=data.IsTruncated?data.Marker!:null;
   projection=data.Policies.map(r=>({arn:r.Arn,id:r.PolicyId,defaultVersion:r.DefaultVersionId})).sort((a,b)=>a.arn.localeCompare(b.arn));
  }else{
   const raw=await (client as EC2Client).send(new DescribeInstancesCommand({MaxResults:100,...(p.cursor?{NextToken:p.cursor}:{})}),{abortSignal:signal});
   const data=z.object({Reservations:z.array(z.object({OwnerId:z.literal(p.accountId),Instances:z.array(z.object({InstanceId:text,State:z.object({Name:text})}).strip()).max(100)}).strip()).max(100),NextToken:marker.optional()}).parse(raw);
   projection=data.Reservations.flatMap(r=>r.Instances.map(i=>({id:i.InstanceId,state:i.State.Name}))).sort((a,b)=>a.id.localeCompare(b.id));if(projection.length>100)throw Error('governance_aws_page_limit');nextCursor=data.NextToken??null;
  }
  signal.throwIfAborted();return{projection,nextCursor};
 }catch(error){if(error&&typeof error==='object'&&'name'in error&&['AccessDenied','AccessDeniedException','UnauthorizedOperation'].includes(String(error.name)))throw Object.assign(Error('governance_source_denied'),{code:'access_denied'});throw Error('governance_aws_read_unavailable')}
 finally{client.destroy()}
}
