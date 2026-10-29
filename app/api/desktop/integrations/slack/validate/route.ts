import {createValidationProviderIo,type ValidationProviderIo} from '@/lib/integrations/validationProviderIo';
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
import { decryptScopedCredential } from "@/lib/security/credentialVault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
class ValidationAuthorityChanged extends Error {}

interface SlackConnectionRow { id: string; status: string; encryptedCredential: string; updatedAt: Date; revokedAt: Date | null }
interface SlackConnectionRepo {
  $transaction<T>(fn:(tx:Pick<SlackConnectionRepo,"tenantIntegrationConnection">)=>Promise<T>):Promise<T>;
  tenantIntegrationConnection: {
    findUnique(args: { where: { organizationId_provider: { organizationId: string; provider: string } }; select: { id: true; status: true; encryptedCredential: true; updatedAt: true; revokedAt: true } }): Promise<SlackConnectionRow | null>;
    updateMany(args: { where: { id: string; organizationId: string; provider: string; status: string; encryptedCredential: string; updatedAt: Date; revokedAt: null }; data: { status: string; lastValidatedAt?: Date; encryptedCredential?: string } }): Promise<{ count: number }>;
  };
}

async function audit(input: { organizationId: string; userId: string; action: "connector.validate.success" | "connector.validate.failure"; connectionId: string }) {
  await recordAudit({
    organizationId: idFactory.organization(input.organizationId), actorUserId: idFactory.user(input.userId), actorKind: "user",
    action: input.action, outcome: input.action.endsWith("success") ? "success" : "failure", entityRef: `connector:slack:${input.connectionId}`,
    correlationId: idFactory.correlation(`slack_validate_${Date.now().toString(36)}`), source: "live", detail: { provider: "slack" },
  });
}

/** Validates only that Slack accepts the stored tenant-bound token. It sends
 * no message, returns no provider data, and is the sole active-state transition. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/integrations/slack/validate",
    allowApiKey: false,
    requireWorkspaceAdmin: true,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  async function currentAuthority() {
    if(request.signal.aborted)throw new ValidationAuthorityChanged();
    const current=await resolveRequestDesktopSession(request,{requiredScope:"pipeline:read",route:"POST /api/desktop/integrations/slack/validate",allowApiKey:false,requireWorkspaceAdmin:true});
    if(!current||current.credentialKind!=="desktop_session"||current.id!==session!.id||current.organizationId!==session!.organizationId||current.userId!==session!.userId||request.signal.aborted)throw new ValidationAuthorityChanged();
  }
  const repo = prisma as unknown as SlackConnectionRepo;
  let connection: SlackConnectionRow | null;
  try {
    connection = await repo.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId: session.organizationId, provider: "slack" } }, select: { id: true, status: true, encryptedCredential: true, updatedAt: true, revokedAt: true } });
  } catch {
    return NextResponse.json({ ok: false, error: "slack_connection_unavailable" }, { status: 503 });
  }
  if (!connection || connection.revokedAt !== null || !["pending", "active", "needs_attention"].includes(connection.status)) return NextResponse.json({ ok: false, error: "slack_not_connected" }, { status: 409 });
  if (!(connection.updatedAt instanceof Date) || !Number.isFinite(connection.updatedAt.getTime())) return NextResponse.json({ ok: false, error: "slack_connection_unavailable" }, { status: 503 });
  // Pin the exact tenant-owned record observed before any provider await. A
  // pause/reconnect/revocation must win over either an old success or failure.
  const actorUserId = session.userId;
  const expected = { id: connection.id, organizationId: session.organizationId, provider: "slack", status: connection.status, encryptedCredential: connection.encryptedCredential, updatedAt: new Date(connection.updatedAt.getTime()), revokedAt: null };
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
      if(error instanceof ValidationAuthorityChanged)return NextResponse.json({ok:false,error:"slack_authority_changed"},{status:409});
      // A lost write acknowledgement is unknown: never issue a second write.
      return NextResponse.json({ ok: false, error: "slack_validation_outcome_unknown", retryAllowed:false }, { status: 503 });
    }
    if (count !== 1) return NextResponse.json({ ok: false, error: "slack_connection_changed" }, { status: 409 });
    try {
      await audit({ organizationId: expected.organizationId, userId: actorUserId, action: success ? "connector.validate.success" : "connector.validate.failure", connectionId: expected.id });
    } catch {
      return NextResponse.json({ ok: false, error: "slack_validation_audit_unconfirmed", retryAllowed:false }, { status: 503 });
    }
    return success ? NextResponse.json({ ok: true, data: { status: "active" } }) : NextResponse.json({ ok: false, error }, { status: 503 });
  }

  const io=createValidationProviderIo(request.signal);
  try {
  let token: string;
  try {
    await currentAuthority();
    token = decryptScopedCredential(connection.encryptedCredential, connectionCredentialContext({ organizationId: session.organizationId, provider: "slack", connectionId: connection.id }));
  } catch { return finish(false, "slack_credential_unavailable"); }
  try {
    await currentAuthority();
    const response = await io.read("https://slack.com/api/auth.test", { headers: { Authorization: `Bearer ${token}` } });
    const result = response.json as { ok?: boolean } | null;
    if (!response.ok || result?.ok !== true) return finish(false, "slack_validation_failed");
  } catch { return finish(false, "slack_validation_failed"); }
  return await finish(true, "slack_validation_failed");
  }finally{io.dispose()}
}
