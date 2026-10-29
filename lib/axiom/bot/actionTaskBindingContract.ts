import {z} from 'zod';
const taskId=z.string().regex(/^bot_[a-f0-9]{64}$/),version=z.number().int().min(0).max(2147483647);
/** Client identifies a saved version only; the server supplies its content digest. */
export const botActionTaskReferenceSchema=z.object({taskId,expectedVersion:version}).strict();
export const botActionTaskBindingSchema=z.object({kind:z.literal('saved_bot_task_v1'),taskId,taskVersion:version,contentHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export type BotActionTaskReference=z.infer<typeof botActionTaskReferenceSchema>;
export type BotActionTaskBinding=z.infer<typeof botActionTaskBindingSchema>;
