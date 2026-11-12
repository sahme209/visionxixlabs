import {it,expect,vi} from 'vitest';
import {createPlatformTemplatePreparationHttp} from '../templatePreparationHttp';
const id='platform_action_11111111-1111-4111-8111-111111111111',requestId='22222222-2222-4222-8222-222222222222',selection={operation:'upload',accountId:'123456789012',region:'us-east-2',expiresAt:'2099-01-01T00:00:00Z'};
const request=(body:unknown)=>new Request('http://local.invalid/template',{method:'POST',body:JSON.stringify(body)});
it('saves only a strict source selection and correlates one original reference',async()=>{
 const prepareTemplate=vi.fn(async()=>({actionId:id,historical:false,authority:'proposal_reference_only' as const})),lookupTemplatePreparation=vi.fn();
 const reply=await createPlatformTemplatePreparationHttp(async()=>({prepareTemplate,lookupTemplatePreparation}))(request({operation:'prepare_template',requestId,selection}));
 expect(reply.status).toBe(200);expect(await reply.json()).toEqual({ok:true,data:{actionId:id,requestId,historical:false,authority:'proposal_reference_only'}});expect(prepareTemplate).toHaveBeenCalledExactlyOnceWith(selection,requestId);expect(lookupTemplatePreparation).not.toHaveBeenCalled();
});
it('reports unknown saving separately from read-only lookup failure and refuses arbitrary effects',async()=>{
 const prepareTemplate=vi.fn(async()=>{throw Error('lost')}),lookupTemplatePreparation=vi.fn(async()=>{throw Error('missing')}),handler=createPlatformTemplatePreparationHttp(async()=>({prepareTemplate,lookupTemplatePreparation}));
 const lost=await handler(request({operation:'prepare_template',requestId,selection}));expect(lost.status).toBe(409);expect(await lost.json()).toMatchObject({error:'platform_template_preparation_unconfirmed',recovery:'lookup_original_reference_no_automatic_resubmit'});
 const read=await handler(request({operation:'lookup_template',requestId}));expect(read.status).toBe(409);expect(await read.json()).toMatchObject({error:'platform_template_reference_unavailable'});
 expect((await handler(request({operation:'prepare_template',requestId,selection:{...selection,bytesDigest:'a'.repeat(64)}}))).status).toBe(400);expect(prepareTemplate).toHaveBeenCalledTimes(1);
});
