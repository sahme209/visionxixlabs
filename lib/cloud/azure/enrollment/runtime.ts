import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { createAzureEnrollmentService, type AzureEnrollmentRepo, type AzurePrincipal } from "./service";
import { AzureEnrollmentError, type AzureErrorCode } from "./policy";
export const azureEnrollment = createAzureEnrollmentService(prisma as unknown as AzureEnrollmentRepo, { audit: async (input) => {
        await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId: input.organizationId, kind: input.action === "disconnected" ? "cloud.connection.disconnected" : "cloud.connection.validated", subjectKind: "integration", subjectId: input.accountId, outcome: "ok", summary: input.action === "disconnected" ? "Removed Axiom's stored Azure credential locally; service principal grants and issued tokens were not revoked" : "Azure subscription read identity verified; bounded inventory is separate and generic Agent scans remain disabled", actorUserId: input.userId });
    } });
export async function azureEnrollmentPrincipal(request: NextRequest, mode: "read" | "manage" | "disconnect"): Promise<AzurePrincipal | undefined> {
    const session = await resolveRequestDesktopSession(request, { ...(mode === "disconnect" ? { requireActiveAccess: false } : {}), requiredScope: mode === "read" ? "pipeline:read" : "pipeline:trigger", requiredCapability: mode === "read" ? "workspace:read" : "connections:manage", allowApiKey: false, route: `${request.method} ${request.nextUrl.pathname}` });
    if (!session || session.credentialKind !== "desktop_session")
        return undefined;
    return { organizationId: String(session.organizationId), userId: String(session.userId), sessionId: session.id };
}
export const azureEnrollmentUnauthorized = () => NextResponse.json({ ok: false, error: "desktop_session_required", message: "A currently authorized paired desktop session is required." }, { status: 401 });
export function azureEnrollmentFailure(error: unknown): Response {
    const prismaCode = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    const code: AzureErrorCode = error instanceof AzureEnrollmentError ? error.code : ["P2002", "P2034"].includes(prismaCode) ? "enrollment_conflict" : "enrollment_unavailable";
    const details: Record<AzureErrorCode, [
        number,
        string
    ]> = { invalid_input: [400, "Check the Azure subscription, tenant, client and connection version."], enrollment_unavailable: [503, "Azure enrollment or its required storage is unavailable. Refresh connection state before retrying."], enrollment_not_found: [404, "This Azure connection is unavailable to this workspace."], enrollment_conflict: [409, "Connection state changed. Refresh before retrying."], connection_authority_required: [403, "Your paired session or current workspace role no longer permits this operation."], cloud_account_limit_reached: [403, "The workspace cloud account allowance is exhausted."], connection_disconnected: [409, "Axiom access is disconnected. Reconnect with fresh Azure validation."], azure_identity_unverified: [400, "Azure did not confirm the expected tenant and subscription read identity."], azure_inventory_denied: [403, "Azure denied the bounded resource-group inventory read."], azure_inventory_unavailable: [503, "The bounded Azure inventory could not be observed. No complete inventory is claimed."] };
    return NextResponse.json({ ok: false, error: code, message: details[code][1] }, { status: details[code][0] });
}
export function rejectAzureQuery(request: NextRequest) { if (request.nextUrl.search)
    throw new AzureEnrollmentError("invalid_input"); }
export async function readAzureJsonBody(request: NextRequest): Promise<unknown> {
    if (!request.body)
        throw new AzureEnrollmentError("invalid_input");
    const length = request.headers.get("content-length");
    if (length && (!/^\d+$/.test(length) || Number(length) > 16384))
        throw new AzureEnrollmentError("invalid_input");
    const reader = request.body.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            const part = await reader.read();
            if (part.done)
                break;
            size += part.value.byteLength;
            if (size > 16384)
                throw new AzureEnrollmentError("invalid_input");
            chunks.push(part.value);
        }
        const buffer = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
            buffer.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
    }
    catch {
        throw new AzureEnrollmentError("invalid_input");
    }
    finally {
        try {
            await reader.cancel();
        }
        catch { /* request already closed */ }
        reader.releaseLock();
    }
}
