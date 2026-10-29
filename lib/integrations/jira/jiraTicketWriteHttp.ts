import 'server-only';
import {hasEmptyAuthorizationBody} from '../emptyAuthorizationRequest';
import {NextResponse,type NextRequest} from 'next/server';
import {isSameOriginRequest} from '@/lib/auth/requestOrigin';
import {consumeToken} from '@/lib/api/rateLimiter';
import type {createJiraTicketWriteAuthorization} from './jiraTicketWriteAuthorization';
interface Options{purpose?:'ticket_reporter_upgrade';enabled:()=>boolean;authorization:ReturnType<typeof createJiraTicketWriteAuthorization>;readRateKey?:()=>Promise<string>}
const callbackUrl='https://visionxixlabs.com/api/integrations/jira/callback';
const json=(error:string,status:number)=>NextResponse.json({ok:false,error},{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
const returned=(status:string)=>NextResponse.redirect('https://visionxixlabs.com/account/integrations/jira/ticket-access?'+new URLSearchParams({status}),{status:303,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
export function createJiraTicketWriteHttp(options:Options){
 async function rate(){if(!options.readRateKey)return;const key=await options.readRateKey();if(!key||!consumeToken('jira-ticket-consent:'+key,{capacity:8,tokensPerSecond:0.05}).allowed)throw Error('unavailable')}
 return{
 async start(request:NextRequest){if(request.method!=='POST')return json('method_not_allowed',405);if(!options.enabled())return json('jira_ticket_consent_unavailable',503);if(!isSameOriginRequest(request))return json('invalid_request_origin',403);if(request.nextUrl.search||request.url.length>2048)return json('invalid_jira_ticket_consent',400);
  try{if(!await hasEmptyAuthorizationBody(request,AbortSignal.any([request.signal,AbortSignal.timeout(15000)])))return json('invalid_jira_ticket_consent',400)}catch{return json('invalid_jira_ticket_consent',400)}
  try{await rate();const data=await options.authorization.begin(AbortSignal.any([request.signal,AbortSignal.timeout(15000)]));return NextResponse.json({ok:true,data},{headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})}catch{return json('jira_ticket_consent_unavailable',409)}
 },
 async callback(request:NextRequest){if(request.method!=='GET')return json('method_not_allowed',405);const url=request.nextUrl,states=url.searchParams.getAll('state'),codes=url.searchParams.getAll('code'),errors=url.searchParams.getAll('error');
  if(url.origin+url.pathname!==callbackUrl||request.url.length>8192||states.length!==1||!new RegExp('^'+(options.purpose==='ticket_reporter_upgrade'?'jr1_':'jw1_')+'[A-Za-z0-9_-]{86}$').test(states[0])||codes.length>1||errors.length>1||codes.length===errors.length||codes.length===1&&(!codes[0]||codes[0].length>4096||/[\x00-\x20\x7f]/.test(codes[0]))||errors.length===1&&(!errors[0]||errors[0].length>128))return returned('invalid_state');
  if(!options.enabled())return returned('activation_pending');const signal=AbortSignal.any([request.signal,AbortSignal.timeout(25000)]);
  try{await rate();if(errors.length){await options.authorization.cancel({state:states[0],signal});return returned('declined')}await options.authorization.complete({state:states[0],code:codes[0],signal});return returned('consent_recorded')}catch{return returned('outcome_unconfirmed')}
 }
 };
}
