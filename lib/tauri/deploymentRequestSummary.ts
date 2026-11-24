import { z } from "zod";

const count = z.number().int().nonnegative();
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const instant = z.string().datetime();

export const savedReleaseLocatorSchema = z.object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,160}$/),
    version,
});

const releaseContextSummarySchema = z.object({
    batches: z.object({ selectedRunCount: count }).strict().optional(),
    window: z.object({ startUtc: z.string(), endUtc: z.string(), displayTimeZone: z.string() }).strict().nullable(),
    scope: z.object({
        applicationCount: count,
        repositoryCount: count,
        targetEnvironment: z.string().nullable(),
        githubRepositories: z.array(z.string()).optional(),
        changeNotApplicable: z.literal(true).optional(),
    }).strict(),
    approval: z.object({ prStatus: z.string(), noPrRequired: z.boolean() }).strict(),
    readiness: z.object({
        developmentReady: z.boolean(),
        productionReady: z.boolean(),
        validationStepCount: count,
        deferredValidation: z.boolean(),
        approvalDecision: z.enum(["ready_for_human_approval", "needs_attention"]),
        blockers: z.array(z.string()),
    }).strict(),
    recovery: z.object({ rollbackAvailability: z.string(), backupRequired: z.boolean(), evidenceCount: count }).strict(),
    observation: z.object({ status: z.literal("not_connected"), recordedMonitoringPlan: z.boolean() }).strict(),
}).strict();

export const deploymentRequestSummarySchema = savedReleaseLocatorSchema.extend({
    title: z.string(),
    status: z.string(),
    correlationId: z.string(),
    requesterName: z.string().trim().min(1).max(160).optional(),
    submittedAt: instant.nullable(),
    closedAt: instant.nullable(),
    updatedAt: instant,
    releaseContext: releaseContextSummarySchema,
    latestPlaybook: z.object({
        id: z.string(),
        version,
        status: z.string(),
        contentHash: z.string(),
        createdAt: instant,
    }).strict().nullable(),
}).strict();

export type DeploymentRequestSummary = z.infer<typeof deploymentRequestSummarySchema>;
export type ReleaseContextSummary = z.infer<typeof releaseContextSummarySchema>;
