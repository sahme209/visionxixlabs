// Browser-safe wire projection; runtime guards below never import the server encoder.
export interface JiraDescriptionAdf {version:1;type:'doc';content:Array<{type:'paragraph';content:Array<{type:'text';text:string}>}>}
export interface JiraCreatePreview {authority:'preview_only';provider:'jira';createAvailable:false;connectionId:string;connectionRevision:string;projectId:string;issueTypeId:string;fields:ReadonlyArray<{id:string;label:string;required:boolean;kind:'selected_context'|'summary'|'description'|'connected_reporter'|'unsupported';state:'included'|'missing'|'unsupported_required'|'omitted_optional'|'not_settable';value?:string}>;blockers:ReadonlyArray<{fieldId:string;reason:'missing_metadata'|'not_settable'|'unsupported_schema'|'summary_required'|'unsupported_required'|'description_required'|'reporter_confirmation_required'|'reporter_identity_unavailable'}>;providerPayload:null|{fields:{project:{id:string};issuetype:{id:string};summary:string;description?:JiraDescriptionAdf;reporter?:{accountId:string}}};payloadHash:string|null}
/** Paired, bounded discovery and explicit preview only. This module never consents, activates, publishes,
 * retries a token rotation, or grants execution authority from discovered fields. */
export type JiraDiscoveryOwner={config:{apiBase:string;sessionToken?:string};revision:number};
export type JiraConnectionSummary={connections:Array<{connectionId:string;revision:string;label:'Jira connection';recordedState:'read_validation_recorded';lastValidatedAt:string}>;hasMore:false;currentHealth:'not_checked';capability:'jira_ticket_discovery_v1';issueWritePermissionVerified:false};
export type JiraChoicesInput={connectionId:string;revision:string;startAt:number}&({mode:'projects';query?:string}|{mode:'issueTypes';projectIdOrKey:string});
export type JiraChoice={id:string;name:string;key?:string;subtask?:boolean};
export type JiraChoices={connectionId:string;connectionRevision:string;projectIdOrKey?:string;choices:{authority:'discovery_only';mode:'projects'|'issueTypes';rows:JiraChoice[];hasMore:boolean;nextStartAt:number|null;limitReached:boolean}};
export type JiraFieldsInput={connectionId:string;revision:string;projectIdOrKey:string;issueTypeId:string};
export type JiraFieldPreview={connectionId:string;connectionRevision:string;projectIdOrKey:string;issueTypeId:string;metadata:{authority:'discovery_only';fields:Array<{id:string;name:string;required:boolean;hasDefaultValue:boolean;canSet:boolean;schemaType:string|null;schemaSystem?:string;schemaCustom?:string}>}};
export type JiraDiscoveryResult<T>={ok:true;data:T}|{ok:false;error:'unavailable'|'authority_changed'|'outcome_unknown'|'reporter_permission_required'|'reporter_identity_unavailable';retryAllowed?:false};
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,required:string[],optional:string[]=[])=>required.every(k=>Object.prototype.hasOwnProperty.call(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const bytes=(v:string)=>new TextEncoder().encode(v).byteLength;
const id=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&bytes(v)<=512&&v.trim()===v&&!/[\x00-\x1f\x7f-\x9f]/.test(v);
const iso=(v:unknown):v is string=>{try{return typeof v==='string'&&v.length<=32&&new Date(v).toISOString()===v;}catch{return false;}};
const nativeId=(v:unknown):v is string=>typeof v==='string'&&/^[0-9]{1,20}$/.test(v);
const project=(v:unknown):v is string=>typeof v==='string'&&/^(?:[A-Z][A-Z0-9_]{0,99}|[0-9]{1,20})$/.test(v);
const name=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=512&&v.trim().length>0&&!/[\x00-\x1f\x7f-\x9f]/.test(v);
const unavailable=():JiraDiscoveryResult<never>=>({ok:false,error:'unavailable'});
function summary(v:unknown):v is JiraConnectionSummary{
 return object(v)&&keys(v,['connections','hasMore','currentHealth','capability','issueWritePermissionVerified'])&&v.hasMore===false&&v.currentHealth==='not_checked'&&v.capability==='jira_ticket_discovery_v1'&&v.issueWritePermissionVerified===false&&Array.isArray(v.connections)&&v.connections.length<=1&&v.connections.every(c=>object(c)&&keys(c,['connectionId','revision','label','recordedState','lastValidatedAt'])&&id(c.connectionId)&&iso(c.revision)&&c.label==='Jira connection'&&c.recordedState==='read_validation_recorded'&&iso(c.lastValidatedAt));
}
function choices(v:unknown,input:JiraChoicesInput):v is JiraChoices{
 if(!object(v)||!keys(v,['connectionId','connectionRevision','choices'],['projectIdOrKey'])||v.connectionId!==input.connectionId||(!iso(v.connectionRevision)||v.connectionRevision<input.revision)||(input.mode==='issueTypes'?v.projectIdOrKey!==input.projectIdOrKey:v.projectIdOrKey!==undefined)||!object(v.choices))return false;
 const p=v.choices;
 if(!keys(p,['authority','mode','rows','hasMore','nextStartAt','limitReached'])||p.authority!=='discovery_only'||p.mode!==input.mode||!Array.isArray(p.rows)||p.rows.length>20||typeof p.hasMore!=='boolean'||typeof p.limitReached!=='boolean')return false;
 if(!p.rows.every(r=>object(r)&&keys(r,input.mode==='projects'?['id','key','name']:['id','name','subtask'])&&nativeId(r.id)&&name(r.name)&&(input.mode==='projects'?typeof r.key==='string'&&/^[A-Z][A-Z0-9_]{0,99}$/.test(r.key):typeof r.subtask==='boolean'))||new Set(p.rows.map(r=>r.id)).size!==p.rows.length)return false;
 const next=input.startAt+p.rows.length;
 return p.hasMore ? p.rows.length>0&&(next<=200?p.nextStartAt===next&&p.limitReached===false:p.nextStartAt===null&&p.limitReached===true) : p.nextStartAt===null&&p.limitReached===false;
}
function fields(v:unknown,input:JiraFieldsInput):v is JiraFieldPreview{
 if(!object(v)||!keys(v,['connectionId','connectionRevision','projectIdOrKey','issueTypeId','metadata'])||v.connectionId!==input.connectionId||(!iso(v.connectionRevision)||v.connectionRevision<input.revision)||v.projectIdOrKey!==input.projectIdOrKey||v.issueTypeId!==input.issueTypeId||!object(v.metadata)||!keys(v.metadata,['authority','fields'])||v.metadata.authority!=='discovery_only'||!Array.isArray(v.metadata.fields)||v.metadata.fields.length>200)return false;
 const rows=v.metadata.fields;return rows.every(r=>object(r)&&keys(r,['id','name','required','hasDefaultValue','canSet','schemaType'],['schemaSystem','schemaCustom'])&&typeof r.id==='string'&&/^[a-zA-Z][a-zA-Z0-9_]{0,127}$/.test(r.id)&&!['__proto__','constructor','prototype'].includes(r.id)&&name(r.name)&&typeof r.required==='boolean'&&typeof r.hasDefaultValue==='boolean'&&typeof r.canSet==='boolean'&&(r.schemaType===null||typeof r.schemaType==='string'&&r.schemaType.length>0&&r.schemaType.length<=128)&&(r.schemaSystem===undefined||typeof r.schemaSystem==='string'&&r.schemaSystem.length>0&&r.schemaSystem.length<=128&&!/[\x00-\x1f\x7f-\x9f]/.test(r.schemaSystem))&&(r.schemaCustom===undefined||typeof r.schemaCustom==='string'&&r.schemaCustom.length>0&&r.schemaCustom.length<=256&&!/[\x00-\x1f\x7f-\x9f]/.test(r.schemaCustom)))&&new Set(rows.map(r=>r.id)).size===rows.length;
}
export type JiraCreatePreviewInput={connectionId:string;revision:string;projectId:string;issueTypeId:string;values:{summary?:string;description?:string;useConnectedReporter?:boolean}};
export type JiraPreviewCapabilities={enabled:boolean;canPreview:boolean};
const previewCapabilities=(v:unknown):v is JiraPreviewCapabilities=>object(v)&&keys(v,['enabled','canPreview'])&&typeof v.enabled==='boolean'&&typeof v.canPreview==='boolean'&&(!v.canPreview||v.enabled);
const fieldId=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z][a-zA-Z0-9_]{0,127}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
function validSummary(v:unknown):v is string {if(typeof v!=='string'||v.length>1024||bytes(v.trim())>255||!v.trim()||/[\x00-\x1f\x7f-\x9f\u2028\u2029]/.test(v))return false;for(let i=0;i<v.length;i++){const c=v.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const n=v.charCodeAt(++i);if(!(n>=0xdc00&&n<=0xdfff))return false}else if(c>=0xdc00&&c<=0xdfff)return false}return true}
export function normalizeJiraDescription(v:unknown):string|null {if(typeof v!=='string'||v.length>8192||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(v))return null;for(let i=0;i<v.length;i++){const c=v.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const n=v.charCodeAt(++i);if(!(n>=0xdc00&&n<=0xdfff))return null}else if(c>=0xdc00&&c<=0xdfff)return null}const text=v.replace(/\r\n?/g,'\n');return text.trim()&&bytes(text)<=8192&&text.split('\n').length<=128?text:null}
function validDescriptionAdf(v:unknown,text:string):v is JiraDescriptionAdf {if(!object(v)||!keys(v,['version','type','content'])||v.version!==1||v.type!=='doc'||!Array.isArray(v.content))return false;const lines=text.split('\n');return v.content.length===lines.length&&v.content.every((p,i)=>object(p)&&keys(p,['type','content'])&&p.type==='paragraph'&&Array.isArray(p.content)&&(lines[i]===''?p.content.length===0:p.content.length===1&&object(p.content[0])&&keys(p.content[0],['type','text'])&&p.content[0].type==='text'&&p.content[0].text===lines[i]))}
function ticketPreview(v:unknown,input:JiraCreatePreviewInput):v is {preview:JiraCreatePreview}{
 if(!object(v)||!keys(v,['preview'])||!object(v.preview))return false;const p=v.preview;
 if(!keys(p,['authority','provider','createAvailable','connectionId','connectionRevision','projectId','issueTypeId','fields','blockers','providerPayload','payloadHash'])||p.authority!=='preview_only'||p.provider!=='jira'||p.createAvailable!==false||p.connectionId!==input.connectionId||!iso(p.connectionRevision)||p.connectionRevision<input.revision||p.projectId!==input.projectId||p.issueTypeId!==input.issueTypeId||!Array.isArray(p.fields)||p.fields.length>200||!Array.isArray(p.blockers)||p.blockers.length>203)return false;
 if(!p.fields.every(f=>object(f)&&keys(f,['id','label','required','kind','state'],['value'])&&fieldId(f.id)&&name(f.label)&&typeof f.required==='boolean'&&['selected_context','summary','description','connected_reporter','unsupported'].includes(String(f.kind))&&['included','missing','unsupported_required','omitted_optional','not_settable'].includes(String(f.state))&&(f.value===undefined||typeof f.value==='string'&&(f.kind==='description'?f.id==='description'&&normalizeJiraDescription(f.value)===f.value&&f.value===normalizeJiraDescription(input.values.description):bytes(f.value)<=512&&!/[\x00-\x1f\x7f-\x9f]/.test(f.value))))||new Set(p.fields.map(f=>f.id)).size!==p.fields.length)return false;
 if(!p.blockers.every(b=>object(b)&&keys(b,['fieldId','reason'])&&fieldId(b.fieldId)&&['missing_metadata','not_settable','unsupported_schema','summary_required','unsupported_required','description_required','reporter_confirmation_required','reporter_identity_unavailable'].includes(String(b.reason))&&(p.fields as Record<string,unknown>[]).some(f=>f.id===b.fieldId)||object(b)&&keys(b,['fieldId','reason'])&&b.reason==='missing_metadata'&&['project','issuetype','summary'].includes(String(b.fieldId)))||new Set(p.blockers.map(b=>b.fieldId)).size!==p.blockers.length)return false;
 if(p.blockers.length)return p.providerPayload===null&&p.payloadHash===null;
 const payload=p.providerPayload;if(!object(payload)||!keys(payload,['fields'])||!object(payload.fields)||!keys(payload.fields,['project','issuetype','summary'],['description','reporter'])||!object(payload.fields.project)||!keys(payload.fields.project,['id'])||payload.fields.project.id!==input.projectId||!object(payload.fields.issuetype)||!keys(payload.fields.issuetype,['id'])||payload.fields.issuetype.id!==input.issueTypeId||payload.fields.summary!==input.values.summary?.trim()||!validSummary(payload.fields.summary)||typeof p.payloadHash!=='string'||! /^[a-f0-9]{64}$/.test(p.payloadHash))return false;
 const reporterField=(p.fields as Record<string,unknown>[]).find(f=>f.id==='reporter'&&f.kind==='connected_reporter'&&f.state==='included');if(reporterField){if(typeof reporterField.value!=='string'||!reporterField.value.trim()||reporterField.value.length>200||reporterField.value!==reporterField.value.trim()||input.values.useConnectedReporter!==true||!object(payload.fields.reporter)||!keys(payload.fields.reporter,['accountId'])||typeof payload.fields.reporter.accountId!=='string'||! /^[A-Za-z0-9:_-]{1,128}$/.test(payload.fields.reporter.accountId))return false}else if(payload.fields.reporter!==undefined)return false;
 const descriptionField=(p.fields as Record<string,unknown>[]).find(f=>f.id==='description'&&f.kind==='description'&&f.state==='included');if(descriptionField){const text=normalizeJiraDescription(input.values.description);if(!text||!validDescriptionAdf(payload.fields.description,text))return false}else if(payload.fields.description!==undefined)return false;
 return ['project','issuetype','summary'].every(id=>(p.fields as Record<string,unknown>[]).some(f=>f.id===id&&f.state==='included'&&f.value===(id==='project'?input.projectId:id==='issuetype'?input.issueTypeId:input.values.summary?.trim())));
}
export function createJiraTicketDiscoveryClient(owner:JiraDiscoveryOwner,readCurrent:()=>JiraDiscoveryOwner,transport:typeof fetch=fetch){
 const config=owner.config,revision=owner.revision,apiBase=config.apiBase,token=config.sessionToken;
 const owned=()=>{const c=readCurrent();return c.config===config&&c.revision===revision&&config.apiBase===apiBase&&config.sessionToken===token;};
 async function get<T>(path:string,validate:(value:unknown)=>value is T,external:AbortSignal,postBody?:unknown):Promise<JiraDiscoveryResult<T>>{
  if(!owned())return {ok:false,error:'authority_changed'};
  let base:URL;try{base=new URL(apiBase);}catch{return unavailable();}
  if(!token?.startsWith('axm.desk.')||/[\x00-\x20\x7f]/.test(token)||base.username||base.password||base.search||base.hash||base.pathname!=='/'||!(base.protocol==='https:'||base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname))||external.aborted)return unavailable();
  let dispatched=false;
  const failed=():JiraDiscoveryResult<never>=>postBody!==undefined&&dispatched?{ok:false,error:'outcome_unknown',retryAllowed:false}:unavailable();
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  const relay=()=>controller.abort();external.addEventListener('abort',relay,{once:true});
  const fail=new Promise<never>((_,reject)=>{controller.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});timer=setTimeout(()=>controller.abort(),15000);});
  const bound=<V>(work:Promise<V>)=>Promise.race([work,fail]);
  try{
   const url=base.origin+path;
   dispatched=true;const request=transport(url,{method:postBody===undefined?'GET':'POST',...(postBody===undefined?{}:{body:JSON.stringify(postBody)}),credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal,headers:{accept:'application/json',authorization:`Bearer ${token}`,...(postBody===undefined?{}:{'content-type':'application/json'})}});
   void request.then(r=>{if(controller.signal.aborted)void r.body?.cancel().catch(()=>undefined);},()=>undefined);
   const response=await bound(request);
   if(response.redirected||response.url&&response.url!==url||response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||!response.body){void response.body?.cancel().catch(()=>undefined);return failed();}
   const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>65536)){void response.body.cancel().catch(()=>undefined);return failed();}
   const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
   try{while(true){const item=await bound(reader.read());if(item.done)break;size+=item.value.byteLength;if(size>65536)return failed();chunks.push(item.value);}}finally{void reader.cancel().catch(()=>undefined);}
   const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.byteLength;}
   const body:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));
   if(!owned())return {ok:false,error:'authority_changed'};
   if(controller.signal.aborted)return failed();
   if(response.status===409&&object(body)&&keys(body,['ok','error','retryAllowed'])&&body.ok===false&&body.error==='jira_refresh_persistence_outcome_unknown'&&body.retryAllowed===false)return {ok:false,error:'outcome_unknown',retryAllowed:false};
   if(postBody!==undefined&&!response.ok&&object(body)&&keys(body,['ok','error'])&&body.ok===false&&typeof body.error==='string'){
    if(response.status===409&&body.error==='jira_reporter_permission_required')return {ok:false,error:'reporter_permission_required'};
    if(response.status===409&&body.error==='jira_reporter_identity_unavailable')return {ok:false,error:'reporter_identity_unavailable'};
    if(response.status===503&&body.error==='jira_create_preview_disabled')return unavailable();
    if(response.status>=400&&response.status<500&&['desktop_session_required','invalid_jira_preview_request','jira_create_preview_changed','jira_preview_rate_limited','method_not_allowed','jira_create_preview_unavailable'].includes(body.error))return unavailable();
   }
   if(!response.ok||!object(body)||!keys(body,['ok','data'])||body.ok!==true||!validate(body.data))return failed();
   return {ok:true,data:body.data};
  }catch{return owned()?failed():{ok:false,error:'authority_changed'};}
  finally{clearTimeout(timer);external.removeEventListener('abort',relay);controller.abort();}
 }
 return {
  previewCapabilities:(signal:AbortSignal)=>get('/api/desktop/integrations/jira/create-preview',previewCapabilities,signal),
  previewTicket:(input:JiraCreatePreviewInput,signal:AbortSignal):Promise<JiraDiscoveryResult<{preview:JiraCreatePreview}>>=>{
   if(!object(input)||!keys(input,['connectionId','revision','projectId','issueTypeId','values'])||!id(input.connectionId)||!iso(input.revision)||!nativeId(input.projectId)||!nativeId(input.issueTypeId)||!object(input.values)||!keys(input.values,[],['summary','description','useConnectedReporter'])||(input.values.useConnectedReporter!==undefined&&typeof input.values.useConnectedReporter!=='boolean')||(input.values.summary!==undefined&&!validSummary(input.values.summary))||(input.values.description!==undefined&&normalizeJiraDescription(input.values.description)===null))return Promise.resolve(unavailable());
   const captured={...input,values:{...input.values}};return get('/api/desktop/integrations/jira/create-preview',(v):v is {preview:JiraCreatePreview}=>ticketPreview(v,captured),signal,captured);
  },
  connections:(signal:AbortSignal)=>get('/api/desktop/integrations/jira/connections',summary,signal),
  choices:(input:JiraChoicesInput,signal:AbortSignal):Promise<JiraDiscoveryResult<JiraChoices>>=>{
   if(!keys(input,input.mode==='projects'?['connectionId','revision','mode','startAt']:['connectionId','revision','mode','startAt','projectIdOrKey'],input.mode==='projects'?['query']:[])||!id(input.connectionId)||!iso(input.revision)||!Number.isSafeInteger(input.startAt)||input.startAt<0||input.startAt>200||!['projects','issueTypes'].includes(input.mode)||input.mode==='issueTypes'&&!project(input.projectIdOrKey)||input.mode==='projects'&&input.query!==undefined&&(input.query.trim()!==input.query||bytes(input.query)>100||/[\x00-\x1f\x7f-\x9f]/.test(input.query)))return Promise.resolve(unavailable());
   const captured={...input};const query=new URLSearchParams({connectionId:input.connectionId,revision:input.revision,mode:input.mode,startAt:String(input.startAt)});
   if(input.mode==='projects'&&input.query)query.set('query',input.query);if(input.mode==='issueTypes')query.set('projectIdOrKey',input.projectIdOrKey);
   return get('/api/desktop/integrations/jira/ticket-choices?'+query,(v):v is JiraChoices=>choices(v,captured),signal);
  },
  fields:(input:JiraFieldsInput,signal:AbortSignal):Promise<JiraDiscoveryResult<JiraFieldPreview>>=>{
   if(!keys(input,['connectionId','revision','projectIdOrKey','issueTypeId'])||!id(input.connectionId)||!iso(input.revision)||!project(input.projectIdOrKey)||!nativeId(input.issueTypeId))return Promise.resolve(unavailable());
   const captured={...input};return get('/api/desktop/integrations/jira/create-metadata?'+new URLSearchParams({connectionId:input.connectionId,revision:input.revision,projectIdOrKey:input.projectIdOrKey,issueTypeId:input.issueTypeId}),(v):v is JiraFieldPreview=>fields(v,captured),signal);
  },
 };
}
