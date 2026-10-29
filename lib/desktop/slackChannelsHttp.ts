import 'server-only';
import {NextResponse,type NextRequest} from 'next/server';
import {prisma} from '@/lib/db';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import {decryptScopedCredential} from '@/lib/security/credentialVault';
import {connectionCredentialContext} from '@/lib/integrations/tenantAuthorization';
import {createTenantSlackChannelReader} from '@/lib/integrations/slack/tenantSlackChannels';
import {slackChannelCursorSchema} from './slackChannelsContract';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
class AuthorityChanged extends Error{}
/** Shared tenant connection, explicit read-only public-channel page; never writes connection state. */
export async function handleSlackChannels(request:NextRequest){
 if(request.method!=='GET')return reply({ok:false,error:'method_not_allowed'},405);
 const keys=[...request.nextUrl.searchParams.keys()];if(request.url.length>2048||keys.some(k=>k!=='cursor')||keys.length>1)return reply({ok:false,error:'invalid_slack_channels_request'},400);
 const value=request.nextUrl.searchParams.get('cursor');const cursor=value===null?undefined:slackChannelCursorSchema.safeParse(value);if(cursor&& !cursor.success)return reply({ok:false,error:'invalid_slack_channels_request'},400);
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(15000)]);
 try{
 const principal=async()=>{signal.throwIfAborted();const p=await withGithubAbort(resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'connections:manage',requireWorkspaceAdmin:true,requireWorkspaceMembership:true,allowApiKey:false,route:'GET /api/desktop/integrations/slack/channels'}),signal);signal.throwIfAborted();if(!p||p.credentialKind!=='desktop_session'||!p.id||!p.userId||!p.organizationId||!['owner','admin'].includes(p.role??'')||!p.capabilities.includes('connections:manage'))throw new AuthorityChanged();return p};
 const initial=await principal();
 const reader=createTenantSlackChannelReader({
  readConnection:async organizationId=>prisma.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId,provider:'slack'}},select:{id:true,organizationId:true,provider:true,status:true,encryptedCredential:true,externalAccountId:true,scopesJson:true,consentedByUserId:true,updatedAt:true,revokedAt:true}}),
  assertCurrent:async(organizationId,row)=>{const current=await principal();if(current.id!==initial.id||current.userId!==initial.userId||current.organizationId!==initial.organizationId||organizationId!==initial.organizationId||row&&row.consentedByUserId!==current.userId)throw new AuthorityChanged()},
  readToken:async row=>decryptScopedCredential(row.encryptedCredential,connectionCredentialContext({organizationId:row.organizationId,provider:'slack',connectionId:row.id})),
 });
 const data=await reader.read({organizationId:initial.organizationId,cursor:cursor&&cursor.success?cursor.data:undefined,signal});signal.throwIfAborted();return reply({ok:true,data});
 }catch(e){return e instanceof AuthorityChanged?reply({ok:false,error:'desktop_session_required'},401):reply({ok:false,error:'slack_channels_unavailable'},409)}
}
