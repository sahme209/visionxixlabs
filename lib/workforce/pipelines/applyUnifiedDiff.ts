/**
 * Pure unified-diff applier — Phase 388.
 *
 * Given the base content of a file and a list of hunks, produce the
 * new content. Implements just enough of the unified-diff semantics
 * to round-trip Claude's output:
 *
 *   - Context lines (" foo") must match the corresponding base line
 *     verbatim. Mismatch → applyHunks returns { ok: false,
 *     reason: "context_mismatch" }.
 *   - "-" lines remove the next base line (which must equal the
 *     hunk's "-" text minus the prefix).
 *   - "+" lines insert into the new output.
 *   - "\ No newline at end of file" is ignored (we always emit a
 *     trailing newline for changed files).
 *
 * Pure — no I/O. Fully testable.
 */

import type { FileDiff, FileHunk, FileChangeKind } from "./parseUnifiedDiff";

export type ApplyHunkFailureReason =
  | "context_mismatch"
  | "delete_mismatch"
  | "hunk_overran_base";

export type ApplyHunkResult =
  | { ok: true; newContent: string }
  | { ok: false; reason: ApplyHunkFailureReason; detail: string };

export interface ApplyDiffResultFileEntry {
  path: string;
  changeKind: FileChangeKind;
  newContent: string | null; // null when changeKind="deleted"
}

export type ApplyDiffFailureReason =
  | "missing_base_for_modified"
  | "context_mismatch"
  | "delete_mismatch"
  | "hunk_overran_base"
  | "added_file_with_no_content";

export type ApplyDiffResult =
  | { ok: true; files: ReadonlyArray<ApplyDiffResultFileEntry> }
  | { ok: false; reason: ApplyDiffFailureReason; detail: string };

/** Split content into lines, preserving any trailing empty line. */
function splitLines(content: string): string[] {
  if (content.length === 0) return [];
  // Keep trailing newline behavior: "foo\nbar" → ["foo", "bar"];
  // "foo\nbar\n" → ["foo", "bar", ""]. We use the empty string as
  // a marker for the trailing newline and reattach on join.
  const split = content.split("\n");
  return split;
}

function joinLines(lines: ReadonlyArray<string>): string {
  return lines.join("\n");
}

export function applyHunks(baseContent: string, hunks: ReadonlyArray<FileHunk>): ApplyHunkResult {
  const baseLines = splitLines(baseContent);
  const output: string[] = [];
  // baseIdx is a 0-indexed cursor into baseLines. The first hunk's
  // oldStart is 1-indexed.
  let baseIdx = 0;

  for (const hunk of hunks) {
    const targetBaseIdx = Math.max(0, hunk.oldStart - 1);

    // Copy any base lines before this hunk's start to the output.
    while (baseIdx < targetBaseIdx) {
      if (baseIdx >= baseLines.length) {
        return { ok: false, reason: "hunk_overran_base", detail: `Hunk starts at line ${hunk.oldStart}, base has ${baseLines.length} lines.` };
      }
      output.push(baseLines[baseIdx]);
      baseIdx++;
    }

    // Walk the hunk body line by line.
    for (const raw of hunk.lines) {
      if (raw.length === 0) {
        // Truly empty line — treat as a blank context line.
        if (baseIdx >= baseLines.length || baseLines[baseIdx] !== "") {
          return { ok: false, reason: "context_mismatch", detail: `Expected empty context line at base index ${baseIdx}.` };
        }
        output.push("");
        baseIdx++;
        continue;
      }
      const marker = raw[0];
      const payload = raw.slice(1);

      if (marker === " ") {
        if (baseIdx >= baseLines.length || baseLines[baseIdx] !== payload) {
          return { ok: false, reason: "context_mismatch", detail: `Context at base line ${baseIdx + 1}: expected "${payload}", got "${baseLines[baseIdx] ?? "<EOF>"}".` };
        }
        output.push(baseLines[baseIdx]);
        baseIdx++;
      } else if (marker === "-") {
        if (baseIdx >= baseLines.length || baseLines[baseIdx] !== payload) {
          return { ok: false, reason: "delete_mismatch", detail: `Delete at base line ${baseIdx + 1}: expected "${payload}", got "${baseLines[baseIdx] ?? "<EOF>"}".` };
        }
        baseIdx++;
      } else if (marker === "+") {
        output.push(payload);
      } else if (marker === "\\") {
        // "\ No newline at end of file" — no-op for our line-based model.
        continue;
      } else {
        return { ok: false, reason: "context_mismatch", detail: `Unknown hunk prefix "${marker}".` };
      }
    }
  }

  // Trailing base lines after the last hunk.
  while (baseIdx < baseLines.length) {
    output.push(baseLines[baseIdx]);
    baseIdx++;
  }

  return { ok: true, newContent: joinLines(output) };
}

export interface ApplyDiffInput {
  diff: FileDiff;
  /** Base content; required for "modified" + "deleted", null/undefined for "added". */
  baseContent: string | null;
}

export function applyDiff(input: ApplyDiffInput): { ok: true; entry: ApplyDiffResultFileEntry } | { ok: false; reason: ApplyDiffFailureReason; detail: string } {
  const { diff, baseContent } = input;

  if (diff.changeKind === "deleted") {
    return { ok: true, entry: { path: diff.path, changeKind: "deleted", newContent: null } };
  }

  if (diff.changeKind === "added") {
    if (diff.hunks.length === 0) {
      return { ok: false, reason: "added_file_with_no_content", detail: `New file ${diff.path} has no hunks.` };
    }
    // For added files, sum all '+' lines verbatim. Ignore '\ No newline'.
    const out: string[] = [];
    for (const h of diff.hunks) {
      for (const raw of h.lines) {
        if (raw.length === 0) { out.push(""); continue; }
        if (raw[0] === "+") out.push(raw.slice(1));
        else if (raw[0] === "\\") continue;
        else if (raw[0] === " ") out.push(raw.slice(1));
        // "-" lines should not appear in a new-file diff; skip.
      }
    }
    return { ok: true, entry: { path: diff.path, changeKind: "added", newContent: joinLines(out) } };
  }

  // modified
  if (baseContent === null || baseContent === undefined) {
    return { ok: false, reason: "missing_base_for_modified", detail: `Cannot modify ${diff.path}: base content not supplied.` };
  }
  const r = applyHunks(baseContent, diff.hunks);
  if (!r.ok) {
    return { ok: false, reason: r.reason, detail: r.detail };
  }
  return { ok: true, entry: { path: diff.path, changeKind: "modified", newContent: r.newContent } };
}
