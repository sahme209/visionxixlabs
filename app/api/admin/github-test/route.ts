/**
 * GET /api/admin/github-test — admin only.
 *
 * Proves the GitHub PAT works by calling /user and /user/repos. Returns
 * the authenticated handle + first 5 repos as proof of read access.
 * Never echoes the token.
 *
 * Reads from GITHUB_PAT (canonical) with GITHUB_TOKEN as a fallback so
 * folks who set the wrong name don't have to redo the work.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const fromPat = process.env.GITHUB_PAT?.trim();
  const fromToken = process.env.GITHUB_TOKEN?.trim();
  const token = fromPat || fromToken;
  const sourceEnvVar = fromPat ? "GITHUB_PAT" : fromToken ? "GITHUB_TOKEN" : null;

  const envDebug = {
    GITHUB_PAT_set: !!fromPat,
    GITHUB_TOKEN_set: !!fromToken,
    sourceEnvVar,
    tokenLength: token?.length ?? 0,
    tokenPrefix: token?.slice(0, 4) ?? "",   // expect "ghp_" or "ghst" or "ghu_"
    tokenHasWhitespace: token ? /\s/.test(token) : false,
    tokenHasQuotes: token ? (token.includes('"') || token.includes("'")) : false,
  };

  if (!token) {
    return NextResponse.json({
      ok: false,
      stage: "env_check",
      reason: "Set GITHUB_PAT (preferred) — canonical name used by the codebase.",
      envDebug,
    });
  }

  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      "User-Agent": "visionxixlabs-admin-test",
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    const meRes = await fetch("https://api.github.com/user", { headers });
    if (!meRes.ok) {
      const body = await meRes.text();
      return NextResponse.json({
        ok: false,
        stage: "user_lookup",
        status: meRes.status,
        reason: body.slice(0, 300),
        envDebug,
      });
    }
    const me = await meRes.json() as { login?: string; type?: string; id?: number };

    const reposRes = await fetch("https://api.github.com/user/repos?per_page=5&sort=updated", { headers });
    const repos = reposRes.ok
      ? (await reposRes.json() as Array<{ full_name?: string; private?: boolean; visibility?: string }>)
      : [];

    return NextResponse.json({
      ok: true,
      stage: "github_authenticated_reads",
      handle: me.login ?? "",
      userId: me.id ?? null,
      accountType: me.type ?? "",
      repoSample: repos.map((r) => ({
        fullName: r.full_name ?? "",
        private: !!r.private,
        visibility: r.visibility ?? "",
      })),
      envDebug,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      stage: "github_fetch",
      reason: msg,
      envDebug,
    });
  }
}
