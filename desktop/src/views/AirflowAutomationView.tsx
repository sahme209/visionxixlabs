import {DesktopDialog} from "../components/DesktopDialog";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Clock3, DatabaseZap, Play, RefreshCw, ShieldCheck, Workflow } from "lucide-react";
import { ViewShell } from "../components/Primitives";
import { desktopClient, type AirflowAutomation, type AirflowAutomationExecution, type AirflowDag, type AirflowDagRun } from "../lib/desktopClient";

import { AirflowRunTasks } from "../components/AirflowRunTasks";
import { AirflowRestartReviewCard } from "../components/AirflowRestartReviewCard";

type ReadState = "loading" | "ready" | "unavailable";
type Tab = "dags" | "automations" | "approvals" | "connection";
const input = "min-h-10 w-full rounded-lg border border-white/[0.1] bg-white/[0.025] px-3 text-sm text-zinc-200 outline-none focus:border-white/20";
const button = "rounded-lg border border-white/[0.1] px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.06] disabled:opacity-40";
const recoveryNotices: Record<string, string> = {
  connection_validation_failed: "The Airflow connection could not be validated. Check the endpoint and credentials, then try again.",
  airflow_connection_failed: "The Airflow connection could not be validated. Check the endpoint and credentials, then try again.",
  credentials_required: "Enter the required Airflow credentials before connecting.",
  airflow_not_connected: "Connect and validate Airflow before starting this action.",
  desktop_session_required: "Your desktop session needs verification. Sign in again before continuing.",
  invalid_automation_configuration: "Review the automation name, DAG, action and UTC schedule before saving.",
  deployment_environment_required: "Choose an available deployment environment before saving.",
  repository_required: "Choose an available repository before saving this action.",
  airflow_connection_changed: "The Airflow connection changed. Refresh and review the current connection before continuing.",
  airflow_source_not_ready: "The source run no longer meets this automation's required state. Review its current history.",
  airflow_dependencies_not_ready: "Required dependency runs are not ready. Review their current states before continuing.",
  airflow_preconditions_unavailable: "The source and dependency checks could not be completed. Refresh before continuing.",
  airflow_human_approval_required: "This action requires an authorized human approval of its recorded destination.",
  airflow_execution_not_actionable: "This recorded action is no longer available to execute. Refresh its history.",
  deployment_quota_exhausted: "The workspace's deployment allowance is exhausted. Review usage and billing in the cockpit.",
  automation_not_found: "This automation is no longer available. Refresh the workspace.",
  automation_has_audit_history_pause_instead: "This automation has recorded audit history. Pause it to retain its evidence.",
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

export function AirflowAutomationView({onInspect}: {onInspect?: (dagId: string, runId?: string) => void} = {}) {
  const revision = useSyncExternalStore(desktopClient.subscribeContext, desktopClient.getContextRevision);
  return <AirflowWorkspaceView key={revision} onInspect={onInspect} />;
}

function AirflowWorkspaceView({onInspect}: {onInspect?: (dagId: string, runId?: string) => void}) {
  const [contextRevision] = useState(desktopClient.getContextRevision);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [hasDagCatalog, setHasDagCatalog] = useState(false);
  const [dagState, setDagState] = useState<ReadState>("loading");
  const [automationState, setAutomationState] = useState<ReadState>("loading");
  const [historyState, setHistoryState] = useState<ReadState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [watchRuns, setWatchRuns] = useState(false);
  const [runReview, setRunReview] = useState<string | null>(null);
  const actionInFlight = useRef(false);
  const [tab, setTab] = useState<Tab>("dags");
  const [connectionState, setConnectionState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [connection, setConnection] = useState<{ connected: boolean; status: string; baseUrl?: string; version?: string | null; dagCount?: number | null } | null>(null);
  const [dags, setDags] = useState<AirflowDag[]>([]); const [dagId, setDagId] = useState(""); const [runHistory, setRunHistory] = useState<{ dagId: string; runs: AirflowDagRun[] } | null>(null);
  const historyRequest = useRef(0);
  const [historyRevision, setHistoryRevision] = useState(0);
  const workspaceRequest = useRef(0);
  const selectedDag = dags.find((dag) => dag.dagId === dagId);
  const selectedDagId = selectedDag?.dagId ?? "";
  const runs = selectedDagId && runHistory?.dagId === selectedDagId ? runHistory.runs : [];
  const [automations, setAutomations] = useState<AirflowAutomation[]>([]); const [executions, setExecutions] = useState<AirflowAutomationExecution[]>([]);
  const [repositories, setRepositories] = useState<Array<{ fullName: string; defaultBranch: string }>>([]);
  const [environments, setEnvironments] = useState<Array<{ id: string; name: string; tier: string }>>([]);
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!mounted.current) return;
    const request = ++workspaceRequest.current;
    const current = () => mounted.current && request === workspaceRequest.current && contextRevision === desktopClient.getContextRevision();
    setRefreshing(true); setDagState("loading"); setAutomationState("loading");
    setDags([]); setRepositories([]); setEnvironments([]); setRunReview(null);
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
        if (!result.data.connected) { setDagState("ready"); return; }
        try {
          const dagResult = await desktopClient.listAirflowDags();
          if (!current()) return;
          setDagState(dagResult.ok ? "ready" : "unavailable");
          if (dagResult.ok) { setHasDagCatalog(true); setDags(dagResult.data.dags); setDagId((selected) => dagResult.data.dags.some(dag => dag.dagId === selected) ? selected : dagResult.data.dags[0]?.dagId || ""); }
        } catch { if (current()) setDagState("unavailable"); }
      }),
      read(async () => {
        try {
          const result = await desktopClient.listAirflowAutomations();
          if (!current()) return;
          setAutomationState(result.ok ? "ready" : "unavailable");
          if (result.ok) { setAutomations(result.data.automations); setExecutions(result.data.executions); }
          else { setAutomations([]); setExecutions([]); }
        } catch { if (current()) { setAutomationState("unavailable"); setAutomations([]); setExecutions([]); } }
      }),
    ]);
    if (current()) setRefreshing(false);
  }, [contextRevision]);
  useEffect(() => {
    const requestState = workspaceRequest;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => { window.clearTimeout(timer); requestState.current++; };
  }, [load]);
  const refreshRuns = useCallback(async () => {
    const request = ++historyRequest.current;
    if (!mounted.current || !selectedDagId || contextRevision !== desktopClient.getContextRevision()) return;
    const current = () => mounted.current && request === historyRequest.current && contextRevision === desktopClient.getContextRevision();
    setHistoryState("loading"); setRunHistory(null);
    try {
      const result = await desktopClient.listAirflowDagRuns(selectedDagId);
      if (!current()) return;
      setHistoryState(result.ok ? "ready" : "unavailable");
      if (result.ok) setRunHistory({ dagId: selectedDagId, runs: result.data.runs });
    } catch {
      if (current()) setHistoryState("unavailable");
    }
  }, [selectedDagId, contextRevision]);
  useEffect(() => {
    const requestState = historyRequest;
    void refreshRuns();
    return () => { requestState.current++; };
  }, [refreshRuns, historyRevision]);

  useEffect(() => {
    if (!watchRuns || tab !== "dags" || !selectedDagId || connectionState !== "ready" || !connection?.connected || historyState === "loading") return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refreshRuns(); }, 15_000);
    return () => window.clearInterval(timer);
  }, [watchRuns, tab, selectedDagId, connectionState, connection?.connected, historyState, refreshRuns]);

  async function act(work: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    if (!mounted.current || contextRevision !== desktopClient.getContextRevision() || actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true); setNotice(null);
    try {
      const result = await work();
      if (!mounted.current || contextRevision !== desktopClient.getContextRevision()) return;
      setNotice(result.ok ? success : recoveryNotices[result.error ?? ""] ?? "The action's outcome could not be confirmed. Refresh and review its history before retrying.");
      // A failed response can mean the external outcome is uncertain. Refresh
      // history on both paths so the operator sees the reconciliation hold.
      await load();
    } catch {
      if (mounted.current && contextRevision === desktopClient.getContextRevision()) { setNotice("The action's outcome could not be confirmed. Refresh and review its history before retrying."); await load(); }
    } finally {
      actionInFlight.current = false;
      if (mounted.current && contextRevision === desktopClient.getContextRevision()) { setBusy(false); setHistoryRevision(value => value + 1); }
    }
  }

  return <ViewShell><div className="mx-auto w-full max-w-6xl pb-14">
    <div className="flex items-start justify-between gap-5"><div><h1 className="text-2xl font-semibold tracking-tight">Airflow automation</h1><p className="mt-1.5 max-w-3xl text-sm leading-6 text-zinc-500">Select real DAGs, watch batch completion, and turn successful runs into governed pull requests or service restarts.</p></div><div className="flex items-center gap-2 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-2 text-[11px] text-emerald-200"><ShieldCheck className="h-3.5 w-3.5"/>Approvals and audit always on</div></div>
    <div className="mt-6 flex flex-wrap items-center gap-2"><button type="button" aria-label="Refresh Airflow workspace" disabled={busy || refreshing} onClick={() => void load()} className={`${button} ml-auto order-last`}><RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />{refreshing ? "Refreshing…" : "Refresh"}</button>{(["dags", "automations", "approvals", "connection"] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`${button} capitalize ${tab === item ? "bg-white/[0.09] text-white" : ""}`}>{item}</button>)}</div>
    {dagState === "unavailable" && connection?.connected && <p role="alert" className="mt-4 text-xs text-amber-200">DAG catalog could not be verified. Refresh before running or configuring a DAG.</p>}
    {automationState === "unavailable" && <p role="alert" className="mt-4 text-xs text-amber-200">Automation history could not be verified. Refresh before reviewing or changing rules and approvals.</p>}
    {notice && <div role="status" className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-xs text-zinc-300">{notice}</div>}
    {connectionState === "loading" && <p role="status" className="mt-6 text-sm text-zinc-400">Checking Airflow connection…</p>}
    {connectionState === "unavailable" && <div role="alert" className="mt-6 rounded-xl border border-amber-300/20 p-4"><h2 className="text-sm">Airflow connection status unavailable</h2><p className="mt-2 text-xs text-zinc-400">The service could not confirm this workspace connection. Existing connections are not removed. Refresh before configuring or running work.</p><button type="button" onClick={() => void load()} className={`${button} mt-3`}>Retry connection status</button></div>}
    {connectionState === "ready" && !connection?.connected && tab !== "connection" && <div className="mt-8 rounded-2xl border border-amber-300/15 bg-amber-300/[0.03] p-6"><h2 className="text-sm font-medium">Connect Airflow first</h2><p className="mt-2 text-xs leading-5 text-zinc-500">An administrator connects one HTTPS Airflow 3 endpoint. Credentials remain encrypted on the Axiom service.</p><button onClick={() => setTab("connection")} className="btn-primary mt-4">Open connection setup</button></div>}
    {tab === "connection" && connectionState !== "unavailable" && connection !== null && <ConnectionPanel connection={connection} busy={busy} onRun={act} />}
    {tab === "dags" && connectionState === "ready" && connection?.connected && <section className="mt-8 grid gap-5 lg:grid-cols-[340px_1fr]"><div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5"><div className="flex items-center gap-2 text-sm"><Workflow className="h-4 w-4"/>DAG</div><select className={`${input} mt-4`} value={selectedDagId} onChange={(event) => setDagId(event.target.value)}><option value="" disabled>Select an available DAG</option>{dags.map((dag) => <option key={dag.dagId} value={dag.dagId}>{dag.displayName}{dag.paused ? " · paused" : ""}</option>)}</select><p className="mt-3 text-xs leading-5 text-zinc-500">{dags.find((dag) => dag.dagId === dagId)?.description ?? "No DAG description provided."}</p><button disabled={busy || !selectedDag || selectedDag.paused} onClick={() => selectedDag && !selectedDag.paused && setRunReview(selectedDag.dagId)} className="btn-primary mt-5 w-full"><Play className="mr-2 inline h-3.5 w-3.5"/>Run now</button>{onInspect && <button type="button" disabled={!selectedDag || dagState !== "ready"} onClick={() => selectedDag && onInspect(selectedDag.dagId)} className={`${button} mt-2 w-full`}>Investigate with Agent</button>}</div><RunHistory key={selectedDagId} watchRuns={watchRuns} onWatchChange={setWatchRuns} runs={runs} onInspect={onInspect ? runId => onInspect(selectedDagId, runId) : undefined} state={selectedDagId ? historyState : "ready"} onRefresh={() => void refreshRuns()}/></section>}
    {hasDagCatalog && <div hidden={tab !== "automations"} style={{display:tab === "automations" ? "block" : "none"}}><AutomationPanel active={tab === "automations"} verified={connectionState === "ready" && Boolean(connection?.connected) && dagState === "ready" && automationState === "ready"} dags={dags} repositories={repositories} environments={environments} automations={automations} busy={busy} onRun={act} /></div>}
    {tab === "approvals" && automationState === "loading" && <p role="status" className="mt-6 text-xs text-zinc-400">Loading automation history…</p>}
    {tab === "approvals" && automationState === "ready" && <ExecutionPanel executions={executions} automations={automations} busy={busy} onRun={act} />}
    {runReview && <DesktopDialog label="Run Airflow DAG" busy={busy} onClose={() => setRunReview(null)}><h2 className="text-sm font-semibold">Run this DAG?</h2><p className="mt-3 break-all text-xs text-zinc-300">{runReview}</p><p className="mt-2 text-xs leading-5 text-zinc-500">Starts one real run at the connected Airflow endpoint using the DAG’s default configuration. Its tasks may change external systems. Axiom’s service verifies execution permission.</p><div className="mt-5 flex justify-end gap-2"><button type="button" className={button} onClick={() => setRunReview(null)}>Cancel</button><button type="button" className="btn-primary" disabled={busy || dagState !== "ready" || selectedDag?.dagId !== runReview || selectedDag.paused} onClick={() => { const reviewed=runReview; setRunReview(null); if (dagState === "ready" && selectedDag?.dagId === reviewed && !selectedDag.paused) void act(() => desktopClient.triggerAirflowDag(reviewed), "DAG run queued in Airflow."); }}>Confirm DAG run</button></div></DesktopDialog>}
  </div></ViewShell>;
}

function ConnectionPanel({ connection, busy, onRun }: { connection: { connected: boolean; status: string; baseUrl?: string; version?: string | null; dagCount?: number | null } | null; busy: boolean; onRun: (work: () => Promise<{ ok: boolean; error?: string }>, success: string) => Promise<void> }) {
  const [baseUrl, setBaseUrl] = useState(connection?.baseUrl ?? ""); const [authMode, setAuthMode] = useState<"username_password" | "token">("username_password"); const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [token, setToken] = useState("");
  let validOrigin = false;
  try { const url = new URL(baseUrl.trim()); validOrigin = url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && url.pathname === "/"; } catch { /* Editable incomplete origin. */ }
  const canConnect = validOrigin && (authMode === "username_password" ? Boolean(username.trim() && password) : Boolean(token.trim()));
  return <section className="mt-8 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-6"><div className="flex items-center gap-3"><DatabaseZap className="h-5 w-5 text-violet-200"/><div><h2 className="text-base font-medium">Secure Airflow connection</h2><p className="mt-1 text-xs text-zinc-500">Airflow 3 REST API v2 · HTTPS only · private-address and redirect protection</p></div></div>{connection?.connected && <div className="mt-5 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4 text-xs text-zinc-300"><CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-300"/>{connection.baseUrl} · Airflow {connection.version ?? "3.x"} · {connection.dagCount ?? 0} DAGs</div>}<div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs text-zinc-500 sm:col-span-2">Airflow HTTPS origin<input className={`${input} mt-2`} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://airflow.example.com" /></label><label className="text-xs text-zinc-500">Authentication<select className={`${input} mt-2`} value={authMode} onChange={(event) => setAuthMode(event.target.value as typeof authMode)}><option value="username_password">Airflow username and password</option><option value="token">Managed bearer token (advanced)</option></select></label>{authMode === "username_password" ? <><label className="text-xs text-zinc-500">Username<input className={`${input} mt-2`} value={username} onChange={(event) => setUsername(event.target.value)} /></label><label className="text-xs text-zinc-500 sm:col-span-2">Password<input type="password" className={`${input} mt-2`} value={password} onChange={(event) => setPassword(event.target.value)} /></label></> : <label className="text-xs text-zinc-500">Bearer token<input type="password" className={`${input} mt-2`} value={token} onChange={(event) => setToken(event.target.value)} /></label>}</div><div className="mt-5 flex gap-2"><button disabled={busy || !canConnect} onClick={() => canConnect && void onRun(async () => {
      const result = await desktopClient.saveAirflowConnection({ baseUrl, authMode, username, password, token });
      if (result.ok) {
        setPassword((current) => current === password ? "" : current);
        setToken((current) => current === token ? "" : current);
      }
      return result;
    }, "Airflow connection validated and saved." )} className="btn-primary">{busy ? "Validating…" : "Validate & connect"}</button>{connection?.connected && <button disabled={busy} onClick={() => void onRun(() => desktopClient.disconnectAirflow(), "Airflow disconnected; its automations are disabled." )} className={button}>Disconnect</button>}</div></section>;
}

function RunHistory({ runs, state, onRefresh, onInspect, watchRuns, onWatchChange }: { runs: AirflowDagRun[]; state: ReadState; onRefresh: () => void; onInspect?: (runId: string) => void; watchRuns: boolean; onWatchChange: (watch: boolean) => void }) { return <div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5"><div className="flex items-center justify-between"><h2 className="text-sm font-medium">Recent runs</h2><div className="flex items-center gap-2"><button type="button" aria-label="Auto-refresh runs" aria-pressed={watchRuns} onClick={() => onWatchChange(!watchRuns)} className={`${button} ${watchRuns ? "bg-white/10" : ""}`}>{watchRuns ? "Watching · 15s" : "Watch runs"}</button><button aria-label="Refresh run history" disabled={state === "loading"} onClick={onRefresh} className={button}><RefreshCw className="h-3.5 w-3.5"/></button></div></div><div className="mt-4 divide-y divide-white/[0.06]">{state === "loading" ? <p role="status" className="py-8 text-xs text-zinc-500">Loading run history…</p> : state === "unavailable" ? <p role="alert" className="py-8 text-xs text-amber-200">Run history could not be verified. Refresh to observe the provider’s current state.</p> : runs.length ? runs.map((run) => <div key={run.dagRunId} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate text-xs text-zinc-200">{run.dagRunId}</p><p className="mt-1 text-[10px] text-zinc-600">{run.logicalDate ? new Date(run.logicalDate).toLocaleString() : "No logical date"}</p></div>{onInspect && <button type="button" aria-label={`Investigate ${run.dagRunId} with Agent`} onClick={() => onInspect(run.dagRunId)} className={button}>Investigate</button>}<AirflowRunTasks key={`${run.dagId}:${run.dagRunId}`} dagId={run.dagId} runId={run.dagRunId}/><span className={`rounded-full border px-2 py-1 text-[10px] ${run.state === "success" ? "border-emerald-400/20 text-emerald-300" : run.state === "failed" ? "border-rose-400/20 text-rose-300" : "border-white/10 text-zinc-400"}`}>{run.state}</span></div>) : <p className="py-8 text-center text-xs text-zinc-600">No runs returned.</p>}</div></div>; }

function AutomationPanel({ active, verified, dags, repositories, environments, automations, busy, onRun }: { active: boolean; verified: boolean; dags: AirflowDag[]; repositories: Array<{ fullName: string; defaultBranch: string }>; environments: Array<{ id: string; name: string; tier: string }>; automations: AirflowAutomation[]; busy: boolean; onRun: (work: () => Promise<{ ok: boolean; error?: string }>, success: string) => Promise<void> }) {
  const [name, setName] = useState(""); const [dagId, setDagId] = useState(dags[0]?.dagId ?? ""); const [triggerMode, setTriggerMode] = useState("dag_completion"); const [scheduleCron, setScheduleCron] = useState("0 6 * * *"); const [actionType, setActionType] = useState("none"); const [repository, setRepository] = useState(repositories[0]?.fullName ?? ""); const selectedRepo = repositories.find((item) => item.fullName === repository); const [sourceRef, setSourceRef] = useState(selectedRepo?.defaultBranch ?? "main"); const [branchCatalog, setBranchCatalog] = useState<{ repository: string; status: "ready" | "error"; branches: Array<{ name: string; protected: boolean }> } | null>(null); const [environmentId, setEnvironmentId] = useState(environments[0]?.id ?? ""); const [approvalRequired, setApprovalRequired] = useState(true); const [dependencies, setDependencies] = useState<string[]>([]); const [advanced, setAdvanced] = useState(false);
  const [branchRequest, setBranchRequest] = useState(0);
  const repositoryVerified = !!selectedRepo;
  const branches = branchCatalog?.repository === repository ? branchCatalog.branches : [];
  const branchStatus = branchCatalog?.repository === repository ? branchCatalog.status : "loading";
  const sourceVerified = branchStatus === "ready" && branches.some((branch) => branch.name === sourceRef);
  const canCreate = verified && !busy && !!name.trim() && dags.some((dag) => dag.dagId === dagId)
    && dependencies.every((dependency) => dags.some((dag) => dag.dagId === dependency))
    && (actionType === "none" || (repositoryVerified && sourceVerified))
    && (actionType !== "deploy" || environments.some((environment) => environment.id === environmentId));
  const effectiveApproval = actionType === "none" ? approvalRequired : true;
  useEffect(() => {
    let cancelled = false;
    if (!active || !repositoryVerified) return;
    void desktopClient.listGithubBranches(repository).then((result) => {
      if (cancelled) return;
      setBranchCatalog({ repository, status: result.ok ? "ready" : "error", branches: result.ok ? result.data.branches : [] });
    }).catch(() => { if (!cancelled) setBranchCatalog({ repository, status: "error", branches: [] }); });
    return () => { cancelled = true; };
  }, [active, repository, repositoryVerified, branchRequest]);
  return <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_1fr]"><div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-6"><h2 className="text-base font-medium">New automation</h2><p className="mt-1 text-xs text-zinc-500">A guided rule watches a batch and proposes or performs one governed action.</p><fieldset disabled={busy || !verified} className="mt-5 grid gap-4"><legend className="sr-only">Automation configuration</legend><label className="text-xs text-zinc-500">Name<input className={`${input} mt-2`} value={name} onChange={(event) => setName(event.target.value)} placeholder="Promote daily customer import"/></label><label className="text-xs text-zinc-500">When this DAG<select className={`${input} mt-2`} value={dags.some((dag) => dag.dagId === dagId) ? dagId : ""} onChange={(event) => setDagId(event.target.value)}><option value="" disabled>Select a DAG</option>{dags.map((dag) => <option key={dag.dagId} value={dag.dagId}>{dag.displayName}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2"><button className={`${button} ${triggerMode === "dag_completion" ? "bg-white/[0.09]" : ""}`} onClick={() => setTriggerMode("dag_completion")}>Finishes successfully</button><button className={`${button} ${triggerMode === "schedule" ? "bg-white/[0.09]" : ""}`} onClick={() => setTriggerMode("schedule")}><Clock3 className="mr-1 inline h-3.5 w-3.5"/>Run on schedule</button></div>{triggerMode === "schedule" && <label className="text-xs text-zinc-500">Schedule<select className={`${input} mt-2`} value={scheduleCron} onChange={(event) => setScheduleCron(event.target.value)}><option value="0 * * * *">Every hour</option><option value="0 6 * * *">Every day at 06:00 UTC</option><option value="0 6 * * 1">Every Monday at 06:00 UTC</option></select></label>}<label className="text-xs text-zinc-500">Then<select className={`${input} mt-2`} value={actionType} onChange={(event) => setActionType(event.target.value)}><option value="none">Record completion and notify configured webhooks</option><option value="open_pull_request">Open a pull request</option><option value="deploy">Restart an environment’s ECS service</option></select></label>{actionType !== "none" && <><label className="text-xs text-zinc-500">Repository<select className={`${input} mt-2`} value={repositoryVerified ? repository : ""} onChange={(event) => { const repo = repositories.find((item) => item.fullName === event.target.value); setRepository(event.target.value); setSourceRef(repo?.defaultBranch ?? "main"); setBranchCatalog(null); }}><option value="">Select a repository</option>{repositories.map((repo) => <option key={repo.fullName} value={repo.fullName}>{repo.fullName}</option>)}</select></label><label className="text-xs text-zinc-500">Source branch<select className={`${input} mt-2`} value={sourceVerified ? sourceRef : ""} onChange={(event) => setSourceRef(event.target.value)}><option value="" disabled>{branchStatus === "loading" ? "Loading verified branches…" : "Select a verified branch"}</option>{branches.map((branch) => <option key={branch.name} value={branch.name}>{branch.name}{branch.protected ? " · protected" : ""}</option>)}</select>{branchStatus === "error" && <span role="status">Source branches could not be verified. <button type="button" className={button} disabled={busy || !repositoryVerified} onClick={() => { setBranchCatalog(null); setBranchRequest((request) => request + 1); }}>Retry source branches</button></span>}</label></>}{actionType === "deploy" && <label className="text-xs text-zinc-500">Target environment<select className={`${input} mt-2`} value={environments.some((environment) => environment.id === environmentId) ? environmentId : ""} onChange={(event) => setEnvironmentId(event.target.value)}><option value="" disabled>Select an environment</option>{environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name} · {environment.tier}</option>)}</select></label>}<button className="text-left text-xs text-zinc-500 hover:text-zinc-300" onClick={() => setAdvanced(!advanced)}>Advanced dependencies and approval {advanced ? "−" : "+"}</button>{advanced && <div className="rounded-xl border border-white/[0.07] p-4"><p className="text-xs text-zinc-400">Require these DAGs to be successful too</p><div className="mt-3 max-h-32 space-y-2 overflow-auto">{dags.filter((dag) => dag.dagId !== dagId).map((dag) => <label key={dag.dagId} className="flex items-center gap-2 text-xs text-zinc-500"><input type="checkbox" checked={dependencies.includes(dag.dagId)} onChange={(event) => setDependencies((current) => event.target.checked ? [...current, dag.dagId] : current.filter((id) => id !== dag.dagId))}/>{dag.displayName}</label>)}</div><label className="mt-4 flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={effectiveApproval} disabled={actionType !== "none"} onChange={(event) => setApprovalRequired(event.target.checked)}/>Require human approval {actionType !== "none" ? "(locked for GitHub and cloud changes)" : ""}</label></div>}<button disabled={!canCreate} onClick={() => canCreate && void onRun(() => desktopClient.createAirflowAutomation({ name, dagId, triggerMode, scheduleCron: triggerMode === "schedule" ? scheduleCron : null, requiredDagState: "success", dependencyDagIds: dependencies, actionType, repositoryFullName: actionType === "none" ? null : repository, sourceRef, sourceKind: "branch", pullRequestBase: selectedRepo?.defaultBranch ?? "main", pullRequestTitle: `Automated update after ${dagId}`, environmentId: actionType === "deploy" ? environmentId : null, approvalRequired: effectiveApproval, maxRetries: 3, retryDelaySeconds: 60, notifyOnSuccess: true, notifyOnFailure: true }), "Automation created. It will be evaluated by the secure scheduler." )} className="btn-primary">Create automation</button></fieldset></div>{active && <div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-6"><h2 className="text-base font-medium">Active rules</h2><div className="mt-4 space-y-3">{automations.length ? automations.map((automation) => <div key={automation.id} className="rounded-xl border border-white/[0.07] p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-zinc-200">{automation.name}</p><p className="mt-1 text-xs text-zinc-600">{automation.dagId} → {automation.actionType.replaceAll("_", " ")}</p></div><button disabled={busy || !verified} onClick={() => void onRun(() => desktopClient.setAirflowAutomationEnabled(automation.id, !automation.enabled), `Automation ${automation.enabled ? "paused" : "enabled"}.`)} className={button}>{automation.enabled ? "Pause" : "Enable"}</button></div><p className="mt-3 text-[10px] text-zinc-600">{automation.approvalRequired ? "Approval required" : "Automatic read-only action"}{automation.nextScheduledAt ? ` · next ${new Date(automation.nextScheduledAt).toLocaleString()}` : ""}</p></div>) : <p className="py-8 text-center text-xs text-zinc-600">No automations yet.</p>}</div></div>}</section>;
}

function ExecutionPanel({ executions, automations, busy, onRun }: { executions: AirflowAutomationExecution[]; automations: AirflowAutomation[]; busy: boolean; onRun: (work: () => Promise<{ ok: boolean; error?: string }>, success: string) => Promise<void> }) { const pending = useMemo(() => executions.filter((item) => item.status === "pending_approval"), [executions]); return <section className="mt-8 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-6"><h2 className="text-base font-medium">Action approvals</h2><p className="mt-1 text-xs text-zinc-500">Review the exact DAG evidence and destination before anything changes GitHub or cloud.</p><div className="mt-5 space-y-3">{pending.length ? pending.map((execution) => <div key={execution.id} className="rounded-xl border border-white/[0.08] p-4"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-zinc-200">{automations.find((item) => item.id === execution.automationId)?.name ?? "Airflow action"}</p><p className="mt-1 text-xs text-zinc-600">{execution.sourceDagId} · {execution.sourceDagRunId} · {execution.sourceDagState}</p></div>{automations.find((item) => item.id === execution.automationId)?.actionType !== "deploy" && <div className="flex gap-2"><button disabled={busy} onClick={() => void onRun(() => desktopClient.rejectAirflowExecution(execution.id), "Action rejected and recorded." )} className={button}>Reject</button><button disabled={busy} onClick={() => void onRun(() => desktopClient.approveAirflowExecution(execution.id), "Approval processed. Review the recorded outcome." )} className="btn-primary">Approve & run</button></div>}</div>{automations.find((item) => item.id === execution.automationId)?.actionType === "deploy" && <AirflowRestartReviewCard executionId={execution.id} busy={busy} onRun={onRun} />}</div>) : <p className="py-10 text-center text-xs text-zinc-600">No actions are waiting for approval.</p>}</div>{executions.filter((item) => item.status !== "pending_approval").slice(0, 20).map((execution) => <div key={execution.id} className="mt-2 flex items-center justify-between border-t border-white/[0.05] pt-3 text-xs"><span className="truncate text-zinc-500">{execution.sourceDagId} · {execution.sourceDagRunId}</span><span className="ml-4 text-zinc-400">{execution.status === "needs_reconciliation" ? "Outcome unconfirmed — review before retrying" : execution.status}{execution.attempt ? ` · ${execution.attempt} attempt${execution.attempt === 1 ? "" : "s"}` : ""}</span></div>)}</section>; }
