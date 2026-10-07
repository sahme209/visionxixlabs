import "server-only";

export interface DeploymentExecutionRow {
  id: string;
  organizationId: string;
  environmentId: string;
  repositoryFullName: string;
  workflowRunId: string | null;
  workflowUrl: string | null;
  source: string;
  triggeredByUserId: string;
  status: string;
  conclusion: string | null;
  rollbackStatus: string;
  lastObservedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeploymentExecutionRepo {
  deploymentExecution: {
    create(args: { data: {
      organizationId: string;
      environmentId: string;
      repositoryFullName: string;
      workflowRunId: string | null;
      workflowUrl: string | null;
      source: string;
      triggeredByUserId: string;
      status: string;
    } }): Promise<DeploymentExecutionRow>;
    findFirst(args: { where: { id: string; organizationId: string } }): Promise<DeploymentExecutionRow | null>;
    findMany(args: {
      where: { organizationId: string; environmentId?: string };
      orderBy: { createdAt: "desc" };
      take: number;
    }): Promise<DeploymentExecutionRow[]>;
    updateMany(args: {
      where: { id: string; organizationId: string };
      data: {
        status: string;
        conclusion: string | null;
        rollbackStatus: string;
        workflowUrl: string;
        lastObservedAt: Date;
        completedAt: Date | null;
      };
    }): Promise<{ count: number }>;
  };
}

export function serializeDeploymentExecution(row: DeploymentExecutionRow) {
  return {
    id: row.id,
    environmentId: row.environmentId,
    repositoryFullName: row.repositoryFullName,
    workflowRunId: row.workflowRunId,
    workflowUrl: row.workflowUrl,
    source: row.source,
    status: row.status,
    conclusion: row.conclusion,
    rollbackStatus: row.rollbackStatus,
    lastObservedAt: row.lastObservedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
