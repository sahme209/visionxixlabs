import {expect,it} from 'vitest';
import {createExecutionPolicyRecoveryStore,executionPolicyRecoveryReference} from '../../../desktop/src/lib/executionPolicyRecoveryStore';
const nonce='12345678-1234-4234-8234-123456789012',digest='a'.repeat(64),id='governance_execution_policy_'+digest;
const owner={serviceOrigin:'https://fixture.invalid',organizationId:'org',userId:'user'};
function memory(){const data=new Map<string,string>();return{data,get length(){return data.size},key:(index:number)=>[...data.keys()][index]??null,getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value)},removeItem:(key:string)=>{data.delete(key)}}}
it('stores only bounded inert original request metadata and survives a new store instance',()=>{
 const storage=memory(),store=createExecutionPolicyRecoveryStore(owner,storage);
 store.reserve({operation:'propose',requestId:nonce,policy:{scope:{repositoryId:'private/repo'},executorUserIds:['private-member'],actions:['repository.merge'],expiresAt:'2030-01-01'}} as any);
 const text=[...storage.data.values()][0];expect(text).not.toContain('private/repo');expect(text).not.toContain('private-member');expect(text).not.toContain('repository.merge');expect(text).not.toContain('sessionToken');
 const restored=createExecutionPolicyRecoveryStore(owner,storage).list()[0]??null;expect(restored?.reference).toEqual({operation:'propose',requestId:nonce});
 expect(()=>store.reserve({operation:'revoke',id,version:0,requestId:nonce})).toThrow();
});
it('service/organization/user namespaces never reveal or replace another original locator',()=>{
 const storage=memory();createExecutionPolicyRecoveryStore(owner,storage).reserve({operation:'approve',id,version:0,digest,requestId:nonce});
 for(const changed of [{...owner,userId:'other'},{...owner,organizationId:'other'},{...owner,serviceOrigin:'https://other.invalid'}])expect(createExecutionPolicyRecoveryStore(changed,storage).list()).toEqual([]);
 expect(()=>createExecutionPolicyRecoveryStore({...owner,serviceOrigin:'https://user:secret@fixture.invalid'},storage)).toThrow();
});
it('corrupt/oversized metadata and failed write verification refuse rather than resetting a request',()=>{
 const storage=memory(),store=createExecutionPolicyRecoveryStore(owner,storage);store.reserve({operation:'approve',id,version:0,digest,requestId:nonce});const key=[...storage.data.keys()][0];storage.data.set(key,'x'.repeat(4097));expect(()=>store.list()).toThrow();expect(()=>store.reserve({operation:'approve',id,version:0,digest,requestId:nonce})).toThrow();
 const broken={length:0,key:()=>null,getItem:()=>null,setItem:()=>{},removeItem:()=>{}};expect(()=>createExecutionPolicyRecoveryStore(owner,broken).reserve({operation:'approve',id,version:0,digest,requestId:nonce})).toThrow();
});
it('acknowledgment removes only the exact original marker; no timer expires unknown metadata',()=>{
 const storage=memory(),store=createExecutionPolicyRecoveryStore(owner,storage),record=store.reserve({operation:'approve',id,version:0,digest,requestId:nonce});
 expect(()=>store.acknowledge({...record,reference:{...record.reference,requestId:'22345678-1234-4234-8234-123456789012'}})).toThrow();expect(store.list()).toEqual([record]);store.acknowledge(record);expect(store.list()).toEqual([]);
 expect(executionPolicyRecoveryReference({operation:'activate',id,digest,pointerVersion:2,parentDigest:null,requestId:nonce})).toMatchObject({expectedPointerVersion:3});
});

it('interleaved windows preserve both original locators instead of overwriting an unknown sibling',()=>{
 const storage=memory(),set=storage.setItem;let interleave=true;
 storage.setItem=(key,value)=>{if(interleave){interleave=false;createExecutionPolicyRecoveryStore(owner,storage).reserve({operation:'revoke',id,version:0,requestId:'22345678-1234-4234-8234-123456789012'})}set(key,value)};
 createExecutionPolicyRecoveryStore(owner,storage).reserve({operation:'approve',id,version:0,digest,requestId:nonce});expect(storage.data.size).toBe(2);
});
it('acknowledging one interleaved original leaves the sibling unchanged and overflow never evicts',()=>{
 const storage=memory(),set=storage.setItem;let second:any,interleave=true;storage.setItem=(key,value)=>{if(interleave){interleave=false;second=createExecutionPolicyRecoveryStore(owner,storage).reserve({operation:'revoke',id,version:0,requestId:'22345678-1234-4234-8234-123456789012'})}set(key,value)};
 const store=createExecutionPolicyRecoveryStore(owner,storage),first=store.reserve({operation:'approve',id,version:0,digest,requestId:nonce});store.acknowledge(first);expect(store.list()).toEqual([second]);
 const key=[...storage.data.keys()][0],record=JSON.parse(storage.data.get(key)!);for(let i=0;i<21;i++){const requestId=String(i).padStart(8,'0')+'-1234-4234-8234-123456789012';storage.data.set(key.slice(0,-36)+requestId,JSON.stringify({...record,reference:{...record.reference,requestId}}))}
 const count=storage.data.size;expect(()=>store.list()).toThrow();expect(storage.data.size).toBe(count);
});
it('unknown granting requests preserve fresh containment, while same-target unknown revoke remains original-only',()=>{
 const storage=memory(),store=createExecutionPolicyRecoveryStore(owner,storage);const original=store.reserve({operation:'propose',requestId:nonce,policy:{} as any});
 const revoke=store.reserve({operation:'revoke',id,version:0,requestId:'22345678-1234-4234-8234-123456789012'});expect(store.list()).toHaveLength(2);expect(()=>store.reserve({operation:'revoke',id,version:0,requestId:'32345678-1234-4234-8234-123456789012'})).toThrow();store.acknowledge(revoke);expect(store.list()).toEqual([original]);expect(()=>store.reserve({operation:'approve',id,version:0,digest,requestId:'42345678-1234-4234-8234-123456789012'})).toThrow();
});
