/**
 * Pure body parser for the coding-task start endpoint — Phase 379.
 *
 * Validates the operator's request: instruction, repo target,
 * optional branch hint. Caps lengths so we never write a multi-MB
 * instruction into the DB. Lives separate from the route's auth +
 * Prisma so the matrix can be unit-tested.
 */

export interface CodingTaskInput {
  instruction: string;
  repoRef: string;
  branchHint: string | null;
}

export type ParseCodingTaskResult =
  | { ok: true; input: CodingTaskInput }
  | { ok: false; reason: "invalid_body"; detail: string };

const INSTRUCTION_MAX = 4000;
const REPO_MAX = 200;
const BRANCH_MAX = 200;
const REPO_PATTERN = /^[a-z0-9][a-z0-9_\-./]{0,198}[a-z0-9]$/i;
const BRANCH_PATTERN = /^[a-z0-9][a-z0-9_\-./]{0,198}$/i;

export function parseCodingTaskBody(raw: unknown): ParseCodingTaskResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "invalid_body", detail: "Body must be a JSON object." };
  }
  const b = raw as Record<string, unknown>;

  const instruction = b.instruction;
  if (typeof instruction !== "string" || instruction.trim().length < 5 || instruction.length > INSTRUCTION_MAX) {
    return { ok: false, reason: "invalid_body", detail: `instruction must be 5–${INSTRUCTION_MAX} chars.` };
  }

  const repoRefRaw = b.repoRef;
  if (typeof repoRefRaw !== "string") {
    return { ok: false, reason: "invalid_body", detail: "repoRef must be a string." };
  }
  const repoRef = repoRefRaw.trim();
  if (repoRef.length === 0 || repoRef.length > REPO_MAX || !REPO_PATTERN.test(repoRef)) {
    return { ok: false, reason: "invalid_body", detail: "repoRef must match /[a-z0-9][a-z0-9_\\-./]*[a-z0-9]/i and be ≤200 chars." };
  }

  let branchHint: string | null = null;
  if (b.branchHint !== undefined && b.branchHint !== null && b.branchHint !== "") {
    if (typeof b.branchHint !== "string" || b.branchHint.length > BRANCH_MAX || !BRANCH_PATTERN.test(b.branchHint)) {
      return { ok: false, reason: "invalid_body", detail: `branchHint must match /[a-z0-9][a-z0-9_\\-./]*/i and be ≤${BRANCH_MAX} chars.` };
    }
    branchHint = b.branchHint;
  }

  return {
    ok: true,
    input: {
      instruction: instruction.trim(),
      repoRef,
      branchHint,
    },
  };
}
