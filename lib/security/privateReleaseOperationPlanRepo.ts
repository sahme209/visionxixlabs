import type {Prisma, PrismaClient} from '@prisma/client';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';

/**
 * Bridges the legacy store's broad Record/unknown arguments to generated Prisma
 * arguments without changing their values. Assertions below concern query/JSON
 * shape only: Prisma still validates the supplied data. They establish no
 * authorization, principal, proof, custody or database readiness.
 */
function transactionAdapter(client:Prisma.TransactionClient):ReleaseOperationPlanTransaction {
 return {
  $queryRaw:<T=unknown>(query:TemplateStringsArray,...values:unknown[])=>client.$queryRaw<T>(query,...values),
  durableAgentWorkflow:{
   findFirst:args=>client.durableAgentWorkflow.findFirst(args as Prisma.DurableAgentWorkflowFindFirstArgs),
   findMany:args=>client.durableAgentWorkflow.findMany(args as Prisma.DurableAgentWorkflowFindManyArgs),
   create:args=>client.durableAgentWorkflow.create(args as Prisma.DurableAgentWorkflowCreateArgs),
   updateMany:args=>client.durableAgentWorkflow.updateMany(args as Prisma.DurableAgentWorkflowUpdateManyArgs),
  },
  durableAgentWorkflowEvent:{
   findMany:args=>client.durableAgentWorkflowEvent.findMany(args as Prisma.DurableAgentWorkflowEventFindManyArgs),
   create:args=>client.durableAgentWorkflowEvent.create(args as Prisma.DurableAgentWorkflowEventCreateArgs),
  },
 };
}

export type PrivateReleaseOperationPlanRepo=ReleaseOperationPlanRepo & Pick<PrismaClient,'gitHubInstallation'>;

/** Uses only the supplied lazy client and its actual interactive transaction. */
export function createPrivateReleaseOperationPlanRepo(client:PrismaClient):PrivateReleaseOperationPlanRepo {
 return {
  ...transactionAdapter(client),
  gitHubInstallation:client.gitHubInstallation,
  $transaction:(fn,options)=>client.$transaction(tx=>fn(transactionAdapter(tx)),options),
 };
}
