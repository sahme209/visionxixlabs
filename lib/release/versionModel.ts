/**
 * Release + version model.
 *
 * Tracks every shippable artefact — the web app + desktop platforms —
 * with explicit signing / notarization status. Powers the download page,
 * trust center release panel, command center release badge, and the
 * future updater channel.
 *
 * Honest by design: an artefact is `released` only if it's actually
 * built + signed. Until signing/notarization ships, all desktop entries
 * stay `planned` or `building`.
 */

export type ReleaseChannel = "dev" | "preview" | "beta" | "stable" | "enterprise";

export type ReleasePlatform = "web" | "macos_arm" | "macos_intel" | "windows" | "linux";

export type ReleaseStatus =
  | "planned"
  | "building"
  | "ready_for_test"
  | "released"
  | "deprecated"
  | "blocked";

export type SigningStatus = "not_signed" | "self_signed" | "signed" | "notarized";

export interface ReleaseVersion {
  id: string;
  /** Semver-style version, e.g. "0.1.0", "1.0.0-rc.1". */
  version: string;
  channel: ReleaseChannel;
  platform: ReleasePlatform;
  status: ReleaseStatus;
  /** Optional commit / build hash. */
  buildHash?: string;
  /** Reference to the artefact (URL or storage path). Never a fake URL — leave undefined when not built. */
  artifactRef?: string;
  /** Generic signing status — used by all platforms. */
  signing: SigningStatus;
  /** macOS notarization (separate from signing). */
  macosNotarization?: "pending" | "notarized" | "rejected";
  /** Windows code-signing detail. */
  windowsSigning?: { certificateType: "ev" | "ov" | "self_signed"; signed: boolean };
  /** Linux package signing — per package type. */
  linuxPackage?: { appimage?: boolean; deb?: boolean; rpm?: boolean };
  /** Release notes (markdown allowed). */
  releaseNotes?: string;
  /** Security notes — included in the trust center bundle. */
  securityNotes?: string;
  /** Minimum desktop version still supported on the active channel. */
  minSupportedVersion?: string;
  createdAt: string;
  releasedAt?: string;
}

// ---------------------------------------------------------------------------
// Current registry — honest state of every shippable artefact
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString();

export const RELEASE_REGISTRY: ReleaseVersion[] = [
  {
    id: "rel.web.live",
    version: "1.0.0",
    channel: "stable",
    platform: "web",
    status: "released",
    artifactRef: "https://visionxixlabs.com",
    signing: "not_signed",      // Web app — TLS only, no binary signing
    createdAt: NOW,
    releasedAt: NOW,
    releaseNotes: "Live web platform. Self-serve sign-in, command center, security/audit/reliability centers, copilot.",
    securityNotes: "Served via Vercel over TLS. NextAuth-issued JWTs. No binary distribution.",
  },
  {
    id: "rel.desktop.macos_arm.preview",
    version: "0.1.0",
    channel: "preview",
    platform: "macos_arm",
    status: "building",
    signing: "not_signed",
    macosNotarization: "pending",
    createdAt: NOW,
    releaseNotes: "Tauri desktop shell preview. Apple Silicon. Not yet distributable.",
    securityNotes:
      "Build pipeline scaffolded; Apple Developer ID signing + notarization required before public " +
      "distribution. Until then, the download page surfaces this as Preview — no fake binary URLs.",
    minSupportedVersion: "0.1.0",
  },
  {
    id: "rel.desktop.macos_intel.preview",
    version: "0.1.0",
    channel: "preview",
    platform: "macos_intel",
    status: "building",
    signing: "not_signed",
    macosNotarization: "pending",
    createdAt: NOW,
    releaseNotes: "Tauri desktop shell preview. Intel macOS. Not yet distributable.",
    securityNotes: "Same signing + notarization gate as Apple Silicon.",
    minSupportedVersion: "0.1.0",
  },
  {
    id: "rel.desktop.windows.preview",
    version: "0.1.0",
    channel: "preview",
    platform: "windows",
    status: "planned",
    signing: "not_signed",
    windowsSigning: { certificateType: "ev", signed: false },
    createdAt: NOW,
    releaseNotes: "Windows Tauri build planned. Awaiting EV code-signing certificate.",
    securityNotes:
      "Windows binaries require EV signing before public distribution. Tracked in the trust center release panel.",
    minSupportedVersion: "0.1.0",
  },
  {
    id: "rel.desktop.linux.preview",
    version: "0.1.0",
    channel: "preview",
    platform: "linux",
    status: "planned",
    signing: "not_signed",
    linuxPackage: { appimage: false, deb: false, rpm: false },
    createdAt: NOW,
    releaseNotes: "Linux AppImage + .deb + .rpm planned. Repo signing pending.",
    securityNotes:
      "Linux distribution requires GPG-signed AppImage + repo signing for .deb/.rpm. None of these " +
      "are in place yet.",
    minSupportedVersion: "0.1.0",
  },
];

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export function releasesByPlatform(platform: ReleasePlatform): ReleaseVersion[] {
  return RELEASE_REGISTRY.filter((r) => r.platform === platform);
}

export function currentRelease(platform: ReleasePlatform): ReleaseVersion | undefined {
  return RELEASE_REGISTRY.filter((r) => r.platform === platform && r.status === "released")
    .sort((a, b) => (b.releasedAt ?? "").localeCompare(a.releasedAt ?? ""))[0];
}

export function liveReleaseCount(): number {
  return RELEASE_REGISTRY.filter((r) => r.status === "released").length;
}

export interface ReleaseSummary {
  platform: ReleasePlatform;
  status: ReleaseStatus;
  channel: ReleaseChannel;
  version: string;
  signing: SigningStatus;
  /** True when the artefact is genuinely ready for end-users to download. */
  publicDistributionReady: boolean;
}

export function platformSummaries(): ReleaseSummary[] {
  const platforms: ReleasePlatform[] = ["web", "macos_arm", "macos_intel", "windows", "linux"];
  return platforms.map((p) => {
    const r = RELEASE_REGISTRY.filter((x) => x.platform === p).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return {
      platform: p,
      status: r?.status ?? "planned",
      channel: r?.channel ?? "preview",
      version: r?.version ?? "0.0.0",
      signing: r?.signing ?? "not_signed",
      publicDistributionReady: Boolean(r && r.status === "released" && (p === "web" || r.signing === "signed" || r.signing === "notarized")),
    };
  });
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export const PLATFORM_LABEL: Record<ReleasePlatform, string> = {
  web:         "Web app",
  macos_arm:   "macOS · Apple Silicon",
  macos_intel: "macOS · Intel",
  windows:     "Windows",
  linux:       "Linux",
};

export const STATUS_LABEL: Record<ReleaseStatus, string> = {
  planned:        "Planned",
  building:       "Building",
  ready_for_test: "Ready for test",
  released:       "Released",
  deprecated:     "Deprecated",
  blocked:        "Blocked",
};

export const SIGNING_LABEL: Record<SigningStatus, string> = {
  not_signed:  "Not signed",
  self_signed: "Self-signed",
  signed:      "Signed",
  notarized:   "Signed + notarized",
};

export const CHANNEL_LABEL: Record<ReleaseChannel, string> = {
  dev:        "Dev",
  preview:    "Preview",
  beta:       "Beta",
  stable:     "Stable",
  enterprise: "Enterprise",
};
