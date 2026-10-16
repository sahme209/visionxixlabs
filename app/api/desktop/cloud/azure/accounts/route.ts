import { NextResponse, type NextRequest } from "next/server";
import { azureEnrollment, azureEnrollmentPrincipal, azureEnrollmentUnauthorized, azureEnrollmentFailure, rejectAzureQuery } from "@/lib/cloud/azure/enrollment/runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest): Promise<Response> { try {
    const principal = await azureEnrollmentPrincipal(request, "read");
    if (!principal)
        return azureEnrollmentUnauthorized();
    rejectAzureQuery(request);
    return NextResponse.json({ ok: true, data: await azureEnrollment.list(principal) });
}
catch (error) {
    return azureEnrollmentFailure(error);
} }
