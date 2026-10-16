import { NextResponse, type NextRequest } from "next/server";
import { azureEnrollment, azureEnrollmentPrincipal, azureEnrollmentUnauthorized, azureEnrollmentFailure, readAzureJsonBody, rejectAzureQuery } from "@/lib/cloud/azure/enrollment/runtime";
import { parseAzureDisconnectInput, requireAzureAccountId } from "@/lib/cloud/azure/enrollment/policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest, { params }: {
    params: Promise<{
        id: string;
    }>;
}): Promise<Response> { try {
    const principal = await azureEnrollmentPrincipal(request, "disconnect");
    if (!principal)
        return azureEnrollmentUnauthorized();
    rejectAzureQuery(request);
    const { id } = await params;
    requireAzureAccountId(id);
    const body = parseAzureDisconnectInput(await readAzureJsonBody(request));
    return NextResponse.json({ ok: true, data: await azureEnrollment.disconnect(principal, id, body.expectedVersion) });
}
catch (error) {
    return azureEnrollmentFailure(error);
} }
