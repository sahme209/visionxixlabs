import {afterEach,it,expect,vi} from 'vitest';
import {preparePlatformVercelDeployment} from '../platformDeployment';
import {bindPlatformDeploymentExecution} from '@/lib/governance/platform/effectExecution';
import {createDeploymentNativeTransport} from '@/lib/governance/platform/deploymentNativeTransport';
import type {ExecutionTimeCheck} from '@/lib/governance/platform/executionTime';
import {deploySite} from '../provider';
vi.mock('@/lib/scaffoldGenerator',()=>({generateSiteFiles:()=>[{path:'index.html',content:'fixture'}],generateSiteFilesFromPlan:()=>[{path:'index.html',content:'fixture'}]}));
const files=[{path:'index.html',content:'fixture'}],context={projectName:'fixture',teamId:'team_fixture',target:'production' as const,effectId:'deployment'};
// Explicit synthetic native/time suppliers. Real defaults remain unavailable.
function binding(effect:ReturnType<typeof preparePlatformVercelDeployment>['effect']){
 const now=Date.now(),timing={clock:async()=>{const current=Date.now();return {earliest:current,latest:current}},signal:new AbortController().signal},transport=createDeploymentNativeTransport({...timing,fetch:(url,init)=>fetch(url,init),assertQualified:async()=>{},readHeldCredential:async()=>({token:'SYNTHETIC_HELD_TOKEN',notBefore:now-60000,expiresAt:now+60000}),assertCredentialCurrent:async()=>{}}),service={claimNextEffect:vi.fn(async()=>({effect,proof:Object.freeze({})})),beforeEffectCredential:vi.fn(async(_proof:object,_effect:typeof effect,check:ExecutionTimeCheck,finalFacts?:()=>Promise<void>)=>{await check();if(!finalFacts)throw Error('missing final facts');await finalFacts()}),beforeEffectSend:vi.fn(async(_proof:object,_effect:typeof effect,check?:ExecutionTimeCheck,finalFacts?:()=>Promise<void>)=>{if(!check||!finalFacts)throw Error('missing native owner callbacks');await check();await finalFacts()}),observeEffect:vi.fn(async()=>{}),beforeEffectResult:vi.fn(async()=>{})};return {value:bindPlatformDeploymentExecution(service,'fixture-action',transport,timing),service};
}
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
 const [url,init]=fetch.mock.calls[0] as unknown as [string,RequestInit];expect(url).toBe('https://api.vercel.com/v13/deployments');expect(init.redirect).toBe('error');expect(init.body).toBe(prepared.body);expect(b.service.observeEffect).toHaveBeenCalledWith(expect.anything(),'confirmed',{kind:'deployment.request',providerDeploymentId:'dpl_fixture',providerState:'BUILDING'});expect(b.service.beforeEffectResult).toHaveBeenCalledOnce();
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
it('preview approval cannot confirm a provider-reported production target',async()=>{
 vi.stubEnv('VERCEL_TOKEN','synthetic-token');vi.stubEnv('VERCEL_TEAM_ID','team_fixture');const p=preparePlatformVercelDeployment(files,{...context,target:undefined}),b=binding(p.effect);vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({id:'dpl_fixture',target:'production'}),{status:200})));
 await expect(deploySite('vercel',{} as never,{projectName:'fixture',effectId:'deployment',platformExecution:b.value})).rejects.toThrow();expect(b.service.observeEffect).toHaveBeenCalledWith(expect.anything(),'unknown');
});
it('option mutation during the request cannot remove the prepared production target check',async()=>{
 vi.stubEnv('VERCEL_TOKEN','synthetic-token');vi.stubEnv('VERCEL_TEAM_ID','team_fixture');const p=preparePlatformVercelDeployment(files,context),b=binding(p.effect);
 const options:{projectName:string;target?:'production';effectId:string;platformExecution:object}={projectName:'fixture',target:'production',effectId:'deployment',platformExecution:b.value};
 vi.stubGlobal('fetch',vi.fn(async()=>{delete options.target;return new Response(JSON.stringify({id:'dpl_fixture',target:'preview'}),{status:200})}));
 await expect(deploySite('vercel',{} as never,options)).rejects.toThrow();expect(b.service.observeEffect).toHaveBeenCalledWith(expect.anything(),'unknown');
});

it('keeps a recorded accepted request but withholds output when the final current-authority check refuses',async()=>{vi.stubEnv('VERCEL_TOKEN','synthetic-token');vi.stubEnv('VERCEL_TEAM_ID','team_fixture');const p=preparePlatformVercelDeployment(files,context),b=binding(p.effect),fetch=vi.fn(async()=>Response.json({id:'dpl_fixture',readyState:'BUILDING',target:'production'}));vi.stubGlobal('fetch',fetch);b.service.beforeEffectResult.mockRejectedValue(Error('synthetic revoked current reader'));await expect(deploySite('vercel',{} as never,{projectName:'fixture',target:'production',effectId:'deployment',platformExecution:b.value})).rejects.toThrow('platform_governance_result_unavailable');expect(b.service.observeEffect).toHaveBeenCalledExactlyOnceWith(expect.anything(),'confirmed',{kind:'deployment.request',providerDeploymentId:'dpl_fixture',providerState:'BUILDING'});await expect(deploySite('vercel',{} as never,{projectName:'fixture',target:'production',effectId:'deployment',platformExecution:b.value})).rejects.toThrow();expect(fetch).toHaveBeenCalledOnce()});
