import {it,expect,vi,afterEach} from 'vitest';
import {createPlatformTemplateClient} from '../../../desktop/src/lib/platformReview';
import {platformInspectionSchema} from '../../governance/platform/viewContract';
const id='platform_action_11111111-1111-4111-8111-111111111111',d='a'.repeat(64);
const config={apiBase:'https://fixture.test',sessionToken:'axm.desk.synthetic'},context={getConfig:()=>config,getRevision:()=>0,subscribe:()=>()=>{}};
const saved=()=>platformInspectionSchema.parse({actionId:id,status:'proposed',version:0,attemptCount:0,requesterUserId:'requester',reviewerUserId:null,expired:false,plan:{format:1,scope:'platform',digest:d,sourceDigest:d,expiresAt:'2099-01-01T00:00:00Z',effects:[{id:'upload',kind:'template.object.put',target:{accountId:'123456789012',region:'us-east-2',bucket:'bucket',key:'template.yaml',bytesDigest:d}}]},effects:[{id:'upload',status:'not_started'}],authority:'history_only',sourceValidation:'not_checked'});
const preview={kind:'template.source',actionId:id,planDigest:d,sourceDigest:d,effectId:'upload',bytesDigest:d,yaml:'Resources: {}\n',authority:'review_preview_only'};
afterEach(()=>vi.unstubAllGlobals());
it('reads only the exact current template through the fixed paired review transport',async()=>{
 const http=vi.fn(async()=>Response.json({ok:true,data:preview}));vi.stubGlobal('fetch',http);
 expect((await createPlatformTemplateClient(context).preview(saved())).ok).toBe(true);
 expect(http).toHaveBeenCalledExactlyOnceWith('https://fixture.test/api/desktop/platform-governance/review',expect.objectContaining({method:'POST',credentials:'omit',redirect:'error',body:JSON.stringify({operation:'preview_template',actionId:id})}));
});
it('rejects substituted bytes/source/action and treats a lost preview as read-only uncertainty',async()=>{
 const http=vi.fn(async()=>Response.json({ok:true,data:{...preview,bytesDigest:'b'.repeat(64)}}));vi.stubGlobal('fetch',http);const client=createPlatformTemplateClient(context);
 expect((await client.preview(saved())).ok).toBe(false);http.mockImplementation(async()=>{throw Error('lost')});expect(await client.preview(saved())).toMatchObject({ok:false,outcomeUnconfirmed:false});
 const record=saved();record.expired=true;http.mockClear();expect((await client.preview(record)).ok).toBe(false);expect(http).not.toHaveBeenCalled();
});
