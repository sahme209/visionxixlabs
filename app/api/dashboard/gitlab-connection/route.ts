import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { readBoundedRequestJson } from "@/lib/api/readBoundedRequestJson";
import { currentContext } from "@/lib/auth/currentContext";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { prisma } from "@/lib/db";
import { readGitLabSetupState, registerPendingGitLabReadConnection, revokeGitLabReadConnection } from "@/lib/releaseops/gitlabPendingRegistration";
import { activateGitLabReadConnection } from "@/lib/releaseops/gitlabReadActivation";

export const dynamic = "force-dynamic";

const id = z.string().trim().min(1).max(200);
const token = z.string().regex(/^[!-~]{1,4096}$/);
const revision = z.string().datetime().transform(value => new Date(value));
const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("register"), repositoryId: id, projectId: z.string().regex(/^[1-9][0-9]{0,19}$/),
    projectToken: token, expiresAt: z.number().int().safe().positive(), revision: revision.optional(),
  }).strict(),
  z.object({action: z.enum(["validate", "revalidate"]), repositoryId: id, connectionId: id, revision, verifierToken: token}).strict(),
  z.object({action: z.literal("revoke"), repositoryId: id, connectionId: id, revision}).strict(),
]);

function reply(status: number, data: object) {
  return NextResponse.json(data, {status, headers: {"Cache-Control": "no-store"}});
}

async function authorize() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.sessionUserId) return reply(401, {error: "auth_required"});
  if (!ctx.roles.some(role => role === "owner" || role === "admin")) return reply(403, {error: "connection_manager_required"});
  return {organizationId: ctx.organizationId, userId: ctx.sessionUserId};
}

export async function GET(req: NextRequest) {
  if (process.env.GITLAB_WORKSPACE_SETUP_ENABLED !== "true") return reply(404, {error: "gitlab_setup_unavailable"});
  const scope = await authorize();
  if (scope instanceof NextResponse) return scope;
  const repository = id.safeParse(req.nextUrl.searchParams.get("repositoryId"));
  if (!repository.success) return reply(400, {error: "invalid_payload"});
  try {
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(5_000)]);
    const data = await readGitLabSetupState(prisma, {...scope, repositoryId: repository.data}, signal);
    return reply(200, data);
  } catch {
    return reply(503, {error: "gitlab_setup_unavailable"});
  }
}

export async function POST(req: NextRequest) {
  if (process.env.GITLAB_WORKSPACE_SETUP_ENABLED !== "true") return reply(404, {error: "gitlab_setup_unavailable"});
  if (!isSameOriginRequest(req)) return reply(403, {error: "invalid_request_origin"});
  const scope = await authorize();
  if (scope instanceof NextResponse) return scope;
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(15_000)]);
  const input = requestSchema.safeParse(await readBoundedRequestJson(req, signal, 8_192).catch(() => null));
  if (!input.success) return reply(400, {error: "invalid_payload"});

  try {
    if (input.data.action === "register") {
      const data = await registerPendingGitLabReadConnection(prisma, {...input.data, ...scope, signal});
      return reply(200, {status: "pending", connectionId: data.connectionId, revision: data.revision.toISOString()});
    }
    if (input.data.action === "revoke") {
      const data = await revokeGitLabReadConnection(prisma, {...input.data, ...scope, signal});
      return reply(200, {status: "revoked", connectionId: data.connectionId, revision: data.revision.toISOString()});
    }
    const mode = input.data.action === "revalidate" ? "revalidate" : undefined;
    const data = await activateGitLabReadConnection(prisma, {...input.data, ...scope, signal, mode});
    return reply(200, {status: "active", connectionId: data.connectionId, projectId: data.projectId, validatedAt: data.validatedAt.toISOString()});
  } catch (error) {
    const unconfirmed = error instanceof Error
      && ["gitlab_registration_unconfirmed", "gitlab_read_activation_unconfirmed", "gitlab_revocation_unconfirmed"].includes(error.message);
    return reply(409, {error: unconfirmed ? "gitlab_setup_unconfirmed" : "gitlab_setup_unavailable"});
  }
}
