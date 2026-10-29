import {z} from 'zod';
import {slackNotificationIntentSchema} from './slackNotificationContract';
export {SLACK_NOTIFICATION_APPROVAL_KIND} from './slackNotificationApprovalKind';
export const slackNotificationApprovalIdSchema=z.string().regex(/^slack_notification_approval_[a-f0-9]{64}$/);
export const slackNotificationApprovalDtoSchema=z.object({id:slackNotificationApprovalIdSchema,version:z.number().int().min(0).max(2),clientRequestId:z.string().uuid(),state:z.enum(['requested','approved','consumed','cancelled']),intent:slackNotificationIntentSchema,intentDigest:z.string().regex(/^[a-f0-9]{64}$/),canApprove:z.boolean(),canCancel:z.boolean(),canPrepare:z.boolean().default(false),operationId:z.string().regex(/^slack_notification_[a-f0-9]{64}$/).optional()}).strict();
export type SlackNotificationApprovalDto=z.infer<typeof slackNotificationApprovalDtoSchema>;
