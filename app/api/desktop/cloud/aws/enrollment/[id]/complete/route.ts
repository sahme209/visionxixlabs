import { NextResponse, type NextRequest } from "next/server";
import { AwsEnrollmentError } from "@/lib/cloud/aws/enrollment/policy";
import { awsEnrollment, enrollmentFailure, enrollmentPrincipal, enrollmentUnauthorized } from "@/lib/cloud/aws/enrollment/runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const principal = await enrollmentPrincipal(request, "manage");
    if (!principal) return enrollmentUnauthorized();
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const { id } = await params;
    if (!body || Array.isArray(body) || Object.keys(body).some((key) => key !== "externalId") || !id || id.length > 128) throw new AwsEnrollmentError("invalid_input");
    return NextResponse.json({ ok: true, data: await awsEnrollment.complete(principal, id, body.externalId) });
  } catch (error) { return enrollmentFailure(error); }
}
