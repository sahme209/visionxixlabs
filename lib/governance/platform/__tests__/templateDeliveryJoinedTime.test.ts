import {it,expect} from 'vitest';
import {prepareTemplateExecutionPlan} from '../templateExecutionPreparation';
import {createPlatformAction,approvePlatformAction,claimPlatformAction,finishPlatformAction} from '../kernel';
import {createTemplateExecutionReceipt,nativeTemplateKey} from '../templateExecutionContract';
import {reserveTemplateResource,observeTemplateResult} from '../templateLiability';
import {deriveTemplateGrantContext,sealTemplateGrant,claimTemplateGrantDelivery} from '../templateGrantArtifact';
import {createTemplateExecutionStore} from '../templateExecutionStore';
import type {PlatformRepository,PlatformTransaction} from '../actionStore';
const now=Date.parse('2026-11-13T00:00:00Z'),id='platform_action_11111111-1111-4111-8111-111111111111',actor={userId:'requester',sessionId:'requester-session'},reviewer={userId:'reviewer',sessionId:'reviewer-session'},artifactRef='platform_template_artifact_11111111-1111-4111-8111-111111111111';
async function fixture(){
 const profile={accountId:'123456789012',region:'us-east-2',profileDigest:'a'.repeat(64),access:{artifactProfileDigest:'b'.repeat(64),clockSkewMs:1000}},selection={operation:'access',accountId:profile.accountId,region:profile.region,expiresAt:new Date(now+60000).toISOString(),objectVersion:'version-1',ttlSeconds:1,delivery:'original_requester_session'};
 const {plan,binding}=await prepareTemplateExecutionPlan(selection,now,id,actor,profile);if(binding.effect.kind!=='template.access.grant'||!binding.access)throw Error('fixture');
 const state=finishPlatformAction(claimPlatformAction(approvePlatformAction(createPlatformAction(plan,actor,now),{...reviewer,planDigest:plan.digest},now),actor,now),'confirmed',now),reserved=reserveTemplateResource(binding,now,null),receipt=createTemplateExecutionReceipt({format:1,purpose:'platform_template_execution_receipt_v1',receiptId:'platform_template_receipt_11111111-1111-4111-8111-111111111111',nativeKey:nativeTemplateKey(binding.effect,actor),bindingDigest:binding.bindingDigest,actionId:id,effectIndex:0,planDigest:binding.planDigest,sourceDigest:binding.sourceDigest,profileDigest:binding.profileDigest,generation:1,operation:'access',outcome:'confirmed',observedAt:now,detail:{kind:'access',grantId:binding.access.grantId,artifactRef,artifactProfileDigest:binding.access.artifactProfileDigest,signedAt:now,ttlSeconds:1,hardExpiresAt:now+1000,clockSkewMs:1000}}),resource=observeTemplateResult(reserved,binding,receipt,now),context=deriveTemplateGrantContext(resource,receipt,now);
 const target=binding.effect.target,date='20261113T000000Z',url=`https://${target.bucket}.s3.us-east-2.amazonaws.com/${target.key}?versionId=version-1&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-SignedHeaders=host&x-amz-expected-bucket-owner=123456789012&X-Amz-Date=${date}&X-Amz-Expires=1&X-Amz-Signature=${'a'.repeat(64)}`,key=Buffer.alloc(32,7),envelope=sealTemplateGrant(key,context,url);
 let claim:ReturnType<typeof claimTemplateGrantDelivery>|null=null,keyReads=0,clockReads=0,source=true,channel=true,keyCurrent=true;
 const repo:PlatformRepository={transaction:async fn=>{let staged=claim;const tx={lock:async()=>{},read:async()=>state,now:async()=>now,readTemplateBinding:async()=>binding,readPrincipal:async(p:typeof actor)=>({...p,live:true,sessionIssuedAtMs:now-1000,sessionExpiresAtMs:now+120000}),templateStorage:{claimDelivery:async()=>{staged=claimTemplateGrantDelivery(context,actor,now,staged);return {context,envelope,claim:staged}},receipts:async()=>[receipt],deliveries:async()=>staged?[staged]:[]}} as unknown as PlatformTransaction;const value=await fn(tx);claim=staged;return value}},authority={assertCurrent:async()=>{}},resources={profiles:{read:async()=>profile,assertQualified:async()=>{if(!source)throw Error('source revoked')}},assertQualified:async()=>{if(!source)throw Error('source revoked')},readCredential:()=>{throw Error('delivery must not read credentials')},now:()=>now,clock:async()=>{clockReads++;return {earliest:now,latest:now+1}},readArtifactKey:()=>{keyReads++;return key},assertArtifactKeyCurrent:async()=>{if(!keyCurrent)throw Error('key revoked')},assertDeliveryChannel:async()=>{if(!channel)throw Error('channel revoked')}};
 return {repo,authority,resources,clockReads:()=>clockReads,keyReads:()=>keyReads,claimed:()=>claim!==null,revoke:(kind:string)=>{if(kind==='source')source=false;if(kind==='channel')channel=false;if(kind==='key')keyCurrent=false}};
}
it('releases only one original-session output after acknowledged claim and live joined checks',async()=>{
 const f=await fixture(),store=createTemplateExecutionStore(f.repo,f.authority,f.resources,new AbortController().signal),output=await store.deliver(id,artifactRef,actor);expect(output).toMatchObject({artifactRef,hardExpiresAt:now+1000,serverOutputAttempted:true,clientReceiptConfirmed:false});expect(new URL(output.url).searchParams.get('versionId')).toBe('version-1');expect(f.claimed()).toBe(true);await expect(store.deliver(id,artifactRef,actor)).rejects.toThrow();
});
it('refuses hard URL expiry using the interval even when both point clocks and approval remain live',async()=>{
 const f=await fixture();f.resources.clock=async()=>({earliest:now+999,latest:now+1000});const store=createTemplateExecutionStore(f.repo,f.authority,f.resources,new AbortController().signal);
 await expect(store.deliver(id,artifactRef,actor)).rejects.toThrow();expect(f.keyReads()).toBe(0);expect(f.claimed()).toBe(true);await expect(store.deliver(id,artifactRef,actor)).rejects.toThrow();
});
it.each(['source','channel','key'])('withholds output when %s is revoked at any joined clock await',async kind=>{
 const control=await fixture();await createTemplateExecutionStore(control.repo,control.authority,control.resources,new AbortController().signal).deliver(id,artifactRef,actor);const decisions=control.clockReads();expect(decisions).toBeGreaterThan(0);
 for(let cut=1;cut<=decisions;cut++){
  const f=await fixture();let reads=0;f.resources.clock=async()=>{if(++reads===cut)f.revoke(kind);return {earliest:now,latest:now+1}};const store=createTemplateExecutionStore(f.repo,f.authority,f.resources,new AbortController().signal);
  await expect(store.deliver(id,artifactRef,actor)).rejects.toThrow();await expect(store.deliver(id,artifactRef,actor)).rejects.toThrow();expect((await store.history(id,actor)).receipts[0].outcome).toBe('confirmed');
 }
});
