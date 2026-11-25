import {batchHistoryExclusionLimit, type BatchHistoryCursor} from "../../../lib/desktop/batchHistoryContract";
import {useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent} from "react";
import {Check, CircleCheck, Clock3, RefreshCw, Search, ShieldCheck, TriangleAlert} from "lucide-react";
import {z} from "zod";
import {prReviewNotRequired, recordedPrReview} from "../../../lib/customerJourney/journey";
import {RecordedReleaseWindow, RecordedUtcTime} from "../components/RecordedReleaseWindow";
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
  closedAt: z.string().datetime().nullish().catch(undefined),
  releaseContext: z.object({
    scope: z.object({
      targetEnvironment: z.string().nullable(),
      applicationCount: count,
      repositoryCount: count,
    }),
    window: z.object({startUtc: z.string(), endUtc: z.string()}).nullish().catch(undefined),
    batches: z.object({selectedRunCount: runCount}).optional(),
    approval: z.object({noPrRequired: recordedFlag, prStatus: z.string().optional().catch(undefined)}).optional().catch(undefined),
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
type ArchivePage = {
  rows: ReleaseRows;
  exclude: string[];
  visitedCursors: ReadonlySet<string>;
  nextCursor?: BatchHistoryCursor | null;
  busy: boolean;
  failed?: boolean;
};


function RecordedSafetyFact({value}: {value: boolean | undefined}) {
  if (value !== true) return <dd>{value === false ? "Not recorded" : "Unavailable"}</dd>;
  return <dd className="studio-batches-fact-with-icon" data-fact-tone="recorded">
    <CircleCheck size={13} aria-hidden="true" />Recorded
  </dd>;
}

function DependencyProgress({requestStatus, approval, runStatus, complete = false}: {
  requestStatus: string;
  approval?: keyof typeof approvalLabels;
  runStatus: string;
  complete?: boolean;
}) {
  const closed = requestStatus === "closed";
  const submitted = requestStatus === "submitted" || closed;
  const stages = [
    {label: "Prepare", status: submitted ? "Request submitted" : "Runs declared", complete: submitted},
    {label: "Check runs", status: runStatus, complete},
    {label: "Approve", status: closed ? "Review closed record" : approval ? approvalLabels[approval] : "Unavailable"},
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

type DependencySection = (typeof dependencySections)[number][0];

const dependencyReturnSections = {release: "overview", review: "approval", logs: "logs"} as const;
type ReleaseHandoff = keyof typeof dependencyReturnSections;

function DependencyNavigation({detailId, section, onSelect}: {
  detailId: string;
  section: DependencySection;
  onSelect: (section: DependencySection) => void;
}) {
  return <nav className="studio-batches-sections" aria-label="Release dependency sections">
    {dependencySections.map(([id, label]) => {
      const targetId = `${detailId}-${id}`;
      return <button type="button" key={id} aria-controls={targetId} aria-current={section === id ? "location" : undefined}
        onClick={() => {
          const target = document.getElementById(targetId);
          if (!target) return;
          onSelect(id);
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
  onOpenRelease: (release: SavedReleaseLink, section?: "review" | "logs") => void;
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
  const [archive, setArchive] = useState<ArchivePage>();
  const archiveFlight = useRef<object | null>(null);
  const [pendingLookup, setPendingLookup] = useState<SavedReleaseLink>();
  const [unverifiedLookup, setUnverifiedLookup] = useState<SavedReleaseLink>();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SavedReleaseLink | undefined>(requestedRelease);
  const [reviewedSection, setReviewedSection] = useState<{release: SavedReleaseLink; section: DependencySection}>();
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [refresh, setRefresh] = useState(0);
  const ownsContext = ownerConfig === desktopClient.config && revision === desktopClient.getContextRevision();
  const [closedReleases, setClosedReleases] = useState<{config: typeof desktopClient.config; revision: number; keys: Set<string>}>();

  const searchField = useRef<HTMLInputElement>(null);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const details = useRef<HTMLElement>(null);
  const unavailable = useRef<HTMLParagraphElement>(null);
  const directoryError = useRef<HTMLParagraphElement>(null);
  const openReleaseButton = useRef<HTMLButtonElement>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const logsDisclosure = useRef<HTMLDetailsElement>(null);
  const openLogsButton = useRef<HTMLButtonElement>(null);
  const restoreReleaseFocus = useRef<{release: SavedReleaseLink; kind: ReleaseHandoff; departed: boolean} | undefined>(undefined);
  const pendingReturn = restoreReleaseFocus.current;
  const opener = pendingReturn?.departed && pendingReturn.release === selected ? pendingReturn.kind : undefined;
  const detailsId = useId();
  const focusDetails = useRef(Boolean(requestedRelease));
  useLayoutEffect(() => {
    if (!requestedRelease) return;
    focusDetails.current = true;
    setQuery("");
    setSelected(requestedRelease);
    setReviewedSection(undefined);
  }, [requestedRelease]);
  useSearchShortcut(searchField, showing && active && canRead && ownsContext);

  useEffect(() => {
    if (!showing || !canRead || !ownsContext) return;
    let disposed = false;
    const ownsRead = () => !disposed && ownerConfig === desktopClient.config && revision === desktopClient.getContextRevision();
    archiveFlight.current = null;
    setArchive(undefined);
    setData(undefined);
    setPendingLookup(undefined);
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
        const rows = parsed.data;
        // A different version in the recent directory must be selected deliberately.
        if (selection && !rows.some(row => row.id === selection.id)) {
          setPendingLookup(selection);
          setData(rows);
          const saved = await desktopClient.savedDeploymentRequest(selection).catch(() => null);
          if (!ownsRead()) return;
          setPendingLookup(undefined);
          if (selectedRef.current !== selection) return;
          const exact = saved?.ok ? releaseRow.safeParse(saved.data) : undefined;
          if (!saved?.ok) setUnverifiedLookup(selection);
          if (exact?.success && exact.data.id === selection.id
            && exact.data.version === selection.version && exact.data.releaseContext.batches?.selectedRunCount) {
            setData([...rows, exact.data]);
          }
          return;
        }
        setData(rows);
      } catch {
        if (ownsRead()) setData(null);
      }
    }
    void load();
    return () => { disposed = true; archiveFlight.current = null; };
  }, [showing, canRead, ownerConfig, revision, ownsContext, refresh, requestedRelease]);

  const current = canRead && ownsContext ? data : undefined;
  async function readOlderHistory() {
    if (!current || !showing || archive?.nextCursor === null || archiveFlight.current ||
        ownerConfig !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
    const operation = {};
    archiveFlight.current = operation;
    const ownsRead = () => archiveFlight.current === operation && ownerConfig === desktopClient.config
      && revision === desktopClient.getContextRevision();
    const previous = archive ?? {
      rows: [], busy: false, visitedCursors: new Set<string>(),
      exclude:current.filter(row => row.status === "closed" && row.releaseContext.batches?.selectedRunCount)
        .slice(0,batchHistoryExclusionLimit).map(row => row.id),
    };
    setArchive({...previous, busy:true, failed:false});
    try {
      const result = await desktopClient.batchReleaseHistory(previous.nextCursor ?? undefined, previous.exclude);
      if (!ownsRead()) return;
      if (!result.ok) {
        setArchive({...previous, busy: false, failed: true});
        return;
      }
      const next = result.data.nextCursor;
      const nextTime = next ? Date.parse(next.closedAt) : undefined;
      const nextKey = next && JSON.stringify([next.id, nextTime]);
      const beforeTime = previous.nextCursor ? Date.parse(previous.nextCursor.closedAt) : undefined;
      const seen = new Set([...previous.exclude, ...previous.rows.map(row => row.id)]);
      const rows = releaseRows.parse(result.data.releases);
      const invalidRows = rows.some(row => {
        const closedAt = row.closedAt ? Date.parse(row.closedAt) : NaN;
        return row.id === previous.nextCursor?.id || seen.has(row.id) || !Number.isFinite(closedAt) ||
          (beforeTime !== undefined && closedAt > beforeTime) ||
          (nextTime !== undefined && closedAt < nextTime);
      });
      if (invalidRows || (nextKey && previous.visitedCursors.has(nextKey)) ||
          (beforeTime !== undefined && nextTime !== undefined && nextTime > beforeTime)) {
        setArchive({...previous, busy: false, failed: true});
        return;
      }
      const visitedCursors = nextKey ? new Set([...previous.visitedCursors, nextKey]) : previous.visitedCursors;
      setArchive({...previous, rows: [...previous.rows, ...rows], visitedCursors, nextCursor: next, busy: false, failed: false});
    } catch {
      if (ownsRead()) setArchive({...previous, busy:false, failed:true});
    } finally {
      if (archiveFlight.current === operation) archiveFlight.current = null;
    }
  }
  const recent = current ?? [];
  const recentIds = new Set(recent.map(row => row.id));
  const linked = [...recent, ...(current ? archive?.rows.filter(row => !recentIds.has(row.id)) ?? [] : [])].flatMap(row => {
    const count = row.releaseContext.batches?.selectedRunCount;
    return count ? [{row, count}] : [];
  });
  const needle = query.trim().toLowerCase();
  const matching = linked.filter(({row}) => `${row.title} ${row.id}`.toLowerCase().includes(needle));
  const currentRows = matching.filter(({row}) => row.status !== "closed");
  const historyRows = matching.filter(({row}) => row.status === "closed");
  const visible = [...currentRows, ...historyRows];
  const matchesSelected = ({row}: (typeof linked)[number]) => row.id === selected?.id && row.version === selected.version;
  const detail = selected ? linked.find(matchesSelected) : visible[0];
  const selectionHidden = Boolean(detail && !visible.includes(detail));
  const displayedRelease = detail?.row;
  const section = displayedRelease && reviewedSection?.release.id === displayedRelease.id
    && reviewedSection.release.version === displayedRelease.version ? reviewedSection.section : "overview";
  useLayoutEffect(() => {
    if (section === "logs" && !selectionHidden && logsDisclosure.current) logsDisclosure.current.open = true;
  }, [displayedRelease, section, selectionHidden]);

  function selectDependency(release: SavedReleaseLink) {
    if (release.id !== displayedRelease?.id || release.version !== displayedRelease.version) setReviewedSection(undefined);
    setSelected({id: release.id, version: release.version});
  }

  const displayedKey = displayedRelease && JSON.stringify([displayedRelease.id, displayedRelease.version]);
  const closureObserved = Boolean(displayedKey && displayedRelease?.status !== "closed" && closedReleases?.config === ownerConfig &&
    closedReleases?.revision === revision && closedReleases.keys.has(displayedKey));
  function noteClosure() {
    if (!displayedKey || ownerConfig !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
    setClosedReleases(previous => {
      const keys = previous?.config === ownerConfig && previous.revision === revision ? previous.keys : [];
      return {config: ownerConfig, revision, keys: new Set([...keys, displayedKey])};
    });
  }
  const prRequirement = displayedRelease?.releaseContext.approval;
  const reviewNotRequired = prReviewNotRequired(prRequirement ?? {});
  const offersReview = !closureObserved && canCheckReadiness && displayedRelease?.status === "submitted"
    && prRequirement?.noPrRequired === false && !reviewNotRequired;
  function openSelectedRelease(section?: "review" | "logs") {
    if (!displayedRelease || closureObserved || ownerConfig !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
    const release = {id: displayedRelease.id, version: displayedRelease.version};
    restoreReleaseFocus.current = {release, kind: section ?? "release", departed: false};
    setSelected(release);
    setReviewedSection({release, section: dependencyReturnSections[section ?? "release"]});
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
    if (restoreReleaseFocus.current) restoreReleaseFocus.current.departed = true;
    // Keep the reviewed version, even for the initially displayed row.
    if (!selected && displayedRelease) setSelected({id: displayedRelease.id, version: displayedRelease.version});
    setData(undefined);
  }, [showing, selected, displayedRelease]);

  const tabbableDependency = selectionHidden ? visible[0] : detail ?? visible[0];
  const checkingSelection = Boolean(current && selected && selected === pendingLookup);
  const selectionUnavailable = Boolean(current && selected && !detail && !checkingSelection);
  const selectionLookupFailed = selectionUnavailable && selected === unverifiedLookup;
  useLayoutEffect(() => {
    if (!showing || !active || current === undefined || checkingSelection) return;
    const focused = document.activeElement;
    if (focusDetails.current) {
      const target = (selectionHidden ? searchField.current : details.current) ?? unavailable.current ?? directoryError.current;
      if (target) {
        focusDetails.current = false;
        restoreReleaseFocus.current = undefined;
        target.focus();
        return;
      }
    }
    if (opener) {
      const canRestoreFocus = focused === document.body || focused === refreshButton.current;
      if (current === null || selectionLookupFailed) {
        // Keep the exact handoff until a retry can verify it.
        if (canRestoreFocus) (directoryError.current ?? unavailable.current)?.focus();
        return;
      }
      restoreReleaseFocus.current = undefined;
      if (canRestoreFocus) {
        const origin = opener === "logs" ? openLogsButton.current : opener === "review" ? reviewButton.current : openReleaseButton.current;
        const visibleOrigin = selectionHidden ? searchField.current : origin ?? openReleaseButton.current;
        (unavailable.current ?? visibleOrigin ?? refreshButton.current)?.focus();
      }
    } else if (selectionUnavailable && (focused === document.body || focused === refreshButton.current)) {
      unavailable.current?.focus();
    }
  }, [showing, active, current, selected, selectionUnavailable, selectionLookupFailed, selectionHidden, opener, checkingSelection]);

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
    selectDependency(target.row);
    document.getElementById(rowId(next))?.focus();
  }

  function dependencyButton({row, count}: (typeof visible)[number], index: number) {
    return (
      <button key={row.id} id={rowId(index)} type="button" aria-controls={detail && !selectionHidden ? detailsId : undefined}
        aria-current={row.id === detail?.row.id ? "true" : undefined}
        tabIndex={row.id === tabbableDependency?.row.id ? 0 : -1}
        onKeyDown={event => navigate(event, index)}
        onClick={() => {focusDetails.current = true; selectDependency(row);}}>
        <span>{row.title}</span>
        <span className="studio-batches-row-state">{row.status.replaceAll("_", " ")}</span>
        <small>v{row.version} · {count} declared {count === 1 ? "run" : "runs"}</small>
        {row.status === "closed" && row.closedAt && <small><RecordedUtcTime value={row.closedAt}/></small>}
      </button>
    );
  }

  if (!showing) return null;
  return <section className="studio-batches-dependencies" aria-label="Recorded release dependencies">
    <header className="studio-batches-heading">
      <div><h1>Batches</h1><p>Review Airflow runs declared on loaded release requests.</p></div>
      {canRead && ownsContext && <button type="button" className="btn-secondary" aria-controls={`${detailsId}-directory`}
        aria-disabled={!current || archive?.busy || archive?.nextCursor === null}
        onClick={() => void readOlderHistory()}>
        <Clock3 size={15} aria-hidden="true"/>
        {archive?.busy ? "Loading history…" : archive?.nextCursor === null ? "History loaded"
          : archive?.failed ? "Retry history" : archive?.nextCursor ? "Load more history" : "History"}
      </button>}
    </header>
    {!canRead || !ownsContext ? <p role="status">A current paired workspace session with read access is required.</p> : <div className="studio-batches-detail-layout">
      <div className="studio-batches-dependency-list" id={`${detailsId}-directory`}>
        <div className="studio-batches-dependency-controls">
          <label className="studio-batches-dependency-search">
            <Search size={15} aria-hidden="true"/>
            <input ref={searchField} type="search" aria-label="Search release dependencies" aria-keyshortcuts="/" placeholder="Search releases" value={query} onChange={event => setQuery(event.target.value)} />
            <kbd aria-hidden="true">/</kbd>
          </label>
          <button ref={refreshButton} type="button" className="btn-secondary studio-batches-refresh" aria-label="Refresh dependencies" title="Refresh dependencies" aria-disabled={current === undefined || checkingSelection} onClick={() => {
            if (current === undefined || checkingSelection) return;
            if (!selected && detail) setSelected({id: detail.row.id, version: detail.row.version});
            setData(undefined);
            setRefresh(value => value + 1);
          }}><RefreshCw size={15} aria-hidden="true"/></button>
        </div>
        {current === undefined && <p role="status">Loading release dependencies…</p>}
        {current === null && <p ref={directoryError} tabIndex={-1} role="alert">Release requests could not be verified. Refresh to try again.</p>}
        {checkingSelection && <p role="status">Checking the selected release version…</p>}
        {current && !visible.length && !checkingSelection && !selectionUnavailable && !selectionHidden && <p role="status">{linked.length
          ? "No loaded dependencies match."
          : "No declared Airflow runs were returned in the loaded requests."}</p>}
        {selectionUnavailable && <p ref={unavailable} role="status" tabIndex={-1}>{selectionLookupFailed
          ? "The selected release version could not be verified. Refresh to retry, or select a current dependency."
          : "The selected release version is unavailable. Select a current dependency to continue."}</p>}
        {selectionHidden && <p role="status">Search has hidden the selected release version. Clear the search to show it again.</p>}
        {visible.length > 0 && <nav aria-label="Select a release dependency">
          <p className="studio-batches-loaded">Loaded dependencies <span>{linked.length.toLocaleString()}</span></p>
          {currentRows.map(dependencyButton)}
          {historyRows.length > 0 && <div role="group" aria-labelledby={`${detailsId}-history`} className="studio-batches-history">
            <p id={`${detailsId}-history`} className="studio-batches-loaded">History</p>
            {historyRows.map((entry, index) => dependencyButton(entry, currentRows.length + index))}
          </div>}
        </nav>}
        {current && archive?.failed && <p role="status">Older release history could not be verified.</p>}
        {current && archive?.nextCursor === null && <p role="status">No more closed release history.</p>}
      </div>
      {detail && <article ref={details} id={detailsId} hidden={selectionHidden} inert={selectionHidden} tabIndex={-1} aria-label="Selected release dependency"
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
            <DependencyNavigation detailId={detailsId} section={section} onSelect={next => {
              const {id, version} = detail.row;
              setReviewedSection({release: {id, version}, section: next});
            }} />
          </header>
          <section className="studio-batches-readiness" aria-label="Dependency readiness" id={`${detailsId}-overview`} tabIndex={-1}>
            <h3 className="sr-only">Dependency readiness</h3>
            <div id={`${detailsId}-runs`} tabIndex={-1} role="region" aria-label="Declared release runs">
              {closureObserved && <p role="status">This saved release is closed. Refresh the release list to review its recorded closure.</p>}
              {detail.row.status !== "submitted" ? <>
                <DependencyProgress requestStatus={detail.row.status} approval={approval}
                  runStatus={detail.row.status === "closed" ? "No current check" : "Unavailable"}/>
                <p>{detail.row.status === "closed"
                  ? "Batch readiness checks are unavailable for closed releases. Open the saved release to review its recorded closure."
                  : "Batch readiness is available for submitted release versions."}</p>
              </>
                : canCheckReadiness ? <>
                  <ReleaseBatchReadiness requestId={detail.row.id} version={detail.row.version} count={detail.count} inspectTasks
                    releaseClosed={closureObserved} onConfirmedClosed={noteClosure}
                    renderProgress={(runStatus, complete) => <DependencyProgress requestStatus={closureObserved ? "closed" : detail.row.status} approval={approval} runStatus={runStatus} complete={complete}/>}/>
                  <section className="studio-batches-monitor" aria-label="Recorded monitor">
                    <h3>Recorded monitor</h3>
                    <ReleaseBatchMonitor requestId={detail.row.id} version={detail.row.version} readOnly
                      releaseClosed={closureObserved} onConfirmedClosed={noteClosure}/>
                  </section>
                </>
                : <>
                  <DependencyProgress requestStatus={detail.row.status} approval={approval} runStatus="Unavailable"/>
                  <p>Batch readiness requires pipeline read access.</p>
                </>}
            </div>
            <details ref={logsDisclosure} id={`${detailsId}-logs`} className="studio-batches-run-logs" tabIndex={-1}>
              <summary className="btn-secondary">View logs</summary>
              <p>Task logs are unavailable for this release.</p>
              {!closureObserved && detail.row.status === "submitted" && canCheckReadiness && <p>Check batches to see observed runs and inspect their task status.</p>}
              <button ref={openLogsButton} type="button" className="btn-secondary mt-2" aria-disabled={closureObserved}
                onClick={() => openSelectedRelease("logs")}>Open release logs</button>
            </details>
          </section>
          <div className="studio-batches-config">
            <section aria-label="Recorded run configuration">
              <h3>Run configuration</h3>
              <dl>
                <div><dt>Recorded target</dt><dd>{detail.row.releaseContext.scope.targetEnvironment || "Unavailable"}</dd></div>
                <div><dt>Applications in plan</dt><dd>{detail.row.releaseContext.scope.applicationCount?.toLocaleString() ?? "Unavailable"}</dd></div>
                <div><dt>Repositories in plan</dt><dd>{detail.row.releaseContext.scope.repositoryCount?.toLocaleString() ?? "Unavailable"}</dd></div>
                <div><dt>Declared runs</dt><dd>{detail.count}</dd></div>
                <div className="studio-batches-window"><dt>Recorded window</dt><dd><RecordedReleaseWindow window={detail.row.releaseContext.window}/></dd></div>
              </dl>
            </section>
            <section id={`${detailsId}-approval`} tabIndex={-1} aria-labelledby={`${detailsId}-approval-heading`}>
              <h3 id={`${detailsId}-approval-heading`}>Approval gate</h3>
              <dl>
                <div><dt>Recorded prerequisites</dt><dd className={approval === "needs_attention" ? "studio-batches-fact-with-icon" : undefined}
                  data-fact-tone={approval === "needs_attention" ? "attention" : undefined}>
                  {approval === "needs_attention" && <TriangleAlert size={13} aria-hidden="true" />}
                  {approval ? approvalLabels[approval] : "Unavailable"}
                </dd></div>
                <div><dt>Recorded PR state</dt><dd>{recordedPrReview(prRequirement ?? {})}</dd></div>
              </dl>
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
                <div><dt>Development readiness</dt><RecordedSafetyFact value={readiness?.developmentReady}/></div>
                <div><dt>Production readiness</dt><RecordedSafetyFact value={readiness?.productionReady}/></div>
                <div><dt>Validation plan</dt><dd>{plannedValidation}{validationSteps !== undefined && readiness?.deferredValidation && " · deferred"}</dd></div>
                <div><dt>Monitoring plan</dt><RecordedSafetyFact value={monitoringPlan}/></div>
                <div><dt>Release evidence references</dt><dd>{recovery?.evidenceCount ?? "Unavailable"}</dd></div>
              </dl>
            </section>
            <div className="studio-batches-release-action">
              {!closureObserved && detail.row.status === "submitted" && !offersReview && !reviewNotRequired && <p>Review release approvals in Deployments.</p>}
              <div className="flex flex-col items-start gap-2">
                {offersReview && <button ref={reviewButton} type="button" className="btn-primary"
                  onClick={() => openSelectedRelease("review")}><ShieldCheck size={15} aria-hidden="true" />Review approvals</button>}
                <button ref={openReleaseButton} type="button" aria-label={`Open release ${detail.row.title}`} className="btn-secondary" aria-disabled={closureObserved}
                  onClick={() => openSelectedRelease()}>Open release</button>
              </div>
            </div>
          </div>
      </article>}
    </div>}
  </section>;
}
