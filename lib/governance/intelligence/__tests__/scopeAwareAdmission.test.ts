import {it,expect,vi} from 'vitest';
import {createScopeAwareGovernanceAdmission} from '../scopeAwareAdmission';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
const scope={organizationId:'org',actorUserId:'owner',sessionId:'session'},context={...scope,action:'repository.merge',scope:{repositoryId:'company/repo',resourceId:'github:repository:company/repo',environment:'production'},planDigest:'a'.repeat(64)},baselineDigest='b'.repeat(64);
function fixture(){let now=Date.parse('2030-01-01T00:00:00Z');const readEnrollment=vi.fn<any>(async()=>({enrolled:false})),guard={assert:vi.fn(async(_c:any,phase:any)=>({baselineDigest,contextDigest:sha256ContentHash(context),phase,checkedAt:now}))},wrapped=createScopeAwareGovernanceAdmission(scope,{readEnrollment,guard,now:()=>now});return{wrapped,readEnrollment,guard,setNow:(v:number)=>now=v}}
it('preserves positively non-enrolled scope behavior while repeating current enrollment checks',async()=>{const f=fixture(),prior=await f.wrapped.assert(context,'before_claim');await f.wrapped.assert(context,'before_write',prior);expect(f.readEnrollment).toHaveBeenCalledTimes(2);expect(f.guard.assert).not.toHaveBeenCalled()});
it('uses strict admission for enrolled scope in both phases',async()=>{const f=fixture();f.readEnrollment.mockResolvedValue({enrolled:true,baselineDigest});const prior=await f.wrapped.assert(context,'before_claim');await f.wrapped.assert(context,'before_write',prior);expect(f.guard.assert).toHaveBeenCalledTimes(2)});
it.each([true,false])('refuses enrollment transition from %s between claim and write',async enrolled=>{const f=fixture();f.readEnrollment.mockResolvedValue(enrolled?{enrolled:true,baselineDigest}:{enrolled:false});const prior=await f.wrapped.assert(context,'before_claim');f.readEnrollment.mockResolvedValue(enrolled?{enrolled:false}:{enrolled:true,baselineDigest});await expect(f.wrapped.assert(context,'before_write',prior)).rejects.toThrow()});
it('refuses unknown enrollment and never treats a read failure as legacy permission',async()=>{const f=fixture();f.readEnrollment.mockRejectedValue(Error('database unavailable'));await expect(f.wrapped.assert(context,'before_claim')).rejects.toThrow();expect(f.guard.assert).not.toHaveBeenCalled()});
it('refuses invented or cross-context prior receipts',async()=>{const f=fixture();await expect(f.wrapped.assert(context,'before_write',{baselineDigest:'0'.repeat(64),contextDigest:sha256ContentHash(context),phase:'before_claim',checkedAt:Date.parse('2030-01-01T00:00:00Z')})).rejects.toThrow();const prior=await f.wrapped.assert(context,'before_claim');await expect(f.wrapped.assert({...context,planDigest:'c'.repeat(64)},'before_write',prior)).rejects.toThrow()});

it('rejects a caller-mutated genuine prior receipt',async()=>{const f=fixture(),prior=await f.wrapped.assert(context,'before_claim');prior.checkedAt++;await expect(f.wrapped.assert(context,'before_write',prior)).rejects.toThrow()});

it.each(['removed','replaced','unavailable'])('refuses enrollment %s while strict admission is awaited',async change=>{
 const f=fixture();f.readEnrollment.mockResolvedValue({enrolled:true,baselineDigest});
 f.guard.assert.mockImplementationOnce(async(_c:any,phase:any)=>{
  if(change==='unavailable')f.readEnrollment.mockRejectedValue(Error('current pointer unreadable'));
  else f.readEnrollment.mockResolvedValue(change==='removed'?{enrolled:false}:{enrolled:true,baselineDigest:'c'.repeat(64)});
  return {baselineDigest,contextDigest:sha256ContentHash(context),phase,checkedAt:Date.parse('2030-01-01T00:00:00Z')};
 });
 await expect(f.wrapped.assert(context,'before_claim')).rejects.toThrow('governance_admission_unavailable');
});
