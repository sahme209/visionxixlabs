/** Parsed operator data only. No DNS, environment, database, permission or
 * execution authority is obtained here. Model limit qualification is separate. */
import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
export type InstallationAIMode='online'|'offline'|'unavailable';
export function readInstallationAIMode(raw:unknown):InstallationAIMode {
 return raw===undefined||raw==='false'?'online':raw==='true'?'offline':'unavailable';
}
export interface CustomerHostedModel {readonly id:string;readonly maxInputTokens:number;readonly maxOutputTokens:number;readonly maxInputBytes:number}
export interface CustomerHostedBudget {readonly organizationId:string;readonly windowId:string;readonly startsAt:string;readonly expiresAt:string;readonly limitTokens:number}
export interface CustomerHostedOperatorConfig {
 readonly format:'axiom.customer-hosted/1';readonly installationId:string;readonly revision:string;readonly digest:string;
 readonly server:Readonly<{kind:'vllm'|'ollama'|'lm_studio';baseUrl:string;allowedHosts:readonly string[]}>;
 readonly models:readonly CustomerHostedModel[];readonly budgets:readonly CustomerHostedBudget[];
}
function invalid():never{throw Error('customer_hosted_configuration_unavailable');}
function object(v:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||Object.keys(v).some(k=>!keys.includes(k)))invalid();
 return v as Record<string,unknown>;
}
function identifier(v:unknown):string{if(typeof v!=='string'||!(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/).test(v))invalid();return v;}
function number(v:unknown,min=1):number{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min)invalid();return v;}
function array(v:unknown,max:number):unknown[]{if(!Array.isArray(v)||!v.length||v.length>max)invalid();return v;}
function instant(v:unknown):string{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)||!Number.isSafeInteger(Date.parse(v))||Date.parse(v)<0||new Date(v).toISOString()!==v)invalid();return v;}
function host(v:unknown):string{
 if(typeof v!=='string'||v.length>253||v!==v.toLowerCase())invalid();
 if(isIP(v)||v.startsWith('[')&&v.endsWith(']')&&isIP(v.slice(1,-1))===6)return v;
 if(!v.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))invalid();return v;
}
/** Accepts only the fixed bounded JSON representation supplied by deployment
 * configuration. This must never be called on a workspace-supplied endpoint. */
export function parseCustomerHostedOperatorConfig(raw:unknown):CustomerHostedOperatorConfig|null{
 try{
  if(typeof raw!=='string'||!raw.length||Buffer.byteLength(raw,'utf8')>65536)return null;
  const v=object(JSON.parse(raw),['format','installationId','revision','server','models','budgets']);
  if(v.format!=='axiom.customer-hosted/1')invalid();
  const installationId=identifier(v.installationId),revision=identifier(v.revision);
  const s=object(v.server,['kind','baseUrl','allowedHosts']);if(!['vllm','ollama','lm_studio'].includes(s.kind as string))invalid();
  const allowedHosts=array(s.allowedHosts,16).map(host);if(new Set(allowedHosts).size!==allowedHosts.length)invalid();
  if(typeof s.baseUrl!=='string'||s.baseUrl.length>2048||/[\s\\]/.test(s.baseUrl))invalid();
  const url=new URL(s.baseUrl);
  if(url.username||url.password||url.search||url.hash||!['/v1','/v1/'].includes(url.pathname)||!allowedHosts.includes(url.hostname.toLowerCase()))invalid();
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))invalid();
  url.pathname='/v1';
  const server=Object.freeze({kind:s.kind as 'vllm'|'ollama'|'lm_studio',baseUrl:url.toString(),allowedHosts:Object.freeze(allowedHosts)});
  const models=array(v.models,64).map(value=>{
   const m=object(value,['id','maxInputTokens','maxOutputTokens','maxInputBytes']);
   if(typeof m.id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(m.id))invalid();
   const maxInputTokens=number(m.maxInputTokens),maxOutputTokens=number(m.maxOutputTokens),maxInputBytes=number(m.maxInputBytes);
   if(!Number.isSafeInteger(maxInputTokens+maxOutputTokens)||maxInputBytes>131072)invalid();
   return Object.freeze({id:m.id,maxInputTokens,maxOutputTokens,maxInputBytes});
  });
  if(new Set(models.map(m=>m.id)).size!==models.length)invalid();
  const budgets=array(v.budgets,256).map(value=>{
   const b=object(value,['organizationId','windowId','startsAt','expiresAt','limitTokens']);
   const organizationId=identifier(b.organizationId),windowId=identifier(b.windowId),startsAt=instant(b.startsAt),expiresAt=instant(b.expiresAt),limitTokens=number(b.limitTokens,0);
   if(Date.parse(expiresAt)<=Date.parse(startsAt))invalid();
   return Object.freeze({organizationId,windowId,startsAt,expiresAt,limitTokens});
  });
  // One explicitly configured current window per workspace. Changing it cannot
  // clear durable holds; the later accounting boundary must enforce that.
  if(new Set(budgets.map(b=>b.organizationId)).size!==budgets.length)invalid();
  const normalized={format:'axiom.customer-hosted/1' as const,installationId,revision,server,models:Object.freeze(models),budgets:Object.freeze(budgets)};
  const digest=createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  return Object.freeze({...normalized,digest});
 }catch{return null;}
}
export function activeCustomerHostedBudget(config:CustomerHostedOperatorConfig,organizationId:string,now:number):CustomerHostedBudget|null{
 if(!Number.isSafeInteger(now)||now<0)return null;
 return config.budgets.find(b=>b.organizationId===organizationId&&Date.parse(b.startsAt)<=now&&now<Date.parse(b.expiresAt))??null;
}
