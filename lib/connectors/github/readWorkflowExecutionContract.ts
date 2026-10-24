import { getFile } from "./githubWriteClient";
import { parseRepositoryFullName, resolveTenantScopedToken } from "./resolveTenantScopedToken";
import { isWorkflowExecutionSource, validateWorkflowExecutionContract, type WorkflowExecutionSource } from "./workflowExecutionContract";

type Result = { ok: true; source: WorkflowExecutionSource; inputs: Record<string, string> }
  | { ok: false; error: "workflow_execution_contract_unavailable" };
const unavailable = (): Result => ({ ok: false, error: "workflow_execution_contract_unavailable" });

/** Server-only tenant read. A successful contract is evidence, never an approval or dispatch grant. */
export async function readWorkflowExecutionContract(input: {
  organizationId: string;
  source: WorkflowExecutionSource;
  inputs: unknown;
  signal: AbortSignal;
}): Promise<Result> {
  if (!input.organizationId.trim() || !isWorkflowExecutionSource(input.source) || input.signal.aborted) return unavailable();
  const repository = parseRepositoryFullName(input.source.repositoryFullName);
  if (!repository) return unavailable();
  try {
    const token = await resolveTenantScopedToken(input.organizationId, repository);
    if (!token.ok || input.signal.aborted) return unavailable();
    const file = await getFile({ ...repository, branch: input.source.ref, path: input.source.path, installationToken: token.token, read: { signal: input.signal, maxBytes: 200_000 } });
    if (!file.ok || input.signal.aborted || file.data.path !== input.source.path) return unavailable();
    const currentSource = { ...input.source, blobSha: file.data.sha };
    const result = validateWorkflowExecutionContract({ expectedSource: input.source, currentSource, content: file.data.content, inputs: input.inputs });
    if (!result.ok) return unavailable();
    return { ok: true, source: currentSource, inputs: result.inputs };
  } catch { return unavailable(); }
}
