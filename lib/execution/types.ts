/**
 * Execution layer — types for automation engine.
 */

export type ExecutionAction = {
  id: string;
  pluginId: string;
  action: string;
  params: Record<string, unknown>;
  approvalRequired: boolean;
  description?: string;
  /** For rollback */
  rollbackSteps?: string[];
};

export type ExecutionContext = {
  userId: string;
  projectId?: string;
  leadId?: string;
  /** Required for cloud operations */
  credentialsKey?: string;
};

export type ExecutionResult = {
  success: boolean;
  actionId: string;
  pluginId: string;
  data?: unknown;
  error?: string;
  executionLogId?: string;
};

export type ExecutionLogEntry = {
  id: string;
  userId: string;
  projectId?: string;
  leadId?: string;
  action: string;
  pluginId: string;
  status: "pending" | "success" | "failed" | "rolled_back";
  params?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  rollbackSteps?: string[];
  executedAt: Date;
};
