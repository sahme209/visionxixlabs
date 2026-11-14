const credentialExpiry=Date.now()+86400000; // Synthetic fixture metadata only.
import {it,expect,vi,afterEach} from 'vitest';
import {NodeHttpHandler} from '@smithy/node-http-handler';
import {Readable} from 'node:stream';
import {S3Client} from '@aws-sdk/client-s3';
import {prepareTemplateExecutionPlan} from '../templateExecutionPreparation';
import {createTemplateNativeTransport} from '../templateNativeTransport';
import type {ExecutionTimeCheck} from '../executionTime';
afterEach(()=>vi.restoreAllMocks());
it.each(['expiry','credential-expiry','revocation','live'] as const)('uses the actual SDK final boundary after asynchronous preparation: %s',async mode=>{
 const now=Date.now(),expiresAt=now+60000,profile={accountId:'123456789012',region:'us-east-2',profileDigest:'a'.repeat(64),access:null};
 const {binding}=await prepareTemplateExecutionPlan({operation:'create_bucket',accountId:profile.accountId,region:profile.region,expiresAt:new Date(expiresAt).toISOString()},now,'platform_action_11111111-1111-4111-8111-111111111111',{userId:'requester',sessionId:'session'},profile);
 let preparing=false,writes=0,reads=0;
 vi.spyOn(NodeHttpHandler.prototype,'handle').mockImplementation(async request=>{
  if(request.hostname.startsWith('sts.')){reads++;return {response:{statusCode:200,headers:{'content-type':'text/xml'},body:Readable.from(['<GetCallerIdentityResponse><GetCallerIdentityResult><Account>123456789012</Account></GetCallerIdentityResult></GetCallerIdentityResponse>'])} }}
  writes++;return {response:{statusCode:200,headers:{'content-type':'application/xml'},body:Readable.from([])}};
 });
 const send=S3Client.prototype.send;
 vi.spyOn(S3Client.prototype,'send').mockImplementation(function(this:S3Client,...args:unknown[]){
  this.middlewareStack.add(next=>async request=>{await Promise.resolve();preparing=true;return next(request)},{step:'finalizeRequest',name:'syntheticAsyncPreparation',priority:'low'});
  return Reflect.apply(send,this,args);
 });
 const transport=createTemplateNativeTransport({assertCredentialCurrent:async()=>{},assertDispatchCurrent:async()=>{},clock:async()=>({earliest:now,latest:preparing&&mode==='expiry'?expiresAt:preparing&&mode==='credential-expiry'?now+1000:now+1}),now:()=>now,admit:async()=>{},assertQualified:async()=>{},assertCurrent:async(_b,check?:ExecutionTimeCheck)=>{if(preparing&&mode==='revocation')throw Error('synthetic_revoked');await check?.()},readCredential:()=>({accessKeyId:'synthetic-key',secretAccessKey:'synthetic-secret',expiresAt:mode==='credential-expiry'?now+1000:credentialExpiry})});
 if(mode==='live'){const proof=await transport.perform(binding);expect(transport.consume(proof,binding)).toEqual({kind:'bucket',providerStatus:200});expect(writes).toBe(1)}else{await expect(transport.perform(binding)).rejects.toThrow();expect(writes).toBe(0)}
 expect(reads).toBe(1);await expect(transport.perform(binding)).rejects.toThrow();expect(writes).toBe(mode==='live'?1:0);
});

it('postcommit expiry at actual SDK handler prevents even the initial native identity read',async()=>{
 const now=Date.now(),profile={accountId:'123456789012',region:'us-east-2',profileDigest:'a'.repeat(64),access:null},{binding}=await prepareTemplateExecutionPlan({operation:'create_bucket',accountId:profile.accountId,region:profile.region,expiresAt:new Date(now+60000).toISOString()},now,'platform_action_11111111-1111-4111-8111-111111111111',{userId:'requester',sessionId:'session'},profile);
 let atHandler=false,expired=false;const native=vi.spyOn(NodeHttpHandler.prototype,'handle').mockRejectedValue(Error('must not reach native'));
 const {STSClient}=await import('@aws-sdk/client-sts'),send=STSClient.prototype.send;vi.spyOn(STSClient.prototype,'send').mockImplementation(function(this:InstanceType<typeof STSClient>,...args:unknown[]){atHandler=true;return Reflect.apply(send,this,args)});
 const transport=createTemplateNativeTransport({assertCredentialCurrent:async()=>{},assertDispatchCurrent:async()=>{},clock:async()=>({earliest:now,latest:expired?now+1000:now+1}),now:()=>now,admit:async()=>{},assertQualified:async()=>{},assertCurrent:async(_b,check)=>{await check?.({expiresAt:now+1000});if(atHandler)expired=true},readCredential:()=>({accessKeyId:'synthetic-key',secretAccessKey:'synthetic-secret',expiresAt:credentialExpiry})});
 await expect(transport.perform(binding)).rejects.toThrow();expect(native).not.toHaveBeenCalled();await expect(transport.perform(binding)).rejects.toThrow();expect(native).not.toHaveBeenCalled();
});

it.each(['upload','access'] as const)('distinct installed SDK and presigner phases retain original committed checkpoints for %s',async operation=>{
 const now=Date.now(),accountId='123456789012',profile={accountId,region:'us-east-2',profileDigest:'a'.repeat(64),access:operation==='access'?{artifactProfileDigest:'a'.repeat(64),clockSkewMs:1000}:null};
 const {binding}=await prepareTemplateExecutionPlan({operation,accountId,region:'us-east-2',expiresAt:new Date(now+60000).toISOString(),...(operation==='access'?{objectVersion:'version-1',ttlSeconds:60,delivery:'original_requester_session'}:{})},now,'platform_action_11111111-1111-4111-8111-111111111111',{userId:'requester',sessionId:'session'},profile),bytes=await (await import('@/lib/cloud/aws/platformTemplateSource')).readPlatformTemplateBytes();
 const phases:string[]=[];let insideOwner=false;const native=vi.spyOn(NodeHttpHandler.prototype,'handle').mockImplementation(async(request):Promise<Awaited<ReturnType<NodeHttpHandler['handle']>>>=>{
  if(request.hostname.startsWith('sts.'))return {response:{statusCode:200,headers:{'content-type':'text/xml'},body:Readable.from(['<GetCallerIdentityResponse><GetCallerIdentityResult><Account>123456789012</Account></GetCallerIdentityResult></GetCallerIdentityResponse>'])}};
  if('versioning' in (request.query??{}))return {response:{statusCode:200,headers:{'content-type':'text/xml'},body:Readable.from(['<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Status>Enabled</Status></VersioningConfiguration>'])}};
  return {response:{statusCode:200,headers:{'x-amz-version-id':'version-1','content-length':String(bytes.length)},body:Readable.from(request.method==='GET'?[bytes]:[])}};
 });
 const transport=createTemplateNativeTransport({clock:async()=>({earliest:now,latest:now+1}),now:()=>now,admit:async()=>{},assertQualified:async()=>{},assertCurrent:async(_b,check)=>{insideOwner=true;try{await check?.()}finally{insideOwner=false}},assertCredentialCurrent:async()=>{},assertDispatchCurrent:async(b,phase)=>{expect(insideOwner).toBe(false);expect(b.bindingDigest).toBe(binding.bindingDigest);phases.push(phase)},readCredential:()=>({accessKeyId:'synthetic-key',secretAccessKey:'synthetic-secret',expiresAt:credentialExpiry})});
 const proof=await transport.perform(binding);expect(transport.consume(proof,binding).kind).toBe(operation==='access'?'access':'object');expect(phases).toEqual(operation==='access'?['credential-read','sdk:GetCallerIdentity','sdk:GetBucketVersioning','sdk:GetObject','presign:GetObject']:['credential-read','sdk:GetCallerIdentity','sdk:GetBucketVersioning','sdk:PutObject']);expect(native).toHaveBeenCalledTimes(3);
});
it('cannot substitute signed SDK headers during the same-proof dispatch wait',async()=>{
 const now=Date.now(),profile={accountId:'123456789012',region:'us-east-2',profileDigest:'a'.repeat(64),access:null},{binding}=await prepareTemplateExecutionPlan({operation:'create_bucket',accountId:profile.accountId,region:profile.region,expiresAt:new Date(now+60000).toISOString()},now,'platform_action_11111111-1111-4111-8111-111111111111',{userId:'requester',sessionId:'session'},profile);
 const {STSClient}=await import('@aws-sdk/client-sts');let headers:Record<string,string>|undefined;const send=STSClient.prototype.send;
 vi.spyOn(STSClient.prototype,'send').mockImplementation(function(this:InstanceType<typeof STSClient>,...args:unknown[]){this.middlewareStack.add(next=>async value=>{headers=(value.request as {headers:Record<string,string>}).headers;return next(value)},{step:'finalizeRequest',name:'captureExactPrivateRequest',priority:'low'});return Reflect.apply(send,this,args)});
 const native=vi.spyOn(NodeHttpHandler.prototype,'handle').mockRejectedValue(Error('must not send substituted headers'));
 const transport=createTemplateNativeTransport({clock:async()=>({earliest:now,latest:now+1}),now:()=>now,admit:async()=>{},assertQualified:async()=>{},assertCurrent:async(_b,check)=>{await check?.()},assertCredentialCurrent:async()=>{},assertDispatchCurrent:async(_b,phase)=>{if(phase==='sdk:GetCallerIdentity')headers!.authorization='synthetic-substituted-signature'},readCredential:()=>({accessKeyId:'synthetic-key',secretAccessKey:'synthetic-secret',expiresAt:credentialExpiry})});
 await expect(transport.perform(binding)).rejects.toThrow();expect(native).not.toHaveBeenCalled();
});
