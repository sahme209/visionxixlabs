import {it,expect} from 'vitest';
import {createCustomerHostedTokenStore,type TokenCall,type TokenRepository} from '../customerHostedTokenStore';
function fixture(){
 const rows=new Map<string,TokenCall>();let tail=Promise.resolve();
 const repository:TokenRepository={transaction:async fn=>{const before=tail;let release!:()=>void;tail=new Promise<void>(r=>{release=r});await before;const snapshot=new Map(rows);try{return await fn({lock:async()=>{},read:async(org)=>[...rows.values()].filter(r=>r.organizationId===org),insert:async r=>{if(rows.has(r.id))throw Error('duplicate');rows.set(r.id,r)},replace:async r=>{rows.set(r.id,r)}})}catch(e){rows.clear();for(const [k,v] of snapshot)rows.set(k,v);throw e}finally{release()}}};
 let current={digest:'a'.repeat(64),windowId:'w1',limitTokens:100,expiresAt:2000};
 const store=createCustomerHostedTokenStore(repository,async()=>current,()=>1000);
 const request={installationId:'install',organizationId:'org',actorId:'actor',requestDigest:'b'.repeat(64),modelId:'model',configDigest:'a'.repeat(64),windowId:'w1',reservedTokens:60};
 return {rows,store,request,setCurrent:(value:typeof current)=>{current=value}};
}
it('serializes concurrent reservations against one explicit workspace cap',async()=>{
 const f=fixture();const results=await Promise.allSettled([f.store.reserveCustomerHostedCall(f.request),f.store.reserveCustomerHostedCall({...f.request,requestDigest:'c'.repeat(64)})]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(f.rows.size).toBe(1);
});
it('consumes a durable claim once and settles only that claim once',async()=>{
 const f=fixture(),id=await f.store.reserveCustomerHostedCall(f.request),claim=await f.store.claimCustomerHostedCall(f.request,id);
 await expect(f.store.claimCustomerHostedCall(f.request,id)).rejects.toThrow();
 await expect(f.store.settleCustomerHostedCall({},20)).rejects.toThrow();
 expect(await f.store.settleCustomerHostedCall(claim,20)).toEqual({status:'settled',liabilityTokens:20});
 await expect(f.store.settleCustomerHostedCall(claim,20)).rejects.toThrow();
 expect([...f.rows.values()][0].status).toBe('settled');
});
it('refuses config changes and expired authority before claim without freeing the hold',async()=>{
 const f=fixture(),id=await f.store.reserveCustomerHostedCall(f.request);
 f.setCurrent({digest:'c'.repeat(64),windowId:'w1',limitTokens:100,expiresAt:2000});
 await expect(f.store.claimCustomerHostedCall(f.request,id)).rejects.toThrow();expect([...f.rows.values()][0].status).toBe('reserved');
 f.setCurrent({digest:'a'.repeat(64),windowId:'w1',limitTokens:100,expiresAt:1000});
 await expect(f.store.claimCustomerHostedCall(f.request,id)).rejects.toThrow();
});
it('retains unknown exposure through a new operator window and forbids request replay',async()=>{
 const f=fixture(),id=await f.store.reserveCustomerHostedCall(f.request),claim=await f.store.claimCustomerHostedCall(f.request,id);
 await f.store.settleCustomerHostedCall(claim,null);
 f.setCurrent({digest:'d'.repeat(64),windowId:'w2',limitTokens:100,expiresAt:2000});
 await expect(f.store.reserveCustomerHostedCall({...f.request,configDigest:'d'.repeat(64),windowId:'w2',requestDigest:'e'.repeat(64)})).rejects.toThrow();
 await expect(f.store.reserveCustomerHostedCall({...f.request,configDigest:'d'.repeat(64),windowId:'w2'})).rejects.toThrow();
 expect([...f.rows.values()][0].status).toBe('unknown');
});
it('rejects cross-actor claims and records overrun without refund',async()=>{
 const f=fixture(),id=await f.store.reserveCustomerHostedCall(f.request);
 await expect(f.store.claimCustomerHostedCall({...f.request,actorId:'other'},id)).rejects.toThrow();
 const claim=await f.store.claimCustomerHostedCall(f.request,id);
 expect(await f.store.settleCustomerHostedCall(claim,120)).toEqual({status:'overrun',liabilityTokens:120});
 await expect(f.store.reserveCustomerHostedCall({...f.request,requestDigest:'e'.repeat(64),reservedTokens:1})).rejects.toThrow();
});
