import {z} from 'zod';
import {platformActionId} from '../viewContract';
export const operationalWorkloadCommand=z.object({actionId:platformActionId,delegationVersion:z.literal(0)}).strict();
