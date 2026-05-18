/**
 * Desktop Release Management Center builder.
 *
 * Pure read-only composition over:
 *   - getDesktopReleaseManifest()  → live GH-API per-asset release state
 *   - buildDistributionTable()     → per-platform distribution gate checklist
 *   - currentRelease(platform)     → per-platform signing/notarization registry
 *   - loadAppEnv()                 → DESKTOP_HANDOFF_SIGNING_KEY / DESKTOP_MODE
 *
 * Never publishes, never edits the registry. The center is a *review*
 * surface — the actual publish path is CI from a tagged commit.
 */

import "server-only";

import { getDesktopReleaseManifest, type DesktopPlatform } from "./releaseManifest";
import { buildDistributionTable } from "./desktopDistribution";
import { currentRelease, type ReleasePlatform } from "@/lib/release/versionModel";
import { loadAppEnv } from "@/lib/config/env";

import type { OrganizationId, UserId } from "@/lib/domain/ids";
import type {
  DesktopReleaseChannel,
  DesktopReleaseGate,
  DesktopReleaseGateStatus,
  DesktopReleasePlatformEntry,
  DesktopReleaseReport,
  DesktopReleaseSourceMode,
  DesktopReleaseSummary,
} from "./desktopReleaseModel";
import { PLATFORM_LABEL } from "./desktopReleaseModel";

export interface BuildDesktopReleaseInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

const ALL_PLATFORMS: DesktopPlatform[] = ["macos-arm", "macos-intel", "windows-x64", "linux-x64"];

export async function buildDesktopReleaseReport(input: BuildDesktopReleaseInput): Promise<DesktopReleaseReport> {
  const env = loadAppEnv();
  const [manifest] = await Promise.all([
    getDesktopReleaseManifest(),
  ]);
  const distribution = buildDistributionTable();

  // ---------------------------------------------------------------------------
  // Per-platform entries
  // ---------------------------------------------------------------------------
  const platforms: DesktopReleasePlatformEntry[] = ALL_PLATFORMS.map((p) => {
    const asset = manifest.assets[p];
    const distroEntry = distribution.find((d) => mapReleasePlatform(d.platform) === p);
    const registry = currentRelease(mapToRegistryPlatform(p));

    const state: DesktopReleasePlatformEntry["state"] = asset
      ? "live"
      : distroEntry?.state === "blocked"
        ? "blocked"
        : distroEntry?.state === "planned"
          ? "planned"
          : "preview";

    return {
      platform: p,
      label: PLATFORM_LABEL[p],
      state,
      liveVersion: asset ? manifest.tag?.replace(/^desktop-v?/, "") : distroEntry?.liveVersion,
      channel: (registry?.channel ?? "preview") as DesktopReleaseChannel,
      assetFileName: asset?.fileName,
      downloadUrl: asset?.downloadUrl,
      sizeBytes: asset?.sizeBytes,
      signed: Boolean(asset?.signed),
      notarized: Boolean(asset?.notarized),
      installFriction: asset?.installFriction ?? defaultFriction(p),
      gates: buildPlatformGates(p, Boolean(asset), Boolean(asset?.signed), Boolean(asset?.notarized), env),
    };
  });

  // ---------------------------------------------------------------------------
  // Global gates (cross-platform)
  // ---------------------------------------------------------------------------
  const signingKeyOk = env.desktopHandoffSigningKeySet;
  const downloadsEnabled = env.desktopDownloadsEnabled;
  const hasAnyAsset = manifest.hasAnyAsset;
  const allSignedNotarized = manifest.allSignedAndNotarized;

  const globalGates: DesktopReleaseGate[] = [
    {
      id: "signing_key_configured",
      label: "Handoff signing key configured",
      description: "DESKTOP_HANDOFF_SIGNING_KEY backs signed handoffs to the desktop runtime.",
      status: signingKeyOk ? "passing" : "preview",
      reason: signingKeyOk
        ? "Environment variable present — handoffs sign with the dedicated key."
        : "Falling back to NEXTAUTH_SECRET for handoff signing.",
      evidenceRef: "lib/config/env.ts:desktopHandoffSigningKeySet",
      nextFix: signingKeyOk ? undefined : "Set DESKTOP_HANDOFF_SIGNING_KEY on Vercel (≥32 bytes random).",
    },
    {
      id: "distribution_published",
      label: "Public distribution published",
      description: "Latest desktop-v* tag has at least one release asset on the public release repo.",
      status: hasAnyAsset ? "passing" : "preview",
      reason: hasAnyAsset
        ? `Active tag ${manifest.tag} — ${countAssets(manifest.assets)} asset${countAssets(manifest.assets) === 1 ? "" : "s"} attached.`
        : (manifest.note ?? "No published desktop release yet."),
      evidenceRef: "lib/desktop/releaseManifest.ts:getDesktopReleaseManifest",
      nextFix: hasAnyAsset ? undefined : "Tag a `desktop-v*` commit on the release repo; CI attaches binaries.",
    },
    {
      id: "code_signed",
      label: "Every published asset code-signed",
      description: "All published macOS / Windows assets must carry valid signatures before public download.",
      status: hasAnyAsset && allSignedNotarized ? "passing" : hasAnyAsset ? "partial" : "preview",
      reason: hasAnyAsset
        ? allSignedNotarized
          ? "Every published asset is signed (and macOS assets are notarized)."
          : "Published assets exist but at least one is unsigned. Install friction expected."
        : "No published assets to sign yet.",
      evidenceRef: "lib/desktop/releaseManifest.ts:signedFlag",
      nextFix: allSignedNotarized
        ? undefined
        : "Wire APPLE_DEVELOPER_ID + Windows EV cert secrets into the release workflow.",
    },
    {
      id: "auto_update_channel",
      label: "Auto-update channel wired",
      description: "Tauri/MSI/AppImage updater channel pointing at the release repo.",
      status: hasAnyAsset && allSignedNotarized ? "partial" : "planned",
      reason: "Updater backend planned — operators install fresh from /download until then.",
      evidenceRef: "desktop/tauri/updater (planned)",
      nextFix: "Add `updater` block in tauri.conf.json + sign update bundles from release repo.",
    },
    {
      id: "min_version_enforced",
      label: "Minimum version enforced",
      description: "The runtime refuses to operate below the tenant-configured min version.",
      status: hasAnyAsset ? "passing" : "preview",
      reason: hasAnyAsset
        ? "Desktop runtime checks minRequiredVersion on boot; out-of-date shells move to needs_update."
        : "No version to enforce yet.",
      evidenceRef: "lib/desktop/desktopShellState.ts:DesktopRuntimeState",
    },
    {
      id: "rollback_plan",
      label: "Per-release rollback plan",
      description: "Every release tag retains prior release tag as the documented rollback target.",
      status: hasAnyAsset ? "passing" : "preview",
      reason: hasAnyAsset
        ? "GitHub Releases keeps every prior tag — operator can re-download an earlier asset directly."
        : "No prior tag to roll back to yet.",
      evidenceRef: "lib/release/versionModel.ts:RELEASE_REGISTRY",
    },
    {
      id: "release_notes_published",
      label: "Release notes published",
      description: "Operator-readable notes attached to the active release.",
      status: hasAnyAsset ? "passing" : "preview",
      reason: hasAnyAsset
        ? "Active tag body acts as the operator-facing release notes."
        : "No notes yet — first published release will include them.",
      evidenceRef: manifest.htmlUrl ?? "GitHub releases page",
    },
  ];

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const summary: DesktopReleaseSummary = {
    totalPlatforms: platforms.length,
    liveCount:     platforms.filter((p) => p.state === "live").length,
    previewCount:  platforms.filter((p) => p.state === "preview").length,
    plannedCount:  platforms.filter((p) => p.state === "planned").length,
    blockedCount:  platforms.filter((p) => p.state === "blocked").length,
    signedCount:   platforms.filter((p) => p.signed).length,
    notarizedCount: platforms.filter((p) => p.notarized).length,
    allSignedAndNotarized: allSignedNotarized,
    latestTag: manifest.tag,
    latestPublishedAt: manifest.publishedAt,
    latestHtmlUrl: manifest.htmlUrl,
  };

  // ---------------------------------------------------------------------------
  // Honest limitations
  // ---------------------------------------------------------------------------
  const limitations: string[] = [];
  if (!hasAnyAsset) limitations.push("No published desktop assets — center renders the gate checklist pending CI publish.");
  if (!allSignedNotarized && hasAnyAsset) limitations.push("Some assets are unsigned — operators will see install friction.");
  if (!signingKeyOk) limitations.push("DESKTOP_HANDOFF_SIGNING_KEY not set — handoffs fall back to NEXTAUTH_SECRET.");
  if (!downloadsEnabled) limitations.push("DESKTOP_DOWNLOADS_ENABLED is false — /download surfaces preview UI until flipped on.");
  if (manifest.note) limitations.push(manifest.note);

  const safeNextAction: { label: string; href: string } = hasAnyAsset
    ? { label: "Open the public release page", href: manifest.htmlUrl ?? "/download" }
    : { label: "Open the desktop install page", href: "/download" };

  const sourceMode: DesktopReleaseSourceMode = hasAnyAsset ? "live" : "preview";

  return {
    generatedAt: manifest.generatedAt,
    tenantId: String(input.tenantId),
    sourceMode,
    platforms,
    globalGates,
    summary,
    safetyContract: "release_review_only_no_publish",
    limitations,
    safeNextAction,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPlatformGates(
  p: DesktopPlatform,
  hasAsset: boolean,
  signed: boolean,
  notarized: boolean,
  env: ReturnType<typeof loadAppEnv>,
): DesktopReleaseGate[] {
  const gates: DesktopReleaseGate[] = [];

  gates.push({
    id: "binary_built",
    label: "Binary built",
    description: "CI built an asset for this platform and attached it to the latest release tag.",
    status: hasAsset ? "passing" : "preview",
    reason: hasAsset ? "Asset attached to the latest release tag." : "No asset attached yet — build pipeline scaffolded.",
    evidenceRef: "lib/desktop/releaseManifest.ts:fetchLatestRelease",
  });

  if (p === "macos-arm" || p === "macos-intel") {
    gates.push({
      id: "code_signed",
      label: "Apple Developer ID signed",
      description: "macOS Gatekeeper requires Apple Developer ID code-signing.",
      status: signed ? "passing" : hasAsset ? "blocked" : "preview",
      reason: signed
        ? "Asset is Developer ID signed."
        : hasAsset
          ? "Asset present but no Developer ID signature detected."
          : "No asset to sign yet.",
      evidenceRef: "release workflow APPLE_DEVELOPER_ID + APPLE_API_KEY secrets",
      nextFix: signed ? undefined : "Add APPLE_DEVELOPER_ID + APPLE_API_KEY + APPLE_API_ISSUER secrets to the release workflow.",
    });
    gates.push({
      id: "notarized",
      label: "Notarized + stapled",
      description: "macOS notarytool submission completes + stapler embeds the ticket.",
      status: notarized ? "passing" : signed ? "partial" : hasAsset ? "blocked" : "preview",
      reason: notarized
        ? "Notarytool ticket stapled."
        : signed
          ? "Signed but not yet notarized — Gatekeeper still warns."
          : hasAsset
            ? "Cannot notarize an unsigned asset."
            : "No asset to notarize yet.",
      evidenceRef: "release workflow notarytool step",
      nextFix: notarized ? undefined : "Run notarytool submit --wait + xcrun stapler staple on the .dmg in CI.",
    });
  }

  if (p === "windows-x64") {
    gates.push({
      id: "code_signed",
      label: "EV code signing",
      description: "SmartScreen / Defender reputation requires EV code signing on Windows.",
      status: signed ? "passing" : hasAsset ? "blocked" : "preview",
      reason: signed
        ? "MSI signed with EV cert."
        : hasAsset
          ? "Asset present but no signature detected."
          : "No asset to sign yet.",
      evidenceRef: "release workflow WINDOWS_EV_CERT secret",
      nextFix: signed ? undefined : "Add WINDOWS_EV_CERT + WINDOWS_EV_PASSWORD secrets + signtool step.",
    });
  }

  if (p === "linux-x64") {
    gates.push({
      id: "code_signed",
      label: "Package signed (GPG / AppImage)",
      description: ".deb / .rpm / .AppImage signed with the maintainer GPG key.",
      status: signed ? "passing" : hasAsset ? "partial" : "preview",
      reason: signed
        ? "Package signed with maintainer key."
        : hasAsset
          ? "Asset present but no signature attached — operators can verify via SHA-256."
          : "No asset to sign yet.",
      evidenceRef: "release workflow GPG_PRIVATE_KEY secret",
      nextFix: signed ? undefined : "Add GPG_PRIVATE_KEY + sign output package in CI.",
    });
  }

  gates.push({
    id: "distribution_published",
    label: "Published to release repo",
    description: "The asset is downloadable from the public release page.",
    status: hasAsset ? "passing" : "preview",
    reason: hasAsset ? "Public download URL active." : "Awaiting first published release.",
    evidenceRef: "GitHub releases page",
  });

  gates.push({
    id: "signing_key_configured",
    label: "Handoff signing key (shared)",
    description: "Desktop signed handoffs need DESKTOP_HANDOFF_SIGNING_KEY.",
    status: env.desktopHandoffSigningKeySet ? "passing" : "preview",
    reason: env.desktopHandoffSigningKeySet ? "Key present." : "Falling back to NEXTAUTH_SECRET.",
    evidenceRef: "lib/config/env.ts:desktopHandoffSigningKeySet",
  });

  return gates;
}

function mapReleasePlatform(p: ReleasePlatform): DesktopPlatform | null {
  switch (p) {
    case "macos_arm":   return "macos-arm";
    case "macos_intel": return "macos-intel";
    case "windows":     return "windows-x64";
    case "linux":       return "linux-x64";
    default:            return null;
  }
}

function mapToRegistryPlatform(p: DesktopPlatform): ReleasePlatform {
  switch (p) {
    case "macos-arm":   return "macos_arm";
    case "macos-intel": return "macos_intel";
    case "windows-x64": return "windows";
    case "linux-x64":   return "linux";
  }
}

function countAssets(assets: Record<DesktopPlatform, unknown | null>): number {
  return Object.values(assets).filter((a) => a !== null).length;
}

function defaultFriction(p: DesktopPlatform): string {
  switch (p) {
    case "macos-arm":   return "macOS requires Developer ID signing + notarization before Gatekeeper accepts the install.";
    case "macos-intel": return "macOS requires Developer ID signing + notarization before Gatekeeper accepts the install.";
    case "windows-x64": return "Windows SmartScreen warns on unsigned installers until an EV cert ships.";
    case "linux-x64":   return "Linux packages can be downloaded once signed — SHA-256 verification ships in release notes.";
  }
}
