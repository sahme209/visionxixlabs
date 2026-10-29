import {type NextRequest,NextResponse} from 'next/server';
import {currentContext} from '@/lib/auth/currentContext';
import {gcpGuided} from '@/lib/cloud/gcp/guided/runtime';
import {GCP_GUIDED_CALLBACK} from '@/lib/cloud/gcp/guided/contract';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
export const dynamic='force-dynamic';export const runtime='nodejs';
/** No code/state/token is returned, logged, or retried by this endpoint. */
export async function GET(request:NextRequest){const signal=AbortSignal.any([request.signal,AbortSignal.timeout(25000)]);try{if(request.nextUrl.origin+request.nextUrl.pathname!==GCP_GUIDED_CALLBACK)throw new Error('invalid_callback');const q=request.nextUrl.searchParams;if(q.getAll('state').length!==1||q.getAll('code').length!==1||q.has('error'))throw new Error('invalid_callback');const first=await withGithubAbort(currentContext(),signal);const valid=(a:typeof first)=>a.isAuthenticated&&a.sessionUserId&&a.userId===a.sessionUserId&&a.organizationId&&a.roles.some(r=>r==='owner'||r==='admin');if(!valid(first))throw new Error('authority_required');const browser={organizationId:String(first.organizationId),userId:String(first.sessionUserId)};await gcpGuided.callback({state:q.get('state')!,code:q.get('code')!,browser,signal,assertBrowser:async()=>{const fresh=await withGithubAbort(currentContext(),signal);if(!valid(fresh)||fresh.organizationId!==first.organizationId||fresh.sessionUserId!==first.sessionUserId)throw new Error('authority_changed')}});return cloudReturn()}catch{return cloudReturn()}}
function cloudReturn(){return NextResponse.redirect('https://visionxixlabs.com/desktop/cloud/return',{status:303,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})}
