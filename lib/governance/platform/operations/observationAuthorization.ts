import type {ExecutionTimeAuthorization} from '../executionTime';
/** Private original-transaction owner, not request JSON or reusable approval.
 * The owner may validate several phases; each supplied check is one-use. */
export interface OperationalObservationAuthorization{
 readonly signal:AbortSignal;
 readonly authorize:ExecutionTimeAuthorization;
 /** Synchronous original possession/cancellation check after final awaits. */
 readonly assertActive:()=>void;
}
