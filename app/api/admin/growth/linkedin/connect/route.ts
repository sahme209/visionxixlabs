/**
 * GET /api/admin/growth/linkedin/connect
 *
 * Starts the LinkedIn OAuth 2.0 authorization-code flow. Sets a signed
 * state cookie (random nonce) that the callback verifies. Redirects the
 * operator to LinkedIn's consent screen.
 *
 * If LinkedIn env vars aren't configured, returns 503 with `missing[]`
 * so the UI can tell the operator exactly which env vars to set.
 */

import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { requireAdmin } from "@/lib/admin/auth";
import { buildAuthorizeUrl } from "@/lib/growth/linkedin/oauth";
import { writeGrowthAudit } from "@/lib/growth/audit";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "vxl_li_oauth_state";
const STATE_TTL_SECONDS = 600; // 10 minutes

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("error" in gate) return gate.error;

  const state = randomBytes(24).toString("hex");
  const built = buildAuthorizeUrl(state);
  if (built.kind === "missing") {
    return NextResponse.json(
      { ok: false, error: "linkedin_not_configured", missing: built.missing },
      { status: 503 },
    );
  }

  await writeGrowthAudit({
    actor: gate.user.email ?? "admin",
    action: "linkedin.connect_initiated",
    targetKind: "linkedin_connection",
  });

  const res = NextResponse.redirect(built.url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });
  return res;
}
