import {it,expect,vi,afterEach} from 'vitest';
import {NodeHttpHandler} from '@smithy/node-http-handler';
import {Readable} from 'node:stream';
import {S3Client} from '@aws-sdk/client-s3';
import {prepareTemplateExecutionPlan} from '../templateExecutionPreparation';
import {createTemplateNativeTransport} from '../templateNativeTransport';
import type {ExecutionTimeCheck} from '../executionTime';
afterEach(()=>vi.restoreAllMocks());
it.each(['expiry','revocation','live'] as const)('uses the actual SDK final boundary after asynchronous preparation: %s',async mode=>{
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
 const transport=createTemplateNativeTransport({clock:async()=>({earliest:now,latest:preparing&&mode==='expiry'?expiresAt:now+1}),now:()=>now,admit:async()=>{},assertQualified:async()=>{},assertCurrent:async(_b,check?:ExecutionTimeCheck)=>{if(preparing&&mode==='revocation')throw Error('synthetic_revoked');await check?.()},readCredential:()=>({accessKeyId:'synthetic-key',secretAccessKey:'synthetic-secret'})});
 if(mode==='live'){const proof=await transport.perform(binding);expect(transport.consume(proof,binding)).toEqual({kind:'bucket',providerStatus:200});expect(writes).toBe(1)}else{await expect(transport.perform(binding)).rejects.toThrow();expect(writes).toBe(0)}
 expect(reads).toBe(1);await expect(transport.perform(binding)).rejects.toThrow();expect(writes).toBe(mode==='live'?1:0);
});
