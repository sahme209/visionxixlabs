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
export function recordOutlookValidationFailure(error:unknown){
 const fields=error instanceof z.ZodError?[...new Set(error.issues.flatMap(i=>i.path.filter((p):p is string=>typeof p==='string'&&safeFields.has(p))))].slice(0,8):[];
 console.warn('[Outlook validation]',{kind:error instanceof z.ZodError?'schema_rejected':'operation_refused',fields});
}
