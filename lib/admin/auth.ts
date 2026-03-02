import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";

export interface AdminUser {
  uid: string;
  email?: string;
}

export async function requireAdmin(
  req: NextRequest
): Promise<{ user: AdminUser } | { error: NextResponse }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      error: NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 }),
    };
  }

  const token = authHeader.split("Bearer ")[1];
  const adminAuth = getAdminAuth();

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const isAdmin = (decoded.admin as boolean) === true;
    if (!isAdmin) {
      return {
        error: NextResponse.json({ error: "Access denied. Admin required." }, { status: 403 }),
      };
    }
    return {
      user: { uid: decoded.uid, email: decoded.email as string | undefined },
    };
  } catch {
    return {
      error: NextResponse.json(
        { error: "Unauthorized. Invalid or expired token." },
        { status: 401 }
      ),
    };
  }
}
