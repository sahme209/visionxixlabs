import {expect,it} from 'vitest';
import {readInstallationAIMode,parseCustomerHostedOperatorConfig,activeCustomerHostedBudget} from '../customerHostedConfig';
const now=Date.parse('2026-11-11T12:00:00.000Z');
function fixture(kind='vllm'){return {format:'axiom.customer-hosted/1',installationId:'install_one',revision:'r1',server:{kind,baseUrl:'https://models.corp.test/v1',allowedHosts:['models.corp.test']},models:[{id:'team/model:1',maxInputTokens:4096,maxOutputTokens:512,maxInputBytes:8192}],budgets:[{organizationId:'org_a',windowId:'window_one',startsAt:'2026-11-11T00:00:00.000Z',expiresAt:'2026-11-12T00:00:00.000Z',limitTokens:100000}]};}
const parse=(value:unknown)=>parseCustomerHostedOperatorConfig(JSON.stringify(value));
it('selects only explicit valid modes and never treats malformed offline settings as online',()=>{
 for(const v of [undefined,'false'])expect(readInstallationAIMode(v)).toBe('online');
 expect(readInstallationAIMode('true')).toBe('offline');
 for(const v of ['',null,false,true,'TRUE',' true ','0',{}])expect(readInstallationAIMode(v)).toBe('unavailable');
});
it.each(['vllm','ollama','lm_studio'])('parses a positive bounded %s profile as immutable data, not authority',kind=>{
 const input=fixture(kind),config=parse(input);expect(config).not.toBeNull();
 expect(config?.server.kind).toBe(kind);expect(config?.digest).toMatch(/^[a-f0-9]{64}$/);
 expect(Object.isFrozen(config)).toBe(true);expect(Object.isFrozen(config?.models[0])).toBe(true);expect(Object.isFrozen(config?.server.allowedHosts)).toBe(true);
 input.models[0].maxOutputTokens=999;expect(config?.models[0].maxOutputTokens).toBe(512);
 expect(config).not.toHaveProperty('executionAuthorized');expect(config).not.toHaveProperty('qualified');
});
it('has no automatic configuration, cap or model bounds',()=>{
 for(const v of [undefined,null,'','{}','x'.repeat(65537)])expect(parseCustomerHostedOperatorConfig(v)).toBeNull();
 expect(parseCustomerHostedOperatorConfig(JSON.stringify(fixture())+' '.repeat(65536))).toBeNull();
 for(const field of ['models','budgets','server','revision','installationId']){const v:Record<string,unknown>=fixture();delete v[field];expect(parse(v)).toBeNull();}
 const v=fixture();delete (v.models[0] as Partial<typeof v.models[0]>).maxInputTokens;expect(parse(v)).toBeNull();
});
it('requires an exact host and refuses redirects-as-config, credentials, queries, fragments and native API paths',()=>{
 for(const baseUrl of ['http://models.corp.test/v1','https://models.corp.test.evil/v1','https://u:p@models.corp.test/v1','https://models.corp.test/v1?key=x','https://models.corp.test/v1#x','https://models.corp.test/api','file:///v1'])expect(parse({...fixture(),server:{...fixture().server,baseUrl}})).toBeNull();
 for(const allowedHosts of [['*.corp.test'],['other.corp.test'],['https://models.corp.test'],[]])expect(parse({...fixture(),server:{...fixture().server,allowedHosts}})).toBeNull();
 for(const baseUrl of ['http://127.0.0.1:11434/v1','http://[::1]:1234/v1','http://localhost:1234/v1']){const h=new URL(baseUrl).hostname;expect(parse({...fixture(),server:{kind:'ollama',baseUrl,allowedHosts:[h]}})).not.toBeNull();}
});
it('rejects unknown fields, duplicate identities and invalid numeric limits without echoing data',()=>{
 expect(parse({...fixture(),secret:'not-an-allowed-setting'})).toBeNull();
 expect(parse({...fixture(),server:{...fixture().server,kind:'arbitrary'}})).toBeNull();
 for(const value of [-1,0,1.5,Number.MAX_SAFE_INTEGER+1])expect(parse({...fixture(),models:[{...fixture().models[0],maxOutputTokens:value}]})).toBeNull();
 expect(parse({...fixture(),models:[{...fixture().models[0],maxInputBytes:131073}]})).toBeNull();
 expect(parse({...fixture(),models:[fixture().models[0],fixture().models[0]]})).toBeNull();
 expect(parse({...fixture(),budgets:[fixture().budgets[0],fixture().budgets[0]]})).toBeNull();
 expect(parse({...fixture(),budgets:[{...fixture().budgets[0],limitTokens:-1}]})).toBeNull();
});
it('selects the exact workspace and explicit active window, including a zero cap, without expiry fallback',()=>{
 const v=fixture(),config=parse(v)!;expect(activeCustomerHostedBudget(config,'org_a',now)?.limitTokens).toBe(100000);
 expect(activeCustomerHostedBudget(config,'org_b',now)).toBeNull();
 expect(activeCustomerHostedBudget(config,'org_a',Date.parse(v.budgets[0].startsAt)-1)).toBeNull();
 expect(activeCustomerHostedBudget(config,'org_a',Date.parse(v.budgets[0].startsAt))).not.toBeNull();
 expect(activeCustomerHostedBudget(config,'org_a',Date.parse(v.budgets[0].expiresAt))).toBeNull();
 expect(activeCustomerHostedBudget(config,'org_a',NaN)).toBeNull();
 expect(activeCustomerHostedBudget(parse({...v,budgets:[{...v.budgets[0],limitTokens:0}]})!,'org_a',now)?.limitTokens).toBe(0);
 expect(parse({...v,budgets:[{...v.budgets[0],expiresAt:v.budgets[0].startsAt}]})).toBeNull();
});
it('normalizes semantic JSON formatting but changes digest for a different cap or model bound',()=>{
 const v=fixture(),a=parse(v)!;expect(parseCustomerHostedOperatorConfig(JSON.stringify(v,null,2))?.digest).toBe(a.digest);
 expect(parse({...v,budgets:[{...v.budgets[0],limitTokens:1}]})?.digest).not.toBe(a.digest);
 expect(parse({...v,models:[{...v.models[0],maxOutputTokens:1}]})?.digest).not.toBe(a.digest);
});
