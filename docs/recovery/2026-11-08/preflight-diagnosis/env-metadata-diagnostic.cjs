'use strict';
// SOURCE ONLY — counts-only diagnostic for the stopped production preflight.
// Makes at most ONE provider call (Vercel env METADATA, decrypt:false) and returns
// ONLY a fixed reason code plus non-identifying counts/types. It never returns,
// logs or retains env values, IDs, keys other than the fixed DATABASE_URL literal,
// branch names, URLs or raw errors. No Neon, no SQL, no get_project_env, no retry.
// Requires fresh explicit user authority for that single call before any use.
const VERCEL_PROJECT='prj_BwKc7V1daPJ938ZW2QKYxZsTkZnp',VERCEL_TEAM='team_j0CEiAAorasdEVQyeAJjpNfm';
const REASONS=Object.freeze(['tool_unavailable','tool_threw','tool_is_error','response_not_object','text_block_count_not_one','text_block_too_large','text_not_json','envs_not_array','production_database_url_count_not_one','id_shape_invalid','updated_at_not_safe_integer','metadata_shape_accepted']);
function shapeOf(v){return v===null?'null':Array.isArray(v)?'array':typeof v;}
function classify(response){
 if(!response||typeof response!=='object')return{reason:'response_not_object'};
 if(response.isError===true)return{reason:'tool_is_error'};
 let body=null,via;
 if(response.structuredContent&&typeof response.structuredContent==='object'){body=response.structuredContent;via='structuredContent';}
 else if(Array.isArray(response.content)){
  const blocks=response.content.filter(x=>x&&x.type==='text'&&typeof x.text==='string');
  if(blocks.length!==1)return{reason:'text_block_count_not_one',textBlocks:Math.min(blocks.length,99)};
  if(blocks[0].text.length>1024*1024)return{reason:'text_block_too_large'};
  try{body=JSON.parse(blocks[0].text);}catch{return{reason:'text_not_json'};}
  via='single_text_block';
  if(!body||typeof body!=='object')return{reason:'response_not_object',via};
 } else {body=response;via='raw_object';}
 // Top-level shape is reported only as property-name presence for a FIXED list.
 const known=['envs','data','result','items','pagination'],present=known.filter(k=>Object.prototype.hasOwnProperty.call(body,k));
 if(!Array.isArray(body.envs))return{reason:'envs_not_array',via,bodyShape:shapeOf(body),knownTopLevelKeysPresent:present};
 const envs=body.envs,isDb=x=>x&&x.key==='DATABASE_URL';
 const db=envs.filter(isDb),prod=db.filter(x=>Array.isArray(x.target)&&x.target.includes('production'));
 const counts={envCount:Math.min(envs.length,9999),databaseUrlCount:Math.min(db.length,99),productionDatabaseUrlCount:Math.min(prod.length,99),databaseUrlTargetShapes:[...new Set(db.map(x=>shapeOf(x.target)))].sort(),databaseUrlWithCustomEnvironmentCount:Math.min(db.filter(x=>Array.isArray(x.customEnvironmentIds)&&x.customEnvironmentIds.length>0).length,99),databaseUrlWithGitBranchCount:Math.min(db.filter(x=>typeof x.gitBranch==='string'&&x.gitBranch.length>0).length,99),paginationPresent:present.includes('pagination')};
 if(prod.length!==1)return{reason:'production_database_url_count_not_one',via,...counts};
 const x=prod[0];
 if(typeof x.id!=='string'||!(/^[A-Za-z0-9_-]{1,100}$/).test(x.id))return{reason:'id_shape_invalid',via,...counts,idType:shapeOf(x.id)};
 if(!Number.isSafeInteger(x.updatedAt))return{reason:'updated_at_not_safe_integer',via,...counts,updatedAtType:shapeOf(x.updatedAt)};
 return{reason:'metadata_shape_accepted',via,...counts};
}
async function runEnvMetadataDiagnostic(tools){
 let response=null,out;
 const fn=tools&&tools.vercel_filter_project_envs;
 if(typeof fn!=='function')return Object.freeze({status:'diagnostic_observed',providerCalls:0,reason:'tool_unavailable'});
 try{response=await fn({idOrName:VERCEL_PROJECT,teamId:VERCEL_TEAM,decrypt:'false'});}
 catch{response=null;return Object.freeze({status:'diagnostic_observed',providerCalls:1,reason:'tool_threw'});}
 try{out=classify(response);}catch{out={reason:'response_not_object'};}
 finally{response=null;}
 if(!REASONS.includes(out.reason))out={reason:'response_not_object'};
 return Object.freeze({status:'diagnostic_observed',providerCalls:1,...out,executionAuthorized:false,valuesReturned:false});
}
module.exports=Object.freeze({runEnvMetadataDiagnostic,classify,REASONS});
