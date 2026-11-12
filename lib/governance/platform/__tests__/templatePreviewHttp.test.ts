import {it,expect,vi} from 'vitest';
import {createPlatformReviewHttp} from '../reviewHttp';
const id='platform_action_11111111-1111-4111-8111-111111111111',d='a'.repeat(64);
const preview={kind:'template.source' as const,actionId:id,planDigest:d,sourceDigest:d,effectId:'upload',bytesDigest:d,yaml:'Resources: {}\n',authority:'review_preview_only' as const};
const request=(body:unknown)=>new Request('http://local.invalid/review',{method:'POST',body:JSON.stringify(body)});
it('authenticates before returning an exact read-only template preview without a decision',async()=>{
 const inspect=vi.fn(),review=vi.fn(),previewGrowth=vi.fn(),previewTemplate=vi.fn(async()=>preview),factory=vi.fn(async()=>({inspect,review,previewGrowth,previewTemplate}));
 const response=await createPlatformReviewHttp(factory)(request({operation:'preview_template',actionId:id}));
 expect(response.status).toBe(200);expect(await response.json()).toEqual({ok:true,data:preview});expect(previewTemplate).toHaveBeenCalledWith(id);expect(inspect).not.toHaveBeenCalled();expect(review).not.toHaveBeenCalled();expect(previewGrowth).not.toHaveBeenCalled();
});
it('refuses unsupported or mismatched source and never falls back to another preview',async()=>{
 for(const result of [null,{...preview,actionId:'platform_action_22222222-2222-4222-8222-222222222222'},{...preview,authority:'execution'},{...preview,yaml:'"'.repeat(140000)}]){
  const handler=createPlatformReviewHttp(async()=>({inspect:vi.fn(),review:vi.fn(),previewGrowth:vi.fn(),previewTemplate:async()=>result}));
  expect((await handler(request({operation:'preview_template',actionId:id}))).status).toBe(409);
 }
});
it('refuses unauthenticated template source access and unknown fields',async()=>{
 const denied=createPlatformReviewHttp(async()=>{throw Error('denied')});expect((await denied(request({operation:'preview_template',actionId:id}))).status).toBe(401);
 const previewTemplate=vi.fn();const handler=createPlatformReviewHttp(async()=>({inspect:vi.fn(),review:vi.fn(),previewGrowth:vi.fn(),previewTemplate}));expect((await handler(request({operation:'preview_template',actionId:id,path:'/arbitrary'}))).status).toBe(400);expect(previewTemplate).not.toHaveBeenCalled();
});
