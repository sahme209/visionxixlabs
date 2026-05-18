/**
 * GitHub deeper posture extractor.
 *
 * Pulls multiple read-only GitHub REST surfaces per allowlisted repo:
 *   - Open pull requests (status + age + reviewer)
 *   - Dependabot alerts (open vulnerabilities)
 *   - Code scanning alerts (CodeQL)
 *   - Branch protection on the default branch
 *
 * Hard rules:
 *   - Only runs when GitHub mode = live + GITHUB_DEEP_POSTURE_ENABLED.
 *   - Allowlist via GITHUB_ACTIONS_REPOS (reused — same scope).
 *   - 8s per-call timeout.
 *   - Per-repo failures degrade gracefully.
 *   - Never modifies a PR / alert / protection rule.
 */

import "server-only";

import { createGithubClient } from "./githubLiveClient";
import { loadAppEnv } from "@/lib/config/env";

export type GithubAlertSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface GithubPullRequestPosture {
  repo: string;
  number: number;
  title: string;
  state: "open";
  author?: string;
  reviewersRequested: number;
  reviewsApprovedCount: number;
  createdAt: string;
  updatedAt: string;
  ageDays: number;
  draft: boolean;
  htmlUrl: string;
}

export interface GithubVulnerabilityAlert {
  repo: string;
  number: number;
  severity: GithubAlertSeverity;
  packageName?: string;
  cveIds: string[];
  summary: string;
  state: "open" | "dismissed" | "auto_dismissed" | "fixed";
  createdAt: string;
  htmlUrl: string;
}

export interface GithubCodeScanAlert {
  repo: string;
  number: number;
  severity: GithubAlertSeverity;
  rule: string;
  description: string;
  state: "open" | "dismissed" | "fixed";
  createdAt: string;
  htmlUrl: string;
}

export interface GithubBranchProtectionPosture {
  repo: string;
  branch: string;
  enabled: boolean;
  requirePullRequest: boolean;
  requiredApprovingReviewCount?: number;
  requireSignedCommits: boolean;
  requireStatusChecksToPass: boolean;
  requireConversationResolution: boolean;
  enforceAdmins: boolean;
  /** Honest gaps — names of protections that aren't on. */
  gaps: string[];
}

export interface GithubDeepPostureExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  pullRequests: GithubPullRequestPosture[];
  vulnerabilityAlerts: GithubVulnerabilityAlert[];
  codeScanAlerts: GithubCodeScanAlert[];
  branchProtection: GithubBranchProtectionPosture[];
  durationMs: number;
  limitations: string[];
}

const DEFAULT_TIMEOUT_MS = 8_000;

export async function extractGithubDeepPosture(): Promise<GithubDeepPostureExtraction> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.githubDeepPostureEnabled) {
    return blocked(start, "GITHUB_DEEP_POSTURE_ENABLED is not set — extractor skipped.");
  }
  if (env.githubSyncMode !== "live") {
    return preview(start, "GitHub mode is not live.");
  }
  const repos = resolveRepoAllowlist();
  if (repos.length === 0) {
    return blocked(start, "GITHUB_ACTIONS_REPOS allowlist is empty.");
  }

  const client = createGithubClient();
  if (!client.available) {
    return blocked(start, "GitHub client unavailable.");
  }

  const prs: GithubPullRequestPosture[] = [];
  const vulns: GithubVulnerabilityAlert[] = [];
  const codeScans: GithubCodeScanAlert[] = [];
  const protections: GithubBranchProtectionPosture[] = [];
  const limitations: string[] = [];
  const now = Date.now();

  for (const slug of repos) {
    const [owner, repo] = slug.split("/");
    if (!owner || !repo) continue;
    const encOwner = encodeURIComponent(owner);
    const encRepo = encodeURIComponent(repo);

    // Open PRs
    {
      const r = await client.get<GhPullRequest[]>(
        `/repos/${encOwner}/${encRepo}/pulls?state=open&per_page=30`,
        { timeoutMs: DEFAULT_TIMEOUT_MS },
      );
      if (r.ok && r.data) {
        for (const p of r.data) {
          const created = p.created_at ?? new Date().toISOString();
          prs.push({
            repo: slug,
            number: p.number,
            title: p.title ?? "",
            state: "open",
            author: p.user?.login,
            reviewersRequested: (p.requested_reviewers?.length ?? 0) + (p.requested_teams?.length ?? 0),
            reviewsApprovedCount: 0, // would require a second per-PR call
            createdAt: created,
            updatedAt: p.updated_at ?? created,
            ageDays: Math.floor((now - new Date(created).getTime()) / 86_400_000),
            draft: !!p.draft,
            htmlUrl: p.html_url ?? "",
          });
        }
      } else if (!r.ok) {
        limitations.push(`${slug} PRs: ${r.errorKind ?? "error"}`);
      }
    }

    // Dependabot alerts
    {
      const r = await client.get<GhDependabotAlert[]>(
        `/repos/${encOwner}/${encRepo}/dependabot/alerts?state=open&per_page=50`,
        { timeoutMs: DEFAULT_TIMEOUT_MS },
      );
      if (r.ok && r.data) {
        for (const a of r.data) {
          vulns.push({
            repo: slug,
            number: a.number,
            severity: mapSeverity(a.security_vulnerability?.severity ?? a.security_advisory?.severity),
            packageName: a.dependency?.package?.name,
            cveIds: a.security_advisory?.cve_id ? [a.security_advisory.cve_id] : (a.security_advisory?.identifiers ?? []).map((i) => i.value).filter(Boolean) as string[],
            summary: a.security_advisory?.summary ?? "Dependabot alert",
            state: (a.state as GithubVulnerabilityAlert["state"]) ?? "open",
            createdAt: a.created_at ?? new Date().toISOString(),
            htmlUrl: a.html_url ?? "",
          });
        }
      } else if (!r.ok && r.errorKind !== "not_found") {
        limitations.push(`${slug} Dependabot: ${r.errorKind ?? "error"}`);
      }
    }

    // Code scanning alerts
    {
      const r = await client.get<GhCodeScanAlert[]>(
        `/repos/${encOwner}/${encRepo}/code-scanning/alerts?state=open&per_page=50`,
        { timeoutMs: DEFAULT_TIMEOUT_MS },
      );
      if (r.ok && r.data) {
        for (const a of r.data) {
          codeScans.push({
            repo: slug,
            number: a.number,
            severity: mapSeverity(a.rule?.security_severity_level ?? a.rule?.severity),
            rule: a.rule?.id ?? a.rule?.name ?? "rule",
            description: a.rule?.description ?? a.most_recent_instance?.message?.text ?? "",
            state: (a.state as GithubCodeScanAlert["state"]) ?? "open",
            createdAt: a.created_at ?? new Date().toISOString(),
            htmlUrl: a.html_url ?? "",
          });
        }
      } else if (!r.ok && r.errorKind !== "not_found") {
        limitations.push(`${slug} CodeQL: ${r.errorKind ?? "error"}`);
      }
    }

    // Branch protection — try common default branch names
    for (const branch of ["main", "master"]) {
      const r = await client.get<GhBranchProtection>(
        `/repos/${encOwner}/${encRepo}/branches/${branch}/protection`,
        { timeoutMs: DEFAULT_TIMEOUT_MS },
      );
      if (r.ok && r.data) {
        const p = r.data;
        const gaps: string[] = [];
        const requirePR = !!p.required_pull_request_reviews;
        const requireStatus = !!p.required_status_checks;
        const requireSigned = !!p.required_signatures?.enabled;
        const requireConv = !!p.required_conversation_resolution?.enabled;
        const enforceAdmins = !!p.enforce_admins?.enabled;
        if (!requirePR) gaps.push("no required PR review");
        if ((p.required_pull_request_reviews?.required_approving_review_count ?? 0) < 1) gaps.push("no required approving review count");
        if (!requireStatus) gaps.push("no required status checks");
        if (!requireSigned) gaps.push("no signed commits requirement");
        if (!requireConv) gaps.push("no conversation resolution requirement");
        if (!enforceAdmins) gaps.push("admins not subject to protections");
        protections.push({
          repo: slug,
          branch,
          enabled: true,
          requirePullRequest: requirePR,
          requiredApprovingReviewCount: p.required_pull_request_reviews?.required_approving_review_count,
          requireSignedCommits: requireSigned,
          requireStatusChecksToPass: requireStatus,
          requireConversationResolution: requireConv,
          enforceAdmins,
          gaps,
        });
        break;
      } else if (r.errorKind === "not_found") {
        // Try next branch name; if both fail, record the gap.
        continue;
      } else {
        limitations.push(`${slug} branch protection: ${r.errorKind ?? "error"}`);
        break;
      }
    }
    if (!protections.find((p) => p.repo === slug)) {
      protections.push({
        repo: slug,
        branch: "main",
        enabled: false,
        requirePullRequest: false,
        requireSignedCommits: false,
        requireStatusChecksToPass: false,
        requireConversationResolution: false,
        enforceAdmins: false,
        gaps: ["branch protection not configured on main/master"],
      });
    }
  }

  return {
    mode: "live",
    pullRequests: prs,
    vulnerabilityAlerts: vulns,
    codeScanAlerts: codeScans,
    branchProtection: protections,
    durationMs: Date.now() - start,
    limitations,
  };
}

// ---------------------------------------------------------------------------
// Types for vendor payloads
// ---------------------------------------------------------------------------

interface GhPullRequest {
  number: number;
  title?: string;
  user?: { login?: string };
  state?: string;
  requested_reviewers?: unknown[];
  requested_teams?: unknown[];
  created_at?: string;
  updated_at?: string;
  draft?: boolean;
  html_url?: string;
}

interface GhDependabotAlert {
  number: number;
  state?: string;
  created_at?: string;
  html_url?: string;
  dependency?: { package?: { name?: string } };
  security_advisory?: {
    cve_id?: string;
    summary?: string;
    severity?: string;
    identifiers?: { value?: string }[];
  };
  security_vulnerability?: { severity?: string };
}

interface GhCodeScanAlert {
  number: number;
  state?: string;
  created_at?: string;
  html_url?: string;
  rule?: { id?: string; name?: string; description?: string; severity?: string; security_severity_level?: string };
  most_recent_instance?: { message?: { text?: string } };
}

interface GhBranchProtection {
  required_pull_request_reviews?: { required_approving_review_count?: number };
  required_status_checks?: unknown;
  required_signatures?: { enabled?: boolean };
  required_conversation_resolution?: { enabled?: boolean };
  enforce_admins?: { enabled?: boolean };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapSeverity(v: string | undefined): GithubAlertSeverity {
  switch ((v ?? "").toLowerCase()) {
    case "critical": return "critical";
    case "high":     return "high";
    case "medium":   return "medium";
    case "moderate": return "medium";
    case "low":      return "low";
    default:         return "info";
  }
}

function resolveRepoAllowlist(): string[] {
  const raw = process.env.GITHUB_ACTIONS_REPOS?.trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function preview(start: number, note: string): GithubDeepPostureExtraction {
  return { mode: "preview", pullRequests: [], vulnerabilityAlerts: [], codeScanAlerts: [], branchProtection: [], durationMs: Date.now() - start, limitations: [note] };
}

function blocked(start: number, note: string): GithubDeepPostureExtraction {
  return { mode: "blocked", pullRequests: [], vulnerabilityAlerts: [], codeScanAlerts: [], branchProtection: [], durationMs: Date.now() - start, limitations: [note] };
}
