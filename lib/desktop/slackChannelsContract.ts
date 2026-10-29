import {z} from 'zod';
export const slackChannelCursorSchema=z.string().min(1).max(512).regex(/^[A-Za-z0-9+/_=-]+$/);
const label=z.string().min(1).max(200).refine(v=>v===v.trim()&&!/[\x00-\x1f\x7f-\x9f]/.test(v));
export const slackChannelsDataSchema=z.object({workspaceId:z.string().regex(/^T[A-Z0-9]{2,31}$/),workspaceName:label.optional(),connectionVersion:z.string().datetime().refine(v=>new Date(v).toISOString()===v),channels:z.array(z.object({id:z.string().regex(/^C[A-Z0-9]{2,31}$/),name:label,isMember:z.boolean()}).strict()).max(100),nextCursor:slackChannelCursorSchema.optional()}).strict().refine(v=>new Set(v.channels.map(c=>c.id)).size===v.channels.length);
export type SlackChannelsData=z.infer<typeof slackChannelsDataSchema>;
export const parseSlackChannelsData=(value:unknown):SlackChannelsData=>slackChannelsDataSchema.parse(value);
