import 'server-only';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
/** Associated ticket checks re-read locked provenance, permissions and history.
 * Keep those checks intact within a finite budget below the HTTP operation limit.
 * Never changes Prisma's global defaults or retries a failed transaction. */
export function associatedTicketTransactionRepository(repo:ReleaseOperationPlanRepo):ReleaseOperationPlanRepo{
 return{
  $queryRaw:<T=unknown>(query:TemplateStringsArray,...values:unknown[])=>repo.$queryRaw<T>(query,...values),
  durableAgentWorkflow:repo.durableAgentWorkflow,
  durableAgentWorkflowEvent:repo.durableAgentWorkflowEvent,
  $transaction:run=>repo.$transaction(run,{maxWait:2000,timeout:15000}),
 };
}
