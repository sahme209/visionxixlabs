/**
 * ReleaseOps state aggregator.
 *
 * One pure function the ReleaseOps page + Command Center consume. Always
 * available (no missing-config crash):
 *   - When GitHub is in live mode with a valid PAT, runs the live scanner.
 *     If the live scan partially fails (e.g. permission on branch
 *     protection), the source is marked "partial" with limitations.
 *   - Falls back to preview sync when live is unavailable or fails.
 *
 * Honest source-tagging: `source` is always one of "live", "partial",
 * "preview", or "disabled" — never fabricated.
 */

import "server-only";

import { runPreviewGithubSync } from "@/lib/connectors/github/githubPreviewSync";
import type { GithubPreviewSyncOutcome } from "@/lib/connectors/github/githubPreviewSync";
import { runLiveGithubSync, type GithubLiveSyncOutcome } from "@/lib/connectors/github/githubLiveScanner";
import { getGithubMode } from "@/lib/connectors/github/githubLiveClient";
import { computeReleaseReadiness } from "./releaseReadiness";
import type { ReleaseReadiness } from "./releaseReadiness";
import { getConnectorMode } from "@/lib/config/providerModes";
import type { ProviderMode } from "@/lib/config/providerModes";
import { loadAppEnv } from "@/lib/config/env";

export type ReleaseOpsSourceMode = "live" | "partial" | "preview" | "disabled";

export interface ReleaseOpsState {
  /** Honest connector mode. */
  mode: ProviderMode;
  /** Inventory the platform has available right now. */
  inventory: GithubPreviewSyncOutcome;
  /** Composed readiness over the inventory. */
  readiness: ReleaseReadiness;
  /** Honest tag. */
  source: ReleaseOpsSourceMode;
  /** Live scan limitations (only set when source === "live" or "partial"). */
  limitations: string[];
  /** Authenticated login for the credential that produced the live data. */
  authenticatedLogin?: string;
  /** When the live scan was performed (ISO). */
  syncedAt?: string;
  /** Safe next action when blockers exist. */
  safeNextAction?: { label: string; href: string };
}

export interface ReleaseOpsStateInput {
  organization?: string;
  /** Force preview even when live is configured (used by audit replay). */
  forcePreview?: boolean;
  /** Max repos to discover in a live scan. Default: scanner default (30). */
  maxRepos?: number;
}

export async function getReleaseOpsState(input: ReleaseOpsStateInput = {}): Promise<ReleaseOpsState> {
  const env = loadAppEnv();
  const mode = getConnectorMode("github");
  const organization = input.organization ?? env.githubDefaultOrg ?? "your-org";

  if (mode === "disabled") {
    return disabledState(mode, organization);
  }

  // Live attempt first when configured.
  if (!input.forcePreview && getGithubMode() === "live") {
    try {
      const live: GithubLiveSyncOutcome = await runLiveGithubSync({
        organization,
        maxRepos: input.maxRepos,
      });
      if (live.repos.length > 0) {
        const readiness = computeReleaseReadiness({
          repos: live.repos,
          workflows: live.workflows,
          protections: live.protections,
          lastSyncAt: new Date().toISOString(),
        });
        return {
          mode,
          inventory: { repos: live.repos, workflows: live.workflows, protections: live.protections, durationMs: live.durationMs },
          readiness,
          source: live.source === "live" ? "live" : "partial",
          limitations: live.limitations,
          authenticatedLogin: live.authenticatedLogin,
          syncedAt: new Date().toISOString(),
          safeNextAction: readiness.blockers.length > 0
            ? { label: "Open ReleaseOps", href: "/dashboard/releaseops" }
            : undefined,
        };
      }
      // Live returned empty — fall through to preview but capture limitations.
      const preview = await runPreviewGithubSync({ organization });
      const readiness = computeReleaseReadiness({
        repos: preview.repos,
        workflows: preview.workflows,
        protections: preview.protections,
        lastSyncAt: new Date().toISOString(),
      });
      return {
        mode,
        inventory: preview,
        readiness,
        source: "preview",
        limitations: [
          "Live GitHub scan returned no repositories.",
          ...live.limitations,
        ],
        safeNextAction: { label: "Open ReleaseOps", href: "/dashboard/releaseops" },
      };
    } catch (err) {
      // Live scan crashed — fall back to preview with an honest note.
      const message = err instanceof Error ? err.message : String(err);
      return await previewStateWithLimitation(mode, organization, [`Live GitHub scan failed: ${message}`]);
    }
  }

  // Preview path (default).
  return await previewStateWithLimitation(mode, organization, []);
}

async function previewStateWithLimitation(
  mode: ProviderMode,
  organization: string,
  limitations: string[],
): Promise<ReleaseOpsState> {
  const inventory = await runPreviewGithubSync({ organization });
  const readiness = computeReleaseReadiness({
    repos: inventory.repos,
    workflows: inventory.workflows,
    protections: inventory.protections,
    lastSyncAt: new Date().toISOString(),
  });
  return {
    mode,
    inventory,
    readiness,
    source: "preview",
    limitations,
    safeNextAction: readiness.blockers.length > 0
      ? { label: "Open ReleaseOps", href: "/dashboard/releaseops" }
      : undefined,
  };
}

function disabledState(mode: ProviderMode, organization: string): ReleaseOpsState {
  return {
    mode,
    inventory: { repos: [], workflows: [], protections: [], durationMs: 0 },
    readiness: {
      score: 0,
      grade: "F",
      totalRepos: 0,
      totalWorkflows: 0,
      failingWorkflows: 0,
      weakProtections: 0,
      blockers: [],
      summary: `ReleaseOps disabled for "${organization}". Enable GITHUB_SYNC_MODE to view release telemetry.`,
    },
    source: "disabled",
    limitations: ["GitHub sync is disabled on this deployment."],
    safeNextAction: { label: "Open connector docs", href: "/docs/connectors" },
  };
}
