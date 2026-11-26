import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, CircleCheck, Clock, Columns3, GitBranch, LayoutGrid, List, RefreshCw, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import { z } from "zod";
import { DesktopDialog } from "../components/DesktopDialog";
import { desktopClient } from "../lib/desktopClient";
import { useSearchShortcut } from "../lib/useSearchShortcut";
import "./RepositoryDirectoryView.css";

const providers = {github: "GitHub", gitlab: "GitLab", azuredevops: "Azure DevOps", other: "Other"};
const repositoryList = z.object({
  repositories: z.array(z.object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    provider: z.enum(["github", "gitlab", "azuredevops", "other"]),
    defaultBranch: z.string(),
    protectionStrength: z.enum(["strong", "weak", "none"]),
    openPrCount: z.number().int().nonnegative(),
    lastWorkflow: z.object({
      name: z.string(), state: z.string(), conclusion: z.string().nullable(),
      startedAtIso: z.iso.datetime().nullish().catch(null),
      commitSha: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i).nullish().catch(null),
      syncedAtIso: z.iso.datetime().nullish().catch(null),
    }).nullable(),
  })).refine(rows => new Set(rows.map(row => row.id)).size === rows.length),
});
type Repository = z.output<typeof repositoryList>["repositories"][number];
type Directory = {state: "loading" | "unavailable"} | {state: "ready"; rows: Repository[]};
const pageSize = 8;
const workflowFilters = [
  {id: "all", label: "All repositories", summary: "registered repositories"},
  {id: "success", label: "Successful workflow", summary: "successful workflows"},
  {id: "failure", label: "Failed workflow", summary: "failed workflows"},
  {id: "unrecorded", label: "No recorded workflow", summary: "without recorded workflow"},
] as const;
type WorkflowFilter = (typeof workflowFilters)[number]["id"];
type WorkflowSyncOrder = "" | "newest" | "oldest";

function compareWorkflowSync(a: Repository, b: Repository, order: Exclude<WorkflowSyncOrder, "">) {
  const left = a.lastWorkflow?.syncedAtIso;
  const right = b.lastWorkflow?.syncedAtIso;
  if (!left) return right ? 1 : 0;
  if (!right) return -1;
  const age = Date.parse(left) - Date.parse(right);
  return order === "oldest" ? age : -age;
}

function matchesWorkflow(row: Repository, filter: WorkflowFilter) {
  if (filter === "all") return true;
  if (filter === "unrecorded") return row.lastWorkflow === null;
  return row.lastWorkflow?.state === "completed" && row.lastWorkflow.conclusion === filter;
}

const workflowSyncTime = new Intl.DateTimeFormat(undefined, {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
});

function WorkflowCommit({ workflow, full = false }: { workflow: Repository["lastWorkflow"]; full?: boolean }) {
  const sha = workflow?.commitSha;
  return sha ? <code className="studio-repository-branch" title={full ? undefined : sha}>{full ? sha : sha.slice(0, 7)}</code> : <>Unavailable</>;
}

function WorkflowSync({ workflow }: { workflow: Repository["lastWorkflow"] }) {
  const sync = workflow?.syncedAtIso;
  return sync ? <time dateTime={sync}>{workflowSyncTime.format(new Date(sync))}</time> : <>Unavailable</>;
}

function RecordedWorkflow({workflow, directory = false}: {workflow: Repository["lastWorkflow"]; directory?: boolean}) {
  if (!workflow) return <span>No workflow recorded</span>;
  const passed = workflow.state === "completed" && workflow.conclusion === "success";
  const failed = workflow.state === "completed" && workflow.conclusion === "failure";
  const running = workflow.state === "in_progress";
  const queued = workflow.state === "queued";
  const indicator = passed ? <CircleCheck size={13} aria-hidden="true"/>
    : failed ? <TriangleAlert size={13} aria-hidden="true"/>
    : running || queued ? <Clock size={13} aria-hidden="true"/> : null;
  const recorded = `${workflow.state.replaceAll("_", " ") || "State unavailable"} · ${workflow.conclusion?.replaceAll("_", " ") || "No conclusion recorded"}`;
  const name = workflow.name || "Name unavailable";
  if (directory) {
    const outcome = passed ? "Passed" : failed ? "Failed" : running ? "In progress" : queued ? "Queued" : recorded;
    return <div className="studio-repository-workflow">
      <span className="studio-repository-workflow-outcome" data-outcome={passed ? "passed" : failed ? "failed" : undefined}>{indicator}{outcome}</span>
      <small>{name}</small>
    </div>;
  }
  return <div className="studio-repository-workflow">
    <span>{name}</span>
    <small>{indicator}<span>{recorded}</span></small>
  </div>;
}

const directoryColumns = [
  { id: "branch", title: "Default branch", cell: (row: Repository) => row.defaultBranch
    ? <code className="studio-repository-branch">{row.defaultBranch}</code> : "Unavailable" },
  { id: "commit", title: "Workflow commit", cell: (row: Repository) => <WorkflowCommit workflow={row.lastWorkflow}/> },
  { id: "workflow", title: "Last recorded workflow", cell: (row: Repository) => <RecordedWorkflow workflow={row.lastWorkflow} directory/> },
  { id: "provider", title: "Provider", cell: (row: Repository) => providers[row.provider] },
  { id: "protection", title: "Recorded protection", cell: (row: Repository) => row.protectionStrength },
  { id: "pull-requests", title: "Open PRs", cell: (row: Repository) => row.openPrCount },
  { id: "synced", title: "Workflow synced", cell: (row: Repository) => <WorkflowSync workflow={row.lastWorkflow}/> },
] as const;

type DirectoryColumn = (typeof directoryColumns)[number]["id"];


export function RepositoryDirectoryView({active, canRead, onOpenLocal, onConnect}: {
  active: boolean;
  canRead: boolean;
  onOpenLocal: () => void;
  onConnect?: () => void;
}) {
  const [directory, setDirectory] = useState<Directory>({state: "loading"});
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilter>("all");
  const [layout, setLayout] = useState<"list" | "grid">(() => { try { return globalThis.localStorage?.getItem("v19.repositories.layout") === "grid" ? "grid" : "list"; } catch { return "list"; } });
  const chooseLayout = (next: "list" | "grid") => { setLayout(next); try { globalThis.localStorage?.setItem("v19.repositories.layout", next); } catch { /* per-viewer convenience only */ } };
  const [syncOrder, setSyncOrder] = useState<WorkflowSyncOrder>("");
  const [hiddenColumns, setHiddenColumns] = useState<DirectoryColumn[]>([]);
  const visibleColumns = directoryColumns.filter(column => !hiddenColumns.includes(column.id));
  const filterCountId = useId();
  const searchField = useRef<HTMLInputElement>(null);
  useSearchShortcut(searchField, active && canRead);
  const [page, setPage] = useState(0);
  const [inspectedId, setInspectedId] = useState<string>();
  const localEditorButton = useRef<HTMLButtonElement>(null);
  const restoreLocalFocus = useRef(false);
  const directoryActive = useRef(active && canRead);
  directoryActive.current = active && canRead;
  const inspectorOpener = useRef<{button: HTMLButtonElement; config: typeof desktopClient.config; revision: number} | undefined>(undefined);
  function restoreInspectorFocus() {
    const opener = inspectorOpener.current;
    if (!directoryActive.current || !opener || opener.config !== desktopClient.config ||
      opener.revision !== desktopClient.getContextRevision()) return true;
    if (opener.button.isConnected) opener.button.focus({preventScroll: true});
    if (document.activeElement !== opener.button) searchField.current?.focus();
    return true;
  }

  useEffect(() => {
    if (active && restoreLocalFocus.current) {
      localEditorButton.current?.focus();
      restoreLocalFocus.current = false;
    }
  }, [active]);


  useEffect(() => {
    if (!active || !canRead) return;
    const config = desktopClient.config, revision = desktopClient.getContextRevision();
    let cancelled = false;
    const ownsRead = () => !cancelled && config === desktopClient.config && revision === desktopClient.getContextRevision();
    setDirectory({state: "loading"});
    setInspectedId(undefined);
    async function load() {
      try {
        const result = await desktopClient.listRepositories();
        const data = result.ok ? repositoryList.safeParse(result.data) : undefined;
        if (ownsRead()) setDirectory(data?.success ? {state: "ready", rows: data.data.repositories} : {state: "unavailable"});
      } catch {
        if (ownsRead()) setDirectory({state: "unavailable"});
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [active, canRead, refresh]);

  const rows = canRead && directory.state === "ready" ? directory.rows : [];
  const counts = workflowFilters.map(({id}) => rows.filter(row => matchesWorkflow(row, id)).length);
  const needle = query.trim().toLocaleLowerCase();
  const matching = rows.filter(row => (!provider || provider === row.provider)
    && matchesWorkflow(row, workflowFilter)
    && (`${row.displayName} ${row.defaultBranch}`.toLocaleLowerCase().includes(needle)
      || row.lastWorkflow?.commitSha?.toLowerCase().startsWith(needle)));
  if (syncOrder) matching.sort((a, b) => compareWorkflowSync(a, b, syncOrder));
  const pageCount = Math.ceil(matching.length / pageSize);
  const safePage = Math.min(page, Math.max(0, pageCount - 1));
  const firstPageButton = Math.max(0, Math.min(safePage - 1, pageCount - 3));
  const pageButtons = Array.from({length: Math.min(3, pageCount)}, (_, index) => firstPageButton + index);
  const start = safePage * pageSize;
  const visible = matching.slice(start, start + pageSize);
  const inspected = rows.find(row => row.id === inspectedId);

  return <section aria-label="Repository directory" className="studio-repository-directory">
    <header className="studio-repository-heading">
      <div><h1>Repositories</h1><p>Connect and govern the source behind every release.</p></div>
      <div className="studio-repository-actions">
        {canRead && <button type="button" className="btn-secondary" aria-disabled={directory.state === "loading"}
          onClick={() => { if (active && directory.state !== "loading") { setDirectory({state: "loading"}); setRefresh(value => value + 1); } }}>
          <RefreshCw size={15} aria-hidden="true"/>Refresh directory
        </button>}
        {onConnect && <button type="button" className="btn-secondary" onClick={onConnect}>Connection settings</button>}
        <button ref={localEditorButton} type="button" className="btn-secondary" onClick={() => {restoreLocalFocus.current = true; onOpenLocal();}}>Open local editor</button>
      </div>
    </header>
    {canRead ? <>
      {directory.state === "ready" && <>
        <dl className="studio-repository-count" aria-label="Loaded repository summary">
          {workflowFilters.map(({id, summary}, index) => <div key={id}>
            <dt>{summary}</dt><dd>{counts[index].toLocaleString()}</dd>
          </div>)}
        </dl>
        <div role="group" aria-label="Recorded workflow filter" className="studio-repository-filters">
          {workflowFilters.map(({id, label}, index) => <button key={id} type="button" aria-pressed={workflowFilter === id}
            aria-label={label} aria-describedby={`${filterCountId}-${id}`} onClick={() => {setWorkflowFilter(id); setPage(0);}}>
            {label}
            <span aria-hidden="true">{counts[index].toLocaleString()}</span>
            <span id={`${filterCountId}-${id}`} className="sr-only">{counts[index].toLocaleString()} loaded</span>
          </button>)}
        </div>
      </>}
      <div className="studio-repository-toolbar">
        <label><Search aria-hidden="true" size={16}/><input ref={searchField} type="search" placeholder="Search repositories, branches, or commits" aria-label="Search repositories" aria-keyshortcuts="/" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }}/><kbd aria-hidden="true">/</kbd></label>
        <div className="studio-repository-select">
          <ChevronDown size={14} aria-hidden="true"/>
          <select aria-label="Provider" value={provider} onChange={event => { setProvider(event.target.value); setPage(0); }}>
            <option value="">Provider</option>
            {Object.entries(providers).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
        <div className="studio-repository-table-tools">
          <details className="studio-repository-columns" onKeyDown={event => {
            if (event.key !== "Escape" || event.nativeEvent.isComposing || !event.currentTarget.open) return;
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.open = false;
            event.currentTarget.querySelector("summary")?.focus();
          }}>
            <summary className="btn-secondary"><Columns3 size={14} aria-hidden="true"/>Columns</summary>
            <fieldset>
              <legend>Visible columns</legend>
              {directoryColumns.map(({id, title}) => <label key={id}>
                <input type="checkbox" checked={!hiddenColumns.includes(id)} onChange={event => {
                  const shown = event.target.checked;
                  setHiddenColumns(current => shown ? current.filter(column => column !== id) : [...current, id]);
                }}/>{title}
              </label>)}
              <button type="button" className="btn-secondary" onClick={() => setHiddenColumns([])}>Show all columns</button>
            </fieldset>
          </details>
          <div className="studio-repository-layout" role="group" aria-label="Repository layout">
            <button type="button" aria-pressed={layout === "list"} aria-label="List view" title="List view" onClick={() => chooseLayout("list")}><List size={15} aria-hidden="true"/></button>
            <button type="button" aria-pressed={layout === "grid"} aria-label="Grid view" title="Grid view" onClick={() => chooseLayout("grid")}><LayoutGrid size={15} aria-hidden="true"/></button>
          </div>
          <div className="studio-repository-select">
            <ChevronDown size={14} aria-hidden="true"/>
            <select aria-label="Sort by recorded workflow sync" value={syncOrder} onChange={event => {
              const order = event.target.value;
              setSyncOrder(order === "newest" || order === "oldest" ? order : "");
              setPage(0);
            }}>
              <option value="">Last sync</option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>
      </div>
      {directory.state === "loading" && <p role="status">Loading repositories…</p>}
      {directory.state === "unavailable" && <p role="alert">Repository directory is unavailable. Refresh to try again.</p>}
      {directory.state === "ready" && <>
        {layout === "grid" && <ul className="studio-repository-grid" aria-label="Loaded repository cards">{visible.map(row => <li key={row.id}>
          <div className="studio-repository-name"><GitBranch aria-hidden="true" size={16}/><div>
            <strong>{row.displayName.split("/").pop() || row.displayName}</strong>
            <small>{row.displayName}</small>
          </div></div>
          <dl>{visibleColumns.map(column => <div key={column.id}><dt>{column.title}</dt><dd>{column.cell(row)}</dd></div>)}</dl>
          <button type="button" className="btn-secondary" aria-label={`Inspect ${row.displayName}`} onClick={event => {
            inspectorOpener.current = {button: event.currentTarget, config: desktopClient.config, revision: desktopClient.getContextRevision()};
            setInspectedId(row.id);
          }}>Inspect</button>
        </li>)}</ul>}
        {layout === "list" && <div className="studio-repository-table" role="region" aria-label="Loaded repository rows" tabIndex={0}>
          <table style={{minWidth: 320 + visibleColumns.length * 80}}>
            <thead><tr>
              <th scope="col">Repository</th>
              {visibleColumns.map(({id, title}) => <th key={id} scope="col"
                aria-sort={id === "synced" && syncOrder ? (syncOrder === "newest" ? "descending" : "ascending") : undefined}>{title}</th>)}
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr></thead>
            <tbody>{visible.map(row => <tr key={row.id}>
              <td><div className="studio-repository-name"><GitBranch aria-hidden="true" size={16}/><div>
                <strong>{row.displayName.split("/").pop() || row.displayName}</strong>
                <small>{row.displayName}</small>
              </div></div></td>
              {visibleColumns.map(column => <td key={column.id}>{column.cell(row)}</td>)}
              <td><button type="button" className="btn-secondary" aria-label={`Inspect ${row.displayName}`} onClick={event => {
                inspectorOpener.current = {button: event.currentTarget, config: desktopClient.config, revision: desktopClient.getContextRevision()};
                setInspectedId(row.id);
              }}>Inspect</button></td>
            </tr>)}</tbody>
          </table>
        </div>}
        {!visible.length && <p role="status">{rows.length ? "No matching repositories." : "No repositories are registered."}</p>}
        {!!visible.length && <div className="studio-repository-page-row">
          <p aria-live="polite">Showing {start + 1}–{start + visible.length} of {matching.length} matching repositories</p>
          {pageCount > 1 && <nav aria-label="Repository pages" className="studio-repository-pages">
            <button type="button" className="btn-secondary" aria-label="Previous" aria-disabled={safePage === 0}
              onClick={() => { if (safePage > 0) setPage(safePage - 1); }}><ArrowLeft size={15} aria-hidden="true"/></button>
            {pageButtons.map(index => <button key={index} type="button" aria-label={`Page ${index + 1} of ${pageCount}`}
              aria-current={index === safePage ? "page" : undefined} onClick={() => setPage(index)}>{index + 1}</button>)}
            <button type="button" className="btn-secondary" aria-label="Next" aria-disabled={safePage + 1 >= pageCount}
              onClick={() => { if (safePage + 1 < pageCount) setPage(safePage + 1); }}><ArrowRight size={15} aria-hidden="true"/></button>
          </nav>}
        </div>}
        <p className="studio-repository-access-note"><ShieldCheck size={15} aria-hidden="true"/>Repository access does not grant deployment permission.</p>
      </>}
    </> : <p role="status">The current session cannot read the repository directory.</p>}
    {active && inspected && <DesktopDialog label={`Repository details for ${inspected.displayName}`} role="dialog" isolate overlayClassName="studio-repository-inspector" restoreFocus={restoreInspectorFocus} onClose={() => setInspectedId(undefined)}>
      <h2 className="wrap-break-word text-lg font-medium">{inspected.displayName}</h2>
      <dl className="studio-repository-inspector-facts">
        <div><dt>Provider</dt><dd>{providers[inspected.provider]}</dd></div>
        <div><dt>Default branch</dt><dd>{inspected.defaultBranch ? <code className="studio-repository-branch">{inspected.defaultBranch}</code> : "Unavailable"}</dd></div>
        <div><dt>Recorded protection</dt><dd>{inspected.protectionStrength}</dd></div>
        <div><dt>Open PRs</dt><dd>{inspected.openPrCount}</dd></div>
      </dl>
      <section className="studio-repository-inspector-workflow" aria-label="Last recorded workflow">
        <h3>Last recorded workflow</h3>
        <RecordedWorkflow workflow={inspected.lastWorkflow}/>
        <dl className="studio-repository-inspector-facts">
          <div><dt>Workflow commit</dt><dd><WorkflowCommit workflow={inspected.lastWorkflow} full/></dd></div>
          <div><dt>Workflow synced</dt><dd><WorkflowSync workflow={inspected.lastWorkflow}/></dd></div>
        </dl>
        {inspected.lastWorkflow && <p className="studio-repository-workflow-time">Workflow started
          {inspected.lastWorkflow.startedAtIso
            ? <time dateTime={inspected.lastWorkflow.startedAtIso}>{new Date(inspected.lastWorkflow.startedAtIso).toLocaleString()}</time>
            : <span>Time unavailable</span>}
        </p>}
      </section>
      <button type="button" className="btn-secondary mt-5" onClick={() => setInspectedId(undefined)}>Close repository details</button>
    </DesktopDialog>}
  </section>;
}
