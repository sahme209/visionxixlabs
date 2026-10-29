import 'server-only';
import {z} from 'zod';
import {recordOutlookFailure} from './outlookDiagnostics';
import {createValidationProviderIo} from '@/lib/integrations/validationProviderIo';
import type {ConnectedActionScope} from '@/lib/integrations/connectedActionContract';
import {outlookRegistrationSchema,type OutlookRegistration,type OutlookIssuedCredential} from './outlookOAuth';
import {OUTLOOK_READ_SCOPES,OUTLOOK_ACTION_SCOPES,outlookAccountSchema,type OutlookPurpose} from './outlookConnectionContract';
import {createOutlookReadinessReader} from './outlookReadiness';
const profile=z.object({id:z.string().min(1).max(240).regex(/^[^\s\x00-\x1f\x7f]+$/),displayName:z.string().max(240).nullable(),mail:z.string().email().nullable().optional(),userPrincipalName:z.string().max(320).nullable().optional()});
/** Fixed Microsoft endpoints only. Credentials never enter returned errors or read DTOs. */
export function createOutlookProvider(ports:{clientSecret:()=>string;assertCurrent:(scope:Readonly<ConnectedActionScope>,signal:AbortSignal)=>Promise<void>;fetch?:typeof fetch;now?:()=>number}){
 const fetchImpl=ports.fetch??fetch,now=ports.now??Date.now;
 return{
  async exchange(raw:OutlookRegistration,input:{code:string;verifier:string;purpose:OutlookPurpose;signal:AbortSignal}){
   const reg=outlookRegistrationSchema.parse(raw),secret=ports.clientSecret();
   if(!secret||secret.length>32768||!input.code||input.code.length>16384||!/^[-_A-Za-z0-9]{43,128}$/.test(input.verifier)||!['read','actions'].includes(input.purpose))throw Error('outlook_exchange_refused');
   const io=createValidationProviderIo(input.signal,fetchImpl);
   try{
    const result=await io.read(`https://login.microsoftonline.com/${reg.authority}/oauth2/v2.0/token`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:reg.clientId,client_secret:secret,grant_type:'authorization_code',code:input.code,redirect_uri:reg.redirectUri,code_verifier:input.verifier,scope:(input.purpose==='read'?OUTLOOK_READ_SCOPES:OUTLOOK_ACTION_SCOPES).join(' ')})});
    if(result.status!==200){recordOutlookFailure('token',result.json,result.status);const error=z.object({error:z.enum(['invalid_grant','invalid_client','unauthorized_client','invalid_scope','access_denied'])}).safeParse(result.json);throw Error(error.success?'outlook_exchange_refused':'outlook_exchange_outcome_unknown')}
    return result.json;
   }catch(error){if(error instanceof Error&&error.message==='outlook_exchange_refused')throw error;throw Error('outlook_exchange_outcome_unknown')}finally{io.dispose()}
  },
  async verifyMailbox(scope:Readonly<ConnectedActionScope>,issued:Readonly<OutlookIssuedCredential>,signal:AbortSignal){
   await ports.assertCurrent(scope,signal);signal.throwIfAborted();
   const io=createValidationProviderIo(signal,fetchImpl);
   let account;
   try{const result=await io.read('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName',{method:'GET',headers:{Accept:'application/json',Authorization:`Bearer ${issued.accessToken}`}});if(result.status!==200)throw Error('outlook_profile_unavailable');const p=profile.parse(result.json);account=outlookAccountSchema.parse({id:p.id,displayName:p.displayName??'',email:p.mail??(z.string().email().safeParse(p.userPrincipalName).success?p.userPrincipalName:null)})}finally{io.dispose()}
   await ports.assertCurrent(scope,signal);
   // This provisional binding is never persisted. The caller CAS-binds the actual connection
   // only after all fixed mailbox/calendar reads and current-authority checks succeed.
   const binding={organizationId:scope.organizationId,connectionId:'outlook-provisional',connectionRevision:new Date(now()).toISOString(),accountId:account.id,consentedByUserId:scope.actorUserId};
   const reader=createOutlookReadinessReader({enabled:()=>true,assertCurrent:(s,_binding,abort)=>ports.assertCurrent(s,abort),readCredential:async()=>({...issued,account}),fetch:fetchImpl,now});
   const result=await reader(scope,binding,{start:new Date(now()).toISOString(),end:new Date(now()+86400000).toISOString()},signal);
   return result.account;
  },
 };
}
