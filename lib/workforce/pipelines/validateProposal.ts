/**
 * Pure proposal validator — Phase 390.
 *
 * Runs the parse + sample-apply checks the refinement planner needs
 * to decide whether to ship or retry. Pure — the caller supplies the
 * (path, baseContent) tuples for modified files. The validator runs
 * the same parseUnifiedDiff + applyDiff pipeline the real PR opener
 * (Phase 388) uses, but only against the sampled bases — never
 * against the real GitHub state. This keeps the validator cheap and
 * pure.
 *
 * Returns a structured report with per-file errors so the
 * refinement prompt builder can hand specific feedback to Claude.
 */

import { parseUnifiedDiff } from "./parseUnifiedDiff";
import { applyDiff } from "./applyUnifiedDiff";

export interface SampledBaseFile {
  path: string;
  /** null when the file doesn't exist (new-file diff target). */
  content: string | null;
}

export interface ValidateProposalInput {
  proposedPatchText: string;
  /** Base content for any modified files. New + deleted files don't need entries here. */
  sampledBases: ReadonlyArray<SampledBaseFile>;
}

export interface FileValidation {
  path: string;
  changeKind: "added" | "modified" | "deleted";
  ok: boolean;
  /** Failure reason when ok=false. */
  reason?: string;
  /** Detail when ok=false. */
  detail?: string;
}

export type ParseFailureReason =
  | "no_diff_block"
  | "malformed_header"
  | "malformed_hunk_header";

export interface ValidateProposalResult {
  parseOk: boolean;
  parseFailureReason: ParseFailureReason | null;
  parseFailureDetail: string | null;
  /** Empty when parseOk=false. */
  files: ReadonlyArray<FileValidation>;
  /** True when every file with a supplied base applied cleanly (or had no base needed). */
  applyOk: boolean;
}

export function validateProposal(input: ValidateProposalInput): ValidateProposalResult {
  const parsed = parseUnifiedDiff(input.proposedPatchText);
  if (!parsed.ok) {
    return {
      parseOk: false,
      parseFailureReason: parsed.reason,
      parseFailureDetail: parsed.detail,
      files: [],
      applyOk: false,
    };
  }

  const baseMap = new Map(input.sampledBases.map((b) => [b.path, b.content] as const));
  const files: FileValidation[] = [];
  let applyOk = true;

  for (const fileDiff of parsed.files) {
    if (fileDiff.changeKind === "deleted") {
      files.push({ path: fileDiff.path, changeKind: "deleted", ok: true });
      continue;
    }

    const base = fileDiff.changeKind === "modified" ? baseMap.get(fileDiff.path) : null;

    // If the operator only sampled some files, missing bases for the
    // others are not a hard failure — we can't validate them, but we
    // don't penalize either. Skip with ok=true so the planner ships
    // unless any sampled file genuinely failed.
    if (fileDiff.changeKind === "modified" && base === undefined) {
      files.push({ path: fileDiff.path, changeKind: "modified", ok: true, reason: "not_sampled", detail: "No base sampled — skipped." });
      continue;
    }

    const applied = applyDiff({ diff: fileDiff, baseContent: base ?? null });
    if (!applied.ok) {
      applyOk = false;
      files.push({
        path: fileDiff.path,
        changeKind: fileDiff.changeKind,
        ok: false,
        reason: applied.reason,
        detail: applied.detail,
      });
    } else {
      files.push({ path: fileDiff.path, changeKind: fileDiff.changeKind, ok: true });
    }
  }

  return {
    parseOk: true,
    parseFailureReason: null,
    parseFailureDetail: null,
    files,
    applyOk,
  };
}
