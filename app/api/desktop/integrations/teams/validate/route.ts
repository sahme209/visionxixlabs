import {validateActionConsentScopes} from '@/lib/integrations/connectedActionScopes';
import {splitGrantedScopes} from '@/lib/integrations/grantedScopes';
import {createValidationProviderIo,type ValidationProviderIo} from '@/lib/integrations/validationProviderIo';
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
import { decryptScopedCredential, encryptScopedCredential } from "@/lib/security/credentialVault";
import { microsoftCredentialRefreshDue, parseStoredMicrosoftCredential, type StoredMicrosoftCredential } from "@/lib/integrations/microsoftCredential";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
class ValidationAuthorityChanged extends Error {}

interface TeamsConnectionRow { organizationId:string;provider:string;id: string; status: string; encryptedCredential: string; updatedAt: Date; revokedAt: Date | null }
interface TeamsConnectionRepo {
  $transaction<T>(fn:(tx:Pick<TeamsConnectionRepo,"tenantIntegrationConnection">)=>Promise<T>):Promise<T>;
  tenantIntegrationConnection: {
    findUnique(args: { where: { organizationId_provider: { organizationId: string; provider: string } }; select: { organizationId:true;provider:true;id: true; status: true; encryptedCredential: true; updatedAt: true; revokedAt: true } }): Promise<TeamsConnectionRow | null>;
    updateMany(args: { where: { id: string; organizationId: string; provider: string; status: string; encryptedCredential: string; updatedAt: Date; revokedAt: null }; data: { status: string; lastValidatedAt?: Date; encryptedCredential?: string; updatedAt?:Date } }): Promise<{ count: number }>;
  };
}

class TeamsRefreshOutcomeUnknown extends Error {}

type MicrosoftRefreshResponse = { error?:string; access_token?: string; refresh_token?: string; expires_in?: number };

async function audit(input: { organizationId: string; userId: string; action: "connector.validate.success" | "connector.validate.failure"; connectionId: string }) {
  await recordAudit({
    organizationId: idFactory.organization(input.organizationId), actorUserId: idFactory.user(input.userId), actorKind: "user",
    action: input.action, outcome: input.action.endsWith("success") ? "success" : "failure", entityRef: `connector:teams:${input.connectionId}`,
    correlationId: idFactory.correlation(`teams_validate_${Date.now().toString(36)}`), source: "live", detail: { provider: "teams", validationMode: "identity_read" },
  });
}

/** Verifies the saved Microsoft identity using a minimal Graph read. No team,
 * channel, message, or provider identity data is returned to the desktop. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/integrations/teams/validate",
    allowApiKey: false,
    requireWorkspaceAdmin: true,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  async function currentAuthority() {
    if(request.signal.aborted)throw new ValidationAuthorityChanged();
    const current=await resolveRequestDesktopSession(request,{requiredScope:"pipeline:read",route:"POST /api/desktop/integrations/teams/validate",allowApiKey:false,requireWorkspaceAdmin:true});
    if(!current||current.credentialKind!=="desktop_session"||current.id!==session!.id||current.organizationId!==session!.organizationId||current.userId!==session!.userId||request.signal.aborted)throw new ValidationAuthorityChanged();
  }
  const repo = prisma as unknown as TeamsConnectionRepo;
  let connection: TeamsConnectionRow | null;
  try {
    connection = await repo.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId: session.organizationId, provider: "teams" } }, select: { organizationId:true,provider:true,id: true, status: true, encryptedCredential: true, updatedAt: true, revokedAt: true } });
  } catch {
    return NextResponse.json({ ok: false, error: "teams_connection_unavailable" }, { status: 503 });
  }
  if (!connection || connection.revokedAt !== null || !["pending", "active", "needs_attention"].includes(connection.status)) return NextResponse.json({ ok: false, error: "teams_not_connected" }, { status: 409 });
  if (!(connection.updatedAt instanceof Date) || !Number.isFinite(connection.updatedAt.getTime())) return NextResponse.json({ ok: false, error: "teams_connection_unavailable" }, { status: 503 });
  // Pin the exact tenant-owned record observed before any provider await. A
  // pause/reconnect/revocation must win over either an old success or failure.
  const actorUserId = session.userId;
  let expected = { id: connection.id, organizationId: session.organizationId, provider: "teams", status: connection.status, encryptedCredential: connection.encryptedCredential, updatedAt: new Date(connection.updatedAt.getTime()), revokedAt: null };
  let refreshClaimed=false;
  const refreshUnknown=()=>NextResponse.json({ok:false,error:"teams_refresh_outcome_unknown",retryAllowed:false},{status:503});
  async function finish(success: boolean, error: string, encryptedCredential?: string): Promise<NextResponse> {
    let count: number;
    try {
      count=await repo.$transaction(async tx=>{
        await currentAuthority();
        const result=await tx.tenantIntegrationConnection.updateMany({where:expected,data:success?{status:"active",lastValidatedAt:new Date(),...(encryptedCredential?{encryptedCredential}:{})}:{status:"needs_attention"}});
        await currentAuthority();
        return result.count;
      });
    } catch (error) {
      if(refreshClaimed)return refreshUnknown();
      if(error instanceof ValidationAuthorityChanged)return NextResponse.json({ok:false,error:"teams_authority_changed"},{status:409});
      // A lost write acknowledgement is unknown: never issue a second write.
      return NextResponse.json({ ok: false, error: "teams_validation_outcome_unknown", retryAllowed:false }, { status: 503 });
    }
    if(count!==1&&refreshClaimed)return refreshUnknown();
    if (count !== 1) return NextResponse.json({ ok: false, error: "teams_connection_changed" }, { status: 409 });
    try {
      await audit({ organizationId: expected.organizationId, userId: actorUserId, action: success ? "connector.validate.success" : "connector.validate.failure", connectionId: expected.id });
    } catch {
      return NextResponse.json({ ok: false, error: "teams_validation_audit_unconfirmed", retryAllowed:false }, { status: 503 });
    }
    return success ? NextResponse.json({ ok: true, data: { status: "active" } }) : NextResponse.json({ ok: false, error }, { status: 503 });
  }

  const io=createValidationProviderIo(request.signal);
  try {
  let credential: StoredMicrosoftCredential;
  try {
    await currentAuthority();
    const stored = parseStoredMicrosoftCredential(decryptScopedCredential(connection.encryptedCredential, connectionCredentialContext({ organizationId: session.organizationId, provider: "teams", connectionId: connection.id })));
    if (!stored) throw new Error("missing_access_token");
    credential = stored;
  } catch { return finish(false, "teams_credential_unavailable"); }
  let encryptedCredential: string;
  let refreshedCredential=false;
  try {
    await currentAuthority();
    if(microsoftCredentialRefreshDue(credential)){
      if(!process.env.MICROSOFT_CLIENT_ID?.trim()||!process.env.MICROSOFT_CLIENT_SECRET?.trim()||!process.env.MICROSOFT_TENANT_ID?.trim())return finish(false,"teams_refresh_unavailable");
      const claimedAt=new Date(Math.max(Date.now(),expected.updatedAt.getTime()+1));
      try{
        expected=await repo.$transaction(async tx=>{
          await currentAuthority();
          const claimed=await tx.tenantIntegrationConnection.updateMany({where:expected,data:{status:"suspended",updatedAt:claimedAt}});
          if(claimed.count!==1)throw new TeamsRefreshOutcomeUnknown();
          await currentAuthority();
          return{...expected,status:"suspended",updatedAt:claimedAt};
        });
      }catch{return refreshUnknown()}
      refreshClaimed=true;
      await currentAuthority();
      // Fence an observed reconsent/disconnect during the final authority await.
      // This is a local reread, not atomicity with the remote token endpoint.
      const claimed=await repo.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId:session.organizationId,provider:"teams"}},select:{organizationId:true,provider:true,id:true,status:true,encryptedCredential:true,updatedAt:true,revokedAt:true}});
      if(!claimed||claimed.organizationId!==expected.organizationId||claimed.provider!==expected.provider||claimed.id!==expected.id||claimed.status!=="suspended"||claimed.encryptedCredential!==expected.encryptedCredential||!(claimed.updatedAt instanceof Date)||claimed.updatedAt.getTime()!==expected.updatedAt.getTime()||claimed.revokedAt!==null)throw new TeamsRefreshOutcomeUnknown();
      io.signal.throwIfAborted();
      credential=await refreshMicrosoftCredential(credential,io);refreshedCredential=true;await currentAuthority();
    }
    let response = await graphIdentityRead(credential.accessToken,io);
    if (!response.ok){if(refreshedCredential)throw new TeamsRefreshOutcomeUnknown();return finish(false,"teams_validation_failed")}
    const payload=response.json;
    const identity=payload&&typeof payload==='object'&&!Array.isArray(payload)?payload as Record<string,unknown>:null;
    const identityId=identity?.id;
    if(!identity||'error' in identity||typeof identityId!=='string'||!identityId||identityId!==identityId.trim()||Buffer.byteLength(identityId,'utf8')>240||/[\x00-\x20\x7f-\x9f]/.test(identityId)){
      if(refreshedCredential)throw new TeamsRefreshOutcomeUnknown();
      return finish(false,"teams_validation_failed");
    }
    encryptedCredential = encryptScopedCredential(JSON.stringify(credential), connectionCredentialContext({ organizationId: session.organizationId, provider: "teams", connectionId: connection.id }));
  } catch(error) { if(error instanceof TeamsRefreshOutcomeUnknown||refreshedCredential||refreshClaimed)return NextResponse.json({ok:false,error:"teams_refresh_outcome_unknown",retryAllowed:false},{status:503});return finish(false, "teams_validation_failed"); }
  return await finish(true, "teams_validation_failed", encryptedCredential);
  }finally{io.dispose()}
}

async function graphIdentityRead(accessToken: string,io:ValidationProviderIo) {
  return io.read("https://graph.microsoft.com/v1.0/me?$select=id", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
}

async function refreshMicrosoftCredential(current: StoredMicrosoftCredential,io:ValidationProviderIo): Promise<StoredMicrosoftCredential> {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim() ?? "";
  const tenant = process.env.MICROSOFT_TENANT_ID?.trim() ?? "";
  if (!current.refreshToken || !clientId || !clientSecret || !tenant) throw new Error("teams_refresh_unavailable");
  let response:Awaited<ReturnType<ValidationProviderIo["read"]>>;
  try{response=await io.read(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: current.refreshToken }),
    cache: "no-store",
  });
  }catch{throw new TeamsRefreshOutcomeUnknown()}
  const refreshed=response.json as MicrosoftRefreshResponse|null;
  if(!response.ok){
    const definite=[400,401].includes(response.status)&&refreshed&&typeof refreshed.error==="string"&&["invalid_grant","invalid_client","unauthorized_client","invalid_scope","unsupported_grant_type"].includes(refreshed.error);
    if(definite)throw new Error("teams_refresh_failed");
    throw new TeamsRefreshOutcomeUnknown();
  }
  const token=(value:unknown)=>typeof value==="string"&&value.length>0&&Buffer.byteLength(value,'utf8')<=16384&&!/[\x00-\x20\x7f]/.test(value);
  if(!refreshed||!token(refreshed.access_token)||(refreshed.refresh_token!==undefined&&!token(refreshed.refresh_token))||typeof refreshed.expires_in!=="number"||!Number.isFinite(refreshed.expires_in)||refreshed.expires_in<=0||refreshed.expires_in>31536000)throw new TeamsRefreshOutcomeUnknown();
  const expiresAt = typeof refreshed.expires_in === "number" && Number.isFinite(refreshed.expires_in) && refreshed.expires_in > 0
    ? Date.now() + refreshed.expires_in * 1000
    : null;
  let action:Pick<StoredMicrosoftCredential,'purpose'|'actionScopes'>={};
  if(current.purpose==='connected_app_actions_v1'){try{const raw=(refreshed as unknown as {scope?:unknown}).scope;const scopes=typeof raw==='string'?splitGrantedScopes(raw):raw;action={purpose:'connected_app_actions_v1',actionScopes:validateActionConsentScopes('teams',scopes)}}catch{throw new TeamsRefreshOutcomeUnknown()}}
  return { ...action,accessToken: refreshed.access_token!, refreshToken: refreshed.refresh_token ?? current.refreshToken, expiresAt };
}
