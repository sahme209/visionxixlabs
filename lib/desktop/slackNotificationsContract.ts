import {botActionTaskReferenceSchema} from '../axiom/bot/actionTaskBindingContract';
import {z} from 'zod';
import {slackNotificationIntentSchema,slackNotificationDtoSchema} from '../integrations/slack/slackNotificationContract';
import {slackNotificationApprovalDtoSchema,slackNotificationApprovalIdSchema} from '../integrations/slack/slackNotificationApprovalContract';
import {slackChannelCursorSchema} from './slackChannelsContract';
const operationId=z.string().regex(/^slack_notification_[a-f0-9]{64}$/),version=z.number().int().min(0).max(2);
export const slackNotificationsRequestSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('request'),sourceTask:botActionTaskReferenceSchema.optional(),clientRequestId:z.string().uuid(),channelId:slackNotificationIntentSchema.shape.channelId,text:slackNotificationIntentSchema.shape.text,cursor:slackChannelCursorSchema.optional()}).strict(),
 z.object({action:z.literal('approve'),approvalId:slackNotificationApprovalIdSchema,expectedVersion:z.literal(0),clientRequestId:z.string().uuid()}).strict(),
 z.object({action:z.literal('prepare'),approvalId:slackNotificationApprovalIdSchema,expectedVersion:z.literal(1)}).strict(),
 z.object({action:z.literal('execute'),operationId,expectedVersion:z.literal(0)}).strict(),
 z.object({action:z.literal('cancel'),approvalId:slackNotificationApprovalIdSchema,expectedVersion:version}).strict(),
 z.object({action:z.literal('cancel_operation'),operationId,expectedVersion:version}).strict(),
 z.object({action:z.literal('recover'),operationId,expectedVersion:version}).strict(),
]);
export const slackNotificationsDataSchema=z.object({enabled:z.boolean(),writeAvailable:z.boolean(),reason:z.enum(['sending_disabled','ready','permission_required','connection_unavailable']),approvals:z.array(slackNotificationApprovalDtoSchema).max(20),operations:z.array(slackNotificationDtoSchema).max(20),truncated:z.boolean()}).strict();
export type SlackNotificationsData=z.infer<typeof slackNotificationsDataSchema>;
export const parseSlackNotificationsData=(v:unknown):SlackNotificationsData=>slackNotificationsDataSchema.parse(v);
