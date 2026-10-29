import {z} from 'zod';

/** Pure advisory classification of the existing read-only metadata projection.
 * Matching caller snapshots is not authentication or proof of provider authority.
 * No encoding, identity discovery, persistence, transport or publish capability.
 */
const identifier=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x1f\x7f]/.test(v));
const nativeId=z.string().regex(/^[0-9]{1,20}$/);
const revision=z.string().refine(v=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v);
const context=z.object({connectionId:identifier,revision,projectId:nativeId,issueTypeId:nativeId}).strict();
const field=z.object({id:z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,127}$/).refine(v=>!['__proto__','constructor','prototype'].includes(v)),name:z.string().min(1).max(512).refine(v=>v.trim().length>0),required:z.boolean(),hasDefaultValue:z.boolean(),canSet:z.boolean(),schemaType:z.string().min(1).max(128).nullable(),schemaSystem:z.string().min(1).max(128).optional(),schemaCustom:z.string().min(1).max(256).optional()}).strict();
const input=z.object({field,discovery:context,selection:context}).strict();
export type JiraFieldSupportInput=z.infer<typeof input>;
type Boundary={readonly authority:'discovery_only';readonly publishReady:false;readonly writabilityVerified:false;readonly providerSetOperation:'advertised'|'not_advertised'|'unknown'};
export type JiraFieldSupport=Boundary & (
 {readonly kind:'selected_context';readonly fieldId:'project'|'issuetype';readonly selectedId:string} |
 {readonly kind:'requires_verified_provider_identity'|'encoding_review_required'|'not_settable'|'unsupported_metadata'}
);
const unavailable=():JiraFieldSupport=>Object.freeze({kind:'unsupported_metadata',authority:'discovery_only',publishReady:false,writabilityVerified:false,providerSetOperation:'unknown'});
export function classifyJiraDiscoveredField(value:unknown):JiraFieldSupport {
 try {
  const parsed=input.safeParse(value);if(!parsed.success)return unavailable();
  const {field:f,discovery:d,selection:s}=parsed.data;
  if(d.connectionId!==s.connectionId||d.revision!==s.revision||d.projectId!==s.projectId||d.issueTypeId!==s.issueTypeId)return unavailable();
  const boundary={authority:'discovery_only' as const,publishReady:false as const,writabilityVerified:false as const,providerSetOperation:f.canSet?'advertised' as const:'not_advertised' as const};
  if(f.id==='project'||f.id==='issuetype')return Object.freeze({...boundary,kind:'selected_context',fieldId:f.id,selectedId:f.id==='project'?s.projectId:s.issueTypeId});
  if(f.id==='reporter')return Object.freeze({...boundary,kind:'requires_verified_provider_identity'});
  return Object.freeze({...boundary,kind:f.canSet?'encoding_review_required':'not_settable'});
 } catch {return unavailable();}
}
