/**
 * Desktop distribution control.
 *
 * Honest single source of truth for what the download page, command
 * center, and trust center say about whether a desktop platform is
 * available, what version it's at, and whether the artefact has been
 * signed/notarized.
 *
 * No fake download URLs. When a platform is preview/planned/blocked, the
 * UI surfaces the state — never a button to a URL that 404s.
 */

import { platformSummaries, currentRelease, type ReleasePlatform, type ReleaseSummary } from "@/lib/release/versionModel";

export type DistributionState =
  | "live"          // Public, signed, downloadable
  | "preview"       // Internal/preview build, not publicly downloadable
  | "planned"       // Roadmap — no artefact exists yet
  | "blocked"       // Distribution paused (e.g. signing certificate expired)
  | "deprecated";   // Old version, kept for visibility only

export interface DistributionPlatform {
  platform: ReleasePlatform;
  state: DistributionState;
  /** Single-line headline for the download page tile. */
  headline: string;
  /** Slightly longer detail rendered as the tile sub-label. */
  detail: string;
  /** Optional CTA href — only set when there's a real action. */
  cta?: { label: string; href: string };
  /** Honest checklist of what still has to land before public distribution. */
  gateChecklist: { label: string; ok: boolean; detail?: string }[];
  /** Version the user would actually receive if `state === "live"`. */
  liveVersion?: string;
  /** Channel currently active for this platform. */
  channel: ReleaseSummary["channel"];
}

// ---------------------------------------------------------------------------
// Build distribution state from the release registry
// ---------------------------------------------------------------------------

export function buildDistributionTable(): DistributionPlatform[] {
  return platformSummaries().map((s) => {
    if (s.platform === "web") {
      return {
        platform: s.platform,
        state: "live",
        headline: "Explore the website sandbox",
        detail: "Fictional sample data only. Production operations require the installed application.",
        cta: { label: "Open sandbox", href: "/demo" },
        gateChecklist: [{ label: "Public origin", ok: true, detail: "https://visionxixlabs.com" }],
        liveVersion: s.version,
        channel: s.channel,
      };
    }
    const release = currentRelease(s.platform);
    const channel = s.channel;
    if (s.publicDistributionReady && release) {
      return {
        platform: s.platform,
        state: "live",
        headline: `Download ${humanise(s.platform)}`,
        detail: `${release.version} · ${channel}`,
        cta: { label: `Download ${humanise(s.platform)}`, href: release.artifactRef ?? "/download/preview" },
        gateChecklist: buildChecklist(s, true),
        liveVersion: release.version,
        channel,
      };
    }
    // Preview / planned — route the user to the honest preview page.
    return {
      platform: s.platform,
      state: s.status === "planned" ? "planned" : "preview",
      headline: humaniseHeadline(s),
      detail: humaniseDetail(s),
      cta: { label: "Join preview", href: `/download/preview?platform=${platformToQuery(s.platform)}` },
      gateChecklist: buildChecklist(s, false),
      channel,
    };
  });
}

function humanise(p: ReleasePlatform): string {
  switch (p) {
    case "web":         return "Website sandbox";
    case "macos_arm":   return "macOS · Apple Silicon";
    case "macos_intel": return "macOS · Intel";
    case "windows":     return "Windows";
    case "linux":       return "Linux";
  }
}

function humaniseHeadline(s: ReleaseSummary): string {
  if (s.status === "planned") return `${humanise(s.platform)} — planned`;
  return `${humanise(s.platform)} preview`;
}

function humaniseDetail(s: ReleaseSummary): string {
  if (s.status === "planned") return "On the roadmap. Binaries arrive once signing is in place.";
  return "Build pipeline scaffolded. Signed + notarized binaries ship with 1.0.";
}

function platformToQuery(p: ReleasePlatform): string {
  return p.replace("_", "-");
}

function buildChecklist(s: ReleaseSummary, distributable: boolean): { label: string; ok: boolean; detail?: string }[] {
  const out: { label: string; ok: boolean; detail?: string }[] = [];
  out.push({ label: "Build pipeline", ok: s.status !== "planned" && s.status !== "blocked", detail: s.status });
  if (s.platform.startsWith("macos")) {
    out.push({ label: "Apple Developer ID signing", ok: s.signing === "signed" || s.signing === "notarized" });
    out.push({ label: "Notarization", ok: s.signing === "notarized" });
  } else if (s.platform === "windows") {
    out.push({ label: "EV code signing", ok: s.signing === "signed" || s.signing === "notarized" });
  } else if (s.platform === "linux") {
    out.push({ label: "AppImage / .deb / .rpm signing", ok: s.signing === "signed" });
  }
  out.push({ label: "Public distribution ready", ok: distributable });
  return out;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const DISTRIBUTION_STATE_LABEL: Record<DistributionState, string> = {
  live:       "Live",
  preview:    "Preview",
  planned:    "Planned",
  blocked:    "Blocked",
  deprecated: "Deprecated",
};

export function distributionSemantic(state: DistributionState): "success" | "warning" | "neutral" | "error" {
  switch (state) {
    case "live":       return "success";
    case "preview":    return "warning";
    case "planned":    return "neutral";
    case "blocked":    return "error";
    case "deprecated": return "neutral";
  }
}
