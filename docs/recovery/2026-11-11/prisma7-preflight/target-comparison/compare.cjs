'use strict';
// Pure helpers only. No provider call, I/O, logging or returned connection string.
function unavailable(kind){throw new Error('target_'+kind+'_unavailable');}
function body(response,kind){
 if(!response||typeof response!=='object'||response.isError===true)unavailable(kind);
 let value=response.structuredContent;
 if(!value){
  const texts=response.content?.filter(x=>x?.type==='text'&&typeof x.text==='string');
  if(texts?.length!==1||texts[0].text.length>1024*1024)unavailable(kind);
  try{value=JSON.parse(texts[0].text);}catch{unavailable(kind);}
 }
 if(!value||typeof value!=='object'||Array.isArray(value))unavailable(kind);
 if(Object.hasOwn(value,'result'))value=value.result;
 if(!value||typeof value!=='object'||Array.isArray(value))unavailable(kind);
 return value;
}
function selectProductionDatabaseId(response){
 const b=body(response,'metadata');if(!Array.isArray(b.envs))unavailable('metadata');
 const rows=b.envs.filter(x=>x?.key==='DATABASE_URL'&&Array.isArray(x.target)&&x.target.includes('production'));
 if(rows.length!==1)unavailable('metadata');const x=rows[0];
 if(typeof x.id!=='string'||!/^[-A-Za-z0-9_]{1,100}$/.test(x.id)||!Number.isSafeInteger(x.updatedAt)||x.updatedAt<0||x.gitBranch||x.customEnvironmentIds?.length)unavailable('metadata');
 return {id:x.id,updatedAt:x.updatedAt};
}
function compareTarget(response,expectedId,expectedUpdatedAt){
 const outer=body(response,'detail');
 if(outer.env&&outer.id)unavailable('detail');
 const b=outer.env??outer;if(!b||typeof b!=='object'||b.updatedAt!==expectedUpdatedAt||b.id!==expectedId||b.key!=='DATABASE_URL'||!Array.isArray(b.target)||!b.target.includes('production')||!Number.isSafeInteger(b.updatedAt)||b.updatedAt<0||typeof b.value!=='string'||b.value.length>8192)unavailable('detail');
 let url;try{url=new URL(b.value);}catch{unavailable('detail');}
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.hash)unavailable('detail');
 const recordedEndpointMatches=['ep-small-mountain-ailw0kvt.c-4.us-east-1.aws.neon.tech','ep-small-mountain-ailw0kvt-pooler.c-4.us-east-1.aws.neon.tech'].includes(url.hostname.toLowerCase());
 return {status:'observed',recordedEndpointMatches,databaseMatches:url.pathname==='/neondb',updatedAt:b.updatedAt,valuesReturned:false};
}
module.exports=Object.freeze({selectProductionDatabaseId,compareTarget});
