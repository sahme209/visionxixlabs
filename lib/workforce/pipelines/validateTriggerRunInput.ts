/**
 * Pure validator for the v1 pipeline-trigger payload — Phase 396.
 *
 * External clients POST { pipelineId, instruction, repoRef, branchHint? }
 * to /api/v1/pipelines/runs. This kernel:
 *
 *   1. Validates each field structurally (types, lengths, allowed values).
 *   2. Returns either a normalized typed payload OR a closed-union
 *      `TriggerValidationFailure` so the route can render a specific
 *      400 with a machine-readable `error` field.
 *
 * Lives separate from the route so the route is 15 lines of glue and
 * the validation matrix is testable in isolation.
 *
 * Pure — no Prisma, no I/O.
 */

import { parseRepoRef } from "./parseRepoRef";

const PIPELINE_ID_RE = /^[a-z][a-z0-9_]{2,63}$/;
const MAX_INSTRUCTION_LENGTH = 4_000;
const MAX_BRANCH_HINT_LENGTH = 256;
const MAX_METADATA_KEYS = 10;
const MAX_METADATA_VALUE_LENGTH = 1_000;

export type TriggerValidationFailureKind =
  | "missing_pipeline_id"
  | "invalid_pipeline_id_format"
  | "missing_instruction"
  | "instruction_too_long"
  | "missing_repo_ref"
  | "invalid_repo_ref"
  | "branch_hint_too_long"
  | "metadata_not_object"
  | "metadata_too_many_keys"
  | "metadata_value_too_long";

export interface TriggerValidationFailure {
  ok: false;
  error: TriggerValidationFailureKind;
  message: string;
  field?: string;
}

export interface ValidatedTriggerInput {
  ok: true;
  pipelineId: string;
  instruction: string;
  repoRef: string;
  branchHint: string | null;
  /** Operator-supplied K/V metadata to round-trip through the run. */
  metadata: Record<string, string>;
}

export type TriggerValidationResult = ValidatedTriggerInput | TriggerValidationFailure;

function fail(error: TriggerValidationFailureKind, message: string, field?: string): TriggerValidationFailure {
  return { ok: false, error, message, ...(field ? { field } : {}) };
}

export function validateTriggerRunInput(raw: unknown): TriggerValidationResult {
  if (raw === null || typeof raw !== "object") {
    return fail("missing_pipeline_id", "Request body must be a JSON object.");
  }
  const body = raw as Record<string, unknown>;

  // pipelineId
  if (typeof body.pipelineId !== "string" || body.pipelineId.length === 0) {
    return fail("missing_pipeline_id", "Field `pipelineId` is required.", "pipelineId");
  }
  if (!PIPELINE_ID_RE.test(body.pipelineId)) {
    return fail(
      "invalid_pipeline_id_format",
      "Field `pipelineId` must match /^[a-z][a-z0-9_]{2,63}$/.",
      "pipelineId",
    );
  }

  // instruction
  if (typeof body.instruction !== "string" || body.instruction.trim().length === 0) {
    return fail("missing_instruction", "Field `instruction` is required.", "instruction");
  }
  if (body.instruction.length > MAX_INSTRUCTION_LENGTH) {
    return fail(
      "instruction_too_long",
      `Field \`instruction\` exceeds the ${MAX_INSTRUCTION_LENGTH}-char limit.`,
      "instruction",
    );
  }

  // repoRef
  if (typeof body.repoRef !== "string" || body.repoRef.length === 0) {
    return fail("missing_repo_ref", "Field `repoRef` is required.", "repoRef");
  }
  if (!parseRepoRef(body.repoRef)) {
    return fail("invalid_repo_ref", "Field `repoRef` could not be parsed as `owner/repo`.", "repoRef");
  }

  // branchHint
  let branchHint: string | null = null;
  if (body.branchHint !== undefined && body.branchHint !== null) {
    if (typeof body.branchHint !== "string") {
      return fail("branch_hint_too_long", "Field `branchHint` must be a string.", "branchHint");
    }
    if (body.branchHint.length > MAX_BRANCH_HINT_LENGTH) {
      return fail(
        "branch_hint_too_long",
        `Field \`branchHint\` exceeds the ${MAX_BRANCH_HINT_LENGTH}-char limit.`,
        "branchHint",
      );
    }
    branchHint = body.branchHint.length > 0 ? body.branchHint : null;
  }

  // metadata — operator-supplied K/V the producer round-trips into the
  // run row so a webhook listener can correlate the run back to its
  // originating context (e.g., the CI job that triggered it).
  const metadata: Record<string, string> = {};
  if (body.metadata !== undefined && body.metadata !== null) {
    if (typeof body.metadata !== "object" || Array.isArray(body.metadata)) {
      return fail("metadata_not_object", "Field `metadata` must be a flat object.", "metadata");
    }
    const entries = Object.entries(body.metadata as Record<string, unknown>);
    if (entries.length > MAX_METADATA_KEYS) {
      return fail(
        "metadata_too_many_keys",
        `Field \`metadata\` has ${entries.length} keys; max allowed ${MAX_METADATA_KEYS}.`,
        "metadata",
      );
    }
    for (const [k, v] of entries) {
      const sv = typeof v === "string" ? v : v == null ? "" : String(v);
      if (sv.length > MAX_METADATA_VALUE_LENGTH) {
        return fail(
          "metadata_value_too_long",
          `metadata.${k} exceeds the ${MAX_METADATA_VALUE_LENGTH}-char limit.`,
          `metadata.${k}`,
        );
      }
      metadata[k] = sv;
    }
  }

  return {
    ok: true,
    pipelineId: body.pipelineId,
    instruction: body.instruction.trim(),
    repoRef: body.repoRef,
    branchHint,
    metadata,
  };
}
