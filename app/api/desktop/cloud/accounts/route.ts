import { NextResponse, type NextRequest } from "next/server";
import { awsEnrollment, enrollmentFailure, enrollmentPrincipal, enrollmentUnauthorized } from "@/lib/cloud/aws/enrollment/runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const principal = await enrollmentPrincipal(request, "read");
    if (!principal) return enrollmentUnauthorized();
    return NextResponse.json({ ok: true, data: await awsEnrollment.list(principal.organizationId) });
  } catch (error) { return enrollmentFailure(error); }
}
