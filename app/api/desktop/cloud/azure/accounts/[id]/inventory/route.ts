import { NextResponse, type NextRequest } from "next/server";
import { azureEnrollment, azureEnrollmentPrincipal, azureEnrollmentUnauthorized, azureEnrollmentFailure, rejectAzureQuery } from "@/lib/cloud/azure/enrollment/runtime";
import { requireAzureAccountId } from "@/lib/cloud/azure/enrollment/policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;
export async function GET(request: NextRequest, { params }: {
    params: Promise<{
        id: string;
    }>;
}): Promise<Response> { try {
    const principal = await azureEnrollmentPrincipal(request, "read");
    if (!principal)
        return azureEnrollmentUnauthorized();
    rejectAzureQuery(request);
    const { id } = await params;
    requireAzureAccountId(id);
    return NextResponse.json({ ok: true, data: await azureEnrollment.inventory(principal, id) });
}
catch (error) {
    return azureEnrollmentFailure(error);
} }
