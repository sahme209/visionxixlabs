import {z} from 'zod';
import {recordOutlookFailure,recordOutlookValidationFailure} from './outlookDiagnostics';
import {readBoundedRequestJson} from '@/lib/api/readBoundedRequestJson';
import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {currentContext} from '@/lib/auth/currentContext';
import {isSameOriginRequest} from '@/lib/auth/requestOrigin';
import {isAdminOrOwner} from '@/lib/auth/platformAdmin';
import {trustedAxiomUrl} from '@/lib/integrations/trustedCallbackUrl';
import {createOutlookRuntime,outlookConfigured} from './outlookRuntime';
import type {ConnectedActionScope} from '@/lib/integrations/connectedActionContract';
const errors=new Set(['outlook_not_configured','outlook_authorization_required','outlook_scope_insufficient','outlook_mailbox_unavailable','outlook_account_changed','outlook_connection_changed','outlook_registration_changed','outlook_invalid_state','outlook_exchange_refused','outlook_exchange_outcome_unknown','outlook_record_outcome_unknown','outlook_verified_connection_required']);
export function outlookSafeError(error:unknown){return error instanceof Error&&errors.has(error.message)?error.message:'outlook_unavailable'}
/** Browser-only authority. This session label is not a paired desktop capability. */
export async function outlookBrowserAuthority(){const context=await currentContext();if(!context.isAuthenticated||!context.organizationId||!context.sessionUserId||!isAdminOrOwner({email:context.email,roles:context.roles}))throw Error('outlook_authorization_required');const scope:ConnectedActionScope={organizationId:String(context.organizationId),actorUserId:String(context.sessionUserId),sessionId:'browser:'+context.sessionUserId};const assertCurrent=async(expected:Readonly<ConnectedActionScope>,signal:AbortSignal)=>{signal.throwIfAborted();const current=await currentContext();if(!current.isAuthenticated||String(current.organizationId)!==expected.organizationId||String(current.sessionUserId)!==expected.actorUserId||!isAdminOrOwner({email:current.email,roles:current.roles}))throw Error('outlook_authorization_required');signal.throwIfAborted()};return{scope,assertCurrent}}
export async function startOutlookBrowser(request:NextRequest,purpose:'read'|'actions'){
 if(!isSameOriginRequest(request))return NextResponse.json({ok:false,error:'invalid_request_origin'},{status:403,headers:{'Cache-Control':'no-store'}});
 try{if(request.nextUrl.searchParams.size||!outlookConfigured())throw Error('outlook_not_configured');const {scope,assertCurrent}=await outlookBrowserAuthority();const expected=z.object({expectedOrganizationId:z.string().min(1).max(240),expectedUserId:z.string().min(1).max(240)}).strict().parse(await readBoundedRequestJson(request,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]),4096));if(expected.expectedOrganizationId!==scope.organizationId||expected.expectedUserId!==scope.actorUserId)throw Error('outlook_authorization_required');const runtime=createOutlookRuntime(assertCurrent),result=await runtime.start(scope,purpose,request.signal);return NextResponse.json({ok:true,data:result},{headers:{'Cache-Control':'no-store'}})}catch(error){return NextResponse.json({ok:false,error:outlookSafeError(error)},{status:503,headers:{'Cache-Control':'no-store'}})}
}
export async function completeOutlookBrowser(request:NextRequest){let status='outlook_unavailable';
 try{const query=request.nextUrl.searchParams;if(request.url.length>20000||[...query.keys()].some(k=>!['state','code','error','error_description','session_state'].includes(k))||['state','code','error'].some(k=>query.getAll(k).length>1))throw Error('outlook_invalid_state');if(query.has('error')){recordOutlookFailure('authorization',{error:query.get('error')});throw Error('outlook_exchange_refused')};const {scope,assertCurrent}=await outlookBrowserAuthority();await createOutlookRuntime(assertCurrent).complete(scope,{state:query.get('state')??'',code:query.get('code')??''},request.signal);status='connected'}catch(error){recordOutlookValidationFailure(error);status=outlookSafeError(error)}
 const destination=trustedAxiomUrl('/account/integrations/outlook?'+new URLSearchParams({status}));return destination?NextResponse.redirect(destination,{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}}):NextResponse.json({ok:false,error:'trusted_return_url_unavailable'},{status:503});
}
