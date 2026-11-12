import 'server-only';
import {platformEffectSchema} from '@/lib/governance/platform/contracts';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
const fail=():never=>{throw Error('platform_deployment_plan_unavailable')};
/** Pure preparation binds exact submitted bytes and account/name scope. The
 * existing API's name field may create a project: the plan says so explicitly.
 * This digest is data binding, not verified issuer/runtime qualification. */
export function preparePlatformVercelDeployment(files:readonly {path:string;content:string}[],options:{projectName:string;teamId:string;target?:'production';effectId?:string;source?:{leadId:string;leadRevision:string}}){
 if(!/^team_[A-Za-z0-9]+$/.test(options.teamId)||! /^[a-z0-9][a-z0-9-]{0,99}$/.test(options.projectName)||!files.length||files.length>1024)fail();
 const seen=new Set<string>();
 const payloadFiles=files.map(file=>{
  if(typeof file.path!=='string'||file.path.length>512||file.path.startsWith('/')||file.path.includes('\\')||file.path.split('/').some(p=>!p||p==='.'||p==='..')||/[\x00-\x1f]/.test(file.path)||seen.has(file.path)||typeof file.content!=='string')fail();
  seen.add(file.path);return {file:file.path,data:Buffer.from(file.content,'utf8').toString('base64'),encoding:'base64' as const};
 });
 const body=JSON.stringify({name:options.projectName,...(options.target?{target:options.target}:{}),files:payloadFiles});
 if(Buffer.byteLength(body)>8*1024*1024)fail();
 const endpoint='https://api.vercel.com/v13/deployments';
 const effect=platformEffectSchema.parse({id:options.effectId??'platform-vercel-deployment',kind:'deployment.vercel' as const,target:{projectName:options.projectName,teamId:options.teamId,environment:options.target??'preview',projectCreation:'may_create_named_project' as const,filesDigest:sha256ContentHash(payloadFiles),configurationDigest:sha256ContentHash({provider:'vercel',endpoint,teamId:options.teamId}),...(options.source?{leadId:options.source.leadId,leadRevision:options.source.leadRevision}:{})}});
 if(effect.kind!=='deployment.vercel')return fail();
 return Object.freeze({body,effect});
}
export async function readPlatformDeploymentResponse(response:Response):Promise<unknown>{
 if(!response.ok||!response.body)throw Error('platform_deployment_result_unconfirmed');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>128*1024)throw Error('platform_deployment_result_unconfirmed');chunks.push(part.value)}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}
