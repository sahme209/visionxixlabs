import {afterEach,it,expect,vi} from 'vitest';
import {preparePlatformVercelDeployment} from '../platformDeployment';
import {bindPlatformExecution} from '@/lib/governance/platform/effectExecution';
import {deploySite} from '../provider';
vi.mock('@/lib/scaffoldGenerator',()=>({generateSiteFiles:()=>[{path:'index.html',content:'fixture'}],generateSiteFilesFromPlan:()=>[{path:'index.html',content:'fixture'}]}));
const files=[{path:'index.html',content:'fixture'}],context={projectName:'fixture',teamId:'team_fixture',target:'production' as const,effectId:'deployment'};
function binding(effect:ReturnType<typeof preparePlatformVercelDeployment>['effect']){const service={claimNextEffect:vi.fn(async()=>({effect,proof:Object.freeze({})})),beforeEffectSend:vi.fn(async()=>{}),observeEffect:vi.fn(async()=>{})};return {value:bindPlatformExecution(service,'fixture-action'),service}}
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});
it('binds exact named-project creation risk, team, files and environment to request bytes',()=>{
 const p=preparePlatformVercelDeployment(files,context);expect(p.effect.target).toMatchObject({projectName:'fixture',teamId:'team_fixture',environment:'production',projectCreation:'may_create_named_project'});
 expect(JSON.parse(p.body)).toMatchObject({name:'fixture',target:'production',files:[{file:'index.html',data:Buffer.from('fixture').toString('base64')}]});
 expect(preparePlatformVercelDeployment([{...files[0],content:'changed'}],context).effect.target.filesDigest).not.toBe(p.effect.target.filesDigest);
 expect(preparePlatformVercelDeployment(files,{...context,teamId:'team_other'}).effect.target.configurationDigest).not.toBe(p.effect.target.configurationDigest);
});
it('rejects missing account scope, ambiguous files and unsupported names',()=>{
 for(const bad of [{...context,teamId:''},{...context,projectName:'../other'}])expect(()=>preparePlatformVercelDeployment(files,bad)).toThrow();
 for(const bad of [[...files,...files],[{path:'../secret',content:'fixture'}],[{path:'/absolute',content:'fixture'}]])expect(()=>preparePlatformVercelDeployment(bad,context)).toThrow();
});
it('default deployment refuses missing or invented authority before credential access or fetch',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);vi.stubEnv('VERCEL_TOKEN','synthetic-token');vi.stubEnv('VERCEL_TEAM_ID','team_fixture');
 for(const platformExecution of [undefined,{}])await expect(deploySite('vercel',{} as never,{projectName:'fixture',platformExecution})).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();
});
it('composes exact claim, final check and one default deployment POST',async()=>{
 vi.stubEnv('VERCEL_TOKEN','synthetic-token');vi.stubEnv('VERCEL_TEAM_ID','team_fixture');
 const prepared=preparePlatformVercelDeployment(files,context),b=binding(prepared.effect),fetch=vi.fn(async()=>new Response(JSON.stringify({id:'dpl_fixture',readyState:'BUILDING',target:'production'}),{status:200}));vi.stubGlobal('fetch',fetch);
 const result=await deploySite('vercel',{} as never,{projectName:'fixture',target:'production',effectId:'deployment',platformExecution:b.value});
 expect(result).toMatchObject({deploymentId:'dpl_fixture',state:'BUILDING'});expect(fetch).toHaveBeenCalledTimes(1);
 const [url,init]=fetch.mock.calls[0] as unknown as [string,RequestInit];expect(url).toBe('https://api.vercel.com/v13/deployments');expect(init.redirect).toBe('error');expect(init.body).toBe(prepared.body);expect(b.service.observeEffect).toHaveBeenCalledWith(expect.anything(),'confirmed');
});
it('changed payload refuses before fetch and unconfirmed responses stay unknown without replay',async()=>{
 vi.stubEnv('VERCEL_TOKEN','synthetic-token');vi.stubEnv('VERCEL_TEAM_ID','team_fixture');const prepared=preparePlatformVercelDeployment(files,context);
 const mismatch=binding(prepared.effect),fetch=vi.fn(async()=>new Response('{}',{status:200}));vi.stubGlobal('fetch',fetch);
 await expect(deploySite('vercel',{} as never,{projectName:'other',target:'production',effectId:'deployment',platformExecution:mismatch.value})).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();
 const unknown=binding(prepared.effect);await expect(deploySite('vercel',{} as never,{projectName:'fixture',target:'production',effectId:'deployment',platformExecution:unknown.value})).rejects.toThrow();
 expect(fetch).toHaveBeenCalledTimes(1);expect(unknown.service.observeEffect).toHaveBeenCalledWith(expect.anything(),'unknown');
});
it('does not confirm a production request when the provider reports a different target',async()=>{
 vi.stubEnv('VERCEL_TOKEN','synthetic-token');vi.stubEnv('VERCEL_TEAM_ID','team_fixture');const p=preparePlatformVercelDeployment(files,context),b=binding(p.effect),fetch=vi.fn(async()=>new Response(JSON.stringify({id:'dpl_fixture',target:'preview'}),{status:200}));vi.stubGlobal('fetch',fetch);
 await expect(deploySite('vercel',{} as never,{projectName:'fixture',target:'production',effectId:'deployment',platformExecution:b.value})).rejects.toThrow();expect(fetch).toHaveBeenCalledTimes(1);expect(b.service.observeEffect).toHaveBeenCalledWith(expect.anything(),'unknown');
});
