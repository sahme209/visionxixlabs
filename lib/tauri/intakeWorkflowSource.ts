import { readWorkflowExecutionContract } from "@/lib/connectors/github/readWorkflowExecutionContract";
import type { WorkflowExecutionSource } from "@/lib/connectors/github/workflowExecutionContract";

interface BoundIntake {
  repositoryUrls: string[];
  sourceBranch: string;
  workflowName: string;
  workflowInputs: Record<string, string>;
  workflowSource?: WorkflowExecutionSource;
}
/** Verify an optional observation before persistence. Does not authorize any provider action. */
export async function verifyIntakeWorkflowSource(organizationId: string, intake: BoundIntake, signal: AbortSignal): Promise<boolean> {
  if (!intake.workflowSource) return true;
  const source = intake.workflowSource;
  // The PR source branch and the separately reviewed deployment ref may differ.
  // Always verify the exact declared workflow ref/blob and inputs with GitHub below.
  if (intake.repositoryUrls.length !== 1) return false;
  const path = intake.workflowName.startsWith(".github/workflows/") ? intake.workflowName : `.github/workflows/${intake.workflowName}`;
  if (path !== source.path) return false;
  try {
    const url = new URL(intake.repositoryUrls[0]);
    if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password || url.search || url.hash) return false;
    const repository = url.pathname.replace(/^\//, "").replace(/\/$/, "").replace(/\.git$/, "");
    if (repository !== source.repositoryFullName) return false;
    const result = await readWorkflowExecutionContract({ organizationId, source, inputs: intake.workflowInputs, signal });
    return result.ok;
  } catch { return false; }
}
