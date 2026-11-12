import {BlockList,isIP} from 'node:net';
const privateAddresses=new BlockList();
const mappedAddresses=new BlockList();
mappedAddresses.addSubnet('::ffff:0:0',96,'ipv6');
privateAddresses.addSubnet('127.0.0.0',8,'ipv4');
privateAddresses.addSubnet('10.0.0.0',8,'ipv4');
privateAddresses.addSubnet('172.16.0.0',12,'ipv4');
privateAddresses.addSubnet('192.168.0.0',16,'ipv4');
privateAddresses.addAddress('::1','ipv6');
privateAddresses.addSubnet('fc00::',7,'ipv6');
/** Address classification is NOT DNS resolution, peer pinning or model trust. */
export function customerHostedPrivateAddress(ip:string):boolean {
 const family=isIP(ip);
 if(!family||ip.includes('%')||family===6&&mappedAddresses.check(ip,'ipv6'))return false;
 return privateAddresses.check(ip,family===4?'ipv4':'ipv6');
}
export interface CustomerHostedReportedUsage {readonly promptTokens:number;readonly completionTokens:number;readonly totalTokens:number}
/** Preserve finite overrun evidence on refusals, so accounting must not refund
 * the hold or silently discard an actually reported larger liability. */
export class CustomerHostedResponseError extends Error {
 constructor(readonly usage:CustomerHostedReportedUsage|null){super('customer_hosted_response_unverified');this.name='CustomerHostedResponseError';}
}
function object(value:unknown):Record<string,unknown>|null {
 return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
}
function tokens(value:unknown):value is number{return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;}
export function parseCustomerHostedCompletion(body:string|Buffer,modelId:string,maxInputTokens:number,maxOutputTokens:number):{data:Record<string,unknown>;raw:string}&CustomerHostedReportedUsage {
 let usage:CustomerHostedReportedUsage|null=null;
 const refuse=():never=>{throw new CustomerHostedResponseError(usage)};
 if(!tokens(maxInputTokens)||maxInputTokens===0||!tokens(maxOutputTokens)||maxOutputTokens===0)refuse();
 if(Buffer.byteLength(body)>1048576)refuse();
 let text='';
 try{text=typeof body==='string'?body:new TextDecoder('utf-8',{fatal:true}).decode(body)}catch{refuse()}
 let value:Record<string,unknown>|null=null;
 try{value=object(JSON.parse(text))}catch{refuse()}
 if(!value)return refuse();
 const u=object(value.usage);
 if(u&&tokens(u.prompt_tokens)&&tokens(u.completion_tokens)&&tokens(u.total_tokens)&&Number.isSafeInteger(u.prompt_tokens+u.completion_tokens)){
  // Charge the larger reported aggregate if fields disagree. This is observed
  // liability evidence, not acceptance of an inconsistent provider response.
  usage=Object.freeze({promptTokens:u.prompt_tokens,completionTokens:u.completion_tokens,totalTokens:Math.max(u.total_tokens,u.prompt_tokens+u.completion_tokens)});
 }
 if(!usage||!u||u.total_tokens!==usage.promptTokens+usage.completionTokens||usage.promptTokens>maxInputTokens||usage.completionTokens>maxOutputTokens||value.model!==modelId)return refuse();
 const choices=value.choices;
 if(!Array.isArray(choices)||choices.length!==1)return refuse();
 const choice=object(choices[0]),message=object(choice?.message);
 if(!choice||choice.index!==0||choice.finish_reason!=='stop'||!message||message.role!=='assistant'||typeof message.content!=='string'||message.tool_calls!==undefined||message.function_call!==undefined)return refuse();
 let data:Record<string,unknown>|null=null;
 try{data=object(JSON.parse(message.content))}catch{refuse()}
 if(!data)return refuse();
 return {data,raw:message.content,...usage};
}
