import {it,expect,vi,afterEach} from 'vitest';
import {createPlatformDeploymentClient} from '../../../desktop/src/lib/platformReview';
import {platformInspectionSchema} from '../../governance/platform/viewContract';
const id='platform_action_11111111-1111-4111-8111-111111111111',nonce='22222222-2222-4222-8222-222222222222',d='a'.repeat(64);
const config={apiBase:'https://fixture.test',sessionToken:'axm.desk.synthetic'},context={getConfig:()=>config,getRevision:()=>0,subscribe:()=>()=>{}};
const saved=()=>platformInspectionSchema.parse({actionId:id,status:'proposed',version:0,attemptCount:0,requesterUserId:'requester',reviewerUserId:null,expired:false,plan:{format:1,scope:'platform',digest:d,sourceDigest:d,expiresAt:'2099-01-01T00:00:00Z',effects:[{id:'deploy',kind:'deployment.vercel',target:{projectName:'project',teamId:'team_fixture',environment:'preview',projectCreation:'may_create_named_project',filesDigest:d,configurationDigest:d,leadId:'lead',leadRevision:'2026-11-12T00:00:00Z'}}]},effects:[{id:'deploy',status:'not_started'}],authority:'history_only',sourceValidation:'not_checked'});
afterEach(()=>vi.unstubAllGlobals());
it('uses the fixed preparation path once and distinguishes lost saves from read-only recovery',async()=>{
 const http=vi.fn(async()=>{throw Error('lost')});vi.stubGlobal('fetch',http);const client=createPlatformDeploymentClient(context);
 expect(await client.prepare({leadId:'lead',projectName:'project',environment:'preview',expiresAt:'2099-01-01T00:00:00Z'},nonce)).toMatchObject({ok:false,outcomeUnconfirmed:true});expect(await client.lookup(nonce)).toMatchObject({ok:false,outcomeUnconfirmed:false});expect(await client.preview(saved())).toMatchObject({ok:false,outcomeUnconfirmed:false});expect(http).toHaveBeenCalledTimes(3);expect(http).toHaveBeenCalledWith('https://fixture.test/api/desktop/platform-governance/deployment',expect.objectContaining({method:'POST',credentials:'omit',redirect:'error'}));
});
it('accepts only preview bound to this supported saved source, action and effect',async()=>{
 const preview={kind:'deployment.vercel',actionId:id,planDigest:d,sourceDigest:d,effectId:'deploy',files:[{path:'index.html',content:'<html>Escaped review text</html>'}],authority:'review_preview_only'},http=vi.fn(async()=>Response.json({ok:true,data:preview}));vi.stubGlobal('fetch',http);const client=createPlatformDeploymentClient(context);expect((await client.preview(saved())).ok).toBe(true);
 http.mockResolvedValueOnce(Response.json({ok:true,data:{...preview,sourceDigest:'b'.repeat(64)}}));expect((await client.preview(saved())).ok).toBe(false);
 const record=saved();if(record.plan.effects[0].kind!=='deployment.vercel')throw Error('wrong');delete record.plan.effects[0].target.leadId;delete record.plan.effects[0].target.leadRevision;http.mockClear();expect((await client.preview(record)).ok).toBe(false);expect(http).not.toHaveBeenCalled();
});
