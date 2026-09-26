import { z } from "zod";
import type { DeploymentIntake } from "./deploymentOperations";

const checklistItemSchema = z.object({
    id: z.string().trim().min(1),
    instruction: z.string().trim().min(1),
    owner: z.string().trim().min(1),
    evidenceRequired: z.boolean(),
    completed: z.boolean(),
    validationInstruction: z.string().trim().min(1).optional(),
});

const sourcedFactSchema = z.object({
    id: z.string().trim().min(1),
    classification: z.enum([
        "confirmed", "decided", "proposed", "issue",
        "resolution", "open_item", "tbd",
    ]),
    value: z.string().trim().min(1),
    sourceEvidenceId: z.string().trim().min(1),
    confirmedBy: z.string().trim().min(1).optional(),
});

export const deploymentIntakeSchema = z.object({
    id: z.string().trim().min(1),
    tenantId: z.string().trim().min(1),
    title: z.string().trim().min(1),
    serviceImpactingNow: z.boolean(),
    requestClass: z.enum([
        "planned_biweekly_release", "planned_release", "ad_hoc",
        "emergency", "maintenance", "other",
    ]),
    adHocReason: z.string().optional(),
    adHocPriority: z.string().optional(),
    businessImpact: z.string().optional(),
    scheduleExceptionReason: z.string().optional(),
    windowStartUtc: z.string().trim().min(1),
    windowEndUtc: z.string().trim().min(1),
    displayTimeZone: z.enum(["ET", "CT", "MT", "PT", "UTC", "Other"]),
    changeTypes: z.array(z.enum([
        "enhancement", "new_feature", "new_client_implementation",
        "configuration_change", "infrastructure_change", "database_change",
        "security_image_refresh", "credential_rotation", "workflow_change",
        "manual_configuration", "bug_fix", "other",
    ])).min(1),
    applications: z.array(z.string().trim().min(1)).min(1),
    clients: z.array(z.string().trim().min(1)).min(1),
    deploymentContact: z.string().trim().min(1),
    repositoryUrls: z.array(z.string().url()).min(1),
    productionPrUrls: z.array(z.string().url()),
    noPrRequired: z.boolean(),
    prApprovalStatus: z.enum(["approved", "pending", "not_applicable"]),
    sourceBranch: z.string(),
    targetBranch: z.string(),
    deploymentMethod: z.string(),
    workflowName: z.string(),
    targetEnvironment: z.string(),
    workflowInputs: z.record(z.string(), z.string()),
    manualSteps: z.array(checklistItemSchema),
    lowerEnvironmentTested: z.array(z.string().trim().min(1)),
    lowerEnvironmentValidation: z.enum(["yes", "no", "not_applicable"]),
    developmentReady: z.boolean(),
    productionReady: z.boolean(),
    validationSteps: z.array(checklistItemSchema),
    expectedProductionResult: z.string(),
    validationOwner: z.enum([
        "devops", "application_team", "shared", "l1", "dba", "other",
    ]),
    deferredValidation: z.object({
        reason: z.string(),
        trigger: z.string(),
        expectedDateUtc: z.string(),
        owner: z.string(),
        monitoringPlan: z.string(),
    }).optional(),
    rollbackAvailability: z.enum(["yes", "no", "not_applicable"]),
    rollbackSteps: z.array(checklistItemSchema),
    rollbackOwner: z.string().optional(),
    backupRequired: z.boolean(),
    backupEvidenceIds: z.array(z.string().trim().min(1)),
    changeCreationMethod: z.enum([
        "rca_workflow", "dbployer_automatic", "manual_servicenow",
        "existing_change", "not_applicable", "other",
    ]),
    applicationContact: z.string(),
    escalationContact: z.string(),
    facts: z.array(sourcedFactSchema),
}).strict();

export type IntakeParseResult =
    | { ok: true; intake: DeploymentIntake }
    | {
        ok: false;
        issues: Array<{ field: string; message: string }>;
    };

export function parseDeploymentIntake(value: unknown): IntakeParseResult {
    const result = deploymentIntakeSchema.safeParse(value);
    if (result.success) {
        return { ok: true, intake: result.data };
    }
    return {
        ok: false,
        issues: result.error.issues.map((issue) => ({
            field: issue.path.join(".") || "body",
            message: issue.message,
        })),
    };
}
