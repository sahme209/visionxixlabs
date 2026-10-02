/**
 * GET /api/dashboard/github-installation-status — Phase 502.
 *
 * UI reads this on every relevant page load to decide whether GitHub App
 * installation is configured and whether an installation is active. The
 * one-time browser handoff itself starts only from the explicit POST route.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildInstallationStatusResponse,
  type GitHubInstallationRepo,
} from "@/lib/releaseops/githubInstallationResponder";
import { getGithubConfig, isGithubAppInstallationReady } from "@/lib/connectors/github/githubConfig";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const config = getGithubConfig();
  const appSlug = isGithubAppInstallationReady(config, process.env.GITHUB_APP_SLUG)
    ? (process.env.GITHUB_APP_SLUG ?? "")
    : "";
  const r = await buildInstallationStatusResponse(
    prisma as unknown as GitHubInstallationRepo,
    ctx.organizationId,
    { appSlug },
  );
  return NextResponse.json(r.body, { status: r.status });
}
