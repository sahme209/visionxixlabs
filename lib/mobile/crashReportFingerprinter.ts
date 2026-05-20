/**
 * Pure mobile crash-report fingerprinter.
 *
 * Folds raw stack traces from iOS / Android into stable group
 * fingerprints so the cockpit shows "this same crash hit 42×"
 * rather than 42 separate rows. The fingerprint hashes the top-N
 * (default 3) stack frames after stripping memory addresses, line
 * numbers, and platform-specific noise.
 *
 * Pure / deterministic. Uses node:crypto for the SHA-1 prefix.
 */

import { createHash } from "node:crypto";

export interface RawCrashFrame {
  /** Function / method symbol. */
  symbol: string;
  /** Optional file path. */
  file?: string;
  /** Optional line / column. */
  line?: number;
}

export interface RawCrashReport {
  id: string;
  /** "ios" | "android" | other. */
  platform: string;
  appVersion: string;
  occurredAtIso: string;
  message: string;
  stackFrames: readonly RawCrashFrame[];
  /** User id or session id — never included in the fingerprint. */
  userIdHash?: string;
}

export interface CrashGroup {
  fingerprint: string;        // 16-char SHA-1 prefix
  representative: RawCrashReport;
  occurrences: number;
  affectedPlatforms: string[];
  affectedAppVersions: string[];
  firstSeen: string;
  lastSeen: string;
}

export interface FingerprintReport {
  totalReports: number;
  groups: CrashGroup[];
}

const ADDR_RE = /0x[0-9a-fA-F]+/g;
const LINE_NUM_RE = /:\d+(:\d+)?$/;
const NOISE_RE = /\s+\+\s+\d+/g; // iOS-style "Symbol + 1234"

function normalizeFrame(frame: RawCrashFrame): string {
  const symbol = frame.symbol
    .replace(ADDR_RE, "")
    .replace(NOISE_RE, "")
    .trim();
  const file = (frame.file ?? "").replace(LINE_NUM_RE, "").trim();
  return file ? `${symbol}@${file}` : symbol;
}

export interface FingerprintOptions {
  topN?: number;             // default 3
}

export function fingerprintCrash(report: RawCrashReport, opts?: FingerprintOptions): string {
  const topN = Math.max(1, Math.min(opts?.topN ?? 3, 10));
  const frames = report.stackFrames.slice(0, topN).map(normalizeFrame);
  const seed = `${report.platform}::${frames.join("|")}`;
  return createHash("sha1").update(seed).digest("hex").slice(0, 16);
}

export function buildCrashGroups(reports: readonly RawCrashReport[], opts?: FingerprintOptions): FingerprintReport {
  const groups = new Map<string, CrashGroup>();

  for (const r of reports) {
    const fp = fingerprintCrash(r, opts);
    const existing = groups.get(fp);
    if (!existing) {
      groups.set(fp, {
        fingerprint: fp,
        representative: r,
        occurrences: 1,
        affectedPlatforms: [r.platform],
        affectedAppVersions: [r.appVersion],
        firstSeen: r.occurredAtIso,
        lastSeen: r.occurredAtIso,
      });
      continue;
    }
    existing.occurrences += 1;
    if (!existing.affectedPlatforms.includes(r.platform)) existing.affectedPlatforms.push(r.platform);
    if (!existing.affectedAppVersions.includes(r.appVersion)) existing.affectedAppVersions.push(r.appVersion);
    if (r.occurredAtIso < existing.firstSeen) existing.firstSeen = r.occurredAtIso;
    if (r.occurredAtIso > existing.lastSeen) existing.lastSeen = r.occurredAtIso;
  }

  const out = [...groups.values()]
    .map((g) => ({
      ...g,
      affectedPlatforms: [...g.affectedPlatforms].sort(),
      affectedAppVersions: [...g.affectedAppVersions].sort(),
    }))
    .sort((a, b) => b.occurrences - a.occurrences);

  return { totalReports: reports.length, groups: out };
}
