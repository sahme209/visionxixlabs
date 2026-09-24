/**
 * Desktop Release Manifest.
 *
 * Resolves the latest published Axiom Agent desktop release from GitHub
 * Releases. Returns a typed per-platform download manifest the /download
 * page reads from so the UI flips from "preview" to "available" the
 * moment CI publishes a tagged release.
 *
 * Honest about signing — each asset carries its own `signed` /
 * `notarized` flag based on whether the release CI had the cert secrets
 * available. The page surfaces a "one-time install friction" note per
 * platform when an asset is unsigned, never pretending it's signed.
 *
 * Caching: 60-second in-memory cache. The GitHub API endpoint is
 * unauthenticated (public repo), so rate limits are 60/hour per IP.
 */

import "server-only";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DesktopPlatform = "macos-arm" | "macos-intel" | "windows-x64" | "linux-x64";

export interface DesktopAsset {
  platform: DesktopPlatform;
  fileName: string;
  downloadUrl: string;
  sizeBytes: number;
  contentType: string;
  /** True when the asset was code-signed in CI (Apple Developer ID / Windows EV). */
  signed: boolean;
  /** Apple-only — true when notarytool stapled the binary. */
  notarized: boolean;
  /** Honest one-line install friction. */
  installFriction: string;
}

export interface DesktopReleaseManifest {
  /** Honest source — "github_release" when found, "none" when no release yet. */
  source: "github_release" | "none";
  /** Release tag (e.g. "desktop-v0.1.0"). */
  tag?: string;
  /** Public release page URL. */
  htmlUrl?: string;
  /** Release publish time. */
  publishedAt?: string;
  /** Per-platform availability — populated whether or not asset exists. */
  assets: Record<DesktopPlatform, DesktopAsset | null>;
  /** When false, the download page must stay in preview state. */
  hasAnyAsset: boolean;
  /** True when every platform has a signed + notarized asset. */
  allSignedAndNotarized: boolean;
  /** When fetched. */
  generatedAt: string;
  /** Optional note for the UI (rate limit, error, etc). */
  note?: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// The public repo where release binaries live. The main `visionxixlabs`
// repo is private; only release artefacts are mirrored here so the
// /download page can serve unauthenticated public downloads.
const REPO_OWNER = process.env.AXIOM_DESKTOP_REPO_OWNER ?? "sahme209";
const REPO_NAME  = process.env.AXIOM_DESKTOP_REPO_NAME  ?? "axiom-releases";
const TAG_PREFIX = "desktop-";
const CACHE_MS   = 60_000;

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

let cached: { manifest: DesktopReleaseManifest; fetchedAt: number } | null = null;

function emptyManifest(note?: string): DesktopReleaseManifest {
  return {
    source: "none",
    assets: {
      "macos-arm":   null,
      "macos-intel": null,
      "windows-x64": null,
      "linux-x64":   null,
    },
    hasAnyAsset: false,
    allSignedAndNotarized: false,
    generatedAt: new Date().toISOString(),
    note,
  };
}

// ---------------------------------------------------------------------------
// Platform classification per file name
// ---------------------------------------------------------------------------

function classifyAsset(name: string): DesktopPlatform | null {
  const n = name.toLowerCase();
  if (/(aarch64|arm64).*\.(dmg|app\.tar\.gz)$/.test(n) || /\.app\.tar\.gz$/.test(n) && n.includes("aarch64")) return "macos-arm";
  if (/(x86_64|intel|x64).*\.(dmg|app\.tar\.gz)$/.test(n) || /\.dmg$/.test(n) && n.includes("x64"))           return "macos-intel";
  if (/\.dmg$/.test(n) && !n.includes("intel") && !n.includes("aarch") && !n.includes("arm")) return "macos-arm"; // default ARM bundle
  if (/\.msi$/.test(n) || /\.exe$/.test(n))                                                                    return "windows-x64";
  if (/\.appimage$/.test(n) || /\.deb$/.test(n) || /\.rpm$/.test(n))                                            return "linux-x64";
  return null;
}

function frictionFor(platform: DesktopPlatform, signed: boolean, notarized: boolean): string {
  switch (platform) {
    case "macos-arm":
    case "macos-intel":
      if (signed && notarized) return "Signed + notarized. Double-click to install.";
      if (signed)              return "Signed but not notarized — right-click → Open the first time.";
      return "Unsigned developer build — right-click → Open the first time to bypass Gatekeeper.";
    case "windows-x64":
      if (signed) return "Signed with EV certificate. Double-click to install.";
      return "Unsigned developer build — SmartScreen will warn; click 'More info' → 'Run anyway'.";
    case "linux-x64":
      return "Standard Linux install — chmod +x ./Axiom*.AppImage (or use the .deb / .rpm).";
  }
}

// ---------------------------------------------------------------------------
// GitHub release fetch
// ---------------------------------------------------------------------------

interface GhAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

interface GhRelease {
  tag_name: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  assets: GhAsset[];
  body: string;
}

async function fetchLatestRelease(): Promise<DesktopReleaseManifest> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "axiom-release-manifest" },
      // Never use Next caching here — this is a server-side fetch with our
      // own 60s cache. Caching twice would lengthen propagation.
      cache: "no-store",
    });
  } catch (err) {
    return emptyManifest(`Unable to reach GitHub: ${String(err).slice(0, 120)}`);
  }

  if (!res.ok) {
    return emptyManifest(`GitHub release lookup returned HTTP ${res.status}.`);
  }

  const releases = (await res.json().catch(() => null)) as GhRelease[] | null;
  if (!Array.isArray(releases)) {
    return emptyManifest("GitHub release lookup returned a non-array response.");
  }

  const desktopReleases = releases.filter((r) =>
    r.tag_name?.startsWith(TAG_PREFIX) && !r.draft,
  );
  if (desktopReleases.length === 0) {
    return emptyManifest("No published desktop release yet. Tag a `desktop-v*` commit to publish.");
  }

  // Most recent published.
  const latest = desktopReleases[0];

  // Trust only explicit machine-readable attestations emitted after the
  // signing steps complete. Prose such as "signed when configured" is not
  // evidence and must never enable a signed/notarized badge.
  const body = latest.body?.toLowerCase() ?? "";
  const signedFlag = body.includes("artifact-signed: true");
  const notarizedFlag = body.includes("artifact-notarized: true");

  const assets: DesktopReleaseManifest["assets"] = {
    "macos-arm":   null,
    "macos-intel": null,
    "windows-x64": null,
    "linux-x64":   null,
  };

  const assetPreference = (platform: DesktopPlatform, fileName: string): number => {
    const name = fileName.toLowerCase();
    if (platform === "linux-x64") {
      if (name.endsWith(".appimage")) return 3;
      if (name.endsWith(".deb")) return 2;
      if (name.endsWith(".rpm")) return 1;
    }
    if (platform === "windows-x64") {
      if (name.endsWith(".msi")) return 2;
      if (name.endsWith(".exe")) return 1;
    }
    return 1;
  };

  for (const a of latest.assets ?? []) {
    const platform = classifyAsset(a.name);
    if (!platform) continue;
    const current = assets[platform];
    if (current && assetPreference(platform, current.fileName) >= assetPreference(platform, a.name)) continue;
    const signed = signedFlag && (platform === "macos-arm" || platform === "macos-intel" || platform === "windows-x64");
    const notarized = notarizedFlag && (platform === "macos-arm" || platform === "macos-intel");
    assets[platform] = {
      platform,
      fileName: a.name,
      downloadUrl: a.browser_download_url,
      sizeBytes: a.size,
      contentType: a.content_type,
      signed,
      notarized,
      installFriction: frictionFor(platform, signed, notarized),
    };
  }

  const hasAnyAsset = Object.values(assets).some((a) => a !== null);
  // This aggregate is intentionally strict: missing platforms, unsigned Linux
  // artifacts, unsigned Windows installers, or unnotarized macOS bundles all
  // keep the global badge false. Per-platform badges remain available above.
  const allSignedAndNotarized = Object.values(assets).every(
    (a) => a !== null && a.signed && (!a.platform.startsWith("macos-") || a.notarized),
  );

  return {
    source: "github_release",
    tag: latest.tag_name,
    htmlUrl: latest.html_url,
    publishedAt: latest.published_at,
    assets,
    hasAnyAsset,
    allSignedAndNotarized,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getDesktopReleaseManifest(): Promise<DesktopReleaseManifest> {
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_MS) {
    return cached.manifest;
  }
  const manifest = await fetchLatestRelease();
  cached = { manifest, fetchedAt: now };
  return manifest;
}

/** Get the recommended asset for the operator's detected platform. */
export function pickPreferred(manifest: DesktopReleaseManifest, platform: DesktopPlatform): DesktopAsset | null {
  return manifest.assets[platform];
}

export const PLATFORM_LABEL: Record<DesktopPlatform, string> = {
  "macos-arm":   "macOS · Apple Silicon",
  "macos-intel": "macOS · Intel",
  "windows-x64": "Windows · x64",
  "linux-x64":   "Linux · x64",
};
