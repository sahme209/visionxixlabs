import { NextResponse, type NextRequest } from "next/server";
import { AwsEnrollmentError } from "@/lib/cloud/aws/enrollment/policy";
import { awsEnrollment, enrollmentFailure, enrollmentPrincipal, enrollmentUnauthorized } from "@/lib/cloud/aws/enrollment/runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const principal = await enrollmentPrincipal(request, "disconnect");
    if (!principal) return enrollmentUnauthorized();
    const { id } = await params;
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!id || id.length > 128 || !body || Array.isArray(body) || Object.keys(body).some((key) => key !== "expectedVersion")) throw new AwsEnrollmentError("invalid_input");
    return NextResponse.json({ ok: true, data: await awsEnrollment.disconnect(principal, id, body.expectedVersion) });
  } catch (error) { return enrollmentFailure(error); }
}
