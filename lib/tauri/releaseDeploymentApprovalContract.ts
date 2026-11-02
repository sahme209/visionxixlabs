import {z} from 'zod';
import {deploymentPlanSchema} from './releaseDeploymentExecutionContract';
/** Display evidence only. Current server authority is required to issue approval. */
export const releaseDeploymentApprovalPreviewSchema=z.object({
 plan:deploymentPlanSchema,
 planDigest:z.string().regex(/^[a-f0-9]{64}$/),
 canApprove:z.boolean(),
 executionAvailable:z.literal(false),
 governanceBaselineDigest:z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict();
export type ReleaseDeploymentApprovalPreview=z.infer<typeof releaseDeploymentApprovalPreviewSchema>;
