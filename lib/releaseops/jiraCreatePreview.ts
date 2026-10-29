import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {jiraSelfIdentitySnapshotSchema} from '@/lib/integrations/jira/jiraSelfIdentity';

// Server-only pure encoder. Production callers must use the successful current
// readJiraCreateMetadata result; matching browser metadata proves no authority.
const identifier=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x1f\x7f]/.test(v));
const nativeId=z.string().regex(/^[0-9]{1,20}$/);
const revision=z.string().refine(v=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v);
const fieldSchema=z.object({id:z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,127}$/).refine(v=>!['__proto__','constructor','prototype'].includes(v)),name:z.string().min(1).max(512).refine(v=>v.trim().length>0),required:z.boolean(),hasDefaultValue:z.boolean(),canSet:z.boolean(),schemaType:z.string().min(1).max(128).nullable(),schemaSystem:z.string().min(1).max(128).optional(),schemaCustom:z.string().min(1).max(256).optional()}).strict();
const discoverySchema=z.object({ok:z.literal(true),connectionId:identifier,connectionRevision:revision,projectIdOrKey:nativeId,issueTypeId:nativeId,metadata:z.object({authority:z.literal('discovery_only'),fields:z.array(fieldSchema).max(200).refine(fields=>new Set(fields.map(f=>f.id)).size===fields.length,'Duplicate Jira fields')}).strict()}).strict();
const selectionSchema=z.object({connectionId:identifier,connectionRevision:revision,projectId:nativeId,issueTypeId:nativeId}).strict();
function validUnicode(v:string){for(let i=0;i<v.length;i++){const c=v.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const next=v.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))return false}else if(c>=0xdc00&&c<=0xdfff)return false}return true}
const summarySchema=z.string().max(1024).refine(v=>!/[\x00-\x1f\x7f-\x9f\u2028\u2029]/.test(v)&&validUnicode(v),'Summary must be valid single-line text').transform(v=>v.trim()).refine(v=>v.length>0&&Buffer.byteLength(v,'utf8')<=255,'Summary must contain 1–255 UTF8 bytes');
const descriptionSchema=z.string().max(8192).refine(v=>validUnicode(v)&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(v),'Description must contain valid plain text').transform(v=>v.replace(/\r\n?/g,'\n')).refine(v=>v.trim().length>0&&Buffer.byteLength(v,'utf8')<=8192&&v.split('\n').length<=128,'Description must contain 1–8192 UTF8 bytes and at most 128 lines');
export const jiraCreatePreviewValuesSchema=z.object({summary:summarySchema.optional(),description:descriptionSchema.optional(),useConnectedReporter:z.boolean().optional()}).strict();
export type JiraCreatePreviewValues=z.infer<typeof jiraCreatePreviewValuesSchema>;
const inputSchema=z.object({discovery:discoverySchema,selection:selectionSchema,values:jiraCreatePreviewValuesSchema,reporter:jiraSelfIdentitySnapshotSchema.optional()}).strict();
export type JiraCreateDiscoverySnapshot=z.infer<typeof discoverySchema>;
export type JiraCreatePreviewInput=z.input<typeof inputSchema>;
export type JiraCreatePreviewBlockReason='missing_metadata'|'not_settable'|'unsupported_schema'|'summary_required'|'unsupported_required'|'description_required'|'reporter_confirmation_required'|'reporter_identity_unavailable';
export type JiraCreatePreviewField={readonly id:string;readonly label:string;readonly required:boolean;readonly kind:'selected_context'|'summary'|'description'|'connected_reporter'|'unsupported';readonly state:'included'|'missing'|'unsupported_required'|'omitted_optional'|'not_settable';readonly value?:string};
export type JiraDescriptionAdf={readonly version:1;readonly type:'doc';readonly content:readonly {readonly type:'paragraph';readonly content:readonly {readonly type:'text';readonly text:string}[]}[]};
export type JiraCreatePreviewPayload={readonly fields:{readonly project:{readonly id:string};readonly issuetype:{readonly id:string};readonly summary:string;readonly description?:JiraDescriptionAdf;readonly reporter?:{readonly accountId:string}}};
export type JiraCreatePreview={readonly authority:'preview_only';readonly provider:'jira';readonly createAvailable:false;readonly connectionId:string;readonly connectionRevision:string;readonly projectId:string;readonly issueTypeId:string;readonly fields:readonly JiraCreatePreviewField[];readonly blockers:readonly {readonly fieldId:string;readonly reason:JiraCreatePreviewBlockReason}[];readonly providerPayload:JiraCreatePreviewPayload|null;readonly payloadHash:string|null};
export type JiraCreatePreviewResult={readonly ok:false;readonly reason:'invalid_input'|'discovery_context_changed'}|{readonly ok:true;readonly preview:JiraCreatePreview};
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v)}return v}
/** No fetch, persistence, credentials, permission claims or create capability. */
export function prepareJiraCreatePreview(input:unknown,now=Date.now()):JiraCreatePreviewResult{
 const parsed=inputSchema.safeParse(input);if(!parsed.success)return{ok:false,reason:'invalid_input'};
 const {discovery:d,selection:s,values,reporter}=parsed.data;
 if(!Number.isSafeInteger(now)||now<0)return{ok:false,reason:'invalid_input'};
 let reporterAccountId:string|undefined;
 if(d.connectionId!==s.connectionId||d.connectionRevision!==s.connectionRevision||d.projectIdOrKey!==s.projectId||d.issueTypeId!==s.issueTypeId)return{ok:false,reason:'discovery_context_changed'};
 if(values.description!==undefined&&!d.metadata.fields.some(f=>f.id==='description'))return{ok:false,reason:'invalid_input'};
 const blockers:Array<{fieldId:string;reason:JiraCreatePreviewBlockReason}>=[],fields:JiraCreatePreviewField[]=[];
 for(const f of d.metadata.fields){
  const basic={id:f.id,label:f.name,required:f.required};
  if(f.id==='project'||f.id==='issuetype'){
   // Fixed native issue-type creation context is not an editable field operation.
   // Atlassian JRASERVER-66514 documents omitted set metadata. Only the exact
   // server-discovered context and native schema qualify; no writability claim.
   const fixedIssueType=f.id==='issuetype'&&f.schemaType==='issuetype'&&f.schemaSystem==='issuetype'&&f.schemaCustom===undefined;
   if(!f.canSet&&!fixedIssueType){blockers.push({fieldId:f.id,reason:'not_settable'});fields.push({...basic,kind:'selected_context',state:'not_settable'})}
   else fields.push({...basic,kind:'selected_context',state:'included',value:f.id==='project'?s.projectId:s.issueTypeId});
  }else if(f.id==='summary'){
   if(!f.canSet){blockers.push({fieldId:f.id,reason:'not_settable'});fields.push({...basic,kind:'summary',state:'not_settable'})}
   else if(f.schemaType!=='string'){blockers.push({fieldId:f.id,reason:'unsupported_schema'});fields.push({...basic,kind:'unsupported',state:'unsupported_required'})}
   else if(values.summary===undefined){blockers.push({fieldId:f.id,reason:'summary_required'});fields.push({...basic,kind:'summary',state:'missing'})}
   else fields.push({...basic,kind:'summary',state:'included',value:values.summary});
  }else if(f.id==='description'&&f.schemaSystem==='description'&&f.schemaCustom===undefined&&f.schemaType==='string'&&f.canSet){
   if(values.description!==undefined)fields.push({...basic,kind:'description',state:'included',value:values.description});
   else if(f.required){blockers.push({fieldId:f.id,reason:'description_required'});fields.push({...basic,kind:'description',state:'missing'})}
   else fields.push({...basic,kind:'description',state:'omitted_optional'});
  }else if(f.id==='reporter'&&f.schemaType==='user'&&f.schemaSystem==='reporter'&&f.schemaCustom===undefined){
   if(!f.canSet){if(f.required)blockers.push({fieldId:f.id,reason:'not_settable'});fields.push({...basic,kind:'connected_reporter',state:'not_settable'})}
   else if(!values.useConnectedReporter){if(f.required)blockers.push({fieldId:f.id,reason:'reporter_confirmation_required'});fields.push({...basic,kind:'connected_reporter',state:f.required?'missing':'omitted_optional'})}
   else if(!reporter||reporter.connectionId!==s.connectionId||reporter.connectionRevision!==s.connectionRevision||Date.parse(reporter.observedAt)>now||now-Date.parse(reporter.observedAt)>300000||Date.parse(reporter.expiresAt)<=now){blockers.push({fieldId:f.id,reason:'reporter_identity_unavailable'});fields.push({...basic,kind:'connected_reporter',state:'missing'})}
   else{reporterAccountId=reporter.accountId;fields.push({...basic,kind:'connected_reporter',state:'included',value:reporter.displayName})}
  }else if(f.required){blockers.push({fieldId:f.id,reason:'unsupported_required'});fields.push({...basic,kind:'unsupported',state:'unsupported_required'})}
  else fields.push({...basic,kind:'unsupported',state:'omitted_optional'});
 }
 for(const id of ['project','issuetype','summary'])if(!d.metadata.fields.some(f=>f.id===id))blockers.push({fieldId:id,reason:'missing_metadata'});
 const providerPayload:JiraCreatePreviewPayload|null=blockers.length?null:{fields:{project:{id:s.projectId},issuetype:{id:s.issueTypeId},summary:values.summary!,...(reporterAccountId?{reporter:{accountId:reporterAccountId}}:{}),...(fields.some(f=>f.id==='description'&&f.kind==='description'&&f.state==='included')?{description:{version:1 as const,type:'doc' as const,content:values.description!.split('\n').map(text=>({type:'paragraph' as const,content:text?[{type:'text' as const,text}]:[]}))}}:{})}};
 return freeze({ok:true,preview:{authority:'preview_only',provider:'jira',createAvailable:false,...s,fields,blockers,providerPayload,payloadHash:providerPayload?sha256ContentHash(providerPayload):null}});
}
