import {z} from 'zod';
export const serviceNowInspectionSchema=z.object({readOnly:z.literal(true),executionAuthorized:z.literal(false),status:z.enum(['passed','refused','timeout']),steps:z.array(z.object({phase:z.enum(['inspection_readers','association_preflight','saved_record','association_recheck','authority','credential','journal_absence','native_plan','record_read','final_native_plan','final_authority']),status:z.enum(['passed','refused','timeout']),elapsedMs:z.number().int().min(0).max(60000)}).strict()).min(1).max(10)}).strict();
export type ServiceNowPreflightInspection=z.infer<typeof serviceNowInspectionSchema>;
export const serviceNowInspectionResultSchema=serviceNowInspectionSchema.extend({actionId:z.string().regex(/^servicenow_action_[a-f0-9]{64}$/),actionVersion:z.number().int().min(0).max(2147483647)}).strict();
export type ServiceNowInspectionResult=z.infer<typeof serviceNowInspectionResultSchema>;
