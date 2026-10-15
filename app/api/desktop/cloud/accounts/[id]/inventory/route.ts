import { NextResponse, type NextRequest } from "next/server";
import { AwsEnrollmentError } from "@/lib/cloud/aws/enrollment/policy";
import { readTenantAwsInventory } from "@/lib/cloud/aws/enrollment/inventory";
import { enrollmentRepo, enrollmentFailure, enrollmentPrincipal, enrollmentUnauthorized } from "@/lib/cloud/aws/enrollment/runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const principal = await enrollmentPrincipal(request, "read");
    if (!principal) return enrollmentUnauthorized();
    const { id } = await params;
    if (!id || id.length > 128 || request.nextUrl.search) throw new AwsEnrollmentError("invalid_input");
    return NextResponse.json({ ok: true, data: await readTenantAwsInventory(enrollmentRepo, principal, id) });
  } catch (error) { return enrollmentFailure(error); }
}
