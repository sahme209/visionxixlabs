/**
 * GET /api/admin/whoami — debug endpoint.
 *
 * Tells the caller: which email NextAuth thinks you are, whether you're
 * in ADMIN_EMAILS, and how many entries are in ADMIN_EMAILS. No
 * credentials echoed. Always returns 200 so we can read the response
 * even when the admin guard would reject.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? null;
  const adminList = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  const isAdmin = !!email && adminList.includes(email.toLowerCase());

  return NextResponse.json({
    signedIn: !!email,
    email,
    adminListCount: adminList.length,
    adminListEmpty: adminList.length === 0,
    isAdmin,
    nextStep: !email
      ? "Sign in at /auth/signin"
      : !adminList.length
        ? "Set ADMIN_EMAILS env var on Vercel and redeploy."
        : !isAdmin
          ? `Your email (${email}) is not in ADMIN_EMAILS. Add it and redeploy.`
          : "OK — admin endpoints should work.",
  });
}
