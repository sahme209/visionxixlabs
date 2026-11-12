import {it,expect,vi} from 'vitest';
import {createCurrentPlatformAuthority} from '../currentAuthority';
import type {PlatformTransaction} from '../actionStore';
const principal={userId:'stable-user',sessionId:'paired-session'};
const good={userId:'stable-user',sessionId:'paired-session',email:'admin@example.test',live:true};
function fixture(row:unknown=good){const readPrincipal=vi.fn(async()=>row);return {tx:{readPrincipal} as unknown as PlatformTransaction,readPrincipal}}
it('uses stable current paired identity and current deployment-admin allowlist',async()=>{
 const f=fixture();let allowed=['admin@example.test'];const authority=createCurrentPlatformAuthority(()=>allowed);
 await authority.assertCurrent(f.tx,principal);expect(f.readPrincipal).toHaveBeenCalledWith(principal);allowed=[];await expect(authority.assertCurrent(f.tx,principal)).rejects.toThrow();
});
it('refuses stale/revoked/wrong/unknown identity and malformed supplier output',async()=>{
 for(const row of [null,{...good,live:false},{...good,userId:'other'},{...good,sessionId:'other'},{...good,email:'other@example.test'},{...good,live:'true'},[good],{...good,unexpected:'data'}]){
  const f=fixture(row);await expect(createCurrentPlatformAuthority(()=>['admin@example.test']).assertCurrent(f.tx,principal)).rejects.toThrow();
 }
});
it('checks allowlist again after awaited identity lookup and fails closed on read failure',async()=>{
 let allowed=['admin@example.test'];const f=fixture();f.readPrincipal.mockImplementation(async()=>{allowed=[];return good});
 await expect(createCurrentPlatformAuthority(()=>allowed).assertCurrent(f.tx,principal)).rejects.toThrow();
 f.readPrincipal.mockRejectedValue(Error('unavailable'));await expect(createCurrentPlatformAuthority(()=>['admin@example.test']).assertCurrent(f.tx,principal)).rejects.toThrow();
});
