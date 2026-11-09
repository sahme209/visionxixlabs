import { NextResponse, type NextRequest } from "next/server";
import { azureEnrollment, azureEnrollmentPrincipal, azureEnrollmentUnauthorized, azureEnrollmentFailure, readAzureJsonBody, rejectAzureQuery } from "@/lib/cloud/azure/enrollment/runtime";
import { workspaceUnenrolled } from "@/lib/governance/intelligence/enrolledRefusal";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;
export async function POST(request: NextRequest): Promise<Response> { try {
    const principal = await azureEnrollmentPrincipal(request, "manage");
    if (!principal)
        return azureEnrollmentUnauthorized();
    rejectAzureQuery(request);
    // Governance M03: each enrollment adds a cloud account, so it waits while enrolled. Disconnect still works.
    if (!await workspaceUnenrolled(principal.organizationId))
        return NextResponse.json({ ok: false, error: "governance_enrolled_connection_increase" }, { status: 409 });
    return NextResponse.json({ ok: true, data: await azureEnrollment.enroll(principal, await readAzureJsonBody(request)) });
}
catch (error) {
    return azureEnrollmentFailure(error);
} }
