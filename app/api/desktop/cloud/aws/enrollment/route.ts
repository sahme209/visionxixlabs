import { NextResponse, type NextRequest } from "next/server";
import { awsEnrollment, enrollmentFailure, enrollmentPrincipal, enrollmentUnauthorized } from "@/lib/cloud/aws/enrollment/runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const principal = await enrollmentPrincipal(request, "manage");
    if (!principal) return enrollmentUnauthorized();
    const data = await awsEnrollment.start(principal, await request.json().catch(() => null));
    return NextResponse.json({ ok: true, data });
  } catch (error) { return enrollmentFailure(error); }
}
