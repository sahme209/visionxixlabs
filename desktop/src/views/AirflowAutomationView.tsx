import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Clock3, DatabaseZap, Play, RefreshCw, ShieldCheck, Workflow } from "lucide-react";
import { ViewShell } from "../components/Primitives";
import { desktopClient, type AirflowAutomation, type AirflowAutomationExecution, type AirflowDag, type AirflowDagRun } from "../lib/desktopClient";

import { AirflowRunTasks } from "../components/AirflowRunTasks";
import { AirflowRestartReviewCard } from "../components/AirflowRestartReviewCard";

type Tab = "dags" | "automations" | "approvals" | "connection";
const input = "min-h-10 w-full rounded-lg border border-white/[0.1] bg-white/[0.025] px-3 text-sm text-zinc-200 outline-none focus:border-white/20";
const button = "rounded-lg border border-white/[0.1] px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.06] disabled:opacity-40";
const recoveryNotices: Record<string, string> = {
  airflow_review_required: "Immutable destination evidence is missing. Reject this action and wait for a new scheduler proposal.",
  airflow_review_storage_unavailable: "Destination review storage is unavailable. Approval is paused; ask a workspace administrator to review the installation proposal.",
  airflow_review_changed: "The displayed destination review changed. Read it again before approving.",
  airflow_restart_review_stale: "The destination or policy changed. Reject this action and wait for a new scheduler proposal.",
  airflow_reservation_release_unconfirmed: "The allowance release could not be confirmed. Automatic replay is paused; review the recorded hold before further action.",
  airflow_execution_state_unconfirmed: "The local action state could not be confirmed. Automatic replay remains paused; refresh and review its history.",
  airflow_provider_outcome_unknown: "The provider may already have accepted this action. Automatic retry is paused; review its recorded outcome first.",
  airflow_automation_disabled: "This automation is paused. It cannot start an action or retry.",
  airflow_approval_authority_required: "An accepted workspace approver is required before this action can run.",
  airflow_approval_authority_unavailable: "Approval permissions could not be confirmed. No action was started.",
};

export function AirflowAutomationView() {
  const revision = useSyncExternalStore(desktopClient.subscribeContext, desktopClient.getContextRevision);
  return <AirflowWorkspaceView key={revision} />;
}

function AirflowWorkspaceView() {
  const [contextRevision] = useState(desktopClient.getContextRevision);
  const [tab, setTab] = useState<Tab>("dags");
  const [connectionState, setConnectionState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [connection, setConnection] = useState<{ connected: boolean; status: string; baseUrl?: string; version?: string | null; dagCount?: number | null } | null>(null);
  const [dags, setDags] = useState<AirflowDag[]>([]); const [dagId, setDagId] = useState(""); const [runHistory, setRunHistory] = useState<{ dagId: string; runs: AirflowDagRun[] } | null>(null);
  const historyRequest = useRef(0);
  const workspaceRequest = useRef(0);
  const selectedDag = dags.find((dag) => dag.dagId === dagId);
  const selectedDagId = selectedDag?.dagId ?? "";
  const runs = selectedDagId && runHistory?.dagId === selectedDagId ? runHistory.runs : [];
  const [automations, setAutomations] = useState<AirflowAutomation[]>([]); const [executions, setExecutions] = useState<AirflowAutomationExecution[]>([]);
  const [repositories, setRepositories] = useState<Array<{ fullName: string; defaultBranch: string }>>([]);
  const [environments, setEnvironments] = useState<Array<{ id: string; name: string; tier: string }>>([]);
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const request = ++workspaceRequest.current;
    const current = () => request === workspaceRequest.current && contextRevision === desktopClient.getContextRevision();
    // Each read owns its result. GitHub/environment availability must not hide
    // Airflow status or pending approvals, and no failed read grants authority.
    async function read(work: () => Promise<void>) {
      try { await work(); }
      catch { if (current()) setNotice("Some Airflow workspace data could not be loaded. Refresh before acting on missing information."); }
    }
    // Optional destination catalogs must not hold action completion busy.
    void read(async () => {
      const result = await desktopClient.listGithubRepositories();
      if (current() && result.ok) setRepositories(result.data.repositories);
    });
    void read(async () => {
      const result = await desktopClient.listEnvironments();
      if (current() && result.ok) setEnvironments(result.data.environments);
    });
    await Promise.all([
      read(async () => {
        setConnectionState("loading");
        let result;
        try { result = await desktopClient.airflowConnection(); }
        catch { if (current()) { setConnection(null); setConnectionState("unavailable"); } return; }
        if (!current()) return;
        if (!result.ok) { setConnection(null); setConnectionState("unavailable"); return; }
        setConnectionState("ready");
        setConnection(result.data);
        if (!result.data.connected) return;
        const dagResult = await desktopClient.listAirflowDags();
        if (current() && dagResult.ok) { setDags(dagResult.data.dags); setDagId((selected) => selected || dagResult.data.dags[0]?.dagId || ""); }
      }),
      read(async () => {
        const result = await desktopClient.listAirflowAutomations();
        if (current() && result.ok) { setAutomations(result.data.automations); setExecutions(result.data.executions); }
      }),
    ]);
  }, [contextRevision]);
  useEffect(() => {
    const requestState = workspaceRequest;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => { window.clearTimeout(timer); requestState.current++; };
  }, [load]);
  const refreshRuns = useCallback(async () => {
    const request = ++historyRequest.current;
    if (!selectedDagId || contextRevision !== desktopClient.getContextRevision()) return;
    const current = () => request === historyRequest.current && contextRevision === desktopClient.getContextRevision();
    try {
      const result = await desktopClient.listAirflowDagRuns(selectedDagId);
      if (current() && result.ok) setRunHistory({ dagId: selectedDagId, runs: result.data.runs });
    } catch {
      if (current()) setNotice("Run history could not be refreshed. Its displayed state is not execution confirmation.");
    }
  }, [selectedDagId, contextRevision]);
  useEffect(() => {
    const requestState = historyRequest;
    void refreshRuns();
    return () => { requestState.current++; };
  }, [refreshRuns]);

  async function act(work: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    if (contextRevision !== desktopClient.getContextRevision()) return;
    setBusy(true); setNotice(null);
    try {
      const result = await work();
      if (contextRevision !== desktopClient.getContextRevision()) return;
      setNotice(result.ok ? success : recoveryNotices[result.error ?? ""] ?? result.error ?? "The operation failed.");
      // A failed response can mean the external outcome is uncertain. Refresh
      // history on both paths so the operator sees the reconciliation hold.
      await load();
    } catch {
      if (contextRevision === desktopClient.getContextRevision()) setNotice("The action's outcome could not be confirmed. Refresh and review its history before retrying.");
    } finally {
      if (contextRevision === desktopClient.getContextRevision()) setBusy(false);
    }
  }

  return <ViewShell><div className="mx-auto w-full max-w-6xl pb-14">
    <div className="flex items-start justify-between gap-5"><div><h1 className="text-2xl font-semibold tracking-tight">Airflow automation</h1><p className="mt-1.5 max-w-3xl text-sm leading-6 text-zinc-500">Select real DAGs, watch batch completion, and turn successful runs into governed pull requests or service restarts.</p></div><div className="flex items-center gap-2 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-2 text-[11px] text-emerald-200"><ShieldCheck className="h-3.5 w-3.5"/>Approvals and audit always on</div></div>
    <div className="mt-6 flex flex-wrap gap-2">{(["dags", "automations", "approvals", "connection"] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`${button} capitalize ${tab === item ? "bg-white/[0.09] text-white" : ""}`}>{item}</button>)}</div>
    {notice && <div role="status" className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-xs text-zinc-300">{notice}</div>}
    {connectionState === "loading" && <p role="status" className="mt-6 text-sm text-zinc-400">Checking Airflow connection…</p>}
    {connectionState === "unavailable" && <div role="alert" className="mt-6 rounded-xl border border-amber-300/20 p-4"><h2 className="text-sm">Airflow connection status unavailable</h2><p className="mt-2 text-xs text-zinc-400">The service could not confirm this workspace connection. Existing connections are not removed. Refresh before configuring or running work.</p><button type="button" onClick={() => void load()} className={`${button} mt-3`}>Retry connection status</button></div>}
    {connectionState === "ready" && !connection?.connected && tab !== "connection" && <div className="mt-8 rounded-2xl border border-amber-300/15 bg-amber-300/[0.03] p-6"><h2 className="text-sm font-medium">Connect Airflow first</h2><p className="mt-2 text-xs leading-5 text-zinc-500">An administrator connects one HTTPS Airflow 3 endpoint. Credentials remain encrypted on the Axiom service.</p><button onClick={() => setTab("connection")} className="btn-primary mt-4">Open connection setup</button></div>}
    {tab === "connection" && connectionState !== "unavailable" && connection !== null && <ConnectionPanel connection={connection} busy={busy} onRun={act} />}
    {tab === "dags" && connectionState === "ready" && connection?.connected && <section className="mt-8 grid gap-5 lg:grid-cols-[340px_1fr]"><div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5"><div className="flex items-center gap-2 text-sm"><Workflow className="h-4 w-4"/>DAG</div><select className={`${input} mt-4`} value={selectedDagId} onChange={(event) => setDagId(event.target.value)}><option value="" disabled>Select an available DAG</option>{dags.map((dag) => <option key={dag.dagId} value={dag.dagId}>{dag.displayName}{dag.paused ? " · paused" : ""}</option>)}</select><p className="mt-3 text-xs leading-5 text-zinc-500">{dags.find((dag) => dag.dagId === dagId)?.description ?? "No DAG description provided."}</p><button disabled={busy || !selectedDag || selectedDag.paused} onClick={() => selectedDag && !selectedDag.paused && void act(() => desktopClient.triggerAirflowDag(selectedDag.dagId), "DAG run queued in Airflow." )} className="btn-primary mt-5 w-full"><Play className="mr-2 inline h-3.5 w-3.5"/>Run now</button></div><RunHistory key={selectedDagId} runs={runs} onRefresh={() => void refreshRuns()}/></section>}
    {tab === "automations" && connection?.connected && <AutomationPanel dags={dags} repositories={repositories} environments={environments} automations={automations} busy={busy} onRun={act} />}
    {tab === "approvals" && <ExecutionPanel executions={executions} automations={automations} busy={busy} onRun={act} />}
  </div></ViewShell>;
}

function ConnectionPanel({ connection, busy, onRun }: { connection: { connected: boolean; status: string; baseUrl?: string; version?: string | null; dagCount?: number | null } | null; busy: boolean; onRun: (work: () => Promise<{ ok: boolean; error?: string }>, success: string) => Promise<void> }) {
  const [baseUrl, setBaseUrl] = useState(connection?.baseUrl ?? ""); const [authMode, setAuthMode] = useState<"username_password" | "token">("username_password"); const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [token, setToken] = useState("");
  return <section className="mt-8 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-6"><div className="flex items-center gap-3"><DatabaseZap className="h-5 w-5 text-violet-200"/><div><h2 className="text-base font-medium">Secure Airflow connection</h2><p className="mt-1 text-xs text-zinc-500">Airflow 3 REST API v2 · HTTPS only · private-address and redirect protection</p></div></div>{connection?.connected && <div className="mt-5 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4 text-xs text-zinc-300"><CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-300"/>{connection.baseUrl} · Airflow {connection.version ?? "3.x"} · {connection.dagCount ?? 0} DAGs</div>}<div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs text-zinc-500 sm:col-span-2">Airflow HTTPS origin<input className={`${input} mt-2`} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://airflow.example.com" /></label><label className="text-xs text-zinc-500">Authentication<select className={`${input} mt-2`} value={authMode} onChange={(event) => setAuthMode(event.target.value as typeof authMode)}><option value="username_password">Airflow username and password</option><option value="token">Managed bearer token (advanced)</option></select></label>{authMode === "username_password" ? <><label className="text-xs text-zinc-500">Username<input className={`${input} mt-2`} value={username} onChange={(event) => setUsername(event.target.value)} /></label><label className="text-xs text-zinc-500 sm:col-span-2">Password<input type="password" className={`${input} mt-2`} value={password} onChange={(event) => setPassword(event.target.value)} /></label></> : <label className="text-xs text-zinc-500">Bearer token<input type="password" className={`${input} mt-2`} value={token} onChange={(event) => setToken(event.target.value)} /></label>}</div><div className="mt-5 flex gap-2"><button disabled={busy} onClick={() => void onRun(async () => {
      const result = await desktopClient.saveAirflowConnection({ baseUrl, authMode, username, password, token });
      if (result.ok) {
        setPassword((current) => current === password ? "" : current);
        setToken((current) => current === token ? "" : current);
      }
      return result;
    }, "Airflow connection validated and saved." )} className="btn-primary">{busy ? "Validating…" : "Validate & connect"}</button>{connection?.connected && <button disabled={busy} onClick={() => void onRun(() => desktopClient.disconnectAirflow(), "Airflow disconnected; its automations are disabled." )} className={button}>Disconnect</button>}</div></section>;
}

function RunHistory({ runs, onRefresh }: { runs: AirflowDagRun[]; onRefresh: () => void }) { return <div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5"><div className="flex items-center justify-between"><h2 className="text-sm font-medium">Recent runs</h2><button aria-label="Refresh run history" onClick={onRefresh} className={button}><RefreshCw className="h-3.5 w-3.5"/></button></div><div className="mt-4 divide-y divide-white/[0.06]">{runs.length ? runs.map((run) => <div key={run.dagRunId} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate text-xs text-zinc-200">{run.dagRunId}</p><p className="mt-1 text-[10px] text-zinc-600">{run.logicalDate ? new Date(run.logicalDate).toLocaleString() : "No logical date"}</p></div><AirflowRunTasks key={`${run.dagId}:${run.dagRunId}`} dagId={run.dagId} runId={run.dagRunId}/><span className={`rounded-full border px-2 py-1 text-[10px] ${run.state === "success" ? "border-emerald-400/20 text-emerald-300" : run.state === "failed" ? "border-rose-400/20 text-rose-300" : "border-white/10 text-zinc-400"}`}>{run.state}</span></div>) : <p className="py-8 text-center text-xs text-zinc-600">No runs returned.</p>}</div></div>; }

function AutomationPanel({ dags, repositories, environments, automations, busy, onRun }: { dags: AirflowDag[]; repositories: Array<{ fullName: string; defaultBranch: string }>; environments: Array<{ id: string; name: string; tier: string }>; automations: AirflowAutomation[]; busy: boolean; onRun: (work: () => Promise<{ ok: boolean; error?: string }>, success: string) => Promise<void> }) {
  const [name, setName] = useState(""); const [dagId, setDagId] = useState(dags[0]?.dagId ?? ""); const [triggerMode, setTriggerMode] = useState("dag_completion"); const [scheduleCron, setScheduleCron] = useState("0 6 * * *"); const [actionType, setActionType] = useState("none"); const [repository, setRepository] = useState(repositories[0]?.fullName ?? ""); const selectedRepo = repositories.find((item) => item.fullName === repository); const [sourceRef, setSourceRef] = useState(selectedRepo?.defaultBranch ?? "main"); const [branchCatalog, setBranchCatalog] = useState<{ repository: string; status: "ready" | "error"; branches: Array<{ name: string; protected: boolean }> } | null>(null); const [environmentId, setEnvironmentId] = useState(environments[0]?.id ?? ""); const [approvalRequired, setApprovalRequired] = useState(true); const [dependencies, setDependencies] = useState<string[]>([]); const [advanced, setAdvanced] = useState(false);
  const [branchRequest, setBranchRequest] = useState(0);
  const repositoryVerified = !!selectedRepo;
  const branches = branchCatalog?.repository === repository ? branchCatalog.branches : [];
  const branchStatus = branchCatalog?.repository === repository ? branchCatalog.status : "loading";
  const sourceVerified = branchStatus === "ready" && branches.some((branch) => branch.name === sourceRef);
  const canCreate = !busy && !!name.trim() && dags.some((dag) => dag.dagId === dagId)
    && dependencies.every((dependency) => dags.some((dag) => dag.dagId === dependency))
    && (actionType === "none" || (repositoryVerified && sourceVerified))
    && (actionType !== "deploy" || environments.some((environment) => environment.id === environmentId));
  const effectiveApproval = actionType === "none" ? approvalRequired : true;
  useEffect(() => {
    let cancelled = false;
    if (!repositoryVerified) return;
    void desktopClient.listGithubBranches(repository).then((result) => {
      if (cancelled) return;
      setBranchCatalog({ repository, status: result.ok ? "ready" : "error", branches: result.ok ? result.data.branches : [] });
    }).catch(() => { if (!cancelled) setBranchCatalog({ repository, status: "error", branches: [] }); });
    return () => { cancelled = true; };
  }, [repository, repositoryVerified, branchRequest]);
  return <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_1fr]"><div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-6"><h2 className="text-base font-medium">New automation</h2><p className="mt-1 text-xs text-zinc-500">A guided rule watches a batch and proposes or performs one governed action.</p><div className="mt-5 grid gap-4"><label className="text-xs text-zinc-500">Name<input className={`${input} mt-2`} value={name} onChange={(event) => setName(event.target.value)} placeholder="Promote daily customer import"/></label><label className="text-xs text-zinc-500">When this DAG<select className={`${input} mt-2`} value={dags.some((dag) => dag.dagId === dagId) ? dagId : ""} onChange={(event) => setDagId(event.target.value)}><option value="" disabled>Select a DAG</option>{dags.map((dag) => <option key={dag.dagId} value={dag.dagId}>{dag.displayName}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2"><button className={`${button} ${triggerMode === "dag_completion" ? "bg-white/[0.09]" : ""}`} onClick={() => setTriggerMode("dag_completion")}>Finishes successfully</button><button className={`${button} ${triggerMode === "schedule" ? "bg-white/[0.09]" : ""}`} onClick={() => setTriggerMode("schedule")}><Clock3 className="mr-1 inline h-3.5 w-3.5"/>Run on schedule</button></div>{triggerMode === "schedule" && <label className="text-xs text-zinc-500">Schedule<select className={`${input} mt-2`} value={scheduleCron} onChange={(event) => setScheduleCron(event.target.value)}><option value="0 * * * *">Every hour</option><option value="0 6 * * *">Every day at 06:00 UTC</option><option value="0 6 * * 1">Every Monday at 06:00 UTC</option></select></label>}<label className="text-xs text-zinc-500">Then<select className={`${input} mt-2`} value={actionType} onChange={(event) => setActionType(event.target.value)}><option value="none">Record completion and notify configured webhooks</option><option value="open_pull_request">Open a pull request</option><option value="deploy">Restart an environment’s ECS service</option></select></label>{actionType !== "none" && <><label className="text-xs text-zinc-500">Repository<select className={`${input} mt-2`} value={repositoryVerified ? repository : ""} onChange={(event) => { const repo = repositories.find((item) => item.fullName === event.target.value); setRepository(event.target.value); setSourceRef(repo?.defaultBranch ?? "main"); setBranchCatalog(null); }}><option value="">Select a repository</option>{repositories.map((repo) => <option key={repo.fullName} value={repo.fullName}>{repo.fullName}</option>)}</select></label><label className="text-xs text-zinc-500">Source branch<select className={`${input} mt-2`} value={sourceVerified ? sourceRef : ""} onChange={(event) => setSourceRef(event.target.value)}><option value="" disabled>{branchStatus === "loading" ? "Loading verified branches…" : "Select a verified branch"}</option>{branches.map((branch) => <option key={branch.name} value={branch.name}>{branch.name}{branch.protected ? " · protected" : ""}</option>)}</select>{branchStatus === "error" && <span role="status">Source branches could not be verified. <button type="button" className={button} disabled={busy || !repositoryVerified} onClick={() => { setBranchCatalog(null); setBranchRequest((request) => request + 1); }}>Retry source branches</button></span>}</label></>}{actionType === "deploy" && <label className="text-xs text-zinc-500">Target environment<select className={`${input} mt-2`} value={environments.some((environment) => environment.id === environmentId) ? environmentId : ""} onChange={(event) => setEnvironmentId(event.target.value)}><option value="" disabled>Select an environment</option>{environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name} · {environment.tier}</option>)}</select></label>}<button className="text-left text-xs text-zinc-500 hover:text-zinc-300" onClick={() => setAdvanced(!advanced)}>Advanced dependencies and approval {advanced ? "−" : "+"}</button>{advanced && <div className="rounded-xl border border-white/[0.07] p-4"><p className="text-xs text-zinc-400">Require these DAGs to be successful too</p><div className="mt-3 max-h-32 space-y-2 overflow-auto">{dags.filter((dag) => dag.dagId !== dagId).map((dag) => <label key={dag.dagId} className="flex items-center gap-2 text-xs text-zinc-500"><input type="checkbox" checked={dependencies.includes(dag.dagId)} onChange={(event) => setDependencies((current) => event.target.checked ? [...current, dag.dagId] : current.filter((id) => id !== dag.dagId))}/>{dag.displayName}</label>)}</div><label className="mt-4 flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={effectiveApproval} disabled={actionType !== "none"} onChange={(event) => setApprovalRequired(event.target.checked)}/>Require human approval {actionType !== "none" ? "(locked for GitHub and cloud changes)" : ""}</label></div>}<button disabled={!canCreate} onClick={() => canCreate && void onRun(() => desktopClient.createAirflowAutomation({ name, dagId, triggerMode, scheduleCron: triggerMode === "schedule" ? scheduleCron : null, requiredDagState: "success", dependencyDagIds: dependencies, actionType, repositoryFullName: actionType === "none" ? null : repository, sourceRef, sourceKind: "branch", pullRequestBase: selectedRepo?.defaultBranch ?? "main", pullRequestTitle: `Automated update after ${dagId}`, environmentId: actionType === "deploy" ? environmentId : null, approvalRequired: effectiveApproval, maxRetries: 3, retryDelaySeconds: 60, notifyOnSuccess: true, notifyOnFailure: true }), "Automation created. It will be evaluated by the secure scheduler." )} className="btn-primary">Create automation</button></div></div><div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-6"><h2 className="text-base font-medium">Active rules</h2><div className="mt-4 space-y-3">{automations.length ? automations.map((automation) => <div key={automation.id} className="rounded-xl border border-white/[0.07] p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-zinc-200">{automation.name}</p><p className="mt-1 text-xs text-zinc-600">{automation.dagId} → {automation.actionType.replaceAll("_", " ")}</p></div><button disabled={busy} onClick={() => void onRun(() => desktopClient.setAirflowAutomationEnabled(automation.id, !automation.enabled), `Automation ${automation.enabled ? "paused" : "enabled"}.`)} className={button}>{automation.enabled ? "Pause" : "Enable"}</button></div><p className="mt-3 text-[10px] text-zinc-600">{automation.approvalRequired ? "Approval required" : "Automatic read-only action"}{automation.nextScheduledAt ? ` · next ${new Date(automation.nextScheduledAt).toLocaleString()}` : ""}</p></div>) : <p className="py-8 text-center text-xs text-zinc-600">No automations yet.</p>}</div></div></section>;
}

function ExecutionPanel({ executions, automations, busy, onRun }: { executions: AirflowAutomationExecution[]; automations: AirflowAutomation[]; busy: boolean; onRun: (work: () => Promise<{ ok: boolean; error?: string }>, success: string) => Promise<void> }) { const pending = useMemo(() => executions.filter((item) => item.status === "pending_approval"), [executions]); return <section className="mt-8 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-6"><h2 className="text-base font-medium">Action approvals</h2><p className="mt-1 text-xs text-zinc-500">Review the exact DAG evidence and destination before anything changes GitHub or cloud.</p><div className="mt-5 space-y-3">{pending.length ? pending.map((execution) => <div key={execution.id} className="rounded-xl border border-white/[0.08] p-4"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-zinc-200">{automations.find((item) => item.id === execution.automationId)?.name ?? "Airflow action"}</p><p className="mt-1 text-xs text-zinc-600">{execution.sourceDagId} · {execution.sourceDagRunId} · {execution.sourceDagState}</p></div>{automations.find((item) => item.id === execution.automationId)?.actionType !== "deploy" && <div className="flex gap-2"><button disabled={busy} onClick={() => void onRun(() => desktopClient.rejectAirflowExecution(execution.id), "Action rejected and recorded." )} className={button}>Reject</button><button disabled={busy} onClick={() => void onRun(() => desktopClient.approveAirflowExecution(execution.id), "Approval processed. Review the recorded outcome." )} className="btn-primary">Approve & run</button></div>}</div>{automations.find((item) => item.id === execution.automationId)?.actionType === "deploy" && <AirflowRestartReviewCard executionId={execution.id} busy={busy} onRun={onRun} />}</div>) : <p className="py-10 text-center text-xs text-zinc-600">No actions are waiting for approval.</p>}</div>{executions.filter((item) => item.status !== "pending_approval").slice(0, 20).map((execution) => <div key={execution.id} className="mt-2 flex items-center justify-between border-t border-white/[0.05] pt-3 text-xs"><span className="truncate text-zinc-500">{execution.sourceDagId} · {execution.sourceDagRunId}</span><span className="ml-4 text-zinc-400">{execution.status === "needs_reconciliation" ? "Outcome unconfirmed — review before retrying" : execution.status}{execution.attempt ? ` · ${execution.attempt} attempt${execution.attempt === 1 ? "" : "s"}` : ""}</span></div>)}</section>; }
