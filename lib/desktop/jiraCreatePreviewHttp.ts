import {jiraRecordedScopesSchema} from '@/lib/integrations/jira/jiraRecordedScopes';
import 'server-only';
import {NextResponse, type NextRequest} from 'next/server';
import {z, ZodError} from 'zod';
import {prisma} from '@/lib/db';
import {resolveRequestDesktopSession, type DesktopRequestPrincipal} from './resolveRequestDesktopSession';
import {consumeToken} from '@/lib/api/rateLimiter';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {readJiraCreateMetadata} from '@/lib/releaseops/readJiraCreateMetadata';
import {readJiraSelfIdentity} from '@/lib/integrations/jira/jiraSelfIdentity';
import {decryptScopedCredential} from '@/lib/security/credentialVault';
import {prepareJiraCreatePreview,jiraCreatePreviewValuesSchema} from '@/lib/releaseops/jiraCreatePreview';

const enabled = () => process.env.AXIOM_JIRA_CREATE_PREVIEW_ENABLED === 'true';
const policy = {requiredScope:'pipeline:read' as const, requiredCapability:'connections:manage' as const,
  requireWorkspaceAdmin:true, requireWorkspaceMembership:true, allowApiKey:false,
  route:'/api/desktop/integrations/jira/create-preview'};
const identifier = z.string().min(1).max(240).refine(v => v === v.trim() && !/[\x00-\x1f\x7f-\x9f]/.test(v));
const revision = z.string().max(32).refine(v => {try {return new Date(v).toISOString() === v;} catch {return false;}});
const inputSchema = z.object({connectionId:identifier, revision, projectId:z.string().regex(/^[0-9]{1,20}$/),
  issueTypeId:z.string().regex(/^[0-9]{1,20}$/), values:jiraCreatePreviewValuesSchema}).strict();
const reply = (body:unknown, status=200) => NextResponse.json(body, {status, headers:{'Cache-Control':'private, no-store'}});
const fail = (error:string, status:number) => reply({ok:false, error}, status);
function paired(p:DesktopRequestPrincipal | undefined):p is DesktopRequestPrincipal {
  return Boolean(p && p.credentialKind === 'desktop_session' && (p.role === 'owner' || p.role === 'admin')
    && p.capabilities.includes('connections:manage') && [p.id,p.userId,p.organizationId].every(v => identifier.safeParse(v).success));
}
async function readBody(request:NextRequest):Promise<unknown> {
  if (!request.body || request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new Error('invalid_input');
  const size = request.headers.get('content-length');
  if (size !== null && (!/^\d+$/.test(size) || Number(size) > 24576)) throw new Error('invalid_input');
  const reader=request.body.getReader(); let stop!:()=>void; let timer:ReturnType<typeof setTimeout>|undefined;
  const stopped=new Promise<never>((_r,reject)=>{stop=()=>reject(new Error('invalid_input'));timer=setTimeout(stop,5000)});
  request.signal.addEventListener('abort',stop,{once:true}); const chunks:Uint8Array[]=[]; let bytes=0;
  try {
    request.signal.throwIfAborted();
    while (true) {const item=await Promise.race([reader.read(),stopped]);if(item.done)break;bytes+=item.value.byteLength;if(bytes>24576)throw new Error('invalid_input');chunks.push(item.value)}
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
  } finally {clearTimeout(timer);request.signal.removeEventListener('abort',stop);void reader.cancel().catch(()=>{});reader.releaseLock()}
}
export async function handleJiraCreatePreview(request:NextRequest):Promise<Response> {
  try {
    if (!['GET','POST'].includes(request.method)) return fail('method_not_allowed',405);
    if (request.nextUrl.search || Buffer.byteLength(request.url)>2048) return fail('invalid_jira_preview_request',400);
    const actor=await resolveRequestDesktopSession(request,policy);
    if (!paired(actor)) return fail('desktop_session_required',401);
    if (request.method === 'GET') return reply({ok:true,data:{enabled:enabled(),canPreview:enabled()}});
    if (!enabled()) return fail('jira_create_preview_disabled',503);
    if (!consumeToken(`jira-create-preview:${actor.organizationId}:${actor.userId}`,{capacity:3,tokensPerSecond:1/60}).allowed) return fail('jira_preview_rate_limited',429);
    let input:z.infer<typeof inputSchema>;
    try {input=inputSchema.parse(await readBody(request))} catch {return fail('invalid_jira_preview_request',400)}
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(24000)]);
    const readCurrentActor=async()=>{
      signal.throwIfAborted();
      const current=await withGithubAbort(resolveRequestDesktopSession(request,policy),signal);
      signal.throwIfAborted();
      return enabled() && paired(current) && current.id===actor.id && current.organizationId===actor.organizationId && current.userId===actor.userId
        ? {organizationId:actor.organizationId,userId:actor.userId,canManageConnections:true as const} : null;
    };
    if (!await readCurrentActor()) return fail('jira_create_preview_changed',409);
    const connection=await withGithubAbort(prisma.tenantIntegrationConnection.findUnique({
      where:{organizationId_provider:{organizationId:actor.organizationId,provider:'jira'}},
      select:{id:true,organizationId:true,provider:true,status:true,revokedAt:true,consentedByUserId:true,externalAccountId:true,scopesJson:true,updatedAt:true},
    }),signal);
    const scopes=jiraRecordedScopesSchema.safeParse(connection?.scopesJson);
    if (!connection || connection.id!==input.connectionId || connection.organizationId!==actor.organizationId || connection.provider!=='jira'
      || connection.status!=='active' || connection.revokedAt || connection.consentedByUserId!==actor.userId || connection.updatedAt.toISOString()!==input.revision
      || !z.string().uuid().safeParse(connection.externalAccountId).success || !scopes.success || !scopes.data.includes('read:jira-work')
      || new Set(scopes.data).size!==scopes.data.length) return fail('jira_create_preview_changed',409);
    const currentActor=await readCurrentActor();
    if (!currentActor) return fail('jira_create_preview_changed',409);
    const discovery=await withGithubAbort(readJiraCreateMetadata({organizationId:actor.organizationId,projectIdOrKey:input.projectId,
      issueTypeId:input.issueTypeId,signal,authorization:{actor:currentActor,readCurrentActor,connectionId:connection.id,revision:input.revision,
        refresh:{clientId:process.env.JIRA_CLIENT_ID?.trim()??'',clientSecret:process.env.JIRA_CLIENT_SECRET?.trim()??'',transport:fetch}}}),signal);
    if (!discovery.ok) return discovery.error==='jira_refresh_persistence_outcome_unknown'
      ? reply({ok:false,error:discovery.error,retryAllowed:false},409) : fail('jira_create_preview_unavailable',409);
    // A successful authorized refresh may rotate the stored revision. The fresh
    // server result, never browser metadata, defines this non-executable preview.
    if (discovery.connectionId!==input.connectionId || discovery.projectIdOrKey!==input.projectId || discovery.issueTypeId!==input.issueTypeId) return fail('jira_create_preview_changed',409);
    let reporter;
    if(input.values.useConnectedReporter){
      try {
        reporter=await readJiraSelfIdentity({organizationId:actor.organizationId,actorUserId:actor.userId,sessionId:actor.id,
          connectionId:discovery.connectionId,connectionRevision:discovery.connectionRevision},signal,{
          readActor:async()=>{const current=await readCurrentActor();return current?{...current,sessionId:actor.id}:null},
          readConnection:organizationId=>prisma.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId,provider:'jira'}}}),
          decrypt:decryptScopedCredential,fetch,
        });
      } catch(error) {
        return fail(error instanceof Error&&error.message==='jira_reporter_permission_required'?'jira_reporter_permission_required':'jira_reporter_identity_unavailable',409);
      }
    }
    const preview=prepareJiraCreatePreview({discovery,selection:{connectionId:discovery.connectionId,
      connectionRevision:discovery.connectionRevision,projectId:input.projectId,issueTypeId:input.issueTypeId},values:input.values,...(reporter?{reporter}:{})});
    if (!preview.ok) return fail('invalid_jira_preview_request',400);
    const latest=await withGithubAbort(prisma.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId:actor.organizationId,provider:'jira'}},
      select:{id:true,status:true,revokedAt:true,updatedAt:true,consentedByUserId:true}}),signal);
    if (!latest || latest.id!==discovery.connectionId || latest.status!=='active' || latest.revokedAt || latest.consentedByUserId!==actor.userId
      || latest.updatedAt.toISOString()!==discovery.connectionRevision || !await readCurrentActor()) return fail('jira_create_preview_changed',409);
    signal.throwIfAborted();
    if (!enabled()) return fail('jira_create_preview_changed',409);
    const output={ok:true,data:{preview:preview.preview}};
    if(Buffer.byteLength(JSON.stringify(output),'utf8')>65536)return fail('jira_preview_response_too_large',502);
    return reply(output);
  } catch(error) {
    if(error instanceof ZodError) return fail('invalid_jira_preview_request',400);
    return fail('jira_create_preview_unavailable',503);
  }
}
