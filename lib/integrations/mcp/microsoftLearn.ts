import 'server-only';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {AgentSkillRepo} from '@/lib/axiom/agentRuntime/skillCatalog';

const ENDPOINT='https://learn.microsoft.com/api/mcp';
const MAX_RESPONSE_BYTES=1_048_576;
const OPTIONS={timeout:15_000,maxTotalTimeout:25_000};
export const MICROSOFT_LEARN_SKILL_ID='microsoft-learn-docs';
export interface DocumentationResult {title:string;excerpt:string;url:string}
type Failure={ok:false;error:'invalid_documentation_query'|'microsoft_learn_unavailable'|'mcp_not_enabled'};
export type DocumentationSearch={ok:true;data:{results:DocumentationResult[]}}|Failure;

export function validDocumentationQuery(value:unknown):value is string {
 return typeof value==='string'&&value.trim().length>0&&value.length<=300&&!/[\r\n\x00-\x1f]/.test(value)
  &&!/(?:-----BEGIN|authorization\s*:|bearer\s+|(?:sk|rk)_(?:live|test)_|gh[pousr]_|github_pat_|AKIA[A-Z0-9]|password\s*[=:]|client_secret\s*[=:])/i.test(value);
}
/** A fixed public server only: no arbitrary URLs, credentials, OAuth, writes,
 * sampling or local process execution. SDK negotiates MCP and discovers tools.
 * All response bodies and the complete connection have hard bounds. */
async function withServer<T>(operate:(client:Client)=>Promise<T>):Promise<T>{
 const deadline=AbortSignal.timeout(25_000);
 const client=new Client({name:'axiom-microsoft-learn',version:'1.0.0'},{capabilities:{}});
 const transport=new StreamableHTTPClientTransport(new URL(ENDPOINT),{
  requestInit:{redirect:'error',credentials:'omit',cache:'no-store'},
  reconnectionOptions:{maxRetries:0,maxReconnectionDelay:1000,initialReconnectionDelay:1000,reconnectionDelayGrowFactor:1},
  fetch:async(url,init)=>{
   if(String(url)!==ENDPOINT)throw Error('fixed_documentation_endpoint_required');
   const headers=new Headers(init?.headers);headers.delete('authorization');headers.delete('cookie');
   const response=await fetch(ENDPOINT,{...init,headers,redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.any([deadline,...(init?.signal?[init.signal]:[])])});
   if(response.status>=300&&response.status<400)throw Error('documentation_redirect_refused');
   if(!response.body)return response;
   const reader=response.body.getReader();let bytes=0;
   return new Response(new ReadableStream({
    async pull(controller){try{const chunk=await reader.read();if(chunk.done){controller.close();return;}bytes+=chunk.value.byteLength;if(bytes>MAX_RESPONSE_BYTES){await reader.cancel();throw Error('documentation_response_too_large');}controller.enqueue(chunk.value);}catch(error){controller.error(error);}},
    cancel(reason){return reader.cancel(reason);},
   }),{status:response.status,statusText:response.statusText,headers:response.headers});
  },
 });
 try{
  await client.connect(transport,{...OPTIONS,signal:deadline});
  const list=await client.listTools({}, {...OPTIONS,signal:deadline});
  const tool=list.tools.find(t=>t.name==='microsoft_docs_search');
  if(!tool||tool.inputSchema.type!=='object'||!tool.inputSchema.properties||typeof tool.inputSchema.properties.query!=='object'||tool.inputSchema.properties.query===null
   ||(tool.inputSchema.properties.query as {type?:unknown}).type!=='string'||tool.inputSchema.required?.some(name=>name!=='query'))throw Error('documentation_tool_contract_unavailable');
  return await operate(client);
 }finally{await client.close().catch(()=>undefined);}
}
export async function checkMicrosoftLearn():Promise<{ok:true;data:{searchAvailable:true}}|Failure>{
 try{return await withServer(async()=>({ok:true as const,data:{searchAvailable:true as const}}));}catch{return {ok:false,error:'microsoft_learn_unavailable'};}
}
export async function searchMicrosoftLearn(query:unknown):Promise<DocumentationSearch>{
 if(!validDocumentationQuery(query))return {ok:false,error:'invalid_documentation_query'};
 try{return await withServer(async client=>{
  const result=await client.callTool({name:'microsoft_docs_search',arguments:{query:query.trim()}},undefined,OPTIONS);
  if(result.isError||!Array.isArray(result.content))throw Error('documentation_tool_failed');
  const text=result.content.filter(item=>item.type==='text').map(item=>item.text).join('');
  const parsed:unknown=JSON.parse(text);
  if(!parsed||typeof parsed!=='object'||!('results' in parsed)||!Array.isArray(parsed.results))throw Error('documentation_result_invalid');
  const results:DocumentationResult[]=[];
  for(const item of parsed.results.slice(0,10)){
   if(!item||typeof item!=='object'||typeof item.title!=='string'||typeof item.content!=='string'||typeof item.contentUrl!=='string')continue;
   let url:URL;try{url=new URL(item.contentUrl);}catch{continue;}
   if(url.origin!=='https://learn.microsoft.com'||url.username||url.password||url.port||!url.pathname.startsWith('/'))continue;
   results.push({title:item.title.slice(0,200),excerpt:item.content.slice(0,1200),url:url.toString()});
  }
  return {ok:true as const,data:{results}};
 });}catch{return {ok:false,error:'microsoft_learn_unavailable'};}
}
export async function searchInstalledMicrosoftLearn(repo:AgentSkillRepo,organizationId:string,query:unknown):Promise<DocumentationSearch>{
 try{
  const enabled=async()=> (await repo.agentSkillInstallation.findMany({where:{organizationId,status:'enabled'}})).some(row=>row.skillId===MICROSOFT_LEARN_SKILL_ID&&row.status==='enabled');
  if(!await enabled())return {ok:false,error:'mcp_not_enabled'};
  const result=await searchMicrosoftLearn(query);
  return await enabled()?result:{ok:false,error:'mcp_not_enabled'};
 }catch{return {ok:false,error:'microsoft_learn_unavailable'};}
}
