import {it,expect,vi} from 'vitest';
import {createPlatformDeploymentHttp} from '../deploymentHttp';
const id='platform_action_11111111-1111-4111-8111-111111111111',requestId='22222222-2222-4222-8222-222222222222';
const selected={leadId:'lead',projectName:'project',environment:'preview',expiresAt:'2099-01-01T00:00:00Z'};
const request=(body:unknown)=>new Request('https://fixture.test/deployment',{method:'POST',body:JSON.stringify(body)});
function fixture(){const prepareDeployment=vi.fn(async()=>({actionId:id,historical:false,authority:'proposal_reference_only' as const})),lookupDeploymentPreparation=vi.fn(async()=>({found:true as const,actionId:id,authority:'history_only' as const})),previewDeployment=vi.fn(async()=>({kind:'deployment.vercel' as const,actionId:id,planDigest:'a'.repeat(64),sourceDigest:'b'.repeat(64),effectId:'one',files:[{path:'index.html',content:'<html>Exact text</html>'}],authority:'review_preview_only' as const})),factory=vi.fn(async()=>({prepareDeployment,lookupDeploymentPreparation,previewDeployment}));return {prepareDeployment,lookupDeploymentPreparation,previewDeployment,factory,handle:createPlatformDeploymentHttp(factory)}}
it('saves a mandatory original reference and exposes separate read-only lookup/preview',async()=>{
 const f=fixture();expect((await f.handle(request({operation:'prepare_deployment',requestId,selection:selected}))).status).toBe(200);expect(f.prepareDeployment).toHaveBeenCalledExactlyOnceWith(selected,requestId);
 const lookup=await f.handle(request({operation:'lookup_deployment',requestId}));expect(await lookup.json()).toMatchObject({data:{requestId,actionId:id,authority:'history_only'}});expect(f.prepareDeployment).toHaveBeenCalledTimes(1);
 const preview=await f.handle(request({operation:'preview_deployment',actionId:id}));expect(preview.headers.get('cache-control')).toContain('no-store');expect(await preview.json()).toMatchObject({data:{kind:'deployment.vercel',authority:'review_preview_only'}});
});
it('refuses caller authority/files and authenticates before source use',async()=>{
 const f=fixture();f.factory.mockRejectedValueOnce(Error('private authentication'));const denied=await f.handle(request({operation:'prepare_deployment',requestId,selection:selected}));expect(denied.status).toBe(401);expect(await denied.text()).not.toContain('private authentication');
 for(const body of [{operation:'prepare_deployment',selection:selected},{operation:'execute',actionId:id},{operation:'prepare_deployment',requestId,selection:selected,actor:'other'},{operation:'prepare_deployment',requestId,selection:{...selected,files:[]}}])expect((await f.handle(request(body))).status).toBe(400);expect(f.prepareDeployment).not.toHaveBeenCalled();
});
it('holds uncertain saves for original-reference lookup without retry or raw error disclosure',async()=>{
 const f=fixture();f.prepareDeployment.mockRejectedValueOnce(Error('possible commit private detail'));const response=await f.handle(request({operation:'prepare_deployment',requestId,selection:selected}));expect(response.status).toBe(409);expect(await response.json()).toEqual({ok:false,error:'platform_deployment_preparation_unconfirmed',recovery:'lookup_original_reference_no_automatic_resubmit'});expect(f.prepareDeployment).toHaveBeenCalledTimes(1);expect(f.lookupDeploymentPreparation).not.toHaveBeenCalled();
});
it('refuses duplicate or unsafe preview paths instead of presenting an ambiguous file set',async()=>{
 for(const files of [[{path:'index.html',content:'one'},{path:'index.html',content:'two'}],[{path:'../outside.html',content:'text'}]]){
  const f=fixture();f.previewDeployment.mockResolvedValueOnce({kind:'deployment.vercel',actionId:id,planDigest:'a'.repeat(64),sourceDigest:'b'.repeat(64),effectId:'one',files,authority:'review_preview_only'});expect((await f.handle(request({operation:'preview_deployment',actionId:id}))).status).toBe(409);
 }
});
