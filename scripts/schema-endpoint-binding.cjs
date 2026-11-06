'use strict';
// Private in-memory projection. No IO/provider/SQL/logging. Copy these exact
// functions into the reviewed functions.exec isolate; never shuttle URI by IPC.
const VERCEL_PROJECT='prj_BwKc7V1daPJ938ZW2QKYxZsTkZnp',VERCEL_TEAM='team_j0CEiAAorasdEVQyeAJjpNfm',NEON_PROJECT='odd-union-57413470',NEON_BRANCH='br-holy-voice-ai303o8m';
function normalizeToolResponse(response){
 // Private-only raw object: NEVER forward this return value outside isolate.
 try{
  if(!response||typeof response!=='object'||response.isError===true)return null;
  if(response.structuredContent&&typeof response.structuredContent==='object')return response.structuredContent;
  if(Array.isArray(response.content)){
   const blocks=response.content.filter(x=>x&&x.type==='text'&&typeof x.text==='string');
   if(blocks.length!==1||blocks[0].text.length>1024*1024)return null;
   const value=JSON.parse(blocks[0].text);return value&&typeof value==='object'?value:null;
  }
  return response;
 }catch{return null;}
}
function selected(metadata){
 if(!metadata||!Array.isArray(metadata.envs))return null;
 const matches=metadata.envs.filter(x=>x&&x.key==='DATABASE_URL'&&Array.isArray(x.target)&&x.target.includes('production'));
 if(matches.length!==1)return null;const x=matches[0];
 if(typeof x.id!=='string'||!(/^[A-Za-z0-9_-]{1,100}$/).test(x.id)||!Number.isSafeInteger(x.updatedAt))return null;
 return {id:x.id,updatedAt:x.updatedAt}; // ALL values discarded.
}
function projectEnvMetadata(metadata){try{const item=selected(metadata);return item?{envs:[{...item,key:'DATABASE_URL',target:['production']}]}:null;}catch{return null;}}
function selectDatabaseEnvId(metadata){try{return selected(metadata)?.id??null;}catch{return null;}}
function verifyPrivateEndpointBinding(metadata,detail,endpoints){
 const refuse=()=>({status:'unverified',reason:'private_endpoint_binding_unverified'});
 try{
  const item=selected(metadata);
  if(!item||!detail||detail.id!==item.id||detail.key!=='DATABASE_URL'||detail.updatedAt!==item.updatedAt||!Array.isArray(detail.target)||!detail.target.includes('production'))return refuse();
  const value=detail.value;if(typeof value!=='string'||value.length>8192||/[\s\x00-\x20]/u.test(value))return refuse();
  // Limited ASCII URI grammar; Functions V8 provides no URL global.
  if(/[^\x21-\x7e]/.test(value)||/%(?![0-9a-fA-F]{2})/.test(value))return refuse();
  const parts=/^(postgres|postgresql):\/\/([^:@/?#]+):([^@/?#]+)@([A-Za-z0-9.-]+)(?::([0-9]{1,5}))?\/neondb\?([^#]+)$/.exec(value);
  if(!parts||decodeURIComponent(parts[2])!=='neondb_owner'||!['','5432'].includes(parts[5]??''))return refuse();
  const host=parts[4].toLowerCase();
  if(!(/^ep-[a-z0-9-]+(?:\.[a-z0-9-]+)+\.neon\.tech$/).test(host))return refuse();
  const allowed=new Set(['sslmode','channel_binding','connect_timeout','pgbouncer','connection_limit','pool_timeout']),options=new Map();
  for(const entry of parts[6].split('&')){
   const pair=/^([^=]+)=([^=]+)$/.exec(entry);if(!pair)return refuse();
   const key=decodeURIComponent(pair[1]),option=decodeURIComponent(pair[2]);
   if(!allowed.has(key)||options.has(key))return refuse();options.set(key,option);
   if(key==='sslmode'&&!['require','verify-full'].includes(option))return refuse();
   if(key==='channel_binding'&&!['require','prefer','disable'].includes(option))return refuse();
   if(key==='pgbouncer'&&!['true','false'].includes(option))return refuse();
   if(['connect_timeout','connection_limit','pool_timeout'].includes(key)&&!/^\d{1,6}$/.test(option))return refuse();
  }
  if(!options.has('sslmode')||!endpoints||!Array.isArray(endpoints.endpoints))return refuse();
  const labels=host.split('.');if(labels[0].endsWith('-pooler'))labels[0]=labels[0].slice(0,-7);const canonical=labels.join('.');
  const matches=endpoints.endpoints.filter(e=>e&&e.project_id===NEON_PROJECT&&e.branch_id===NEON_BRANCH&&e.host===canonical&&e.id===labels[0]&&e.type==='read_write');
  if(matches.length!==1)return refuse();
  return {status:'binding_verified',vercel_project:VERCEL_PROJECT,vercel_team:VERCEL_TEAM,environment_id:item.id,environment_updated_at:item.updatedAt,neon_project:NEON_PROJECT,neon_branch:NEON_BRANCH,endpoint_id:matches[0].id,canonical_host:canonical,database:'neondb',role:'neondb_owner',credentialValueRetained:false,operationalAuthorityGranted:false};
 }catch{return refuse();}
}
module.exports=Object.freeze({normalizeToolResponse,projectEnvMetadata,selectDatabaseEnvId,verifyPrivateEndpointBinding});
