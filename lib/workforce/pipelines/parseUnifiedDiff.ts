/**
 * Pure unified-diff parser — Phase 388.
 *
 * Phase 380's code_propose returns text containing a unified diff in
 * standard `--- a/path` / `+++ b/path` / `@@ -a,b +c,d @@` format.
 * This module turns that text into a closed-shape FileDiff[] the
 * applier can act on.
 *
 * Handles the three shapes Claude commonly emits:
 *   - Modified file:   `--- a/path` + `+++ b/path`
 *   - New file:        `--- /dev/null` + `+++ b/path` (or `--- a/path` + `+++ b/path` with all `+` lines)
 *   - Deleted file:    `--- a/path` + `+++ /dev/null`
 *
 * Hunks are kept verbatim (raw lines including the leading +/-/space)
 * so the applier can interpret them deterministically.
 *
 * Pure — no I/O. Defensive: malformed input returns { ok: false }
 * rather than throwing.
 */

export type FileChangeKind = "added" | "modified" | "deleted";

export interface FileHunk {
  /** 1-indexed start in the OLD file. */
  oldStart: number;
  oldCount: number;
  /** 1-indexed start in the NEW file. */
  newStart: number;
  newCount: number;
  /** Raw hunk body lines, each prefixed with " " | "+" | "-". */
  lines: ReadonlyArray<string>;
}

export interface FileDiff {
  path: string;
  changeKind: FileChangeKind;
  hunks: ReadonlyArray<FileHunk>;
}

export type ParseDiffResult =
  | { ok: true; files: ReadonlyArray<FileDiff> }
  | { ok: false; reason: "no_diff_block" | "malformed_header" | "malformed_hunk_header"; detail: string };

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Extract the unified diff blocks from a free-form text response.
 * Claude often wraps the diff in fenced code blocks (```diff ...```);
 * we strip those and accept either fenced or bare.
 */
function extractDiffBody(text: string): string {
  // Prefer the first ``` ... ``` block when present.
  const fence = text.match(/```(?:diff|patch)?\n([\s\S]*?)```/);
  if (fence) return fence[1];
  return text;
}

function stripAB(path: string): string {
  if (path.startsWith("a/") || path.startsWith("b/")) return path.slice(2);
  return path;
}

export function parseUnifiedDiff(text: string): ParseDiffResult {
  const body = extractDiffBody(text);
  const lines = body.split("\n");

  const files: FileDiff[] = [];
  let i = 0;

  // Walk forward to the first --- header. Anything before is preamble.
  while (i < lines.length && !lines[i].startsWith("--- ")) i++;

  if (i >= lines.length) {
    return { ok: false, reason: "no_diff_block", detail: "No '--- ' marker found in input." };
  }

  while (i < lines.length) {
    if (!lines[i].startsWith("--- ")) { i++; continue; }
    const oldHeader = lines[i].slice(4).trim();
    if (i + 1 >= lines.length || !lines[i + 1].startsWith("+++ ")) {
      return { ok: false, reason: "malformed_header", detail: `Expected '+++ ' after '--- ' at line ${i}.` };
    }
    const newHeader = lines[i + 1].slice(4).trim();
    i += 2;

    let changeKind: FileChangeKind;
    let path: string;
    if (oldHeader === "/dev/null") {
      changeKind = "added";
      path = stripAB(newHeader);
    } else if (newHeader === "/dev/null") {
      changeKind = "deleted";
      path = stripAB(oldHeader);
    } else {
      changeKind = "modified";
      path = stripAB(newHeader);
    }

    const hunks: FileHunk[] = [];
    while (i < lines.length && lines[i].startsWith("@@")) {
      const m = lines[i].match(HUNK_HEADER);
      if (!m) {
        return { ok: false, reason: "malformed_hunk_header", detail: `Bad hunk header at line ${i}: ${lines[i]}` };
      }
      const oldStart = parseInt(m[1], 10);
      const oldCount = m[2] === undefined ? 1 : parseInt(m[2], 10);
      const newStart = parseInt(m[3], 10);
      const newCount = m[4] === undefined ? 1 : parseInt(m[4], 10);
      i += 1;

      const hunkLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith("@@") && !lines[i].startsWith("--- ")) {
        // Allow blank lines inside a hunk (treated as context "").
        if (lines[i].length === 0) {
          hunkLines.push(" ");
          i++;
          continue;
        }
        const c = lines[i][0];
        if (c === " " || c === "+" || c === "-" || c === "\\") {
          // "\ No newline at end of file" is a context line we keep as-is.
          hunkLines.push(lines[i]);
          i++;
        } else {
          // Unexpected character — end of hunk body.
          break;
        }
      }

      hunks.push({ oldStart, oldCount, newStart, newCount, lines: hunkLines });
    }

    files.push({ path, changeKind, hunks });
  }

  return { ok: true, files };
}
