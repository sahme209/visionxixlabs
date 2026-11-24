import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  const cacheControl = "private, no-store";
  if ("error" in auth) {
    auth.error.headers.set("Cache-Control", cacheControl);
    return auth.error;
  }

  const adminListCount = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .filter((email) => email.trim()).length;

  return NextResponse.json({
    signedIn: true,
    email: auth.user.email,
    adminListCount,
    adminListEmpty: adminListCount === 0,
    isAdmin: true,
    nextStep: "OK — admin endpoints should work.",
  }, { headers: { "Cache-Control": cacheControl } });
}
