export type GcpGuidedStatus='not_connected'|'awaiting_consent'|'working'|'selection_required'|'connected_read_only'|'outcome_unknown'|'expired'|'cancelled';
export interface GcpGuidedState{status:GcpGuidedStatus;attemptId?:string;expiresAt?:string;resources?:Array<{id:string;label:string}>;connection?:{id:string;resourceId:string;version:number}}
export interface GcpGuidedStart{attemptId:string;authorizationUrl:string;expiresAt:string}
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const date=(v:unknown):v is string=>typeof v==='string'&&v.length<=40&&Number.isFinite(Date.parse(v));
export function isGcpGuidedStart(value:unknown):value is GcpGuidedStart{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;const v=value as Record<string,unknown>;
 if(!id(v.attemptId)||!date(v.expiresAt)||typeof v.authorizationUrl!=='string'||v.authorizationUrl.length>8192)return false;
 try{const u=new URL(v.authorizationUrl);if([...u.searchParams.keys()].some(k=>u.searchParams.getAll(k).length!==1))return false;return u.origin==='https://accounts.google.com'&&u.pathname==='/o/oauth2/v2/auth'&&!u.username&&!u.password&&!u.hash&&u.searchParams.get('redirect_uri')==='https://visionxixlabs.com/api/integrations/gcp-cloud/callback'&&u.searchParams.get('response_type')==='code'&&u.searchParams.get('code_challenge_method')==='S256'&&/^[A-Za-z0-9_-]{43}$/.test(u.searchParams.get('code_challenge')??'')&&/^[A-Za-z0-9_-]{43,128}$/.test(u.searchParams.get('state')??'')&&u.searchParams.get('scope')==='https://www.googleapis.com/auth/cloud-platform.read-only';}catch{return false}
}
export function isGcpGuidedState(value:unknown):value is GcpGuidedState{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;const v=value as Record<string,unknown>;
 if(!['not_connected','awaiting_consent','working','selection_required','connected_read_only','outcome_unknown','expired','cancelled'].includes(String(v.status)))return false;
 if(v.status==='not_connected')return v.resources===undefined&&v.connection===undefined&&((v.attemptId===undefined&&v.expiresAt===undefined)||(id(v.attemptId)&&date(v.expiresAt)));
 if(!id(v.attemptId)||!date(v.expiresAt))return false;
 if(v.resources!==undefined&&(!Array.isArray(v.resources)||v.resources.length>100||!v.resources.every((r:unknown)=>{if(!r||typeof r!=='object')return false;const x=r as Record<string,unknown>;return typeof x.id==='string'&&/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(x.id)&&typeof x.label==='string'&&x.label.length>0&&x.label.length<=200&&!/[\u0000-\u001f\u007f-\u009f]/.test(x.label)})))return false;
 if(v.status==='selection_required'&&!Array.isArray(v.resources))return false;
 if(v.status==='connected_read_only'){const c=v.connection as Record<string,unknown>|undefined;return !!c&&id(c.id)&&typeof c.resourceId==='string'&&/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(c.resourceId)&&Number.isSafeInteger(c.version)&&(c.version as number)>0;}
 return v.connection===undefined;
}
export function isGcpProjectId(value:string){return /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value)}
export function isGcpAttemptId(value:string){return id(value)}
