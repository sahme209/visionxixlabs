/**
 * GET /api/github/deep-posture
 *
 * Returns the GithubDeepPostureExtraction — PRs, Dependabot alerts,
 * code scanning alerts, branch protection. extractGithubDeepPosture()
 * takes no tenant parameter at all: it scans a single, operator-
 * configured GITHUB_ACTIONS_REPOS allowlist (the platform's own repos),
 * not anything owned by the calling tenant. It must stay admin-only —
 * a plain `isAuthenticated` check would hand every paying customer the
 * same internal posture data about repos they have no relationship to.
 */

import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { extractGithubDeepPosture } from "@/lib/connectors/github/githubDeepPostureExtractor";
import { apiOk, apiErr, resolveCorrelationId } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;
    const result = await extractGithubDeepPosture();
    return apiOk(result, { correlationId, safetyContract: "axiom_os_state_read_only" });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "axiom_os_state_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
