import { NextResponse, type NextRequest } from "next/server";
import { azureEnrollment, azureEnrollmentPrincipal, azureEnrollmentUnauthorized, azureEnrollmentFailure, readAzureJsonBody, rejectAzureQuery } from "@/lib/cloud/azure/enrollment/runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;
export async function POST(request: NextRequest): Promise<Response> { try {
    const principal = await azureEnrollmentPrincipal(request, "manage");
    if (!principal)
        return azureEnrollmentUnauthorized();
    rejectAzureQuery(request);
    return NextResponse.json({ ok: true, data: await azureEnrollment.enroll(principal, await readAzureJsonBody(request)) });
}
catch (error) {
    return azureEnrollmentFailure(error);
} }
