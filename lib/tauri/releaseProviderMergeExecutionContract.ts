import {z} from 'zod';
import {releaseProviderMergeDtoSchema} from './releaseProviderMergeContract';
export const providerMergeExecutionStateSchema=z.object({available:z.boolean(),sourcePolicy:z.literal('expected_head_observed_base'),operation:releaseProviderMergeDtoSchema.nullable()}).strict();
export type ProviderMergeExecutionState=z.infer<typeof providerMergeExecutionStateSchema>;
export const parseProviderMergeExecutionState=(value:unknown)=>providerMergeExecutionStateSchema.parse(value);
