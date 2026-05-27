/**
 * GET /api/dashboard/github-installation-status — Phase 502.
 *
 * UI reads this on every relevant page load to decide whether to
 * show the "+ Install GitHub App" CTA or "Connected as …" badge.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildInstallationStatusResponse,
  type GitHubInstallationRepo,
} from "@/lib/releaseops/githubInstallationResponder";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const appSlug = process.env.GITHUB_APP_SLUG ?? "";
  const callbackBaseUrl = process.env.NEXTAUTH_URL ?? "";
  const r = await buildInstallationStatusResponse(
    prisma as unknown as GitHubInstallationRepo,
    ctx.organizationId,
    { appSlug, callbackBaseUrl },
  );
  return NextResponse.json(r.body, { status: r.status });
}
