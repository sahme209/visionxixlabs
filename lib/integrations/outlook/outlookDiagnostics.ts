import 'server-only';
import {z} from 'zod';
const knownErrors=new Set(['invalid_request','invalid_grant','invalid_client','unauthorized_client','invalid_scope','access_denied','consent_required','interaction_required','login_required','server_error','temporarily_unavailable']);
/** Never log raw descriptions, URLs, codes, states, account identifiers or token bodies. */
export function recordOutlookFailure(phase:'authorization'|'token',raw:unknown,status?:number){
 const value=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
 const error=typeof value.error==='string'&&knownErrors.has(value.error)?value.error:'unclassified';
 const numericErrorCodes=Array.isArray(value.error_codes)?value.error_codes.filter((x):x is number=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0&&x<=999999999).slice(0,5):[];
 console.warn('[Outlook authorization]',{phase,error,...(typeof status==='number'&&Number.isInteger(status)&&status>=400&&status<=599?{status}:{}),numericErrorCodes});
}

const safeFields=new Set(['access_token','refresh_token','expires_in','scope','id','displayName','mail','userPrincipalName','subject','from','receivedDateTime','isRead','webLink','dateTime','timeZone','start','end','organizer','isCancelled','emailAddress','address','name','value']);
/** Schema diagnostics expose only fixed schema names, never provider values or error messages. */
const safeInternalErrors=new Set(['outlook_profile_unavailable','outlook_read_unavailable','outlook_read_ambiguous','outlook_calendar_range_changed','outlook_credential_unavailable','outlook_refresh_required','outlook_permissions_required','outlook_mailbox_unavailable','outlook_authorization_required','outlook_scope_insufficient','outlook_connection_changed','jira_ticket_response_invalid','jira_ticket_response_bound']);
export function recordOutlookValidationFailure(error:unknown){
 const issues=error instanceof z.ZodError?error.issues:error&&typeof error==='object'&&Array.isArray((error as {issues?:unknown}).issues)?(error as {issues:unknown[]}).issues:[];
 const fields=[...new Set(issues.flatMap(i=>i&&typeof i==='object'&&Array.isArray((i as {path?:unknown}).path)?(i as {path:unknown[]}).path.filter((p):p is string=>typeof p==='string'&&safeFields.has(p)):[]))].slice(0,8);
 const message=error instanceof Error?error.message:'';
 console.warn('[Outlook validation]',{kind:issues.length?'schema_rejected':'operation_refused',fields,...(safeInternalErrors.has(message)?{errorCode:message}:{})});
}
export function recordOutlookReadStatus(phase:'profile'|'inbox'|'calendar',status:number){
 if(Number.isInteger(status)&&status>=100&&status<=599)console.warn('[Outlook read status]',{phase,status});
}
