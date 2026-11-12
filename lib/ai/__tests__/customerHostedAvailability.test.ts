import {it,expect,vi,afterEach} from 'vitest';
import {customerHostedAvailability} from '../customerHostedAvailability';
import {parseCustomerHostedOperatorConfig} from '../customerHostedConfig';
afterEach(()=>vi.unstubAllEnvs());
function fixture(){const now=Date.parse('2026-11-11T12:00:00.000Z');const config=parseCustomerHostedOperatorConfig(JSON.stringify({format:'axiom.customer-hosted/1',installationId:'install',revision:'r1',server:{kind:'vllm',baseUrl:'https://models.private.test/v1',allowedHosts:['models.private.test']},models:[{id:'local-a',maxInputTokens:100,maxOutputTokens:20,maxInputBytes:8192},{id:'local-b',maxInputTokens:100,maxOutputTokens:20,maxInputBytes:8192}],budgets:[{organizationId:'org',windowId:'w',startsAt:'2026-11-11T00:00:00.000Z',expiresAt:'2026-11-12T00:00:00.000Z',limitTokens:10000}]}))!;return {now,config,limits:vi.fn(async(_c:unknown,model:string)=>model==='local-a'?{reservedTokens:120,expiresAt:now+60000,evidenceSha256:'b'.repeat(64)}:null)}}
it('exposes only accepted configured models without endpoint, evidence path or cap data',async()=>{
 vi.stubEnv('AXIOM_OFFLINE_MODE','true');const f=fixture();expect(await customerHostedAvailability('org',{readConfig:()=>f.config,readLimits:f.limits,now:()=>f.now})).toEqual({mode:'offline',models:[{id:'local-a',label:'local-a',tier:'balanced'}]});
});
it('does no local evidence IO online and refuses malformed mode',async()=>{
 const f=fixture();for(const mode of ['false','invalid']){vi.stubEnv('AXIOM_OFFLINE_MODE',mode);expect(await customerHostedAvailability('org',{readConfig:()=>f.config,readLimits:f.limits,now:()=>f.now})).toEqual({mode:mode==='false'?'online':'unavailable',models:[]})}expect(f.limits).not.toHaveBeenCalled();
});
it('offers nothing without this workspace budget or when evidence fails',async()=>{
 vi.stubEnv('AXIOM_OFFLINE_MODE','true');const f=fixture();expect((await customerHostedAvailability('other',{readConfig:()=>f.config,readLimits:f.limits,now:()=>f.now})).models).toEqual([]);expect(f.limits).not.toHaveBeenCalled();f.limits.mockRejectedValue(Error('unavailable'));expect((await customerHostedAvailability('org',{readConfig:()=>f.config,readLimits:f.limits,now:()=>f.now})).models).toEqual([]);
});
it('does not return a model whose evidence expired while another model was checked',async()=>{
 vi.stubEnv('AXIOM_OFFLINE_MODE','true');const f=fixture();let at=f.now;
 const readLimits=async(_config:unknown,model:string)=>{if(model==='local-a')return {reservedTokens:120,expiresAt:at+1,evidenceSha256:'b'.repeat(64)};at+=2;return null};
 expect((await customerHostedAvailability('org',{readConfig:()=>f.config,readLimits,now:()=>at})).models).toEqual([]);
});
