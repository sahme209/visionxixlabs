import {z} from 'zod';
import {digest} from '../contracts';
import {platformActionId} from '../viewContract';
import {platformPreparationRequestId} from '../preparationContract';
/** Original proposal/reference metadata only; no review or execution grant. */
export const ecsPreparationReceipt=z.object({actionId:platformActionId,requestId:platformPreparationRequestId,planDigest:digest,historical:z.boolean(),authority:z.literal('proposal_reference_only'),executionAuthorized:z.literal(false)}).strict();
export const ecsPreparationLookup=z.object({found:z.boolean(),actionId:platformActionId,requestId:platformPreparationRequestId,authority:z.literal('history_only'),executionAuthorized:z.literal(false)}).strict();
