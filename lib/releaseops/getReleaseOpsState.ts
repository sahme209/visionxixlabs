/**
 * ReleaseOps state aggregator.
 *
 * One pure function the ReleaseOps page + Command Center consume. Always
 * available (no missing-config crash): returns preview data + honest
 * source tag when GitHub isn't connected, runs against the live preview
 * sync otherwise.
 */

import "server-only";
import { runPreviewGithubSync } from "@/lib/connectors/github/githubPreviewSync";
import type { GithubPreviewSyncOutcome } from "@/lib/connectors/github/githubPreviewSync";
import { computeReleaseReadiness } from "./releaseReadiness";
import type { ReleaseReadiness } from "./releaseReadiness";
import { getConnectorMode } from "@/lib/config/providerModes";
import type { ProviderMode } from "@/lib/config/providerModes";

export interface ReleaseOpsState {
  /** Honest connector mode. */
  mode: ProviderMode;
  /** Inventory the platform has available right now. */
  inventory: GithubPreviewSyncOutcome;
  /** Composed readiness over the inventory. */
  readiness: ReleaseReadiness;
  /** Honest tag — the platform's GitHub sync mode + preview/live source. */
  source: "live" | "preview";
  /** Safe next action when blockers exist. */
  safeNextAction?: { label: string; href: string };
}

export interface ReleaseOpsStateInput {
  organization?: string;
}

export async function getReleaseOpsState(input: ReleaseOpsStateInput = {}): Promise<ReleaseOpsState> {
  const mode = getConnectorMode("github");
  const inventory = await runPreviewGithubSync({ organization: input.organization ?? "your-org" });
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
    // Until live octokit sync ships, source is preview regardless of mode flag.
    source: "preview",
    safeNextAction: readiness.blockers.length > 0
      ? { label: "Open ReleaseOps", href: "/dashboard/releaseops" }
      : undefined,
  };
}
