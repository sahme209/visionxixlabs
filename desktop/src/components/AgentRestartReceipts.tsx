import { useEffect, useRef, useState } from "react";
import { desktopClient, type DeploymentExecution } from "../lib/desktopClient";
import { deploymentObservationState } from "../lib/deploymentObservationState";
import { DeploymentWorkflowEvidence } from "./DeploymentWorkflowEvidence";

interface RestartAction { id: string; toolName: string; status: string; argsJson: unknown; resultJson?: unknown }
type Receipt = Pick<DeploymentExecution, "id" | "repositoryFullName" | "environmentId" | "source" | "status" | "conclusion" | "rollbackStatus" | "workflowRunId" | "evidence">;
function object(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function receipt(value: unknown, args: unknown): Receipt | null {
  const row = object(value), target = object(args);
  if (!row || !target || typeof row.id !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(row.id) || row.source !== "agent"
    || row.repositoryFullName !== target.repositoryFullName || row.environmentId !== target.environmentId
    || typeof row.repositoryFullName !== "string" || typeof row.environmentId !== "string"
    || typeof row.status !== "string" || !/^[a-z_]{1,64}$/.test(row.status)
    || (row.conclusion !== null && (typeof row.conclusion !== "string" || !/^[a-z_]{1,64}$/.test(row.conclusion)))
    || typeof row.rollbackStatus !== "string" || !/^[a-z_]{1,64}$/.test(row.rollbackStatus)
    || (row.workflowRunId !== null && (typeof row.workflowRunId !== "string" || !/^[1-9][0-9]*$/.test(row.workflowRunId)))) return null;
  return { id: row.id, repositoryFullName: row.repositoryFullName, environmentId: row.environmentId, source: "agent", status: row.status, conclusion: row.conclusion as string | null, rollbackStatus: row.rollbackStatus, workflowRunId: row.workflowRunId as string | null,
    // This is the existing legacy workflow contract, never full release/health evidence.
    evidence: { operation: "unknown", requestedOperation: "service_restart", statusScope: "github_workflow", sourceArtifactVerified: false, applicationHealthVerified: false, rollbackImageVerified: false } };
}

/** Receipts are recovered from the existing redacted conversation; only explicit
 * manual observation reads current tenant-authorized workflow status. */
export function AgentRestartReceipts({ conversationId, actions }: { conversationId: string | null; actions: RestartAction[] }) {
  const [context] = useState(() => desktopClient.config);
  if (context !== desktopClient.config) return null;
  return <>{actions.filter(action => action.toolName === "trigger_aws_deploy" && action.status === "executed").map(action => {
    const bound = receipt(object(action.resultJson)?.execution, action.argsJson);
    return <RestartReceipt key={JSON.stringify([conversationId, action.id, bound?.id, bound?.repositoryFullName, bound?.environmentId])} action={action} />;
  })}</>;
}
function RestartReceipt({ action }: { action: RestartAction }) {
  const [context] = useState(() => desktopClient.config);
  const original = receipt(object(action.resultJson)?.execution, action.argsJson);
  const [observation, setObservation] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const epoch = useRef(0);
  useEffect(() => () => { epoch.current += 1; }, []);
  const current = context === desktopClient.config;
  const value = observation?.id === original?.id ? observation : original;
  async function refresh() {
    if (!original || loading || !current) return;
    const generation = ++epoch.current;
    setLoading(true); setError(null);
    try {
      const result = await desktopClient.observeDeploymentExecution(original.id);
      if (generation !== epoch.current || context !== desktopClient.config) return;
      const next = result.ok ? receipt(result.data, action.argsJson) : null;
      if (!next || next.id !== original.id) { setError("Workflow status could not be verified. The recorded receipt is unchanged."); return; }
      setObservation(next);
    } catch {
      if (generation === epoch.current && context === desktopClient.config) setError("Workflow status could not be verified. The recorded receipt is unchanged.");
    } finally { if (generation === epoch.current && context === desktopClient.config) setLoading(false); }
  }
  if (!current) return null;
  return <section className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-xs text-zinc-400" aria-label="ECS restart workflow receipt">
    <p className="font-medium text-zinc-200">ECS restart workflow request recorded</p>
    {value ? <>
      <p className="mt-1 break-all">{value.repositoryFullName} · environment {value.environmentId}</p>
      <p className="mt-1">{deploymentObservationState(value).label} · {observation ? "manually observed" : "recorded dispatch receipt"}</p>
      <DeploymentWorkflowEvidence execution={value} />
      <button type="button" disabled={loading} onClick={() => void refresh()} className="mt-2 rounded-md border border-white/10 px-3 py-1.5 text-zinc-200 disabled:opacity-50">{loading ? "Reading workflow receipt…" : "Refresh workflow receipt"}</button>
    </> : <p className="mt-1">Workflow receipt unavailable. Reopen this conversation to retry its read; do not approve or dispatch again to recover status.</p>}
    {error && <p role="alert" className="mt-2 text-amber-200">{error}</p>}
  </section>;
}
