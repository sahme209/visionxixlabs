'use strict';
// Pure finite projection only. No IO, imports, logging, credentials or returned records.
const TEXT_BYTES=1048576,CONTENT_BLOCKS=4096,ENV_RECORDS=10000;
function blank(failed){return{callOutcome:failed?'exception':'returned',toolError:'unknown',envelope:'unsupported',textBlockCount:'not_applicable',textParsing:'not_applicable',envArray:'not_applicable',productionDatabaseMatches:'not_applicable',selectedId:'not_applicable',selectedUpdatedAt:'not_applicable'};}
function record(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function oversized(text){
 if(text.length>TEXT_BYTES)return true;
 let bytes=0;for(const char of text){const n=char.codePointAt(0);bytes+=n<=127?1:n<=2047?2:n<=65535?3:4;if(bytes>TEXT_BYTES)return true;}
 return false;
}
function projectMetadataDiagnostic(response,callFailed=false){
 const out=blank(callFailed===true);if(callFailed===true)return Object.freeze(out);
 let payload=null,selected=null;
 try{
  if(!record(response))return Object.freeze(out);
  const flag=response.isError;out.toolError=flag===true?true:flag===false?false:'unknown';
  if(flag===true)return Object.freeze(out);
  // Same supported precedence as the unchanged endpoint collector; no new unwrap paths.
  if(response.structuredContent&&typeof response.structuredContent==='object'){
   if(!record(response.structuredContent))return Object.freeze(out);
   out.envelope='structured_object';payload=response.structuredContent;
  }else if(Array.isArray(response.content)){
   out.envelope='text_blocks';
   if(response.content.length>CONTENT_BLOCKS)return Object.freeze(out);
   let text=null,count=0;
   for(const block of response.content){if(block&&block.type==='text'&&typeof block.text==='string'){count++;if(count===1)text=block.text;if(count>1)break;}}
   out.textBlockCount=count===0?'zero':count===1?'one':'multiple';
   if(count!==1)return Object.freeze(out);
   if(oversized(text)){out.textParsing='oversized';return Object.freeze(out);}
   try{payload=JSON.parse(text);}catch{out.textParsing='malformed_or_unsupported';return Object.freeze(out);}finally{text=null;}
   if(!record(payload)){out.textParsing='malformed_or_unsupported';return Object.freeze(out);}
   out.textParsing='accepted_json_object';
  }else{out.envelope='raw_object';payload=response;}
  if(!Array.isArray(payload.envs)){out.envArray='absent';return Object.freeze(out);}
  out.envArray='present';
  // Bound traversal, reporting no accepted selection if the response is excessive.
  if(payload.envs.length>ENV_RECORDS)return Object.freeze(out);
  let matches=0;
  for(const entry of payload.envs){
   if(entry&&entry.key==='DATABASE_URL'&&Array.isArray(entry.target)&&entry.target.includes('production')){matches++;selected=entry;if(matches>1)break;}
  }
  out.productionDatabaseMatches=matches===0?'zero':matches===1?'one':'multiple';
  if(matches!==1)return Object.freeze(out);
  out.selectedId=typeof selected.id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(selected.id)?'valid':'invalid';
  const value=selected.updatedAt;
  out.selectedUpdatedAt=!Object.prototype.hasOwnProperty.call(selected,'updatedAt')?'missing':typeof value==='number'?(Number.isSafeInteger(value)?'safe_integer':'other_number'):typeof value==='string'?'string':'other';
  return Object.freeze(out);
 }catch{return Object.freeze(blank(false));}
 finally{payload=null;selected=null;response=null;}
}
module.exports=Object.freeze({projectMetadataDiagnostic});
