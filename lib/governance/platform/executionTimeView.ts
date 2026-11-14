import {z} from 'zod';
const common={format:z.literal(1),authority:z.literal('history_only'),executionAuthorized:z.literal(false)};
/** Public historical scope only; no native resource coordinates or authority. */
export const executionTimeSummarySchema=z.discriminatedUnion('assurance',[
 z.object({...common,assurance:z.literal('physical-utc-interval-v1')}).strict(),
 z.object({...common,assurance:z.literal('aws-linux-operational-v1'),profileDigest:z.string().regex(/^[a-f0-9]{64}$/),physicalUtcClosureProven:z.literal(false)}).strict(),
]);
