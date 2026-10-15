import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { AwsEnrollmentError } from "./policy";
import { createAwsEnrollmentService, type EnrollmentRepo, type EnrollmentPrincipal } from "./service";
export const enrollmentRepo = prisma as unknown as EnrollmentRepo;
export const awsEnrollment = createAwsEnrollmentService(enrollmentRepo, { audit: async (input) => {
  await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId: input.organizationId, kind: input.action === "disconnected" ? "cloud.connection.disconnected" : "cloud.connection.validated", subjectKind: "integration", subjectId: input.accountId, outcome: "ok", summary: input.action === "disconnected" ? "Disconnected Axiom cloud access locally; AWS role and issued STS sessions were not revoked" : "Verified AWS role identity; generic Agent scan remains disabled", actorUserId: input.userId });
} });
export async function enrollmentPrincipal(request: NextRequest, mode: "read" | "manage" | "disconnect"): Promise<EnrollmentPrincipal | undefined> {
  const session = await resolveRequestDesktopSession(request, { ...(mode === "disconnect" ? { requireActiveAccess: false } : {}), requiredScope: mode === "read" ? "pipeline:read" : "pipeline:trigger", allowApiKey: false, requiredCapability: mode === "read" ? "workspace:read" : "connections:manage", route: `${request.method} ${request.nextUrl.pathname}` });
  if (!session || session.credentialKind !== "desktop_session") return undefined;
  return { organizationId: String(session.organizationId), userId: String(session.userId), sessionId: session.id };
}
export const enrollmentUnauthorized = () => NextResponse.json({ ok: false, error: "desktop_session_required", message: "A currently authorized paired desktop session is required." }, { status: 401 });
export function enrollmentFailure(error: unknown): Response {
  const prismaCode = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const code = error instanceof AwsEnrollmentError ? error.code : ["P2002", "P2034"].includes(prismaCode) ? "enrollment_conflict" : "enrollment_unavailable";
  const statuses = { invalid_input: 400, enrollment_unavailable: 503, enrollment_not_found: 404, enrollment_expired: 410, enrollment_conflict: 409, connection_authority_required: 403, aws_identity_unverified: 400, aws_inventory_denied: 403, cloud_account_limit_reached: 403, connection_disconnected: 409 };
  const messages = {
    connection_disconnected: "Axiom access to this connection is disconnected. Re-enroll to validate new access.",
    cloud_account_limit_reached: "The workspace cloud account allowance is exhausted. Existing connections can still be revalidated.",
    invalid_input: "Check the AWS account, role, region and enrollment challenge.", enrollment_unavailable: "AWS enrollment or its required storage is unavailable. No connection was changed.",
    enrollment_not_found: "This connection or enrollment is unavailable to this workspace.", enrollment_expired: "This enrollment expired. Start a new enrollment.", enrollment_conflict: "Connection state changed or this enrollment was already used. Refresh before retrying.",
    connection_authority_required: "Your paired session or current workspace role no longer permits this operation.", aws_identity_unverified: "AWS did not confirm the expected account and assumed role identity.", aws_inventory_denied: "AWS denied the bounded inventory read. The verified identity does not prove inventory permission.",
  };
  return NextResponse.json({ ok: false, error: code, message: messages[code] }, { status: statuses[code] });
}
