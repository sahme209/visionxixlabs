/**
 * Structural Stabilization: fullPayload schema validation.
 * On write: validate and throw structured error if invalid.
 * On read: gracefully fallback if legacy record.
 * Do NOT enforce strict migration — schema is permissive.
 */

import { z } from "zod";

/** Permissive schema for axiomScores (numeric and string fields) */
export const axiomScoresSchema = z
  .object({
    infrastructureScore: z.number().optional(),
    estimatedAnnualSavings: z.number().nullable().optional(),
    riskExposureLevel: z.string().optional(),
    deploymentFrictionIndex: z.number().optional(),
    complexityTier: z.string().optional(),
    automationReadinessScore: z.number().optional(),
    strategicReadinessScore: z.number().optional(),
    enterpriseReadinessIndex: z.number().optional(),
  })
  .passthrough();

/** Permissive schema for engine metadata */
export const engineSchema = z
  .object({
    scoringVersion: z.string().optional(),
    outputStatus: z.string().optional(),
    engineName: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

/** Permissive schema for axiomResult (scores, plan, driftSignals, etc.) */
export const axiomResultSchema = z
  .object({
    scores: axiomScoresSchema.optional(),
    plan: z.record(z.string(), z.unknown()).optional(),
    driftSignals: z.unknown().optional(),
    dealSignals: z.unknown().optional(),
    playbooks: z.unknown().optional(),
    quality: z.unknown().optional(),
    policyPack: z.unknown().optional(),
    explainability: z.unknown().optional(),
    strategicBrief: z.unknown().optional(),
  })
  .passthrough();

/** Permissive schema for fullPayload context */
export const fullPayloadContextSchema = z
  .object({
    source: z.string().optional(),
    tier: z.string().optional(),
  })
  .passthrough();

/** Permissive fullPayload schema — validates core structure only */
export const fullPayloadSchema = z
  .object({
    context: fullPayloadContextSchema.optional(),
    engine: engineSchema.optional(),
    axiomResult: axiomResultSchema.optional(),
    axiomScores: axiomScoresSchema.optional(),
    scoringVersion: z.string().optional(),
  })
  .passthrough();

export type FullPayloadValidated = z.infer<typeof fullPayloadSchema>;

/**
 * Validate fullPayload on write. Throws structured ZodError if invalid.
 */
export function validateFullPayloadOnWrite(
  payload: unknown
): asserts payload is FullPayloadValidated {
  fullPayloadSchema.parse(payload);
}

/**
 * Safe parse fullPayload on read. Returns validated or null for legacy records.
 */
export function parseFullPayloadOnRead(
  payload: unknown
): FullPayloadValidated | null {
  const result = fullPayloadSchema.safeParse(payload);
  return result.success ? result.data : null;
}
