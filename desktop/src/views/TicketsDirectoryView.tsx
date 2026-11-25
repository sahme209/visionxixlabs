import {ReadableTime} from "../components/ReadableTime";
import {useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type Ref} from "react";
import {invoke} from "@tauri-apps/api/core";
import {ArrowRight, Check, ChevronDown, Code2, Download, FileText, Filter, Layers, Package, Plus, RefreshCw, Search, Sparkles} from "lucide-react";
import {changeDraftSourceSchema, type IncidentActivity, type IncidentResponseTarget, type IncidentRelease, type IncidentTriage, type ChangeDraftSource, type TicketDirectory, type TicketRecord, type TicketReleaseLinks} from "../../../lib/tauri/ticketDirectoryContract";
import {incidentComparisonUrl, incidentWorkflowUrl} from "../../../lib/tauri/incidentSourceEvidenceContract";
import {desktopClient, type VerifiedDesktopIdentity} from "../lib/desktopClient";
import {readIncidentActivity, readIncidentCollection, readIncidentRelease, readIncidentRemediationReview, readIncidentTriage, readTicketDirectory, readTicketReleaseLinks} from "../lib/ticketDirectoryClient";
import {ExternalLink} from "../components/Primitives";
import {useSearchShortcut} from "../lib/useSearchShortcut";
import type {IncidentRemediationReview as SavedRemediationReview} from "../../../lib/tauri/incidentRemediationReviewContract";
import {canReportDeploymentIncident} from "../../../lib/tauri/incidentReportContract";
import {ResolutionDraftForm} from "../components/ResolutionDraftForm";
import type {SavedReleaseLink} from "./WelcomeView";
import {IncidentReportDialog} from "./IncidentReportDialog";
import {IncidentUpdates, type IncidentEvidenceHistory, type IncidentUpdateDraft} from "./IncidentUpdates";
import {IncidentAssignmentPicker} from "./IncidentAssignmentPicker";
import type {IncidentAssignmentRequest} from "../../../lib/tauri/incidentAssignmentContract";
import {IncidentCollectionForm} from "./IncidentCollectionForm";
import type {IncidentCollectionRequest} from "../../../lib/tauri/incidentCollectionContract";
import {IncidentStatusActions} from "./IncidentStatusActions";
import {canChangeIncidentStatus, type IncidentTransitionRequest} from "../../../lib/tauri/incidentTransitionContract";
import {emptyTicketFacets, matchesTicketFacets, TicketFacetFilters} from "./TicketFacetFilters";
import "./TicketsDirectoryView.css";

const key = (record: TicketRecord) => `${record.kind}:${record.id}`;
const changeDraftKey = (source: {provider: string; id: string; reference: string}) => JSON.stringify([source.provider, source.id, source.reference]);
const stateLabel = (value: string) => value.replaceAll("_", " ");
const timeLabel = (value: string) => new Date(value).toLocaleString();
const filters = ["open", "mine", "changes", "resolved", "all"] as const;
type Filter = typeof filters[number];
const detailTabs = ["Overview", "Investigation", "Evidence", "Activity", "Linked items"] as const;
type DetailTab = typeof detailTabs[number];

const filterLabels: Record<Filter, string> = {all: "All tickets", open: "Open", mine: "My work", changes: "Changes", resolved: "Resolved"};

const incidentSeverities = ["critical", "high", "medium", "low", "unknown"] as const satisfies readonly Extract<TicketRecord, {kind: "incident"}>["severity"][];
const changePriorities = ["critical", "high", "normal", "low", "trivial", "unknown"] as const satisfies readonly Extract<TicketRecord, {kind: "change"}>["priority"][];
const classificationKey = (record: TicketRecord) => record.kind === "incident" ? `incident:${record.severity}` : `change:${record.priority}`;

function ticketReference(record: TicketRecord) {
  return record.kind === "change" ? record.reference || record.id : record.id;
}

function ticketSearchText(record: TicketRecord) {
  const context = record.kind === "incident" ? record.releaseContext : undefined;
  return [record.title, ticketReference(record), context?.application, context?.environment]
    .filter(Boolean).join(" ").toLowerCase();
}

function inFilter(record: TicketRecord, filter: Filter, userId?:string) {
  if (filter === "mine") return record.kind === "incident" && record.owner?.state === "assigned" &&
    record.owner.userId === userId && (record.status === "open" || record.status === "mitigated");
  if (filter === "all") return true;
  if (filter === "changes") return record.kind === "change";
  if (filter === "resolved") return record.kind === "incident" ? record.status === "resolved" : record.status === "implemented";
  return record.kind === "incident"
    ? record.status === "open" || record.status === "mitigated"
    : ["pending", "in_progress", "approved"].includes(record.status);
}

export function TicketsDirectoryView({identity, revision, onOpenReleases, onOpenSavedDraft, onPrepareRemediation, onParkedDraftsChange, active = true}: {
  active?: boolean;
  identity: VerifiedDesktopIdentity;
  revision: number;
  onOpenReleases: () => void;
  onOpenSavedDraft?: (release: SavedReleaseLink) => void;
  onParkedDraftsChange?: (hasDrafts: boolean) => void;
  onPrepareRemediation?: (incident: Extract<TicketRecord, {kind: "incident"}>, release: IncidentRelease["release"]) => void;
}) {
  const canRead = identity.kind === "desktop_session" && Boolean(identity.userId) && identity.capabilities.includes("workspace:read");
  const canReport = canRead && canReportDeploymentIncident(identity.role);
  const [changeDrafts, setChangeDrafts] = useState<{
    owner: string;
    sources: Map<string, ChangeDraftSource & {title: string}>;
    openKey?: string;
  }>();
  const savedDraftReturn = useRef<{owner: string; sourceKey: string; departed: boolean} | undefined>(undefined);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportNotice, setReportNotice] = useState("");
  useEffect(() => {
    setReportOpen(false);
    setReportNotice("");
    setTransitionNotice("");
    setChangeDrafts(undefined);
  }, [revision, identity.organizationId, identity.userId]);
  const [updateEvidence, setUpdateEvidence] = useState<IncidentEvidenceHistory>();
  const latestAttachment = useRef<HTMLDetailsElement>(null);
  const [transitionNotice, setTransitionNotice] = useState("");
  const assignmentAttempts = useRef(new Map<string,IncidentAssignmentRequest>());
  const collectionAttempts = useRef(new Map<string, IncidentCollectionRequest>());
  const transitionAttempts = useRef(new Map<string, IncidentTransitionRequest>());
  const updateDrafts = useRef(new Map<string, IncidentUpdateDraft>());
  const updatesOwner = JSON.stringify([revision, identity.organizationId, identity.userId]);
  const draftsOwner = useRef(updatesOwner);
  if (draftsOwner.current !== updatesOwner) {
    draftsOwner.current = updatesOwner;
    updateDrafts.current.clear();
    transitionAttempts.current.clear();
    collectionAttempts.current.clear();
    assignmentAttempts.current.clear();
  }
  const [directory, setDirectory] = useState<TicketDirectory | null>();
  const directoryOwner = useRef<string | undefined>(undefined);
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [classification, setClassification] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [facets, setFacets] = useState(emptyTicketFacets);
  const [filtersOwner, setFiltersOwner] = useState<string>();
  const filtersAction = useRef<HTMLButtonElement>(null);
  const facetsOpen = active && canRead && filtersOwner === updatesOwner;
  useEffect(() => {
    setOwnerFilter("");
    setFacets(emptyTicketFacets);
    setFiltersOwner(undefined);
    setFilter(current => current === "mine" ? "open" : current);
  }, [updatesOwner]);
  useEffect(() => {if (!active || !canRead) setFiltersOwner(undefined);}, [active,canRead]);
  const activeFacetCount = Object.values(facets).filter(Boolean).length;
  const searchField = useRef<HTMLInputElement>(null);
  useSearchShortcut(searchField, active && canRead && !facetsOpen);
  const [selected, setSelected] = useState<string>();
  const [detailSelection, setDetailSelection] = useState<{ticket: string; tab: DetailTab}>();
  useEffect(() => {
    setSelected(undefined);
    setDetailSelection(undefined);
  }, [updatesOwner]);
  const panelId = useId();
  const timelineHeadingId = useId();
  const panel = useRef<HTMLElement>(null);
  const focusDetails = useRef(false);
  const ticketReturn = useRef<{ticket: string; releaseId: string} | undefined>(undefined);
  const remediationAction = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (!focusDetails.current) return;
    focusDetails.current = false;
    panel.current?.focus();
  }, [selected]);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setDirectory(undefined);
    if (!canRead || !active) return;
    const config = desktopClient.config;
    const abort = new AbortController();
    void readTicketDirectory(config.apiBase, config.sessionToken, abort.signal).then(result => {
      if (abort.signal.aborted || config !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
      directoryOwner.current = updatesOwner;
      setDirectory(result?.workspaceId === identity.organizationId && result.actorId === identity.userId ? result : null);
    });
    return () => abort.abort();
  }, [active, canRead, identity.organizationId, identity.userId, revision, refresh, updatesOwner]);

  const data = canRead && directoryOwner.current === updatesOwner ? directory : undefined;
  const needle = query.trim().toLowerCase();
  const owners = new Map<string,string>();
  for (const row of data?.records ?? []) {
    if (row.kind === "incident" && row.owner?.state === "assigned") owners.set(row.owner.userId,row.owner.displayName);
  }
  const visible = (data?.records ?? []).filter(record => inFilter(record,filter,identity.userId)
    && (!ownerFilter || (record.kind === "incident" && (ownerFilter === "unassigned"
      ? record.owner?.state === "unassigned" : record.owner?.state === "assigned" && `user:${record.owner.userId}` === ownerFilter)))
    && matchesTicketFacets(record,facets)
    && (!classification || classification === classificationKey(record))
    && ticketSearchText(record).includes(needle));
  useLayoutEffect(() => {
    const entry = savedDraftReturn.current;
    if (!entry) return;
    if (entry.owner !== updatesOwner) {
      savedDraftReturn.current = undefined;
      return;
    }
    if (!active) {
      entry.departed = true;
      return;
    }
    if (!entry.departed || data === undefined) return;
    savedDraftReturn.current = undefined;
    const focused = document.activeElement;
    if (focused !== document.body && !focused?.closest("[hidden]")) return;
    const index = visible.findIndex(row => row.kind === "change" && changeDraftKey(row) === entry.sourceKey);
    (document.getElementById(`${panelId}-row-${index}`) ?? searchField.current)?.focus();
  }, [active, data, updatesOwner, visible, panelId]);

  const exportFlight = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  useEffect(() => setExportMessage(""), [active, identity.organizationId, identity.userId, revision]);

  async function exportTickets() {
    if (!active || !canRead || exportFlight.current || !visible.length || revision !== desktopClient.getContextRevision()) return;
    const config = desktopClient.config;
    const rows = visible.map(row => ({
      kind: row.kind === "incident" ? "Deployment incident" : "Change ticket",
      reference: ticketReference(row),
      title: row.title,
      status: stateLabel(row.status),
      classification: row.kind === "incident" ? row.severity : row.priority,
      application: row.kind === "incident" ? row.releaseContext?.application ?? "" : "",
      environment: row.kind === "incident" ? row.releaseContext?.environment ?? "" : "",
    }));
    exportFlight.current = true;
    setExporting(true);
    setExportMessage("");
    let message = "";
    try {
      const saved = await invoke<boolean>("export_ticket_csv", {rows});
      message = saved ? "Ticket CSV saved." : "Ticket export canceled.";
    } catch (error) {
      message = error === "export_already_exists" ? "That file already exists. Choose a new name." :
        error === "export_invalid_destination" ? "Choose a local file name ending in .csv." : "The ticket CSV could not be saved.";
    } finally {
      exportFlight.current = false;
      setExporting(false);
      if (config === desktopClient.config && revision === desktopClient.getContextRevision()) setExportMessage(message);
    }
  }
  const selectionUnavailable = Boolean(data && selected && !data.records.some(row => key(row) === selected));
  const record = selectionUnavailable ? undefined : visible.find(row => key(row) === selected) ?? visible[0];
  const tabbableRow = record ?? visible[0];
  const recordKey = record && key(record);
  const tab = detailSelection?.ticket === recordKey ? detailSelection?.tab ?? "Overview" : "Overview";
  const incident = record?.kind === "incident" ? record : undefined;
  const canReadTriage = active && Boolean(incident) && identity.capabilities.includes("pipeline:read");
  const triage = useIncidentInspection({
    incidentId: incident?.id ?? "", releaseId: incident?.releaseId ?? "", recordRevision: incident?.revision,
    identity, revision, active: canReadTriage,
  }, readIncidentTriage);
  const savedRecommendation = canReadTriage ? triage.result?.recommendation : undefined;

  function selectDetail(tab: DetailTab) {
    if (recordKey) setDetailSelection({ticket: recordKey, tab});
  }

  function focusDetailTab(index: number) {
    selectDetail(detailTabs[index]);
    document.getElementById(`${panelId}-tab-${index}`)?.focus();
  }

  function moveDetailTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    const next = event.key === "ArrowRight" ? (index + 1) % detailTabs.length :
      event.key === "ArrowLeft" ? (index + detailTabs.length - 1) % detailTabs.length :
      event.key === "Home" ? 0 : event.key === "End" ? detailTabs.length - 1 : undefined;
    if (next === undefined) return;
    event.preventDefault();
    focusDetailTab(next);
  }

  useLayoutEffect(() => {
    if (!active || data === undefined || !ticketReturn.current) return;
    const previous = ticketReturn.current;
    ticketReturn.current = undefined;
    const focused = document.activeElement;
    if (focused !== document.body && !focused?.closest("[hidden]")) return;
    const action = previous.ticket === recordKey && record?.kind === "incident" && record.releaseId === previous.releaseId
      ? remediationAction.current : null;
    (action ?? searchField.current)?.focus();
  }, [active, data, record, recordKey]);
  const loadedOpenCount = data && Object.values(data.sources).every(source => source.state === "available")
    ? data.records.filter(row => inFilter(row, "open")).length : undefined;
  const loadedMineCount = data?.assignmentAvailable && data.sources.incidents.state === "available"
    ? data.records.filter(row => inFilter(row, "mine", identity.userId)).length : undefined;

  const showNoRows = data && !visible.length && Object.values(data.sources).some(source => source.state === "available");

  const canReadLinkedReleases = identity.capabilities.includes("pipeline:read");
  const canReadSources = identity.capabilities.includes("github:read");
  const selectedSource = record?.kind === "change"
    ? changeDraftSourceSchema.safeParse({id: record.id, provider: record.provider, reference: record.reference}) : undefined;
  const ownedDrafts = changeDrafts?.owner === updatesOwner ? changeDrafts : undefined;
  const hasDrafts = Boolean(ownedDrafts?.sources.size);
  useEffect(() => onParkedDraftsChange?.(hasDrafts), [hasDrafts, onParkedDraftsChange]);
  const sourceKey = selectedSource?.success
    ? changeDraftKey(selectedSource.data) : undefined;
  const changeDraftAction = canReadLinkedReleases && record?.kind === "change" && selectedSource?.success && sourceKey &&
    <button type="button" className="btn-secondary" onClick={() => {
      if (!active || !canRead || revision !== desktopClient.getContextRevision()) return;
      setSelected(key(record));
      setChangeDrafts(current => {
        const sources = new Map(current?.owner === updatesOwner ? current.sources : undefined);
        if (!sources.has(sourceKey)) sources.set(sourceKey, {...selectedSource.data, title: record.title});
        return {owner: updatesOwner, sources, openKey: sourceKey};
      });
    }}>{ownedDrafts?.sources.has(sourceKey) ? `Resume release draft for ${selectedSource.data.reference}` : "Start release draft"}</button>;

  function closeChangeDraft(key: string, discard: boolean) {
    setChangeDrafts(current => {
      if (current?.owner !== updatesOwner || current.openKey !== key) return current;
      if (!discard) return {...current, openKey: undefined};
      const sources = new Map(current.sources);
      sources.delete(key);
      return {owner: current.owner, sources};
    });
  }

  const changeReleaseLinks = record?.kind === "change" && record.relatedReleases > 0 && canReadLinkedReleases
    ? <ChangeTicketReleaseLinks key={JSON.stringify([record.id, revision])} ticketId={record.id}
        identity={identity} revision={revision} active={active && canRead}/>
    : null;
  const releaseLinks = record ? record.kind === "change" ?
    <><span>{record.relatedReleases}</span>{changeReleaseLinks}</> :
    <>
      <span>{record.releaseId}</span>
      {canReadLinkedReleases &&
        <IncidentReleaseLink key={JSON.stringify([record.id, record.releaseId, revision, tab])}
          incident={record} identity={identity} revision={revision} active={active && canRead} include={tab === "Evidence" ? (canReadSources ? "sources" : "evidence") : tab === "Linked items" ? "recovery" : undefined}
          collectionAttempts={collectionAttempts.current}
          label={tab === "Evidence" ? "Review linked release evidence" : "View linked release"} />}
    </> : null;
  const remediation = record?.kind === "incident" && (record.status === "open" || record.status === "mitigated")
    && canReadLinkedReleases && onPrepareRemediation && (
    <IncidentReleaseLink key={JSON.stringify([record.id, record.releaseId, revision])}
      incident={record} identity={identity} revision={revision} active={active && canRead} actionRef={remediationAction}
      label="Prepare remediation plan" onOpen={release => {
        setSelected(key(record));
        ticketReturn.current = {ticket: key(record), releaseId: release.id};
        onPrepareRemediation(record, release);
      }} />
  );
  const evidenceHistory = record?.kind === "incident" && updateEvidence?.workspaceId === identity.organizationId &&
    updateEvidence.actorId === identity.userId && updateEvidence.revision === revision &&
    updateEvidence.incidentId === record.id && updateEvidence.releaseId === record.releaseId ? updateEvidence : undefined;
  const latestAttachmentDate = evidenceHistory?.attachedAt[0];
  const incidentSummary = record?.kind === "incident" && <section className="studio-ticket-summary">
    <h3>Investigation summary</h3>
    <p>{record.summary || "No summary recorded."}</p>
  </section>;
  const milestones = record?.kind === "incident" ? [
    {label: "Reported", at: record.reportedAt},
    ...(record.mitigatedAt ? [{label: "Mitigated", at: record.mitigatedAt}] : []),
    ...(record.resolvedAt ? [{label: record.status === "wont_fix" ? "Closed without a fix" : "Resolved", at: record.resolvedAt}] : []),
    ...(evidenceHistory?.latestNoteAt ? [{label: "Investigation update added", at: evidenceHistory.latestNoteAt}] : []),
    ...(latestAttachmentDate ? [{label: "Release evidence attached", at: latestAttachmentDate}] : []),
  ].sort((left, right) => Date.parse(left.at) - Date.parse(right.at)) : [];
  const incidentTimeline = record?.kind === "incident" && <section className="studio-ticket-summary studio-ticket-timeline-panel" aria-labelledby={timelineHeadingId}>
    <div className="studio-ticket-section-heading">
      <h3 id={timelineHeadingId}>Recorded timeline</h3>
      {tab === "Overview" && active && canReadLinkedReleases && <button type="button" className="studio-ticket-section-link"
        onClick={() => focusDetailTab(detailTabs.indexOf("Activity"))}>View activity <ArrowRight size={14} aria-hidden /></button>}
    </div>
    <ol className="studio-ticket-timeline" role="list">
      {milestones.map(({label, at}) => {
        const local = new Date(at);
        const absolute = timeLabel(at);
        const sameDay = local.toDateString() === new Date(record.reportedAt).toDateString();
        return <li key={label}><span>{label}</span><ReadableTime dateTime={at} fullText={absolute}
          displayText={sameDay ? local.toLocaleTimeString(undefined, {hour: "2-digit", minute: "2-digit"}) : absolute}/></li>;
      })}
    </ol>
  </section>;

  function navigateRows(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const next = event.key === "Home" ? 0 : event.key === "End" ? visible.length - 1 :
      event.key === "ArrowDown" ? (index + 1) % visible.length :
      event.key === "ArrowUp" ? (index - 1 + visible.length) % visible.length : undefined;
    if (next === undefined) return;
    const row = visible[next];
    if (!row) return;
    event.preventDefault();
    setSelected(key(row));
    document.getElementById(`${panelId}-row-${next}`)?.focus();
  }

  return <section aria-label="Tickets workspace" className="studio-tickets">
    <header className="studio-tickets-heading">
      <div><h1>Tickets</h1><p>Review recorded deployment incidents and governed changes.</p></div>
      <div className="studio-ticket-header-actions">
        {canRead && <button type="button" className="btn-secondary" aria-label="Export visible tickets"
          aria-disabled={exporting || !visible.length} onClick={() => void exportTickets()}>
          <Download aria-hidden="true" size={16}/>Export
        </button>}
        <button type="button" className="btn-secondary studio-ticket-icon-action" aria-label="Open Deployments"
          title="Open Deployments" onClick={onOpenReleases}><Layers aria-hidden="true" size={16}/></button>
        {canReport && <button type="button" className="btn-primary" onClick={() => setReportOpen(true)}>
          <Plus aria-hidden="true" size={16}/>New ticket
        </button>}
      </div>
    </header>
    {exportMessage && active && canRead && <p role="status">{exportMessage}</p>}
    {reportNotice && active && canRead && <p role="status">{reportNotice}</p>}
    {transitionNotice && active && canRead && <p role="status">{transitionNotice}</p>}
    {ownedDrafts && [...ownedDrafts.sources].map(([draftKey, source]) => {
      const open = active && canRead && canReadLinkedReleases && ownedDrafts.openKey === draftKey;
      return <ResolutionDraftForm key={JSON.stringify([updatesOwner, draftKey])}
        source={source} active={open}
        dialog={{open,
          onClose: saved => closeChangeDraft(draftKey, saved),
          onDiscard: () => closeChangeDraft(draftKey, true),
          onOpenSaved: onOpenSavedDraft && (release => {
            if (!open || revision !== desktopClient.getContextRevision()) return;
            savedDraftReturn.current = {owner: updatesOwner, sourceKey: draftKey, departed: false};
            closeChangeDraft(draftKey, true);
            onOpenSavedDraft(release);
          }),
        }}/>;
    })}
    {canReport && identity.userId && <IncidentReportDialog
      key={JSON.stringify([revision, identity.organizationId, identity.userId])}
      open={active && reportOpen} workspaceId={identity.organizationId} actorId={identity.userId} revision={revision}
      onClose={() => setReportOpen(false)} onReported={incidentId => {
        setReportOpen(false);
        setReportNotice("Deployment incident reported.");
        setFilter("open");
        setQuery("");
        setClassification("");
        setOwnerFilter("");
        setFacets(emptyTicketFacets);
        setSelected(`incident:${incidentId}`);
        setDetailSelection(undefined);
        setDirectory(undefined);
        setRefresh(value => value + 1);
      }}/>}
    {!canRead && <p role="status">A current paired workspace session with read access is required.</p>}
    {canRead && <div className="studio-tickets-controls">
      <div role="group" aria-label="Ticket filters">{filters.filter(value => value !== "mine" || data?.assignmentAvailable || filter === "mine").map(value => {
        const count = value === "open" ? loadedOpenCount : value === "mine" ? loadedMineCount : undefined;
        return <button key={value} type="button" aria-pressed={filter === value}
          aria-label={count === undefined ? undefined : `${filterLabels[value]}, ${count} loaded`}
          onClick={() => {setFilter(value);if (value === "mine" || value === "changes") setOwnerFilter("");}}>
          {filterLabels[value]}
          {count !== undefined && <span className="studio-ticket-count" aria-hidden="true">{count}</span>}
        </button>;
      })}</div>
      <label className="studio-ticket-search"><Search aria-hidden="true" size={16}/><input ref={searchField} type="search" aria-label="Search tickets" aria-keyshortcuts="/" placeholder="Search tickets, applications, or environments" value={query} onChange={event => setQuery(event.target.value)}/><kbd aria-hidden="true">/</kbd></label>
      <label className="studio-ticket-classification">
        <ChevronDown aria-hidden="true" size={14}/>
        <select aria-label="Filter tickets by priority or severity" data-unfiltered={classification === ""} value={classification} onChange={event => setClassification(event.target.value)}>
          <option value="">Priority</option>
          <optgroup label="Incident severity">
            {incidentSeverities.map(value => <option key={value} value={`incident:${value}`}>{value} severity</option>)}
          </optgroup>
          <optgroup label="Change priority">
            {changePriorities.map(value => <option key={value} value={`change:${value}`}>{value} priority</option>)}
          </optgroup>
        </select>
      </label>
      {(data?.assignmentAvailable || !!ownerFilter) && filter !== "mine" && filter !== "changes" &&
        <label className="studio-ticket-classification">
          <ChevronDown aria-hidden="true" size={14}/>
          <select aria-label="Filter tickets by owner" data-unfiltered={!ownerFilter} value={ownerFilter} onChange={event => setOwnerFilter(event.target.value)}>
            <option value="">Owner</option>
            <option value="unassigned">Unassigned</option>
            {[...owners].sort((a,b) => a[1].localeCompare(b[1])).map(([id,name]) => <option key={id} value={`user:${id}`}>{name}</option>)}
            {ownerFilter.startsWith("user:") && !owners.has(ownerFilter.slice(5)) && <option value={ownerFilter}>Selected owner unavailable</option>}
          </select>
        </label>}
      <div className="studio-ticket-filter-actions">
        <button type="button" className="btn-secondary studio-ticket-icon-action" aria-label="Refresh tickets"
          title="Refresh tickets" aria-disabled={data === undefined}
          onClick={() => {
            if (data === undefined) return;
            if (recordKey) setSelected(recordKey);
            setDirectory(undefined);
            setRefresh(value => value + 1);
          }}>
          <RefreshCw aria-hidden="true" size={15}/>
        </button>
        <button ref={filtersAction} type="button" className="btn-secondary" aria-haspopup="dialog" aria-expanded={facetsOpen}
          aria-label={activeFacetCount ? `Filters, ${activeFacetCount} active` : undefined} aria-disabled={!data}
          onClick={() => {if (data && active) setFiltersOwner(updatesOwner);}}>
          <Filter size={16} aria-hidden="true"/>Filters
          {activeFacetCount > 0 && <span className="studio-ticket-count" aria-hidden="true">{activeFacetCount}</span>}
        </button>
      </div>
    </div>}
    {facetsOpen && data && <TicketFacetFilters records={data.records} current={facets}
      onClose={() => setFiltersOwner(undefined)}
      onApply={next => {
        if (revision === desktopClient.getContextRevision()) setFacets(next);
        setFiltersOwner(undefined);
      }}
      restoreFocus={() => {
        const button = filtersAction.current;
        if (!button?.isConnected || button.closest("[hidden], [inert]")) return false;
        button.focus();
        return document.activeElement === button;
      }}/>}
    {canRead && data === undefined && <p role="status">Loading recorded tickets…</p>}
    {data === null && <p role="alert">Ticket records could not be verified. Refresh to try again.</p>}
    {data && Object.entries(data.sources).map(([name, source]) => {
      const label = name === "changes" ? "Change tickets" : "Deployment incidents";
      return source.state !== "available"
        ? <p key={name} role="status">{label} are unavailable{source.state === "migration_pending" ? " while workspace storage is being prepared" : ""}.</p>
        : source.limited ? <p key={name} role="status">Only the latest loaded {label.toLowerCase()} are shown.</p> : null;
    })}
    {selectionUnavailable && <p role="status">The selected ticket could not be verified in the loaded records. Refresh or select another ticket.</p>}
    {showNoRows && !selectionUnavailable && <p role="status">{data.records.length ? "No loaded tickets match." : "No records from the available sources."}</p>}
    {visible.length > 0 && <div className="studio-tickets-workbench">
      <nav aria-label="Select a ticket" aria-describedby={`${panelId}-instructions`}>
        <p id={`${panelId}-instructions`} className="sr-only">Use the Up and Down arrow keys to select a ticket. Press Enter to focus its details.</p>
        {visible.map((row, index) => {
          const context = row.kind === "incident" ? row.releaseContext : undefined;
          const scope = [context?.environment, context?.application].filter(Boolean).join(" · ");
          return (
            <button key={key(row)} id={`${panelId}-row-${index}`} type="button" aria-controls={record ? panelId : undefined}
              tabIndex={row === tabbableRow ? 0 : -1} aria-current={row === record ? "true" : undefined}
              onKeyDown={event => navigateRows(event, index)} onClick={() => {
                const next = key(row);
                if (selected === next) panel.current?.focus();
                else {
                  focusDetails.current = true;
                  setSelected(next);
                }
              }}>
              <span className="studio-ticket-list-meta">
                <small className="studio-ticket-reference" title={ticketReference(row)}>{ticketReference(row)}</small>
                <span className="studio-ticket-chip" data-ticket-priority={row.kind === "change" ? row.priority : row.severity}>{row.kind === "change" ? row.priority : row.severity}</span>
              </span>
              <span>{row.title || "Untitled record"}</span>
              <small>{scope || (row.kind === "incident" ? "Deployment incident" : stateLabel(row.type))} · {stateLabel(row.status)}</small>
            </button>
          );
        })}
      </nav>
      {record && <article ref={panel} id={panelId} tabIndex={-1} aria-label="Selected ticket details" onKeyDown={event => {
        if (event.key !== "Escape" || event.defaultPrevented || event.nativeEvent.isComposing ||
          event.nativeEvent.keyCode === 229 || (event.target instanceof Element &&
            event.target.closest('input, textarea, select, [contenteditable], [role="dialog"], [role="alertdialog"]'))) return;
        const index = visible.indexOf(record);
        if (index < 0) return;
        event.preventDefault();
        document.getElementById(`${panelId}-row-${index}`)?.focus();
      }}>
        <header className="studio-ticket-detail-heading">
          <p className="studio-ticket-state studio-ticket-reference">{ticketReference(record)}</p>
          <div className="studio-ticket-detail-chips">
            <span className="studio-ticket-chip" data-ticket-priority={record.kind === "incident" ? record.severity : record.priority}>
              {record.kind === "incident" ? `Severity: ${record.severity}` : `Priority: ${record.priority}`}
            </span>
            <span className="studio-ticket-chip" data-ticket-status={record.status}>{stateLabel(record.status)}</span>
            {record.kind === "incident" && record.revision && identity.userId && canReadLinkedReleases &&
              canChangeIncidentStatus(identity.role) && <IncidentStatusActions
                key={JSON.stringify([updatesOwner, record.id, record.releaseId, record.revision])}
                actorId={identity.userId} workspaceId={identity.organizationId} revision={revision} active={active}
                incident={record} attempts={transitionAttempts.current}
                onResult={result => {
                  setTransitionNotice(result === "changed" ? "This ticket changed. Review its refreshed status before changing it." :
                    `Incident status change recorded: ${stateLabel(result.status)}.`);
                  setSelected(recordKey);
                  if (result !== "changed" && (result.status === "resolved" || result.status === "wont_fix")) setFilter("all");
                  searchField.current?.focus();
                  setDirectory(undefined);
                  setRefresh(value => value + 1);
                }}/>}
          </div>
        </header>
        <h2>{record.title || "Untitled record"}</h2>
        {record.kind === "incident" && tab === "Overview" && <div className="studio-ticket-incident-release studio-ticket-release-value">
          <span>Recorded release</span>{releaseLinks}
        </div>}
        <div className="studio-ticket-detail-tabs" role="tablist" aria-label="Ticket details">
          {detailTabs.map((label, index) => <button key={label} type="button" role="tab" id={`${panelId}-tab-${index}`}
            aria-selected={label === tab} tabIndex={label === tab ? 0 : -1} aria-controls={`${panelId}-detail`}
            onClick={() => selectDetail(label)} onKeyDown={event => moveDetailTab(event, index)}>{label}</button>)}
        </div>
        <div key={tab} role="tabpanel" id={`${panelId}-detail`} aria-labelledby={`${panelId}-tab-${detailTabs.indexOf(tab)}`} tabIndex={0}>
          {tab === "Overview" && <>
            <dl className={record.kind === "incident" ? "studio-ticket-overview-facts" : undefined}>
              {record.kind === "change" ? <>
                <div><dt>Provider</dt><dd>{record.provider}</dd></div>
                <div><dt>Recorded type</dt><dd>{stateLabel(record.type)}</dd></div>
                <div><dt>Linked release records</dt><dd className="studio-ticket-release-value">{releaseLinks}</dd></div>
                <div><dt>Last synced</dt><dd>{timeLabel(record.observedAt)}</dd></div>
              </> : <>
                {record.releaseContext !== undefined && <>
                  <div><dt>Application</dt><dd>{record.releaseContext?.application ?? "Unavailable"}</dd></div>
                  <div><dt>Environment</dt><dd>{record.releaseContext?.environment ?? "Unavailable"}</dd></div>
                </>}
                {record.owner && <div><dt>Owner</dt><dd className="studio-ticket-release-value">
                  {record.owner.state === "assigned" ? record.owner.displayName :
                    record.owner.state === "unassigned" ? "Unassigned" : "Recorded owner unavailable"}
                  {active && identity.userId && record.revision && canReadLinkedReleases && canChangeIncidentStatus(identity.role) &&
                    <IncidentAssignmentPicker key={JSON.stringify([updatesOwner,record.id,record.releaseId,record.revision])}
                      incident={record} workspaceId={identity.organizationId} actorId={identity.userId} revision={revision}
                      attempts={assignmentAttempts.current} onSaved={() => {
                        setTransitionNotice("Incident owner updated.");
                        setDirectory(undefined);
                        setSelected(recordKey);
                        setRefresh(value => value + 1);
                        searchField.current?.focus();
                      }}/>}
                </dd></div>}
                <div><dt>Response target</dt><dd>
                  {record.responseTarget ? <ResponseTarget target={record.responseTarget} ticking={active && record.status === "open"}/> :
                    "No triage target recorded"}
                </dd></div>
              </>}
            </dl>
            {changeDraftAction}
            {record.kind === "incident" && <div className="studio-ticket-overview">
              <div>
                {incidentSummary}
                {active && canReadLinkedReleases && <section className="studio-ticket-triage-callout" aria-label="Saved triage">
                  <button type="button" className="studio-ticket-triage-action"
                    onClick={() => focusDetailTab(detailTabs.indexOf("Investigation"))}>
                    <Sparkles size={14} aria-hidden />
                    Review saved triage
                    <ArrowRight size={14} aria-hidden />
                  </button>
                  {savedRecommendation ? <>
                    <p>{triageDecisionLabel(savedRecommendation)}</p>
                    {savedRecommendation.rationale && <p>{savedRecommendation.rationale}</p>}
                  </> : <p>Check the suggested priority, rationale, and any recorded decision.</p>}
                </section>}
                {(canReadLinkedReleases || latestAttachmentDate) && <section className="studio-ticket-summary studio-ticket-overview-evidence">
                  <h3>Evidence</h3>
                  {canReadLinkedReleases && <button type="button" className="studio-ticket-evidence-row"
                    onClick={() => focusDetailTab(detailTabs.indexOf("Evidence"))}>
                    <Package aria-hidden="true" size={16}/>
                    <span>View release evidence</span>
                    <ArrowRight aria-hidden="true" size={14}/>
                  </button>}
                  {latestAttachmentDate && <button type="button" className="studio-ticket-evidence-row" onClick={() => {
                    const attachment = latestAttachment.current;
                    if (!attachment || revision !== desktopClient.getContextRevision()) return;
                    attachment.open = true;
                    attachment.querySelector<HTMLElement>("summary")?.focus();
                  }}>
                    <FileText aria-hidden="true" size={16}/>
                    <span>Review attached evidence<time dateTime={latestAttachmentDate}>{timeLabel(latestAttachmentDate)}</time></span>
                    <ArrowRight aria-hidden="true" size={14}/>
                  </button>}
                </section>}
              </div>
              <div className="space-y-4">
                {incidentTimeline}
                <IncidentResolutionChecklist key={JSON.stringify([updatesOwner,record.id,record.releaseId,record.revision])}
                  incident={record} identity={identity} revision={revision} active={active && canReadLinkedReleases}
                  evidenceHistory={evidenceHistory}/>
                {remediation}
              </div>
            </div>}
          </>}
          {tab === "Investigation" && (record.kind === "incident" ? <>
            {incidentSummary}
            {canReadTriage && <IncidentTriageReview {...triage}/>}
          </> : <p>Investigation notes are unavailable for this change ticket.</p>)}
          {tab === "Activity" && (record.kind === "incident" ? <>
            {incidentTimeline}
            {canReadLinkedReleases && active && <IncidentActivityHistory
              key={JSON.stringify([record.id, record.releaseId, revision, identity.organizationId, identity.userId])}
              incidentId={record.id} releaseId={record.releaseId} identity={identity} revision={revision}/>}
          </> : <dl>
            <div><dt>Last synced</dt><dd><time dateTime={record.kind === "change" ? record.observedAt : undefined}>
              {record.kind === "change" && timeLabel(record.observedAt)}
            </time></dd></div>
          </dl>)}
          {tab === "Evidence" && <section className="studio-ticket-summary">
            <h3>Release evidence</h3>
            {record.kind === "incident" && canReadLinkedReleases ? <>
              <p>Check the recorded release status and commit.</p>
              <div className="studio-ticket-release-value">{releaseLinks}</div>
            </> : <>
              {changeReleaseLinks && <>
                <p>Open a verified linked release in the browser to review its record.</p>
                <div className="studio-ticket-release-value">{changeReleaseLinks}</div>
              </>}
              <p>Evidence attachments are unavailable for this ticket.</p>
            </>}
          </section>}
          {tab === "Linked items" && <>
            <dl>
              <div><dt>{record.kind === "incident" ? "Recorded release ID" : "Linked release records"}</dt>
                <dd className="studio-ticket-release-value">{releaseLinks}</dd></div>
            </dl>
            {changeDraftAction}
          </>}
        </div>
        {record.kind === "incident" && identity.userId && canRead && <IncidentUpdates
          key={JSON.stringify([updatesOwner, record.id, record.releaseId])} visible={active && tab === "Overview"}
          incidentId={record.id} releaseId={record.releaseId} actorId={identity.userId} workspaceId={identity.organizationId}
          revision={revision} drafts={updateDrafts.current} onEvidenceHistory={setUpdateEvidence} latestAttachmentRef={latestAttachment}/>}
      </article>}
    </div>}
  </section>;
}


function ResponseTarget({target,ticking}: {target:IncidentResponseTarget; ticking:boolean}) {
  const [now,setNow] = useState(() => Date.now());
  const due = Date.parse(target.deadline);
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const clock = window.setInterval(() => setNow(Date.now()),15_000);
    return () => window.clearInterval(clock);
  }, [ticking,target.deadline]);

  const minutes = Math.ceil((due-now)/60_000);
  const remaining = minutes <= 0 ? "Target elapsed" :
    minutes > 60 ? `${Math.floor(minutes/60)} h ${minutes%60} min remaining` : `${minutes} min remaining`;
  const source = target.decision === "suggested" ? "Suggested triage" :
    target.decision === "overridden" ? "Reviewed priority override" : "Accepted triage";
  return <>
    <time dateTime={target.deadline} title={timeLabel(target.deadline)}>{ticking ? remaining : timeLabel(target.deadline)}</time>
    <small className="studio-ticket-response-source">{source} · {target.priority}</small>
  </>;
}

function IncidentResolutionChecklist({incident, identity, revision, active, evidenceHistory}: {
  incident: Extract<TicketRecord, {kind: "incident"}>;
  evidenceHistory?: IncidentEvidenceHistory;
  identity: VerifiedDesktopIdentity;
  revision: number;
  active: boolean;
}) {
  const {read, pending, result} = useIncidentInspection({incidentId:incident.id,releaseId:incident.releaseId,identity,revision,active},
    readIncidentRemediationReview);
  const review = active && result?.incidentRevision === incident.revision ? result?.proposal : undefined;
  const reviewed = review?.binding === "current" && !!review.decidedAt;
  const reviewStatus = pending ? "Reading saved remediation…" : result === null ? "Saved review unavailable" :
    result?.incidentRevision !== incident.revision && result ? "Refresh tickets to review the current revision" :
    review?.binding === "historical" ? "Historical proposal" : review && reviewed ? `Review recorded · ${stateLabel(review.decision)}` :
    review ? (review.decision === "superseded" ? "Superseded without review" : "Awaiting decision") :
    result?.proposal === null ? "No saved proposal found" : "Review unconfirmed";
  const config = desktopClient.config;
  const [collection, setCollection] = useState<string | null>();
  const canCheckCollection = active && identity.capabilities.includes("github:read") && !!incident.revision;
  useEffect(() => {
    setCollection(undefined);
    if (!canCheckCollection) return;
    const controller = new AbortController();
    void Promise.resolve(readIncidentCollection(config.apiBase,config.sessionToken,controller.signal,incident.id)).then(result => {
      if (controller.signal.aborted || config !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
      setCollection(result?.workspaceId === identity.organizationId && result.actorId === identity.userId && result.incidentId === incident.id &&
        result.releaseId === incident.releaseId && result.incidentRevision === incident.revision ? result.collectedAt : null);
    });
    return () => controller.abort();
  }, [canCheckCollection,config,identity.organizationId,identity.userId,incident.id,incident.releaseId,incident.revision,revision]);
  const collected = canCheckCollection ? collection : undefined;
  const hasTerminalStatus = incident.status === "resolved" || incident.status === "wont_fix";
  const closed = hasTerminalStatus && !!incident.resolvedAt;
  const attached = evidenceHistory?.attachedAt.some(at => Date.parse(at) >= Date.parse(incident.reportedAt)) ?? false;
  const closureLabel = incident.status === "wont_fix" ? "Closed without a fix" : "Resolution recorded";
  const pendingClosure = hasTerminalStatus || incident.status === "unknown" ? "Closure unverified" : "Closure pending";
  const steps = [
    {label: "Confirm affected environment", done: !!incident.releaseContext?.environment,
      detail: incident.releaseContext?.environment ? undefined : "Linked environment unavailable"},
    {label: "Collect logs and change diff", done: !!collected,
      detail: collected ? "Collection recorded by operator" : "Collection unconfirmed"},
    {label: "Review remediation plan", done: reviewed, detail: reviewStatus},
    {label: "Validate service recovery", done: false, detail: "Recovery unverified"},
    {label: "Close and attach evidence", done: closed && attached,
      detail: closed ? attached ? closureLabel :
        evidenceHistory && !evidenceHistory.limited ? `${closureLabel} · No attachment recorded` :
          `${closureLabel} · Attachment unverified`
        : attached ? `Evidence attached · ${pendingClosure}` : pendingClosure},
  ];
  return <section className="studio-ticket-summary studio-ticket-checklist" aria-label="Resolution checklist">
    <h3>Resolution checklist</h3>
    <ul role="list">
      {steps.map(({label, done, detail}) => <li key={label}>
        <span className="studio-ticket-step-mark" data-recorded={done} aria-hidden="true">
          {done && <Check size={12} strokeWidth={2}/>}
        </span>
        <span>{label === "Review remediation plan" && active && incident.revision
          ? <button type="button" className="studio-ticket-checklist-review" aria-disabled={pending} onClick={() => void read()}>{label}</button>
          : label}
          <span className="sr-only">{done ? ", recorded" : ", unconfirmed"}</span>
          {detail && <small role={label === "Review remediation plan" ? "status" : undefined}>{detail}</small>}
          {label === "Review remediation plan" && review && <small>
            {review.title} · <time dateTime={review.decidedAt ?? review.generatedAt}>{timeLabel(review.decidedAt ?? review.generatedAt)}</time>
          </small>}
        </span>
      </li>)}
    </ul>
  </section>;
}

const transitionLabels: Record<IncidentActivity["events"][number]["action"], string> = {
  mitigate: "Mitigated", resolve: "Resolved", reopen: "Reopened", wont_fix: "Closed without a fix",
};

type IncidentInspection = {
  incidentId: string;
  recordRevision?: string;
  releaseId: string;
  identity: VerifiedDesktopIdentity;
  revision: number;
  active?: boolean;
};

function useIncidentInspection<T extends IncidentActivity | IncidentTriage | SavedRemediationReview>(
  {incidentId, releaseId, recordRevision, identity, revision, active = true}: IncidentInspection,
  load: (base: string, token: string | undefined, signal: AbortSignal, incidentId: string) => Promise<T | undefined> | undefined,
) {
  const flight = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<T | null>();
  useLayoutEffect(() => {
    setPending(false);
    setResult(undefined);
    return () => {flight.current?.abort(); flight.current = null;};
  }, [active, incidentId, releaseId, recordRevision, identity.organizationId, identity.userId, revision]);

  async function read() {
    if (flight.current || !active) return;
    const config = desktopClient.config;
    const controller = new AbortController();
    flight.current = controller;
    setPending(true);
    setResult(undefined);
    const response = await load(config.apiBase, config.sessionToken, controller.signal, incidentId);
    if (flight.current !== controller || controller.signal.aborted || config !== desktopClient.config ||
        revision !== desktopClient.getContextRevision()) return;
    flight.current = null;
    setResult(response?.workspaceId === identity.organizationId && response.actorId === identity.userId &&
      response.incidentId === incidentId && response.releaseId === releaseId ? response : null);
    setPending(false);
  }
  return {read, pending, result};
}

function IncidentActivityHistory(inspection: IncidentInspection) {
  const headingId = useId();
  const {read, pending, result} = useIncidentInspection(inspection, readIncidentActivity);

  return <section className="studio-ticket-summary studio-ticket-timeline-panel" aria-labelledby={headingId}>
    <h3 id={headingId}>Saved transitions</h3>
    <button type="button" className="btn-secondary" aria-disabled={pending} onClick={() => void read()}>
      {result ? "Refresh transition history" : "View transition history"}
    </button>
    <p role="status">{pending ? "Reading saved transitions…" : result === null ? "Transition history is unavailable." :
      result?.limited ? "Showing the 20 most recent saved transitions." :
      result?.events.length === 0 ? "No saved transitions were found." :
      result ? `${result.events.length} saved transitions loaded.` : ""}</p>
    {Boolean(result?.events.length) && <ol className="studio-ticket-timeline" role="list">
      {result?.events.map(event => <li key={event.id}>
        <span>{transitionLabels[event.action]}</span><time dateTime={event.recordedAt}>{timeLabel(event.recordedAt)}</time>
      </li>)}
    </ol>}
  </section>;
}

const triageDecisionLabels: Record<NonNullable<IncidentTriage["recommendation"]>["decision"], string> = {
  pending: "Pending review", accepted: "Accepted", overridden: "Overridden", dismissed: "Dismissed",
};

function triageDecisionLabel(recommendation: NonNullable<IncidentTriage["recommendation"]>) {
  return recommendation.decision === "dismissed" && !recommendation.decidedAt
    ? "Dismissed · no operator decision recorded" : triageDecisionLabels[recommendation.decision];
}

function IncidentTriageReview({read, pending, result}: {
  read: () => Promise<void>;
  pending: boolean;
  result: IncidentTriage | null | undefined;
}) {
  const headingId = useId();
  const recommendation = result?.recommendation;

  return <section className="studio-ticket-summary studio-ticket-timeline-panel" aria-labelledby={headingId}>
    <h3 id={headingId}>Saved triage recommendation</h3>
    <button type="button" className="btn-secondary" aria-disabled={pending} onClick={() => void read()}>
      {result ? "Refresh saved triage" : "View saved triage"}
    </button>
    <p role="status">{pending ? "Reading saved triage…" : result === null ? "Saved triage is unavailable." :
      result?.recommendation === null ? "No triage recommendation is recorded." :
      recommendation ? "Latest saved recommendation loaded." : ""}</p>
    {recommendation && <>
      <dl>
        <div><dt>Suggested priority</dt><dd>{recommendation.priority}</dd></div>
        <div><dt>Suggested team</dt><dd>{recommendation.suggestedTeam}</dd></div>
        <div><dt>Recorded decision</dt><dd>{triageDecisionLabel(recommendation)}</dd></div>
        {recommendation.overridePriority && <div><dt>Operator priority</dt><dd>{recommendation.overridePriority}</dd></div>}
        <div><dt>Generated</dt><dd><time dateTime={recommendation.generatedAt}>{timeLabel(recommendation.generatedAt)}</time></dd></div>
        {recommendation.decidedAt && <div><dt>Decided</dt><dd><time dateTime={recommendation.decidedAt}>{timeLabel(recommendation.decidedAt)}</time></dd></div>}
      </dl>
      {recommendation.rationale && <p>{recommendation.rationale}</p>}
    </>}
  </section>;
}

function IncidentReleaseLink({incident, identity, revision, active, actionRef, onOpen, label, include, collectionAttempts}: {
  incident: Extract<TicketRecord, {kind: "incident"}>;
  identity: VerifiedDesktopIdentity;
  revision: number;
  active: boolean;
  actionRef?: Ref<HTMLButtonElement>;
  include?: "evidence" | "recovery" | "sources";
  collectionAttempts?: Map<string, IncidentCollectionRequest>;
  label: string;
  onOpen?: (release: IncidentRelease["release"]) => void;
}) {
  const [status, setStatus] = useState<"idle" | "reading" | "unavailable">("idle");
  const [details, setDetails] = useState<IncidentRelease>();
  const config = desktopClient.config;
  const flight = useRef<AbortController | null>(null);
  useLayoutEffect(() => {
    setStatus("idle");
    setDetails(undefined);
    return () => {flight.current?.abort(); flight.current = null;};
  }, [active, config, include, revision, incident.revision, incident.status, identity.organizationId, identity.userId]);

  async function openRelease() {
    if (!active || flight.current || config !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
    const request = new AbortController();
    flight.current = request;
    setStatus("reading");
    setDetails(undefined);
    const result = await readIncidentRelease(config.apiBase, config.sessionToken, request.signal, incident.id, include);
    if (flight.current !== request || request.signal.aborted || config !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
    flight.current = null;
    if (!result || result.workspaceId !== identity.organizationId || result.actorId !== identity.userId
      || result.release.id !== incident.releaseId || result.incidentStatus !== incident.status) {
      setStatus("unavailable");
      return;
    }
    setStatus("idle");
    if (onOpen) onOpen(result.release);
    else setDetails(result);
  }

  return <div className="studio-ticket-release-link">
    <button ref={actionRef} type="button" className={onOpen ? "btn-primary" : "studio-ticket-release-action"} aria-disabled={status === "reading"}
      onClick={() => void openRelease()}>
      {onOpen && <Sparkles size={15} aria-hidden="true" />}
      {status === "reading" ? "Checking linked release…" : details ? "Refresh linked release" : label}
    </button>
    {status === "unavailable" && <p role="status">The current linked release could not be verified. Refresh the ticket and try again.</p>}
    {details && <div className="min-w-0 space-y-1">
      <div role="status">
        <p>{details.release.tag ?? "Untagged release"} · {stateLabel(details.release.status)}</p>
        <p>Recorded commit {details.release.commit ? <code className="break-all">{details.release.commit}</code> : "unavailable"}</p>
        {(include === "evidence" || include === "sources") && <SavedIncidentEvidence evidence={details.evidence}/>}
      </div>
      <ExternalLink className="studio-ticket-release-action" href={`https://visionxixlabs.com/control/releases/${encodeURIComponent(details.release.id)}`}>
        Open release record in browser
      </ExternalLink>
      {include === "sources" && <>
        <IncidentSourceLinks sources={details.sources}/>
        {identity.userId && incident.revision && collectionAttempts && canChangeIncidentStatus(identity.role) && <IncidentCollectionForm
          key={JSON.stringify([identity.organizationId,identity.userId,incident.id,incident.releaseId,incident.revision,revision])}
          workspaceId={identity.organizationId} actorId={identity.userId} incidentId={incident.id} releaseId={incident.releaseId}
          incidentRevision={incident.revision} revision={revision} attempts={collectionAttempts} sources={details.sources}/>}
      </>}
      {include === "recovery" && <IncidentRecoveryReference recovery={details.recovery}/>}
    </div>}
  </div>;
}

function IncidentSourceLinks({sources}: {sources: IncidentRelease["sources"]}) {
  return <section className="studio-ticket-source-evidence" aria-label="Repository evidence">
    <h4>Repository evidence</h4>
    {sources?.state !== "recorded" ? <p>Workflow logs and commit comparison are unavailable for this release.</p> : <>
      {sources.runs?.map(run =>
        <ExternalLink className="studio-ticket-evidence-row" key={run.runId}
          href={incidentWorkflowUrl(sources.repository,run.runId)}>
          <FileText size={16} aria-hidden="true"/>
          <span>View workflow logs on GitHub
            <small>{run.name} · {stateLabel(run.conclusion ?? run.status)} · synced <time dateTime={run.observedAt}>{timeLabel(run.observedAt)}</time></small>
          </span>
          <ArrowRight size={14} aria-hidden="true"/>
        </ExternalLink>,
      )}
      {!sources.runs?.length && <p>{sources.runs && !sources.limited
        ? "No matching workflow runs are saved." : "Matching workflow runs could not be verified."}</p>}
      {!!sources.runs?.length && sources.limited && <p>Showing up to five verified matches from the latest saved runs.</p>}
      {sources.comparison ? <ExternalLink className="studio-ticket-evidence-row"
        href={incidentComparisonUrl(sources.repository,sources.comparison.baselineCommit,sources.commit)}>
        <Code2 size={16} aria-hidden="true"/>
        <span>Compare release commits on GitHub
          <small>{sources.comparison.baselineTag || sources.comparison.baselineCommit.slice(0,12)} → {sources.commit.slice(0,12)}</small>
        </span>
        <ArrowRight size={14} aria-hidden="true"/>
      </ExternalLink> : <p>No verified comparison baseline is available.</p>}
    </>}
    <p>Service recovery validation is unavailable.</p>
  </section>;
}

function IncidentRecoveryReference({recovery}: {recovery: IncidentRelease["recovery"]}) {
  return <div className="mt-3">
    <h4 className="font-medium">Recorded rollback reference</h4>
    {recovery?.state === "recorded" ? <>
      <p>{recovery.tag ?? "Untagged release"} · <code className="break-all">{recovery.commit}</code></p>
      <ExternalLink className="studio-ticket-release-action" href={`https://visionxixlabs.com/control/releases/${encodeURIComponent(recovery.releaseId)}`}>
        Open rollback reference in browser
      </ExternalLink>
    </> : <p>{recovery?.state === "missing" ? "No rollback reference is recorded." : "The rollback reference could not be verified."}</p>}
  </div>;
}

function SavedIncidentEvidence({evidence}: {evidence: IncidentRelease["evidence"]}) {
  if (evidence?.state !== "recorded") return <p>{evidence?.state === "missing" ? "No saved evidence pack is recorded." : "A saved evidence pack could not be verified for this release commit."}</p>;
  return <div className="mt-3">
    <h4 className="font-medium">Saved release evidence</h4>
    <dl className="mt-2">
      <div><dt>Generated</dt><dd><time dateTime={evidence.generatedAt}>{timeLabel(evidence.generatedAt)}</time></dd></div>
      <div><dt>Branch checks recorded</dt><dd>{evidence.branchCheckCount}</dd></div>
      <div><dt>Change tickets recorded</dt><dd>{evidence.changeTicketCount}</dd></div>
      {evidence.readiness && <div><dt>Saved readiness evaluation</dt><dd>
        {evidence.readiness.score}/100{evidence.readiness.evaluatedAt
          ? <> · <time dateTime={evidence.readiness.evaluatedAt}>{timeLabel(evidence.readiness.evaluatedAt)}</time></>
          : " · evaluation time unverified"}
      </dd></div>}
    </dl>
  </div>;
}

function ChangeTicketReleaseLinks({ticketId, identity, revision, active}: {
  ticketId: string;
  identity: VerifiedDesktopIdentity;
  revision: number;
  active: boolean;
}) {
  const config = desktopClient.config;
  const [links, setLinks] = useState<TicketReleaseLinks | null>();
  const [busy, setBusy] = useState(false);
  const flight = useRef<AbortController | null>(null);

  useLayoutEffect(() => {
    setLinks(undefined);
    setBusy(false);
    return () => {
      flight.current?.abort();
      flight.current = null;
    };
  }, [active, config, revision, identity.userId, identity.organizationId]);

  async function loadLinks() {
    const owns = () => active && config === desktopClient.config && revision === desktopClient.getContextRevision();
    if (flight.current || !owns()) return;
    const request = new AbortController();
    flight.current = request;
    setLinks(undefined);
    setBusy(true);
    const result = await readTicketReleaseLinks(config.apiBase, config.sessionToken, request.signal, ticketId);
    if (flight.current !== request || request.signal.aborted || !owns()) return;
    flight.current = null;
    setLinks(result?.workspaceId === identity.organizationId && result.actorId === identity.userId && result.ticketId === ticketId ? result : null);
    setBusy(false);
  }

  return <div className="studio-ticket-release-link">
    <button type="button" className="studio-ticket-release-action" aria-disabled={busy} onClick={() => void loadLinks()}>
      {busy ? "Checking linked releases…" : links ? "Refresh linked releases" : "View linked releases"}
    </button>
    {links === null && <p role="status">Linked releases could not be verified.</p>}
    {links && !links.releases.length && <p role="status">{links.incomplete ? "No linked release could be verified." : "No release links are recorded."}</p>}
    {links && links.releases.length > 0 && <>
      <ul aria-label="Verified release links">
        {links.releases.map(release => <li key={release.id}>
          <ExternalLink className="studio-ticket-release-action" href={`https://visionxixlabs.com/control/releases/${encodeURIComponent(release.id)}`}>
            {release.tag || release.id} <span className="sr-only">in browser</span>↗
          </ExternalLink>
        </li>)}
      </ul>
      {links.incomplete && <p role="status">Some recorded links are unavailable in this view.</p>}
    </>}
  </div>;
}
