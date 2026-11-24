import {useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent} from "react";
import {Check, RefreshCw, Search, ShieldCheck} from "lucide-react";
import {z} from "zod";
import {RecordedReleaseWindow} from "../components/RecordedReleaseWindow";
import {ReleaseBatchMonitor} from "../components/ReleaseBatchMonitor";
import {ReleaseBatchReadiness} from "../components/ReleaseBatchReadiness";
import {useSearchShortcut} from "../lib/useSearchShortcut";
import {desktopClient} from "../lib/desktopClient";
import {AirflowAutomationView} from "./AirflowAutomationView";
import type {SavedReleaseLink} from "./WelcomeView";
import "./BatchesWorkspaceView.css";

const rollbackLabels = {yes: "Available in release plan", no: "Unavailable", not_applicable: "Not applicable"} as const;
const approvalLabels = {ready_for_human_approval: "Ready for human review", needs_attention: "Needs attention"} as const;

const runCount = z.number().int().min(0).max(25);
const count = z.number().int().nonnegative().optional().catch(undefined);
const recordedFlag = z.boolean().optional().catch(undefined);
const releaseRow = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  title: z.string(),
  status: z.string(),
  releaseContext: z.object({
    scope: z.object({targetEnvironment: z.string().nullable()}),
    window: z.object({startUtc: z.string(), endUtc: z.string()}).nullish().catch(undefined),
    batches: z.object({selectedRunCount: runCount}).optional(),
    approval: z.object({noPrRequired: recordedFlag}).optional().catch(undefined),
    readiness: z.object({
      approvalDecision: z.enum(["ready_for_human_approval", "needs_attention"]).optional().catch(undefined),
      developmentReady: recordedFlag,
      productionReady: recordedFlag,
      validationStepCount: count,
      deferredValidation: recordedFlag,
    }).optional().catch(undefined),
    observation: z.object({recordedMonitoringPlan: recordedFlag}).optional().catch(undefined),
    recovery: z.object({
      rollbackAvailability: z.enum(["yes", "no", "not_applicable"]).optional().catch(undefined),
      backupRequired: recordedFlag,
      evidenceCount: count,
    }).optional().catch(undefined),
  }),
});
const releaseRows = z.array(releaseRow).refine(rows => new Set(rows.map(row => row.id)).size === rows.length);
type ReleaseRows = z.output<typeof releaseRows>;

function recordedState(value: boolean | undefined) {
  return value === undefined ? "Unavailable" : value ? "Recorded" : "Not recorded";
}

function DependencyProgress({submitted, approval, runStatus, complete = false}: {
  submitted: boolean;
  approval?: keyof typeof approvalLabels;
  runStatus: string;
  complete?: boolean;
}) {
  const stages = [
    {label: "Prepare", status: submitted ? "Request submitted" : "Runs declared", complete: submitted},
    {label: "Check runs", status: runStatus, complete},
    {label: "Approve", status: approval ? approvalLabels[approval] : "Unavailable"},
    {label: "Wave 1", status: "Unavailable"},
    {label: "Wave 2", status: "Unavailable"},
  ];
  return <>
    <ol className="studio-batches-progress" aria-label="Release dependency progress">
      {stages.map((stage, index) => <li key={stage.label}>
        <span className="studio-batches-progress-marker" data-complete={stage.complete || undefined} aria-hidden="true">
          {stage.complete ? <Check size={12} /> : index + 1}
        </span>
        <strong>{stage.label}</strong>
        <small>{stage.status}</small>
      </li>)}
    </ol>
    <p className="studio-batches-wave-notice">Production wave evidence is unavailable for this release.</p>
  </>;
}

const dependencySections = [
  ["overview", "Overview"],
  ["runs", "Dependencies"],
  ["approval", "Approvals"],
  ["checks", "Evidence"],
  ["logs", "Logs"],
] as const;

function DependencyNavigation({detailId}: {detailId: string}) {
  const [section, setSection] = useState<(typeof dependencySections)[number][0]>("overview");

  return <nav className="studio-batches-sections" aria-label="Release dependency sections">
    {dependencySections.map(([id, label]) => {
      const targetId = `${detailId}-${id}`;
      return <button type="button" key={id} aria-controls={targetId} aria-current={section === id ? "location" : undefined}
        onClick={() => {
          const target = document.getElementById(targetId);
          if (!target) return;
          setSection(id);
          if (target instanceof HTMLDetailsElement) target.open = true;
          target.focus({preventScroll: true});
          target.scrollIntoView?.({block: "nearest"});
        }}>{label}</button>;
    })}
  </nav>;
}

interface DependencyProps {
  active?: boolean;
  canRead: boolean;
  canCheckReadiness: boolean;
  ownerConfig: typeof desktopClient.config;
  revision: number;
  requestedRelease?: SavedReleaseLink;
  onOpenRelease: (release: SavedReleaseLink, section?: "review") => void;
}

export function BatchesWorkspaceView({onInspect, ...dependencyProps}: DependencyProps & {
  onInspect: (dagId: string, runId?: string) => void;
}) {
  const [showDependencies, setShowDependencies] = useState(Boolean(dependencyProps.requestedRelease));
  useLayoutEffect(() => {
    if (dependencyProps.requestedRelease) setShowDependencies(true);
  }, [dependencyProps.requestedRelease]);
  return <div className="studio-batches-workspace" data-dependencies={showDependencies}>
    <div role="group" aria-label="Batches views" className="studio-batches-switcher">
      <button type="button" aria-pressed={!showDependencies} onClick={() => setShowDependencies(false)}>Airflow automation</button>
      <button type="button" aria-pressed={showDependencies} onClick={() => setShowDependencies(true)}>Release dependencies</button>
    </div>
    <div hidden={showDependencies} className={showDependencies ? "hidden" : "studio-batches-airflow"}>
      <AirflowAutomationView onInspect={onInspect} active={(dependencyProps.active ?? true) && !showDependencies} />
    </div>
    <ReleaseDependencies {...dependencyProps} showing={showDependencies && (dependencyProps.active ?? true)} />
  </div>;
}

function ReleaseDependencies({active = true, canRead, canCheckReadiness, ownerConfig, revision, requestedRelease, onOpenRelease, showing}: DependencyProps & {showing: boolean}) {
  const [data, setData] = useState<ReleaseRows | null>();
  const [unverifiedLookup, setUnverifiedLookup] = useState<SavedReleaseLink>();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SavedReleaseLink | undefined>(requestedRelease);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [refresh, setRefresh] = useState(0);
  const ownsContext = ownerConfig === desktopClient.config && revision === desktopClient.getContextRevision();
  const searchField = useRef<HTMLInputElement>(null);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const details = useRef<HTMLElement>(null);
  const unavailable = useRef<HTMLParagraphElement>(null);
  const directoryError = useRef<HTMLParagraphElement>(null);
  const openReleaseButton = useRef<HTMLButtonElement>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const restoreReleaseFocus = useRef<"review" | "release" | undefined>(undefined);
  const detailsId = useId();
  const focusDetails = useRef(Boolean(requestedRelease));
  useLayoutEffect(() => {
    if (!requestedRelease) return;
    focusDetails.current = true;
    setQuery("");
    setSelected(requestedRelease);
  }, [requestedRelease]);
  useSearchShortcut(searchField, showing && active && canRead && ownsContext);

  useEffect(() => {
    if (!showing || !canRead || !ownsContext) return;
    let disposed = false;
    const ownsRead = () => !disposed && ownerConfig === desktopClient.config && revision === desktopClient.getContextRevision();
    setData(undefined);
    setUnverifiedLookup(undefined);
    async function load() {
      try {
        const response = await desktopClient.deploymentRequests();
        if (!ownsRead()) return;
        const parsed = response.ok ? releaseRows.safeParse(response.data) : undefined;
        if (!parsed?.success) {
          setData(null);
          return;
        }

        const selection = selectedRef.current;
        let rows = parsed.data;
        // A different version in the recent directory must be selected deliberately.
        if (selection && !rows.some(row => row.id === selection.id)) {
          const saved = await desktopClient.savedDeploymentRequest(selection).catch(() => null);
          if (!ownsRead()) return;
          const exact = saved?.ok ? releaseRow.safeParse(saved.data) : undefined;
          if (!saved?.ok) setUnverifiedLookup(selection);
          if (selectedRef.current === selection && exact?.success && exact.data.id === selection.id
            && exact.data.version === selection.version && exact.data.releaseContext.batches?.selectedRunCount) {
            rows = [...rows, exact.data];
          }
        }
        setData(rows);
      } catch {
        if (ownsRead()) setData(null);
      }
    }
    void load();
    return () => { disposed = true; };
  }, [showing, canRead, ownerConfig, revision, ownsContext, refresh, requestedRelease]);

  const current = canRead && ownsContext ? data : undefined;
  const linked = (current ?? []).flatMap(row => {
    const count = row.releaseContext.batches?.selectedRunCount;
    return count ? [{row, count}] : [];
  });
  const needle = query.trim().toLowerCase();
  const visible = linked.filter(({row}) => `${row.title} ${row.id}`.toLowerCase().includes(needle));
  const matchesSelected = ({row}: (typeof linked)[number]) => row.id === selected?.id && row.version === selected.version;
  const detail = selected ? visible.find(matchesSelected) : visible[0];
  const displayedRelease = detail?.row;
  const offersReview = canCheckReadiness && displayedRelease?.status === "submitted"
    && displayedRelease.releaseContext.approval?.noPrRequired === false;
  function openSelectedRelease(section?: "review") {
    if (!displayedRelease || ownerConfig !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
    const release = {id: displayedRelease.id, version: displayedRelease.version};
    restoreReleaseFocus.current = section ?? "release";
    setSelected(release);
    if (section) onOpenRelease(release, section);
    else onOpenRelease(release);
  }
  const readiness = displayedRelease?.releaseContext.readiness;
  const approval = readiness?.approvalDecision;
  const monitoringPlan = displayedRelease?.releaseContext.observation?.recordedMonitoringPlan;
  const recovery = displayedRelease?.releaseContext.recovery;
  const rollback = recovery?.rollbackAvailability;
  const backup = recovery?.backupRequired;
  const validationSteps = readiness?.validationStepCount;
  const plannedValidation = validationSteps === undefined ? "Unavailable"
    : validationSteps === 0 ? "No steps recorded" : `${validationSteps} ${validationSteps === 1 ? "step" : "steps"} planned`;
  useLayoutEffect(() => {
    if (showing) return;
    // Keep the reviewed version, even for the initially displayed row.
    if (!selected && displayedRelease) setSelected({id: displayedRelease.id, version: displayedRelease.version});
    setData(undefined);
  }, [showing, selected, displayedRelease]);

  const tabbableDependency = detail ?? visible[0];
  const selectionUnavailable = Boolean(current && selected && !linked.some(matchesSelected));
  const selectionHidden = Boolean(current && selected && visible.length && !detail && !selectionUnavailable);
  const selectionLookupFailed = selectionUnavailable && selected === unverifiedLookup;
  useLayoutEffect(() => {
    if (!showing || !active || current === undefined) return;
    const focused = document.activeElement;
    if (focusDetails.current) {
      const target = details.current ?? unavailable.current ?? directoryError.current;
      if (target) {
        focusDetails.current = false;
        restoreReleaseFocus.current = undefined;
        target.focus();
        return;
      }
    }
    const opener = restoreReleaseFocus.current;
    if (opener) {
      restoreReleaseFocus.current = undefined;
      if (focused === document.body) {
        (unavailable.current ?? (opener === "review" ? reviewButton.current : undefined) ?? openReleaseButton.current ?? refreshButton.current)?.focus();
      }
    } else if (selectionUnavailable && (focused === document.body || focused === refreshButton.current)) {
      unavailable.current?.focus();
    }
  }, [showing, active, current, selected, selectionUnavailable]);

  const rowId = (index: number) => `${detailsId}-dependency-${index}`;

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const next = event.key === "Home" ? 0 : event.key === "End" ? visible.length - 1 :
      event.key === "ArrowDown" ? (index + 1) % visible.length :
      event.key === "ArrowUp" ? (index - 1 + visible.length) % visible.length : undefined;
    const target = next === undefined ? undefined : visible[next];
    if (!target || next === undefined) return;
    event.preventDefault();
    setSelected({id: target.row.id, version: target.row.version});
    document.getElementById(rowId(next))?.focus();
  }

  if (!showing) return null;
  return <section className="studio-batches-dependencies" aria-label="Recorded release dependencies">
    <h1>Batches</h1>
    <p>Review Airflow runs declared on loaded release requests.</p>
    {!canRead || !ownsContext ? <p role="status">A current paired workspace session with read access is required.</p> : <div className="studio-batches-detail-layout">
      <div className="studio-batches-dependency-list">
        <div className="studio-batches-dependency-controls">
          <label className="studio-batches-dependency-search">
            <Search size={15} aria-hidden="true"/>
            <input ref={searchField} type="search" aria-label="Search release dependencies" aria-keyshortcuts="/" placeholder="Search releases" value={query} onChange={event => setQuery(event.target.value)} />
            <kbd aria-hidden="true">/</kbd>
          </label>
          <button ref={refreshButton} type="button" className="btn-secondary studio-batches-refresh" aria-label="Refresh dependencies" title="Refresh dependencies" aria-disabled={current === undefined} onClick={() => {
            if (current === undefined) return;
            if (!selected && detail) setSelected({id: detail.row.id, version: detail.row.version});
            setData(undefined);
            setRefresh(value => value + 1);
          }}><RefreshCw size={15} aria-hidden="true"/></button>
        </div>
        {current === undefined && <p role="status">Loading release dependencies…</p>}
        {current === null && <p ref={directoryError} tabIndex={-1} role="alert">Release requests could not be verified. Refresh to try again.</p>}
        {current && !visible.length && !selectionLookupFailed && <p role="status">{linked.length
          ? "No loaded dependencies match."
          : "No declared Airflow runs were returned in the loaded requests."}</p>}
        {selectionUnavailable && <p ref={unavailable} role="status" tabIndex={-1}>{selectionLookupFailed
          ? "The selected release version could not be verified. Refresh to retry, or select a current dependency."
          : "The selected release version is unavailable. Select a current dependency to continue."}</p>}
        {selectionHidden && <p role="status">Search has hidden the selected release version.</p>}
        {visible.length > 0 && <nav aria-label="Select a release dependency">
          <p className="studio-batches-loaded">Loaded dependencies <span>{linked.length.toLocaleString()}</span></p>
          {visible.map(({row, count}, index) => <button key={row.id} id={rowId(index)} type="button" aria-controls={detail ? detailsId : undefined}
            aria-current={row.id === detail?.row.id ? "true" : undefined}
            tabIndex={row.id === tabbableDependency?.row.id ? 0 : -1}
            onKeyDown={event => navigate(event, index)}
            onClick={() => {focusDetails.current = true; setSelected({id: row.id, version: row.version});}}>
            <span>{row.title}</span>
            <span className="studio-batches-row-state">{row.status.replaceAll("_", " ")}</span>
            <small>v{row.version} · {count} declared {count === 1 ? "run" : "runs"}</small>
          </button>)}
        </nav>}
      </div>
      {detail && <article ref={details} id={detailsId} tabIndex={-1} aria-label="Selected release dependency"
        key={JSON.stringify([detail.row.id, detail.row.version])} onKeyDown={event => {
          if (event.key !== "Escape" || event.defaultPrevented || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 ||
            (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable], [role="dialog"], [role="alertdialog"]'))) return;
          const row = document.getElementById(rowId(visible.indexOf(detail)));
          if (!row) return;
          event.preventDefault();
          row.focus();
        }}>
          <header>
            <div className="studio-batches-detail-meta">
              <p>Release version {detail.row.version}</p>
              <span className="studio-batches-status"><span className="sr-only">Request status </span>{detail.row.status.replaceAll("_", " ")}</span>
            </div>
            <h2>{detail.row.title}</h2>
            <DependencyNavigation detailId={detailsId} />
          </header>
          <section className="studio-batches-readiness" aria-label="Dependency readiness" id={`${detailsId}-overview`} tabIndex={-1}>
            <h3 className="sr-only">Dependency readiness</h3>
            <div id={`${detailsId}-runs`} tabIndex={-1} role="region" aria-label="Declared release runs">
              {detail.row.status !== "submitted" ? <>
                <DependencyProgress submitted={false} approval={approval} runStatus="Unavailable"/>
                <p>Batch readiness is available for submitted release versions.</p>
              </>
                : canCheckReadiness ? <>
                  <ReleaseBatchReadiness requestId={detail.row.id} version={detail.row.version} count={detail.count} inspectTasks
                    renderProgress={(runStatus, complete) => <DependencyProgress submitted approval={approval} runStatus={runStatus} complete={complete}/>}/>
                  <section className="studio-batches-monitor" aria-label="Recorded monitor">
                    <h3>Recorded monitor</h3>
                    <ReleaseBatchMonitor requestId={detail.row.id} version={detail.row.version} readOnly/>
                  </section>
                </>
                : <>
                  <DependencyProgress submitted approval={approval} runStatus="Unavailable"/>
                  <p>Batch readiness requires pipeline read access.</p>
                </>}
            </div>
            <details id={`${detailsId}-logs`} className="studio-batches-run-logs" tabIndex={-1}>
              <summary className="btn-secondary">View logs</summary>
              <p>Task logs are unavailable for this release.</p>
              {detail.row.status === "submitted" && canCheckReadiness && <p>Check batches to see observed runs and inspect their task status.</p>}
            </details>
          </section>
          <div className="studio-batches-config">
            <section aria-label="Recorded run configuration">
              <h3>Run configuration</h3>
              <dl>
                <div><dt>Recorded target</dt><dd>{detail.row.releaseContext.scope.targetEnvironment || "Unavailable"}</dd></div>
                <div><dt>Declared runs</dt><dd>{detail.count}</dd></div>
                <div className="studio-batches-window"><dt>Recorded window</dt><dd><RecordedReleaseWindow window={detail.row.releaseContext.window}/></dd></div>
              </dl>
            </section>
            <section id={`${detailsId}-approval`} tabIndex={-1} aria-labelledby={`${detailsId}-approval-heading`}>
              <h3 id={`${detailsId}-approval-heading`}>Approval gate</h3>
              <dl><div><dt>Recorded prerequisites</dt><dd>{approval ? approvalLabels[approval] : "Unavailable"}</dd></div></dl>
            </section>
            <section aria-labelledby={`${detailsId}-recovery`}>
              <h3 id={`${detailsId}-recovery`}>Recovery</h3>
              <dl>
                <div><dt>Recorded rollback</dt><dd>{rollback ? rollbackLabels[rollback] : "Unavailable"}</dd></div>
                <div><dt>Backup evidence</dt><dd>{backup === undefined ? "Unavailable" : backup ? "Required" : "Not required"}</dd></div>
              </dl>
            </section>
            <section id={`${detailsId}-checks`} tabIndex={-1} aria-labelledby={`${detailsId}-checks-heading`}>
              <h3 id={`${detailsId}-checks-heading`}>Recorded safety checks</h3>
              <dl>
                <div><dt>Development readiness</dt><dd>{recordedState(readiness?.developmentReady)}</dd></div>
                <div><dt>Production readiness</dt><dd>{recordedState(readiness?.productionReady)}</dd></div>
                <div><dt>Validation plan</dt><dd>{plannedValidation}{validationSteps !== undefined && readiness?.deferredValidation && " · deferred"}</dd></div>
                <div><dt>Monitoring plan</dt><dd>{recordedState(monitoringPlan)}</dd></div>
                <div><dt>Release evidence references</dt><dd>{recovery?.evidenceCount ?? "Unavailable"}</dd></div>
              </dl>
            </section>
            <div className="studio-batches-release-action">
              {!offersReview && <p>Review release approvals in Deployments.</p>}
              <div className="flex flex-col items-start gap-2">
                {offersReview && <button ref={reviewButton} type="button" className="btn-primary"
                  onClick={() => openSelectedRelease("review")}><ShieldCheck size={15} aria-hidden="true" />Review approvals</button>}
                <button ref={openReleaseButton} type="button" aria-label={`Open release ${detail.row.title}`} className="btn-secondary"
                  onClick={() => openSelectedRelease()}>Open release</button>
              </div>
            </div>
          </div>
      </article>}
    </div>}
  </section>;
}
