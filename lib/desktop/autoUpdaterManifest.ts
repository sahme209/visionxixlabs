/**
 * Pure desktop auto-updater manifest builder.
 *
 * Emits per-OS manifest blobs the desktop shell hosts at a stable
 * URL (e.g. https://updates.visionxixlabs.com/{os}/latest.json).
 * Squirrel.Mac / Squirrel.Windows / generic / Electron-updater all
 * parse JSON; we pick a sane shared shape.
 *
 * Pure / deterministic. Caller supplies signed-asset URLs + sha256s.
 */

import type { DesktopOs } from "./platformCapabilities";

export interface ReleaseArtifact {
  os: Exclude<DesktopOs, "unknown">;
  /** Full download URL. */
  url: string;
  /** SHA-256 hex of the artifact for integrity checks. */
  sha256: string;
  /** Code-signing fingerprint, when applicable. */
  signature?: string;
  /** Size in bytes. */
  sizeBytes: number;
}

export interface ReleaseInput {
  version: string;             // "1.4.0" semver
  releasedAtIso: string;
  releaseNotes: string;        // markdown, ≤ 5_000 chars
  artifacts: readonly ReleaseArtifact[];
  /** Optional minimum supported version. Clients older than this MUST update. */
  minSupportedVersion?: string;
}

export interface UpdateManifest {
  schema: "axiom.desktop.update_manifest";
  schemaVersion: 1;
  version: string;
  releasedAtIso: string;
  releaseNotes: string;
  /** Per-OS artifact slot; null when unavailable. */
  artifacts: Record<Exclude<DesktopOs, "unknown">, ReleaseArtifact | null>;
  minSupportedVersion: string | null;
}

const MAX_NOTES = 5_000;

const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-.+][0-9A-Za-z.-]+)?$/;

export interface BuildManifestResult {
  manifest: UpdateManifest | null;
  errors: string[];
}

export function buildUpdateManifest(input: ReleaseInput): BuildManifestResult {
  const errors: string[] = [];
  if (!SEMVER_RE.test(input.version)) errors.push("version must be semver");
  if (input.minSupportedVersion && !SEMVER_RE.test(input.minSupportedVersion)) {
    errors.push("minSupportedVersion must be semver");
  }
  if (input.releaseNotes.length > MAX_NOTES) errors.push(`releaseNotes exceeds ${MAX_NOTES} chars`);

  const artifacts: UpdateManifest["artifacts"] = { macos: null, windows: null, linux: null };
  const seen = new Set<string>();
  for (const a of input.artifacts) {
    if (seen.has(a.os)) {
      errors.push(`duplicate artifact for ${a.os}`);
      continue;
    }
    seen.add(a.os);
    if (!/^[a-f0-9]{64}$/.test(a.sha256)) {
      errors.push(`${a.os}: sha256 must be 64-char lowercase hex`);
      continue;
    }
    if (a.sizeBytes <= 0) {
      errors.push(`${a.os}: sizeBytes must be > 0`);
      continue;
    }
    artifacts[a.os] = { ...a };
  }

  if (errors.length > 0) return { manifest: null, errors };

  return {
    manifest: {
      schema: "axiom.desktop.update_manifest",
      schemaVersion: 1,
      version: input.version,
      releasedAtIso: input.releasedAtIso,
      releaseNotes: input.releaseNotes,
      artifacts,
      minSupportedVersion: input.minSupportedVersion ?? null,
    },
    errors: [],
  };
}

export interface UpdateDecisionInput {
  installedVersion: string;
  manifest: UpdateManifest;
  os: DesktopOs;
}

export interface UpdateDecision {
  verdict: "up_to_date" | "update_available" | "must_update" | "unsupported_os";
  reason: string;
  /** Artifact the shell should download when verdict != up_to_date and != unsupported_os. */
  artifact: ReleaseArtifact | null;
}

function compareSemver(a: string, b: string): number {
  // Lightweight numeric comparison on the first 3 fields. Pre-release
  // suffixes are compared lexicographically — good enough for our needs.
  const parse = (s: string): { major: number; minor: number; patch: number; pre: string } => {
    const m = s.match(/^(\d+)\.(\d+)\.(\d+)([-.+][0-9A-Za-z.-]+)?$/);
    if (!m) return { major: 0, minor: 0, patch: 0, pre: "" };
    return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre: m[4] ?? "" };
  };
  const A = parse(a);
  const B = parse(b);
  if (A.major !== B.major) return A.major - B.major;
  if (A.minor !== B.minor) return A.minor - B.minor;
  if (A.patch !== B.patch) return A.patch - B.patch;
  if (A.pre === B.pre) return 0;
  // No-prerelease is greater than a prerelease.
  if (A.pre === "" && B.pre !== "") return 1;
  if (B.pre === "" && A.pre !== "") return -1;
  return A.pre < B.pre ? -1 : 1;
}

export function decideUpdate(input: UpdateDecisionInput): UpdateDecision {
  if (input.os === "unknown") {
    return { verdict: "unsupported_os", reason: "no manifest slot for unknown OS", artifact: null };
  }
  const artifact = input.manifest.artifacts[input.os];
  if (!artifact) {
    return { verdict: "unsupported_os", reason: `no artifact for ${input.os}`, artifact: null };
  }
  const cmp = compareSemver(input.installedVersion, input.manifest.version);
  if (cmp >= 0) return { verdict: "up_to_date", reason: `installed=${input.installedVersion} ≥ manifest=${input.manifest.version}`, artifact: null };

  if (input.manifest.minSupportedVersion
    && compareSemver(input.installedVersion, input.manifest.minSupportedVersion) < 0) {
    return { verdict: "must_update", reason: `installed=${input.installedVersion} < minSupported=${input.manifest.minSupportedVersion}`, artifact };
  }
  return { verdict: "update_available", reason: `${input.manifest.version} available`, artifact };
}
