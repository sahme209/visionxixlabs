import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface AdminUser {
  uid: string;
  email?: string;
}

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function requireAdmin(
  _req: NextRequest
): Promise<{ user: AdminUser } | { error: NextResponse }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return {
      error: NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 }),
    };
  }
  const isAdmin =
    ADMIN_EMAILS.length > 0 &&
    ADMIN_EMAILS.includes(session.user.email.toLowerCase());
  if (!isAdmin) {
    return {
      error: NextResponse.json({ error: "Access denied. Admin required." }, { status: 403 }),
    };
  }
  return {
    user: {
      uid: (session.user as { id?: string }).id ?? session.user.email,
      email: session.user.email,
    },
  };
}
