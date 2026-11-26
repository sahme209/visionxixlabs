import {ReadableTime} from "../components/ReadableTime";
import { StatusBadge, StatusIconChip, releaseRequestTone, type StatusShape, type StatusTone } from "../components/StatusBadge";

/** Recorded audit outcomes only; unknown keeps the neutral history glyph. */
function auditOutcomeTone(outcome: string): {tone: StatusTone; shape: StatusShape} | null {
  if (outcome === "ok") return {tone: "green", shape: "success"};
  if (outcome === "rejected" || outcome === "error") return {tone: "red", shape: "failure"};
  if (outcome === "skipped") return {tone: "neutral", shape: "dot"};
  return null;
}
import { ArrowRight, Box, ChevronRight, GitBranch, History, Layers, ListChecks, Sparkles, SquareStack } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { z } from "zod";
import { HOME_DRAFT_MAX_LENGTH, type HomePlanningContext, type HomePlanningIntent } from "../lib/agentDraftRequest";
import { desktopClient } from "../lib/desktopClient";
import { releaseJourney } from "../../../lib/customerJourney/journey";

export interface SavedReleaseLink {
  id: string;
  version: number;
}

interface RecentRelease extends SavedReleaseLink {
  title: string;
  status: string;
  updatedAt: string;
  environment: string | null;
  nextAction?: string;
}

const releaseSummary = [
  {key: "loaded", label: "Loaded requests"},
  {key: "draft", label: "Draft requests"},
  {key: "submitted", label: "Submitted requests"},
  {key: "closed", label: "Closed requests"},
] as const;
type ReleaseCounts = Record<typeof releaseSummary[number]["key"], number>;

interface WelcomeViewProps {
  active?: boolean;
  returnActivity?: SavedReleaseLink;
  onBuild: () => void;
  onBot: () => void;
  onAutomate: () => void;
  onDeploy: () => void;
  onOpenSavedRelease: (release: SavedReleaseLink) => void;
  releaseOwner: string;
  plannerDrafts?: Partial<Record<HomePlanningIntent, string>>;
  onEditPlannerDraft?: (intent: HomePlanningIntent, draft: string) => void;
  onReviewPlan?: (intent: HomePlanningIntent, draft: string, context?: HomePlanningContext) => void;
  contextAccess?: {repositories: boolean};
  displayName?: string;
  releaseConfig: typeof desktopClient.config;
}

const plannerModes = [
  { intent: "release", label: "Plan a release", placeholder: "Describe the change you want to make…", action: "Create plan" },
  { intent: "change", label: "Analyze change", placeholder: "Describe the change you want to analyze…", action: "Review change" },
  { intent: "issue", label: "Investigate issue", placeholder: "Describe the issue you want to investigate…", action: "Review issue" },
  { intent: "ask", label: "Ask V19", placeholder: "What would you like to ask V19?", action: "Review question" },
] as const;

const repositoriesSchema = z.object({
  repositories: z.array(z.object({fullName: z.string().min(1).max(240)})),
});
const environmentsSchema = z.object({
  environments: z.array(z.object({
    id: z.string().min(1), slug: z.string().min(1).max(32), name: z.string().min(1),
  })).refine(rows => new Set(rows.map(row => row.id)).size === rows.length),
});
type EnvironmentOption = z.output<typeof environmentsSchema>["environments"][number];

const homeAuditLimit = 4;
const recentAuditSchema = z.object({
  events: z.array(z.object({
    id: z.string().min(1).max(240),
    summary: z.string().trim().min(1).max(2000),
    outcome: z.enum(["ok", "rejected", "error", "skipped", "unknown"]),
    createdAtIso: z.string().datetime(),
  })).max(homeAuditLimit).refine(events => new Set(events.map(event => event.id)).size === events.length),
});
type HomeAuditEvent = z.output<typeof recentAuditSchema>["events"][number];

function HomeReleaseAudit({config, active}: {config: typeof desktopClient.config; active: boolean}) {
  const [events, setEvents] = useState<HomeAuditEvent[] | null>();
  const revision = desktopClient.getContextRevision();
  useEffect(() => {
    if (!active || config !== desktopClient.config) return;
    let current = true;
    setEvents(undefined);
    void (async () => {
      let records: HomeAuditEvent[] | null = null;
      try {
        const result = await desktopClient.releaseAudit<unknown>({limit: homeAuditLimit});
        const parsed = result.ok ? recentAuditSchema.safeParse(result.data) : undefined;
        if (parsed?.success) records = parsed.data.events;
      } catch {
        // Activity is optional and has an independent unavailable state.
      }
      if (current && config === desktopClient.config && revision === desktopClient.getContextRevision()) setEvents(records);
    })();
    return () => {current = false;};
  }, [active, config, revision]);

  return <section className="studio-home-audit" aria-labelledby="home-release-audit" aria-describedby="home-release-audit-source">
    <div className="studio-home-activity-heading"><h2 id="home-release-audit">Activity feed</h2></div>
    <p id="home-release-audit-source" className="sr-only">Recorded release audit events</p>
    {events?.length ? <ul>{events.map(event => {
      const occurred = new Date(event.createdAtIso);
      const fullTimestamp = occurred.toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"});
      const timestamp = occurred.toDateString() === new Date().toDateString()
        ? occurred.toLocaleTimeString(undefined, {hour: "2-digit", minute: "2-digit", hourCycle: "h23"})
        : fullTimestamp;
      return <li key={event.id}>
        {(() => { const t = auditOutcomeTone(event.outcome); return t ? <StatusIconChip tone={t.tone} shape={t.shape} size={12}/> : <History aria-hidden size={15}/>; })()}
        <div><p>{event.summary}</p><small>{event.outcome === "unknown" ? "Outcome unavailable" : `Outcome: ${event.outcome}`}</small></div>
        <ReadableTime dateTime={event.createdAtIso} fullText={fullTimestamp} displayText={timestamp}/>
      </li>;
    })}</ul> : <p className="studio-home-audit-caption" role="status">{
      events === undefined ? "Loading release audit events…" :
      events === null ? "Release audit events are unavailable." : "No release audit events were returned."
    }</p>}
  </section>;
}


/** Navigation only: never turn a launch choice into an AI or provider action. */
type WelcomeActions = Pick<WelcomeViewProps, "onBuild" | "onBot" | "onAutomate" | "onDeploy">;

export function WelcomeView(props: WelcomeActions | WelcomeViewProps) {
  return "releaseConfig" in props ? <StudioWelcomeView {...props}/> : <LaunchWelcomeView {...props}/>;
}

function LaunchWelcomeView({ onBuild, onBot, onAutomate, onDeploy }: WelcomeActions) {
  return <section aria-label="V19 welcome" className="axiom-home">
    <div className="axiom-home-content">
      <div className="home-introduction">
        <div className="home-introduction-copy">
          <p className="home-eyebrow">Your engineering workspace</p>
          <h1>Your next move,<br/><span>in focus.</span></h1>
          <p className="home-introduction-description">Research with Agent, work with your code, or prepare a release. Choose where to begin.</p>
          <button type="button" onClick={onBuild} className="home-primary-action">Open Agent <span aria-hidden="true">↗</span></button>
          <p className="home-primary-note">Code, context and a clear next step.</p>
        </div>
        <div className="home-landscape" aria-hidden="true">
          <img src="/images/axiom-painted-basin.webp" alt=""/>
          <div className="home-landscape-surface"><span>Space to think.</span><p>Room to<br/>build.</p><span>One considered step at a time.</span></div>
        </div>
      </div>
      <div className="home-destination-heading"><h2>Start with what matters.</h2><p>One workspace. Different ways forward.</p></div>
      <div className="home-destinations">
        <button type="button" onClick={onBot} className="home-destination"><span className="home-destination-top"><span aria-hidden="true">01</span><span aria-hidden="true">↗</span></span><span className="home-destination-title">Delegate a task</span><span className="home-destination-description">Saved tasks and AI responses in V19 Bot. App changes require exact review.</span></button>
        <button type="button" onClick={onDeploy} className="home-destination"><span className="home-destination-top"><span aria-hidden="true">02</span><span aria-hidden="true">↗</span></span><span className="home-destination-title">Plan a release</span><span className="home-destination-description">Bring scope, proposed actions and delivery evidence into one review.</span></button>
        <button type="button" onClick={onAutomate} className="home-destination"><span className="home-destination-top"><span aria-hidden="true">03</span><span aria-hidden="true">↗</span></span><span className="home-destination-title">Review operations</span><span className="home-destination-description">Monitor batches and prepare operations. Requires an Airflow connection.</span></button>
      </div>
      <p className="home-navigation-note">Opening a section does not execute a change. Your saved work stays in its workspace.</p>
    </div>
  </section>;
}

function StudioWelcomeView({ active = true, returnActivity, onBuild, onBot, onAutomate, onDeploy, onOpenSavedRelease, releaseOwner, releaseConfig, displayName, plannerDrafts, onEditPlannerDraft, onReviewPlan, contextAccess }: WelcomeViewProps) {
  const [plannerIndex, setPlannerIndex] = useState(0);
  const mode = plannerModes[plannerIndex];
  const draft = plannerDrafts?.[mode.intent] ?? "";
  const [openContext, setOpenContext] = useState<"repository" | "environment">();
  const contextPanel = useRef<HTMLDivElement>(null);
  const contextOpener = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (openContext) contextPanel.current?.focus();
  }, [openContext]);
  const [repositories, setRepositories] = useState<string[] | null>();
  const [environments, setEnvironments] = useState<EnvironmentOption[] | null>();
  const [repository, setRepository] = useState("");
  const [environmentId, setEnvironmentId] = useState("");
  const canLoadContext = !!contextAccess;
  const canLoadRepositories = !!contextAccess?.repositories;
  useEffect(() => {
    if (!active || !openContext || !canLoadContext || releaseConfig !== desktopClient.config) return;
    const revision = desktopClient.getContextRevision();
    let current = true;
    const ownsContext = () => current && releaseConfig === desktopClient.config && revision === desktopClient.getContextRevision();
    if (openContext === "repository" && canLoadRepositories) {
      setRepositories(undefined);
      void desktopClient.listGithubRepositories().then(result => {
        if (!ownsContext()) return;
        const parsed = result.ok ? repositoriesSchema.safeParse(result.data) : undefined;
        setRepositories(parsed?.success ? [...new Set(parsed.data.repositories.map(row => row.fullName))] : null);
      }).catch(() => {if (ownsContext()) setRepositories(null);});
    } else if (openContext === "environment") {
      setEnvironments(undefined);
      void desktopClient.listEnvironments().then(result => {
        if (!ownsContext()) return;
        const parsed = result.ok ? environmentsSchema.safeParse(result.data) : undefined;
        setEnvironments(parsed?.success ? parsed.data.environments : null);
      }).catch(() => {if (ownsContext()) setEnvironments(null);});
    }
    return () => {current = false;};
  }, [active, openContext, canLoadContext, canLoadRepositories, releaseConfig]);
  const selectedRepository = canLoadContext && canLoadRepositories && repositories?.includes(repository) ? repository : undefined;
  const selectedEnvironment = canLoadContext ? environments?.find(item => item.id === environmentId) : undefined;
  function closeContext() {
    setOpenContext(undefined);
    contextOpener.current?.focus({preventScroll: true});
  }

  function toggleContext(field: "repository" | "environment", opener: HTMLButtonElement) {
    if (openContext === field) {
      closeContext();
      return;
    }
    contextOpener.current = opener;
    setOpenContext(field);
  }
  const [activityFilter, setActivityFilter] = useState<"all" | "draft" | "submitted" | "closed">("all");
  const [recent, setRecent] = useState<{ owner: string; config: typeof desktopClient.config; releases: RecentRelease[] | null; loadedRows?: RecentRelease[]; nextActions: RecentRelease[]; counts?: ReleaseCounts; returnActivity?: SavedReleaseLink; newerVersion?: number }>();
  const activityHeading = useRef<HTMLHeadingElement>(null);
  const activityRows = useRef(new Map<string, HTMLButtonElement>());
  const actionRows = useRef(new Map<string, HTMLButtonElement>());
  const nextActionOrigin = useRef<SavedReleaseLink | undefined>(undefined);
  const restoredActivity = useRef<SavedReleaseLink | undefined>(undefined);
  useEffect(() => {
    if (!active || releaseConfig !== desktopClient.config) return;
    const revision = desktopClient.getContextRevision();
    let current = true;
    void (async () => {
      let releases: RecentRelease[] | null = null;
      let loadedRows: RecentRelease[] | undefined;
      let counts: ReleaseCounts | undefined;
      let nextActions: RecentRelease[] = [];
      let newerVersion: number | undefined;
      try {
        const response = await desktopClient.deploymentRequests();
        if (response.ok) {
          const unique = new Map<string, RecentRelease>();
          for (const release of response.data) {
            if (!release.id || !release.title || typeof release.status !== "string" || !Number.isSafeInteger(release.version) || release.version < 1) continue;
            if ((unique.get(release.id)?.version ?? 0) >= release.version) continue;
            const context = release.releaseContext;
            const nextAction = (release.status === "draft" || release.status === "submitted") &&
              context?.approval && context.readiness && Array.isArray(context.readiness.blockers) && context.recovery
              ? releaseJourney({status: release.status, ...context.approval, ...context.readiness,
                rollbackAvailability: context.recovery.rollbackAvailability, stale: false}).next.title
              : undefined;
            unique.set(release.id, {
              id: release.id, version: release.version, title: release.title, status: release.status,
              updatedAt: release.updatedAt, environment: context?.scope?.targetEnvironment ?? null,
              nextAction,
            });
          }
          const rows = [...unique.values()].sort((a, b) =>
            (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
          counts = {loaded: rows.length, draft: 0, submitted: 0, closed: 0};
          for (const row of rows) {
            if (row.status === "draft" || row.status === "submitted" || row.status === "closed") counts[row.status]++;
          }
          if (returnActivity) {
            const currentRelease = unique.get(returnActivity.id);
            if (currentRelease && currentRelease.version > returnActivity.version) newerVersion = currentRelease.version;
          }
          releases = rows.slice(0, 4);
          loadedRows = rows;
          nextActions = rows.filter(row => row.nextAction).slice(0, 3);
        }
      } catch {
        // The rest of Home remains usable when the release service is unavailable.
      }
      if (current && releaseConfig === desktopClient.config && revision === desktopClient.getContextRevision()) {
        setRecent({ owner: releaseOwner, config: releaseConfig, releases, loadedRows, nextActions, counts, returnActivity, newerVersion });
      }
    })();
    return () => { current = false; };
  }, [active, releaseOwner, releaseConfig, returnActivity]);
  useLayoutEffect(() => {
    if (!active || !returnActivity || recent?.returnActivity !== returnActivity || restoredActivity.current === returnActivity) return;
    restoredActivity.current = returnActivity;
    const focused = document.activeElement;
    if (focused !== document.body && !focused?.closest("[hidden]")) return;
    const nextAction = nextActionOrigin.current === returnActivity ? actionRows.current.get(returnActivity.id) : undefined;
    (nextAction ?? activityRows.current.get(returnActivity.id) ?? activityHeading.current)?.focus();
  }, [active, recent, returnActivity]);
  const ownedActivity = recent?.owner === releaseOwner && recent.config === releaseConfig &&
    recent.returnActivity === returnActivity ? recent : undefined;
  // Optional activity filter over the already-loaded rows; it never issues another request.
  const releases = activityFilter === "all" || !ownedActivity?.loadedRows ? ownedActivity?.releases
    : ownedActivity.loadedRows.filter(release => release.status === activityFilter).slice(0, 4);
  const today = new Date();
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = displayName?.trim().split(/\s+/)[0];
  return <section aria-label="V19 welcome" className="studio-home min-h-0 flex-1 overflow-y-auto bg-axiom-bg">
    <header className="studio-home-heading">
      <div>
        <h1>{firstName ? `${greeting}, ${firstName}.` : `${greeting}.`}</h1>
        <p>Your workspace, ready for the next change.</p>
      </div>
      <time dateTime={today.toISOString()}>{today.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</time>
    </header>
    {onEditPlannerDraft && onReviewPlan && <form className="studio-home-planner" aria-label="Workspace planner" onSubmit={event => {
      event.preventDefault();
      if (!draft.trim() || releaseConfig !== desktopClient.config) return;
      const context = selectedRepository || selectedEnvironment ? {
        repository: selectedRepository,
        environmentSlug: selectedEnvironment?.slug,
      } : undefined;
      onReviewPlan(mode.intent, draft, context);
    }}>
      <div className="studio-home-planner-modes" role="group" aria-label="Planning intent">
        {plannerModes.map((choice, index) => <button key={choice.intent} type="button" aria-pressed={plannerIndex === index} onClick={() => setPlannerIndex(index)}>{choice.label}</button>)}
      </div>
      <textarea className="studio-home-planner-draft" aria-label="Planning request" aria-describedby="studio-home-planner-note" value={draft} placeholder={mode.placeholder}
        maxLength={HOME_DRAFT_MAX_LENGTH} onChange={event => onEditPlannerDraft(mode.intent, event.target.value)} />
      <div className="studio-home-planner-actions">
        <div className="studio-home-context-actions">
          {canLoadRepositories && <button type="button" className="studio-home-context-chip" aria-label={selectedRepository ? `Choose repository, selected ${selectedRepository}` : "Choose repository"}
            aria-expanded={openContext === "repository"} aria-controls={openContext === "repository" ? "studio-home-context" : undefined}
            onClick={event => toggleContext("repository", event.currentTarget)}><GitBranch size={14} aria-hidden /><span>{selectedRepository ?? "Repository"}</span></button>}
          {canLoadContext && <button type="button" className="studio-home-context-chip" aria-label={selectedEnvironment ? `Choose environment, selected ${selectedEnvironment.name}` : "Choose environment"}
            aria-expanded={openContext === "environment"} aria-controls={openContext === "environment" ? "studio-home-context" : undefined}
            onClick={event => toggleContext("environment", event.currentTarget)}><Layers size={14} aria-hidden /><span>{selectedEnvironment?.name ?? "Environment"}</span></button>}
          <span id="studio-home-planner-note">Planning only. Nothing is deployed.</span>
        </div>
        {openContext && canLoadContext && <div ref={contextPanel} id="studio-home-context" role="region" tabIndex={-1}
          aria-label={openContext === "repository" ? "Repository planning context" : "Environment planning context"}
          className="studio-home-context" onKeyDown={event => {
            if (event.key !== "Escape" || event.defaultPrevented || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 ||
              (event.target instanceof Element && event.target.closest("select"))) return;
            event.preventDefault();
            closeContext();
          }}>
          {openContext === "repository" && canLoadRepositories && <label>
            <span>Repository</span>
            <select value={selectedRepository ?? ""} disabled={!repositories?.length} onChange={event => setRepository(event.target.value)}>
              <option value="">{repositories === undefined ? "Loading repositories…" : repositories === null ? "Repositories unavailable" : repositories.length ? "No repository selected" : "No repositories returned"}</option>
              {repositories?.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>}
          {openContext === "environment" && <label>
            <span>Environment</span>
            <select value={selectedEnvironment?.id ?? ""} disabled={!environments?.length} onChange={event => setEnvironmentId(event.target.value)}>
              <option value="">{environments === undefined ? "Loading environments…" : environments === null ? "Environments unavailable" : environments.length ? "No environment selected" : "No environments returned"}</option>
              {environments?.map(item => <option key={item.id} value={item.id}>{item.name} · {item.slug}</option>)}
            </select>
          </label>}
          <button type="button" className="studio-home-context-chip studio-home-context-done" onClick={closeContext}>Done</button>
        </div>}
        <button type="submit" className="studio-home-plan-submit" disabled={!draft.trim()}><ArrowRight size={15} aria-hidden />{mode.action}</button>
      </div>
    </form>}
    <dl aria-label="Loaded release summary" aria-busy={releases === undefined} className="studio-home-summary">
      {releaseSummary.map(({key, label}) => <div key={key}>
        <dt>{label}</dt>
        <dd>{ownedActivity?.counts?.[key].toLocaleString() ?? "—"}</dd>
      </div>)}
    </dl>
    <div className="studio-home-activity-layout">
    <div className="studio-home-activity-column">
    <section className="studio-home-activity" data-has-rows={Boolean(releases?.length)} aria-labelledby="home-recent-releases">
      <div className="studio-home-activity-heading">
        <h2 ref={activityHeading} tabIndex={-1} id="home-recent-releases">Recent deployment activity</h2>
        <span className="studio-home-activity-tools">
          <label className="studio-home-activity-filter"><span className="sr-only">Filter recent activity by request state</span>
            <select value={activityFilter} disabled={!ownedActivity?.loadedRows} onChange={event => setActivityFilter(event.target.value as typeof activityFilter)}>
              <option value="all">All states</option><option value="draft">Drafts</option><option value="submitted">Submitted</option><option value="closed">Closed</option>
            </select>
          </label>
          <button type="button" onClick={onDeploy} className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-100">View all <ArrowRight aria-hidden size={15} /></button>
        </span>
      </div>
      {ownedActivity?.newerVersion && returnActivity && <p className="studio-home-audit-caption" role="status">
        This release has a newer saved version. Review version {ownedActivity.newerVersion} to continue.
      </p>}
      {releases?.length ? <div className="studio-home-table">
        <div className="studio-home-release-head studio-home-release-grid" aria-hidden="true">
          <span>Release / service</span><span>Environment</span><span>Request state</span><span>Updated</span>
        </div>
        <ul>{releases.map(release => {
          const updated = new Date(release.updatedAt);
          return <li key={release.id}>
            <button type="button" ref={node => {
              if (node) activityRows.current.set(release.id, node);
              else activityRows.current.delete(release.id);
            }} onClick={() => onOpenSavedRelease({ id: release.id, version: release.version })}
              className="studio-home-release-grid studio-home-release-row">
              <span className="studio-home-release-title"><Box aria-hidden size={16} /><span>{release.title}{" "}<small>v{release.version}</small></span></span>
              <span><span className="studio-home-environment">{release.environment || "Unspecified"}</span></span>
              <span>{(() => { const t = releaseRequestTone(release.status); return <StatusBadge tone={t.tone} shape={t.shape}><span className="capitalize">{release.status.replaceAll("_", " ")}</span></StatusBadge>; })()}</span>
              <span>{Number.isFinite(updated.getTime()) ? <time dateTime={updated.toISOString()}>{updated.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time> : "Unavailable"}</span>
            </button>
          </li>;
        })}</ul>
      </div> : <p role="status" className="mt-3 text-sm text-zinc-400">{
        releases === undefined ? "Loading recent releases…" :
        releases === null ? "Recent releases are unavailable." : activityFilter !== "all" ? "No loaded releases in this state." : "No saved releases in this workspace."
      }</p>}
    </section>
    {canLoadContext && <HomeReleaseAudit active={active} config={releaseConfig}/>}
    </div>
    <div className="studio-home-side-column">
      <section className="studio-home-next-actions" aria-labelledby="home-next-actions">
        <div className="studio-home-activity-heading"><h2 id="home-next-actions">Next actions</h2></div>
        {ownedActivity?.nextActions.length ? <ul>{ownedActivity.nextActions.map(release => (
          <li key={release.id}>
            <button type="button" aria-label={`${release.nextAction} for ${release.title}, saved version ${release.version}`} ref={node => {
              if (node) actionRows.current.set(release.id, node);
              else actionRows.current.delete(release.id);
            }} onClick={() => {
              const link = {id: release.id, version: release.version};
              nextActionOrigin.current = link;
              onOpenSavedRelease(link);
            }}>
              <ListChecks aria-hidden size={15}/>
              <span><strong>{release.nextAction}</strong><small>{release.title} · v{release.version}</small></span>
              <ChevronRight aria-hidden size={14}/>
            </button>
          </li>
        ))}</ul> : <p role="status" className="studio-home-audit-caption">{
          releases === undefined ? "Loading release actions…" :
          releases === null ? "Release actions are unavailable." : "No next actions in the loaded releases."
        }</p>}
      </section>
    <nav aria-label="Workspace actions" className="studio-home-actions">
      <div className="studio-home-activity-heading"><h2>Workspace actions</h2></div>
      <button type="button" onClick={onDeploy}><Layers aria-hidden size={16} />Deploy and Manage</button>
      <button type="button" onClick={onBuild}><Sparkles aria-hidden size={16} />Build with AI</button>
      <button type="button" onClick={onBot}><ArrowRight aria-hidden size={16} />Delegate a task</button>
      <button type="button" onClick={onAutomate}><SquareStack aria-hidden size={16} />Automate Operations</button>
    </nav>
    </div>
    </div>
  </section>;
}
