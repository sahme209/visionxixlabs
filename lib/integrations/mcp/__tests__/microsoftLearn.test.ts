import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {checkMicrosoftLearn,searchMicrosoftLearn,searchInstalledMicrosoftLearn} from '../microsoftLearn';
const endpoint='https://learn.microsoft.com/api/mcp';
let requests:Array<{url:string;init?:RequestInit;body:Record<string,unknown>}>;
let omitTool=false,redirect=false,toolError=false,extraRequired=false,oversize=false;
const rpc=(id:unknown,result:unknown)=>new Response(JSON.stringify({jsonrpc:'2.0',id,result}),{headers:{'content-type':'application/json'}});
beforeEach(()=>{
 requests=[];omitTool=false;redirect=false;toolError=false;extraRequired=false;oversize=false;
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
  const body=init?.body?JSON.parse(String(init.body)):{};requests.push({url:String(url),init,body});
  if(redirect)return new Response(null,{status:307,headers:{location:'https://evil.invalid/'}});
  if(body.method==='initialize')return rpc(body.id,{protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}});
  if(body.method==='notifications/initialized')return new Response(null,{status:202});
  if(body.method==='tools/list')return rpc(body.id,{tools:omitTool?[]:[{name:'microsoft_docs_search',inputSchema:{type:'object',properties:{query:{type:'string'}},...(extraRequired?{required:['query','secret']}: {})}}]});
  if(body.method==='tools/call')return rpc(body.id,{isError:toolError,content:[{type:'text',text:oversize?'x'.repeat(1_100_000):JSON.stringify({results:[{title:'Managed identity',content:'Public documentation',contentUrl:'https://learn.microsoft.com/en-us/azure/app-service/overview-managed-identity'},{title:'Unsafe link',content:'do not render link',contentUrl:'https://learn.microsoft.com.evil.invalid/'},{title:'Local',content:'bad',contentUrl:'http://127.0.0.1/private'}]})}]});
  return new Response(null,{status:405});
 }));
});
afterEach(()=>vi.unstubAllGlobals());
it('initializes and discovers the official server without a credential or arbitrary destination',async()=>{
 expect(await checkMicrosoftLearn()).toMatchObject({ok:true,data:{searchAvailable:true}});
 expect(requests.every(r=>r.url===endpoint&&r.init?.redirect==='error')).toBe(true);
 expect(requests.map(r=>r.body.method)).toContain('tools/list');
 for(const r of requests){const h=new Headers(r.init?.headers);expect(h.has('authorization')).toBe(false);expect(h.has('cookie')).toBe(false);}
});
it('returns only bounded Microsoft documentation results from a real MCP tool call',async()=>{
 const result=await searchMicrosoftLearn('Azure managed identity');
 expect(result).toEqual({ok:true,data:{results:[{title:'Managed identity',excerpt:'Public documentation',url:'https://learn.microsoft.com/en-us/azure/app-service/overview-managed-identity'}]}});
 expect(requests.find(r=>r.body.method==='tools/call')?.body.params).toEqual({name:'microsoft_docs_search',arguments:{query:'Azure managed identity'}});
});
it.each(['','x'.repeat(301),'line\nsecret','Authorization: Bearer abcdef','-----BEGIN PRIVATE KEY-----','sk_live_testsecretvalue'])('refuses invalid or credential-shaped query before contacting the server: %s',async query=>{
 expect(await searchMicrosoftLearn(query)).toEqual({ok:false,error:'invalid_documentation_query'});expect(requests).toHaveLength(0);
});
it.each(['missing','expanded','redirect','tool_error','oversize'])('fails closed for %s responses without exposing raw diagnostics',async kind=>{
 omitTool=kind==='missing';extraRequired=kind==='expanded';redirect=kind==='redirect';toolError=kind==='tool_error';oversize=kind==='oversize';
 expect(await searchMicrosoftLearn('Azure App Service')).toEqual({ok:false,error:'microsoft_learn_unavailable'});
});
it('requires the current workspace installation and rejects a disable during a call',async()=>{
 const findMany=vi.fn().mockResolvedValue([]);const repo={agentSkillInstallation:{findMany}};
 expect(await searchInstalledMicrosoftLearn(repo,'org-A','Azure identity')).toEqual({ok:false,error:'mcp_not_enabled'});expect(requests).toHaveLength(0);
 findMany.mockResolvedValueOnce([{skillId:'microsoft-learn-docs',status:'enabled'}]).mockResolvedValueOnce([]);
 expect(await searchInstalledMicrosoftLearn(repo,'org-A','Azure identity')).toEqual({ok:false,error:'mcp_not_enabled'});
 expect(findMany).toHaveBeenCalledWith({where:{organizationId:'org-A',status:'enabled'}});
});
it('makes unavailable storage fail closed before external traffic',async()=>{
 const repo={agentSkillInstallation:{findMany:vi.fn().mockRejectedValue(Error('private database diagnostic'))}};
 expect(await searchInstalledMicrosoftLearn(repo,'org-A','Azure identity')).toEqual({ok:false,error:'microsoft_learn_unavailable'});expect(requests).toHaveLength(0);
});
