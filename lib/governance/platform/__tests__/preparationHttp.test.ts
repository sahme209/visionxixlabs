import {it,expect,vi} from 'vitest';
import {createPlatformPreparationHttp} from '../preparationHttp';
import type {createDefaultPlatformRequestService} from '../requestService';
type Service=Awaited<ReturnType<typeof createDefaultPlatformRequestService>>;
const id='platform_action_11111111-1111-8111-a111-111111111111',nonce='22222222-2222-4222-8222-222222222222',d='a'.repeat(64),selection={operation:'publish',draftId:'draft',connectionId:'connection',expiresAt:'2099-01-01T00:00:00.000Z'};
function fixture(){const prepareGrowth=vi.fn<Service['prepareGrowth']>().mockResolvedValue({actionId:id,historical:false,authority:'proposal_reference_only',preview:{sourceDigest:d,effectId:'post',renderedPost:'not-in-reference-response'}}),lookupGrowthPreparation=vi.fn<Service['lookupGrowthPreparation']>().mockResolvedValue({found:true,actionId:id,authority:'history_only'}),factory=vi.fn(async()=>({prepareGrowth,lookupGrowthPreparation}));return {prepareGrowth,lookupGrowthPreparation,factory,handle:createPlatformPreparationHttp(factory)}}
const req=(body:unknown)=>new Request('https://fixture.test/prepare',{method:'POST',body:JSON.stringify(body)});
it('requires a request UUID and strict source selectors; never returns fresh content in the save receipt',async()=>{
 const f=fixture();expect((await f.handle(req({operation:'prepare_growth',selection}))).status).toBe(400);expect(f.prepareGrowth).not.toHaveBeenCalled();
 const response=await f.handle(req({operation:'prepare_growth',requestId:nonce,selection}));expect(response.status).toBe(200);expect(await response.json()).toEqual({ok:true,data:{requestId:nonce,actionId:id,historical:false,authority:'proposal_reference_only'}});expect(f.prepareGrowth).toHaveBeenCalledExactlyOnceWith(selection,nonce);
});
it('lookup is an explicit read and cannot create, renew or approve a proposal',async()=>{
 const f=fixture(),response=await f.handle(req({operation:'lookup_preparation',requestId:nonce}));expect(await response.json()).toEqual({ok:true,data:{requestId:nonce,found:true,actionId:id,authority:'history_only'}});expect(f.prepareGrowth).not.toHaveBeenCalled();
 for(const body of [{operation:'prepare_growth',requestId:nonce,selection:{...selection,sourceDigest:d}},{operation:'lookup_preparation',requestId:nonce,actor:'other'},{operation:'execute',requestId:nonce}])expect((await f.handle(req(body))).status).toBe(400);
});
it('a lost save does not retry; same-request lookup is separate',async()=>{
 const f=fixture();f.prepareGrowth.mockRejectedValueOnce(Error('possible commit private raw detail'));const response=await f.handle(req({operation:'prepare_growth',requestId:nonce,selection}));expect(response.status).toBe(409);expect(await response.json()).toMatchObject({error:'platform_preparation_outcome_unconfirmed',recovery:'lookup_same_request_no_automatic_resubmit'});expect(f.lookupGrowthPreparation).not.toHaveBeenCalled();expect(f.prepareGrowth).toHaveBeenCalledTimes(1);await f.handle(req({operation:'lookup_preparation',requestId:nonce}));expect(f.prepareGrowth).toHaveBeenCalledTimes(1);expect(f.lookupGrowthPreparation).toHaveBeenCalledTimes(1);
});
