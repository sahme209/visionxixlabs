import {changeDraftSourceSchema} from "../../../lib/tauri/ticketDirectoryContract";
import { z } from "zod";
import { open } from "@tauri-apps/plugin-shell";
import { Check as CheckIcon, LockKeyhole, Plus, ShieldCheck } from "lucide-react";
import type { DeploymentRequestSummary } from "../../../lib/tauri/deploymentRequestSummary";
import type { SavedReleaseLink } from "./WelcomeView";
import {FocusedReleaseWorkspace} from "../components/FocusedReleaseWorkspace";
import {CustomerJourneyPanel} from '../../../components/shared/CustomerJourneyPanel';
import {releaseJourney} from '../../../lib/customerJourney/journey';
import { intakeDateInputValue as dateInputValue } from "../lib/intakeDateInput";
import {ReleaseTicketWorkspace} from '../components/ReleaseTicketWorkspace';
import { SelectedReleaseOperationEvidence, recordedWorkflowOutcomes, type RecordedWorkflowEvidence, type RecordedWorkflowRun, type RecordedProviderDecision, type RecordedDeploymentEvent } from "../components/SelectedReleaseOperationEvidence";
import {deploymentExecutionEventLabels} from "../components/ReleaseDeploymentExecution";
import { ReleaseActivityTimeline } from "../components/ReleaseActivityTimeline";
import { ReleaseMergeReview } from "../components/ReleaseMergeReview";
import { RecordedReleaseWindow } from "../components/RecordedReleaseWindow";
import { ReleaseBatchMonitor } from "../components/ReleaseBatchMonitor";
import { ReleaseBatchReadiness } from "../components/ReleaseBatchReadiness";
import { ResolutionDraftForm } from "../components/ResolutionDraftForm";
import { ReleaseBatchSelection } from "../components/ReleaseBatchSelection";
import { releaseAirflowDependencySchema } from "../../../lib/integrations/airflow/releaseDependencySchema";
import { WorkflowCatalogue } from "../components/WorkflowCatalogue";
import { WorkflowDefinitionInputs } from "../components/WorkflowDefinitionInputs";
import { matchingWorkflowObservation, restoredWorkflowRef, singleGithubRepository, workflowFilePath, type WorkflowSourceObservation } from "../lib/workflowReadSource";
import { DeploymentWorkflowEvidence } from "../components/DeploymentWorkflowEvidence";
import { TerraformPlanReview } from "../components/TerraformPlanReview";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { ExternalLink, ViewShell } from "../components/Primitives";
import { desktopClient, type DeploymentExecution } from "../lib/desktopClient";

interface GeneratedPlaybook {
  id: string;
  version: number;
  status: string;
  contentHash: string;
  generatedAtUtc: string;
  scope: string;
  stepCount: number;
  steps: Array<{
    id: string;
    order: number;
    title: string;
    requiredRole: string;
    activation: "always" | "on_success" | "on_failure";
    evidenceRequired: boolean;
    validationInstruction?: string;
  }>;
}

interface RevisionSeed {
  id: string;
  version: number;
  intake: Record<string, unknown>;
}

interface RevisionHistoryEntry {
  version: number;
  createdAt: string;
  author: "You" | "Workspace member";
  changes: string[];
}

interface OperationLedgerEntry {
  kind: string;
  status: string;
  attemptCount: number;
  createdAt: string;
  lastAttemptAt: string | null;
  lastReconciledAt: string | null;
  externallyReferenced: boolean;
}

const evidenceRunState = z.enum(["passed", "failed", "in_progress", "not_reported", "unavailable"]);
const gitHubReleaseEvidenceSchema = z.object({
  mode: z.literal("read_only_evidence"),
  requestId: z.string(),
  requestVersion: z.number().int().positive(),
  repositories: z.array(z.object({
    repository: z.string(),
    state: z.enum(["observed", "unavailable"]),
    branchProtection: z.enum(["protected", "not_protected", "unavailable"]),
    latestWorkflow: evidenceRunState,
  })),
  pullRequests: z.array(z.object({
    repository: z.string(),
    number: z.number().int().positive(),
    pullRequestState: z.enum(["open", "closed", "merged", "draft", "unknown"]),
    checks: evidenceRunState,
  })),
});
type GitHubReleaseEvidence = z.output<typeof gitHubReleaseEvidenceSchema>;

const initialDraft = {
  title: "",
  requestClass: "planned_release",
  adHocReason: "",
  adHocPriority: "",
  businessImpact: "",
  scheduleExceptionReason: "",
  windowStart: "",
  windowEnd: "",
  displayTimeZone: "ET",
  changeType: "configuration_change",
  applications: "",
  clients: "",
  deploymentContact: "",
  applicationContact: "",
  escalationContact: "",
  repositoryUrls: "",
  productionPrUrls: "",
  noPrRequired: false,
  prApprovalStatus: "pending",
  sourceBranch: "",
  targetBranch: "main",
  deploymentMethod: "",
  workflowName: "",
  targetEnvironment: "",
  workflowInputs: "{}",
  lowerEnvironments: "",
  developmentReady: false,
  productionReady: false,
  validationInstruction: "",
  validationOwner: "devops",
  functionalValidationRequired: false,
  functionalValidationInstruction: "",
  functionalValidationOwner: "application_team",
  expectedProductionResult: "",
  rollbackAvailability: "yes",
  rollbackInstruction: "",
  rollbackOwner: "",
  backupRequired: false,
  backupEvidenceIds: "",
  changeCreationMethod: "manual_servicenow",
  manualInstruction: "",
  manualOwner: "",
  manualValidationInstruction: "",
  deferredValidation: false,
  deferredReason: "",
  deferredTrigger: "",
  deferredDate: "",
  deferredOwner: "",
  monitoringPlan: "",
  confirmedFact: "",
  sourceEvidenceId: "",
  factConfirmedBy: "",
};

const INTAKE_STEPS = ["Window", "Scope", "Execution", "Validation", "Recovery"] as const;
type IntakeDraft = typeof initialDraft;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringsValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}


function draftFromIntake(intake: Record<string, unknown>): IntakeDraft {
  const manual = objectValue(Array.isArray(intake.manualSteps) ? intake.manualSteps[0] : undefined);
  const validation = Array.isArray(intake.validationSteps) ? intake.validationSteps.map(objectValue) : [];
  const technical = validation[0] ?? {};
  const functional = validation[1] ?? {};
  const rollback = objectValue(Array.isArray(intake.rollbackSteps) ? intake.rollbackSteps[0] : undefined);
  const deferred = objectValue(intake.deferredValidation);
  const fact = objectValue(Array.isArray(intake.facts) ? intake.facts[0] : undefined);
  return {
    ...initialDraft,
    title: textValue(intake.title), requestClass: textValue(intake.requestClass) || initialDraft.requestClass,
    adHocReason: textValue(intake.adHocReason), adHocPriority: textValue(intake.adHocPriority), businessImpact: textValue(intake.businessImpact), scheduleExceptionReason: textValue(intake.scheduleExceptionReason),
    windowStart: dateInputValue(intake.windowStartUtc), windowEnd: dateInputValue(intake.windowEndUtc), displayTimeZone: textValue(intake.displayTimeZone) || initialDraft.displayTimeZone,
    changeType: stringsValue(intake.changeTypes)[0] || initialDraft.changeType,
    applications: stringsValue(intake.applications).join("\n"), clients: stringsValue(intake.clients).join("\n"), deploymentContact: textValue(intake.deploymentContact), applicationContact: textValue(intake.applicationContact), escalationContact: textValue(intake.escalationContact),
    repositoryUrls: stringsValue(intake.repositoryUrls).join("\n"), productionPrUrls: stringsValue(intake.productionPrUrls).join("\n"), noPrRequired: intake.noPrRequired === true, prApprovalStatus: textValue(intake.prApprovalStatus) || initialDraft.prApprovalStatus, sourceBranch: textValue(intake.sourceBranch), targetBranch: textValue(intake.targetBranch) || initialDraft.targetBranch,
    deploymentMethod: textValue(intake.deploymentMethod), workflowName: textValue(intake.workflowName), targetEnvironment: textValue(intake.targetEnvironment), workflowInputs: JSON.stringify(objectValue(intake.workflowInputs), null, 2),
    manualInstruction: textValue(manual.instruction), manualOwner: textValue(manual.owner), manualValidationInstruction: textValue(manual.validationInstruction),
    lowerEnvironments: stringsValue(intake.lowerEnvironmentTested).join("\n"), developmentReady: intake.developmentReady === true, productionReady: intake.productionReady === true, validationInstruction: textValue(technical.instruction), validationOwner: textValue(technical.owner) || initialDraft.validationOwner, functionalValidationRequired: validation.length > 1, functionalValidationInstruction: textValue(functional.instruction), functionalValidationOwner: textValue(functional.owner) || initialDraft.functionalValidationOwner, expectedProductionResult: textValue(intake.expectedProductionResult),
    rollbackAvailability: textValue(intake.rollbackAvailability) || initialDraft.rollbackAvailability, rollbackInstruction: textValue(rollback.instruction), rollbackOwner: textValue(rollback.owner), backupRequired: intake.backupRequired === true, backupEvidenceIds: stringsValue(intake.backupEvidenceIds).join("\n"), changeCreationMethod: textValue(intake.changeCreationMethod) || initialDraft.changeCreationMethod,
    deferredValidation: Boolean(intake.deferredValidation), deferredReason: textValue(deferred.reason), deferredTrigger: textValue(deferred.trigger), deferredDate: dateInputValue(deferred.expectedDateUtc), deferredOwner: textValue(deferred.owner), monitoringPlan: textValue(deferred.monitoringPlan),
    confirmedFact: textValue(fact.value), sourceEvidenceId: textValue(fact.sourceEvidenceId), factConfirmedBy: textValue(fact.confirmedBy),
  };
}

function validateStep(step: number, draft: IntakeDraft): string | undefined {
  const missing = (pairs: Array<[string, string]>) => pairs.find(([, value]) => !value.trim())?.[0];
  let field: string | undefined;
  if (step === 0) {
    field = missing([["request title", draft.title], ["window start", draft.windowStart], ["window end", draft.windowEnd]]);
    if (!field && (draft.requestClass === "ad_hoc" || draft.requestClass === "emergency")) {
      field = missing([["reason", draft.adHocReason], ["priority", draft.adHocPriority], ["business impact", draft.businessImpact], ["schedule exception", draft.scheduleExceptionReason]]);
    }
  } else if (step === 1) {
    field = missing([["applications", draft.applications], ["clients", draft.clients], ["deployment owner", draft.deploymentContact], ["application owner", draft.applicationContact], ["escalation owner", draft.escalationContact], ["repository URLs", draft.repositoryUrls], ["source branch", draft.sourceBranch], ["target branch", draft.targetBranch]]);
    if (!field && !draft.noPrRequired) field = missing([["production PR URLs", draft.productionPrUrls]]);
  } else if (step === 2) {
    field = missing([["deployment method", draft.deploymentMethod], ["workflow name or trigger", draft.workflowName], ["target environment", draft.targetEnvironment], ["workflow inputs", draft.workflowInputs]]);
    if (!field && draft.manualInstruction.trim()) field = missing([["manual-step owner", draft.manualOwner], ["manual-step validation", draft.manualValidationInstruction]]);
  } else if (step === 3) {
    field = missing([["tested lower environments", draft.lowerEnvironments], ["technical validation", draft.validationInstruction], ["expected production result", draft.expectedProductionResult]]);
    if (!field && draft.functionalValidationRequired) field = missing([["functional validation", draft.functionalValidationInstruction]]);
    if (!field && draft.deferredValidation) field = missing([["deferral reason", draft.deferredReason], ["follow-up trigger", draft.deferredTrigger], ["follow-up date", draft.deferredDate], ["follow-up owner", draft.deferredOwner], ["monitoring plan", draft.monitoringPlan]]);
  } else {
    if (draft.rollbackAvailability === "yes") field = missing([["rollback instruction", draft.rollbackInstruction], ["rollback owner", draft.rollbackOwner]]);
    if (!field && draft.backupRequired) field = missing([["backup evidence identifiers", draft.backupEvidenceIds]]);
    if (!field) field = missing([["confirmed operational fact", draft.confirmedFact], ["source evidence identifier", draft.sourceEvidenceId], ["confirmed by", draft.factConfirmedBy]]);
  }
  return field ? `Complete ${field} before continuing.` : undefined;
}

function splitLines(value: string): string[] {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function localToIso(value: string): string {
  const instant = new Date(value);
  if (!value || !Number.isFinite(instant.getTime())) return "";
  return instant.toISOString();
}

const KNOWN_LOAD_ERRORS: Record<string, string> = {
  desktop_session_required: "Your sign-in needs to refresh. Try signing out and back in.",
  network_error: "Could not reach the service. Check your connection and try again.",
};

/** Never surface a raw API error code (e.g. "desktop_session_required") directly to the user. */
function friendlyLoadError(code: string): string {
  return KNOWN_LOAD_ERRORS[code] ?? "Something went wrong loading your requests. Please try again.";
}

export function DeploymentRequestsView({ active = true, onIntakeOpenChange, savedRelease, savedReleaseSection, resumeIntake, onReviewAgentPlans, onRecoverSavedRelease, activityWorkspace, onInspectReleaseBatches }: {
  active?: boolean;
  onIntakeOpenChange?: (open: boolean) => void;
  savedRelease?: SavedReleaseLink;
  savedReleaseSection?: "evidence" | "review";
  onRecoverSavedRelease?: {label: string; run: () => void; returnWhenAvailable?: boolean};
  resumeIntake?: boolean;
  onReviewAgentPlans?: (release: SavedReleaseLink) => void;
  activityWorkspace?: string;
  onInspectReleaseBatches?: (release: SavedReleaseLink) => void;
}) {
  const [requests, setRequests] = useState<DeploymentRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [lastSuccessfulLoadAt, setLastSuccessfulLoadAt] = useState<Date>();
  const [resolvedEntry, setResolvedEntry] = useState<{link: SavedReleaseLink; preserveDirectoryContext: boolean}>();
  const [exactLookupFailed, setExactLookupFailed] = useState(false);
  const savedReleaseRef = useRef(savedRelease);
  savedReleaseRef.current = savedRelease;
  const loadGeneration = useRef(0);
  const unavailableEntry = useRef<HTMLDivElement>(null);
  const focusWhenRefreshStarted = useRef<Element | null>(null);
  const [showForm, setShowFormState] = useState(false);
  const intakeFormOwner = useRef({ config: desktopClient.config, revision: desktopClient.getContextRevision() });
  function setShowForm(next: boolean | ((current: boolean) => boolean)) {
    intakeFormOwner.current = { config: desktopClient.config, revision: desktopClient.getContextRevision() };
    setShowFormState(next);
  }
  const [showResolutionDraft, setShowResolutionDraft] = useState(false);
  const [resolutionDraftStarted, setResolutionDraftStarted] = useState(false);
  const intakeOpener = useRef<HTMLButtonElement | null>(null);
  const newRelease = useRef<HTMLButtonElement>(null);
  const intakeRegion = useRef<HTMLDivElement>(null);
  const ticketRegion = useRef<HTMLDivElement>(null);
  const intakeWasVisible = useRef(false);
  useLayoutEffect(() => {
    onIntakeOpenChange?.(showForm || resolutionDraftStarted);
    return () => onIntakeOpenChange?.(false);
  }, [onIntakeOpenChange, showForm, resolutionDraftStarted]);
  const draftContext = useSyncExternalStore(desktopClient.subscribeContext, desktopClient.getContextRevision, desktopClient.getContextRevision);
  const draftConfig = useSyncExternalStore(desktopClient.subscribeContext, () => desktopClient.config, () => desktopClient.config);
  const draftIdentity = useRef({ config: draftConfig, context: draftContext, key: 0 });
  if (draftIdentity.current.config !== draftConfig || draftIdentity.current.context !== draftContext) {
    draftIdentity.current = { config: draftConfig, context: draftContext, key: draftIdentity.current.key + 1 };
  }
  useEffect(() => {
    setShowResolutionDraft(false); setResolutionDraftStarted(false);
    setShowForm(false); setRevision(undefined); invalidateRevisionRead();
  }, [draftContext, draftConfig]);
  useEffect(() => {
    if (resumeIntake && resolutionDraftStarted) setShowResolutionDraft(true);
  }, [resumeIntake, resolutionDraftStarted]);
  const intakeEpoch = useRef(0);
  const mounted = useRef(false);
  const viewOwner = useRef({ config: desktopClient.config, revision: desktopClient.getContextRevision() }).current;
  const ownsView = useCallback(() => mounted.current && viewOwner.config === desktopClient.config && viewOwner.revision === desktopClient.getContextRevision(), [viewOwner]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; intakeEpoch.current++; }; }, []);
  function invalidateRevisionRead() { intakeEpoch.current++; setLoadingRevisionId(undefined); }
  const [revision, setRevision] = useState<RevisionSeed>();
  useLayoutEffect(() => {
    const region = showForm ? intakeRegion.current : showResolutionDraft ? ticketRegion.current : null;
    if (region) {
      intakeWasVisible.current = true;
      region.querySelector<HTMLElement>("[data-release-intake-focus]")?.focus();
    } else if (intakeWasVisible.current) {
      intakeWasVisible.current = false;
      const opener = intakeOpener.current;
      const fallback = newRelease.current;
      opener?.focus();
      if (!opener || document.activeElement !== opener) fallback?.focus();
      intakeOpener.current = null;
    }
  }, [showForm, showResolutionDraft, revision?.id]);
  const [loadingRevisionId, setLoadingRevisionId] = useState<string>();
  const [closingRequest, setClosingRequest] = useState<SavedReleaseLink>();
  const [closureEvidenceId, setClosureEvidenceId] = useState("");
  const [closureSummary, setClosureSummary] = useState("");
  const [closingBusy, setClosingBusy] = useState(false);
  const [closureError, setClosureError] = useState<string>();
  const [generatingRequestId, setGeneratingRequestId] = useState<string>();
  const [loadingPlaybookId, setLoadingPlaybookId] = useState<string>();
  const [generatedPlaybooks, setGeneratedPlaybooks] = useState<Record<string, GeneratedPlaybook>>({});
  const [generationErrors, setGenerationErrors] = useState<Record<string, string>>({});
  const [loadingHistoryId, setLoadingHistoryId] = useState<string>();
  const [revisionHistory, setRevisionHistory] = useState<Record<string, RevisionHistoryEntry[]>>({});
  const [historyErrors, setHistoryErrors] = useState<Record<string, string>>({});
  const [loadingOperationsId, setLoadingOperationsId] = useState<string>();
  const [operationLedger, setOperationLedger] = useState<Record<string, OperationLedgerEntry[]>>({});
  const [operationErrors, setOperationErrors] = useState<Record<string, string>>({});
  const [collectingGitHubEvidenceId, setCollectingGitHubEvidenceId] = useState<string>();
  const [githubEvidence, setGitHubEvidence] = useState<Record<string, GitHubReleaseEvidence>>({});
  const [githubEvidenceErrors, setGitHubEvidenceErrors] = useState<Record<string, string>>({});
  const [workflowEvidence, setWorkflowEvidence] = useState<Record<string, RecordedWorkflowEvidence | undefined>>({});
  const [providerDecisions, setProviderDecisions] = useState<Record<string, RecordedProviderDecision | undefined>>({});
  const [deploymentEvents, setDeploymentEvents] = useState<Record<string, RecordedDeploymentEvent | undefined>>({});
  const [recordedChanges, setRecordedChanges] = useState<Record<string, string | undefined>>({});
  const [executions, setExecutions] = useState<DeploymentExecution[]>([]);
  const [terraformRequestId, setTerraformRequestId] = useState<string>();

  const loadExecutions = useCallback(async () => {
    if (!ownsView()) return;
    const result = await desktopClient.listDeploymentExecutions();
    if (!ownsView()) return;
    if (result.ok) setExecutions(result.data.executions);
  }, [ownsView]);

  const load = useCallback(async (refreshExecutions = true) => {
    if (!ownsView()) return;
    const generation = ++loadGeneration.current;
    const link = savedReleaseRef.current;
    const ownsLoad = () => generation === loadGeneration.current && savedReleaseRef.current === link && ownsView();
    setLoading(true);
    setWorkflowEvidence({});
    setRecordedChanges({});
    setProviderDecisions({});
    setDeploymentEvents({});
    setGitHubEvidence({});
    setGitHubEvidenceErrors({});
    try {
      const result = await desktopClient.deploymentRequests(true);
      if (!ownsLoad()) return;
      if (result.ok) {
        let rows = result.data;
        let lookupFailed = false;
        if (link && !rows.some(row => row.id === link.id)) {
          const saved = await desktopClient.savedDeploymentRequest(link, true).catch(() => null);
          if (!ownsLoad()) return;
          lookupFailed = !saved?.ok;
          if (saved?.ok && saved.data?.id === link.id && saved.data.version === link.version) rows = [...rows, saved.data];
        }
        setExactLookupFailed(lookupFailed);
        setRequests(rows);
        setLastSuccessfulLoadAt(new Date());
        setLoadError(undefined);
      } else {
        setLoadError(result.error);
      }
    } catch {
      if (ownsLoad()) setLoadError("network_error");
    } finally {
      if (ownsLoad()) {
        const focusAtStart = focusWhenRefreshStarted.current;
        const focused = document.activeElement;
        setResolvedEntry(link ? {
          link,
          preserveDirectoryContext: focusAtStart !== null && focused !== focusAtStart && focused !== document.body,
        } : undefined);
        setLoading(false);
        if (refreshExecutions) void loadExecutions();
      }
    }
  }, [loadExecutions, ownsView]);

  useEffect(() => {
    focusWhenRefreshStarted.current = null;
    void load(false);
  }, [load, savedRelease]);
  useEffect(() => { void loadExecutions(); }, [loadExecutions]);

  const entryResolved = savedRelease !== undefined && resolvedEntry?.link === savedRelease;
  const preserveDirectoryContext = entryResolved && resolvedEntry.preserveDirectoryContext;
  const exactMatches = savedRelease ? requests.filter(request => request.id === savedRelease.id) : [];
  const exactAvailable = entryResolved && !loadError && exactMatches.length === 1 && exactMatches[0].version === savedRelease?.version;
  const exactUnavailable = entryResolved && !exactAvailable;
  useLayoutEffect(() => {
    if (!active || !exactUnavailable) return;
    const focusAtStart = focusWhenRefreshStarted.current;
    const focused = document.activeElement;
    if (!focusAtStart || focused === focusAtStart || focused === document.body) {
      unavailableEntry.current?.focus();
    }
  }, [active, exactUnavailable, savedRelease]);

  const activeExecutionKey = executions
    .filter((execution) => execution.status !== "completed" && execution.status !== "tracking_unavailable")
    .map((execution) => `${execution.id}:${execution.status}`)
    .join("|");

  useEffect(() => {
    const pending = executions.filter((execution) => execution.status !== "completed" && execution.status !== "tracking_unavailable");
    if (!pending.length) return;
    let cancelled = false, inFlight = false;
    const observe = async () => {
      if (cancelled || inFlight || !ownsView()) return;
      inFlight = true;
      try {
        // Await every sibling, including rejected reads, before another batch.
        const results = await Promise.allSettled(pending.map(async (execution) => desktopClient.observeDeploymentExecution(execution.id)));
        if (cancelled || !ownsView()) return;
        const updates = new Map(results.flatMap((result) => result.status === "fulfilled" && result.value.ok ? [[result.value.data.id, result.value.data] as const] : []));
        if (updates.size) setExecutions((current) => current.map((execution) => updates.get(execution.id) ?? execution));
      } finally {
        inFlight = false;
      }
    };
    void observe();
    const timer = window.setInterval(() => void observe(), 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
    // The key changes only when the set of active runs or their status changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExecutionKey, ownsView]);

  async function generatePlaybook(requestId: string) {
    if (!ownsView()) return;
    setGeneratingRequestId(requestId);
    setGenerationErrors((current) => {
      const next = { ...current };
      delete next[requestId];
      return next;
    });
    const result = await desktopClient.generateDeploymentPlaybook(requestId);
    if (!ownsView()) return;
    setGeneratingRequestId(undefined);
    if (!result.ok) {
      setGenerationErrors((current) => ({ ...current, [requestId]: result.error }));
      return;
    }
    setGeneratedPlaybooks((current) => ({ ...current, [requestId]: result.data }));
  }

  async function loadLatestPlaybook(requestId: string) {
    if (!ownsView()) return;
    setLoadingPlaybookId(requestId);
    setGenerationErrors((current) => {
      const next = { ...current };
      delete next[requestId];
      return next;
    });
    const result = await desktopClient.latestDeploymentPlaybook(requestId);
    if (!ownsView()) return;
    setLoadingPlaybookId(undefined);
    if (!result.ok) {
      setGenerationErrors((current) => ({ ...current, [requestId]: result.error }));
      return;
    }
    setGeneratedPlaybooks((current) => ({ ...current, [requestId]: result.data }));
  }

  async function startRevision(requestId: string, opener: HTMLButtonElement) {
    if (!ownsView()) return;
    const epoch = ++intakeEpoch.current, config = desktopClient.config, context = desktopClient.getContextRevision();
    const owns = () => mounted.current && epoch === intakeEpoch.current && config === desktopClient.config && context === desktopClient.getContextRevision();
    setLoadingRevisionId(requestId);
    try {
      const result = await desktopClient.deploymentRequestForRevision(requestId);
      if (!owns()) return;
      if (!result.ok) { setLoadError(`Could not load the request for revision: ${result.error}`); return; }
      setShowResolutionDraft(false);
      intakeOpener.current = opener;
      setRevision(result.data);
      setShowForm(true);
    } catch { if (owns()) setLoadError("The request could not be loaded. Your current intake has been retained."); }
    finally { if (owns()) setLoadingRevisionId(undefined); }
  }

  async function loadRevisionHistory(requestId: string) {
    if (!ownsView()) return;
    setLoadingHistoryId(requestId);
    setHistoryErrors((current) => {
      const next = { ...current };
      delete next[requestId];
      return next;
    });
    const result = await desktopClient.deploymentRequestHistory(requestId);
    if (!ownsView()) return;
    setLoadingHistoryId(undefined);
    if (!result.ok) {
      setHistoryErrors((current) => ({ ...current, [requestId]: result.error }));
      return;
    }
    setRevisionHistory((current) => ({ ...current, [requestId]: result.data }));
  }

  async function loadOperations(requestId: string) {
    if (!ownsView()) return;
    setLoadingOperationsId(requestId);
    setOperationLedger(current => {
      const next = {...current};
      delete next[requestId];
      return next;
    });
    setOperationErrors((current) => {
      const next = { ...current };
      delete next[requestId];
      return next;
    });
    const result = await desktopClient.deploymentOperations(requestId);
    if (!ownsView()) return;
    setLoadingOperationsId(undefined);
    if (!result.ok) {
      setOperationErrors((current) => ({ ...current, [requestId]: result.error }));
      return;
    }
    setOperationLedger((current) => ({ ...current, [requestId]: result.data }));
  }

  async function collectGitHubEvidence(request: DeploymentRequestSummary) {
    if (!ownsView() || loading || loadError || collectingGitHubEvidenceId) return;
    const generation = loadGeneration.current;
    const key = JSON.stringify([request.id, request.version]);
    setCollectingGitHubEvidenceId(key);
    setGitHubEvidence((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setGitHubEvidenceErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    const result = await desktopClient.collectGitHubReleaseEvidence(request.id, request.version)
      .catch(() => ({ok: false, error: "network_error"} as const));
    if (!ownsView()) return;
    setCollectingGitHubEvidenceId(undefined);
    if (generation !== loadGeneration.current) return;
    const parsed = result.ok ? gitHubReleaseEvidenceSchema.safeParse(result.data) : undefined;
    if (!parsed?.success || parsed.data.requestId !== request.id || parsed.data.requestVersion !== request.version) {
      const message = !result.ok && result.error === "github_read_validation_required"
        ? "GitHub validation is older than 24 hours. Open Settings and run the read-only validation before collecting release evidence."
        : "GitHub evidence could not be verified for this release version. Refresh the release before trying again.";
      setGitHubEvidenceErrors((current) => ({ ...current, [key]: message }));
      return;
    }
    setGitHubEvidence((current) => ({ ...current, [key]: parsed.data }));
  }

  async function closeRequest(request: DeploymentRequestSummary) {
    if (!ownsView() || loading || loadError || closingBusy
      || closingRequest?.id !== request.id || closingRequest.version !== request.version) return;
    setClosingBusy(true);
    setClosureError(undefined);
    const result = await desktopClient.closeDeploymentRequest(
      request.id,
      request.version,
      closureEvidenceId,
      closureSummary,
    );
    if (!ownsView()) return;
    setClosingBusy(false);
    if (!result.ok) {
      setClosureError(result.error);
      return;
    }
    setClosingRequest(undefined);
    setClosureEvidenceId("");
    setClosureSummary("");
    void load();
  }

  const directoryFreshness = lastSuccessfulLoadAt && (
    <p role="status" className="release-directory-freshness">
      {loading ? "Refreshing releases…" : `Service last responded ${lastSuccessfulLoadAt.toLocaleString()}.`}
      {!loading && exactUnavailable && <span className="sr-only"> The saved release version could not be verified.</span>}
    </p>
  );

  return (
    <ViewShell wide className="studio-deployments">
      <div className="release-workspace-heading flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deployments</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Plan, approve, release, and verify changes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {exactAvailable && !loading && !showForm && !showResolutionDraft && onRecoverSavedRelease?.returnWhenAvailable && <button type="button" className="btn-secondary"
            onClick={onRecoverSavedRelease.run}>{onRecoverSavedRelease.label}</button>}
          <button data-help-id="releases.workspace.refresh" type="button" onClick={() => {
            focusWhenRefreshStarted.current = document.activeElement;
            void load();
          }} className="btn-secondary">
            Refresh
          </button>
          <button data-help-id="releases.workspace.ticket-draft-toggle" type="button" onClick={event => { if (!showResolutionDraft) intakeOpener.current = event.currentTarget; invalidateRevisionRead(); setShowForm(false); setRevision(undefined); setResolutionDraftStarted(true); setShowResolutionDraft(value => !value); }} className="btn-secondary">{showResolutionDraft ? "Cancel draft" : "Start from ticket"}</button>
          <button data-help-id="releases.workspace.intake-toggle" type="button" ref={newRelease} onClick={event => { if (!showForm) intakeOpener.current = event.currentTarget; invalidateRevisionRead(); setShowResolutionDraft(false); setRevision(undefined); setShowForm((value) => !value); }} className="btn-primary">
            {!showForm && <Plus size={15} aria-hidden="true" />}
            {showForm ? "Cancel intake" : "New release"}
          </button>
        </div>
      </div>

      {!loading && !loadError && !showForm && !showResolutionDraft && <LoadedReleaseSummary requests={requests} />}

      {resumeIntake && <p role="status" className="glass-card p-3 text-sm text-zinc-300">Your release intake is still in progress. Finish or leave it before opening another saved release.</p>}
      {savedRelease && !entryResolved && <StateCard>Checking the saved release version…</StateCard>}
      {exactUnavailable && <div ref={unavailableEntry} tabIndex={-1} role="region" aria-label="Saved release unavailable">
        <StateCard>
          <p>The saved release version could not be verified. {loadError
            ? "The directory could not be refreshed. Try again or return to the previous view."
            : exactLookupFailed
              ? "Refresh to retry this version, or choose a current release."
              : "Choose a current release explicitly to continue."}</p>
          {!showForm && !showResolutionDraft && onRecoverSavedRelease && <button data-help-id="releases.workspace.saved-release-recovery" type="button" className="btn-secondary mt-3" onClick={onRecoverSavedRelease.run}>{onRecoverSavedRelease.label}</button>}
        </StateCard>
      </div>}
      {resolutionDraftStarted && <div ref={ticketRegion} hidden={!showResolutionDraft}><ResolutionDraftForm key={draftIdentity.current.key} active={showResolutionDraft} onBack={() => setShowResolutionDraft(false)} onSaved={() => { setShowResolutionDraft(false); setResolutionDraftStarted(false); void load(); }} /></div>}

      {showForm && intakeFormOwner.current.config === draftConfig && intakeFormOwner.current.revision === draftContext && (
        <div ref={intakeRegion}><DeploymentIntakeForm
          key={`${draftIdentity.current.key}:${revision?.id ?? "new"}`}
          revision={revision}
          onCreated={() => {
            setShowForm(false);
            setRevision(undefined);
            void load();
          }}
        /></div>
      )}

      {executions.length > 0 && (
        <section className="glass-card p-4" aria-label="Workflow execution evidence">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Workflow execution evidence</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Recorded workflow observations. These runs are not verified as evidence for a particular release; artifact delivery, application health and recovery remain unverified.</p>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Latest {Math.min(executions.length, 5)}</span>
          </div>
          <details className="mt-3"><summary data-help-id="releases.workspace.workflow-runs" className="cursor-pointer py-1 text-xs text-zinc-400">Browse recorded workflow runs</summary><div className="mt-3 space-y-2">
            {executions.slice(0, 5).map((execution) => (
              <div key={execution.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-black/15 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-zinc-200">
                    {execution.repositoryFullName}{execution.sourceRef ? `@${execution.sourceRef}` : ""}
                  </p>
                  {execution.sourceCommitSha && (
                    <p className="mt-1 font-mono text-[10px] text-zinc-400">
                      {execution.sourceKind ?? "ref"} · {execution.sourceCommitSha.slice(0, 12)}
                      {execution.branchPolicyId ? " · policy enforced" : ""}
                    </p>
                  )}
                  <DeploymentWorkflowEvidence execution={execution} />
                  <p className="mt-1 text-[10px] text-zinc-500">{new Date(execution.createdAt).toLocaleString()}</p>
                </div>
                {execution.workflowUrl && (
                  <ExternalLink href={execution.workflowUrl} className="shrink-0 text-[11px] font-medium text-zinc-300 hover:text-white">
                    Open workflow run ↗
                  </ExternalLink>
                )}
              </div>
            ))}
          </div></details>
        </section>
      )}

      {requests.length === 0 && directoryFreshness}
      {loading && requests.length === 0 && <StateCard>Loading current workspace requests…</StateCard>}
      {!loading && loadError && (
        <StateCard tone="error">
          {requests.length > 0
            ? `Refresh failed: ${friendlyLoadError(loadError)} Showing the last successfully loaded records; they may be stale.`
            : friendlyLoadError(loadError)}
        </StateCard>
      )}
      {!loading && !loadError && !exactLookupFailed && requests.length === 0 && (
        <StateCard>
          No deployment requests exist in this workspace. Start a request to capture scope,
          authority, production trigger, validation, evidence, and rollback requirements.
        </StateCard>
      )}
      {requests.length > 0 && (
        <FocusedReleaseWorkspace key={draftIdentity.current.key}
          directoryContext={directoryFreshness}
          searchShortcutActive={active && !showForm && !showResolutionDraft}
          requestedRelease={savedRelease}
          renderSelectedActivity={ownsView() && !loading && !loadError ? item => {
            const request = requests.find(row => row.id === item.id && row.version === item.version);
            if (!request) return null;
            const evidenceKey = JSON.stringify([request.id, request.version]);
            return <>
              <SelectedReleaseLifecycle request={request} workflow={workflowEvidence[evidenceKey]} deploymentEvent={deploymentEvents[evidenceKey]} providerDecision={providerDecisions[evidenceKey]}
                onReviewPlans={onReviewAgentPlans && request.version > 0
                ? () => { if (ownsView()) onReviewAgentPlans({id: request.id, version: request.version}); }
                : undefined} />
              {activityWorkspace && <ReleaseActivityTimeline key={JSON.stringify([activityWorkspace, request.id, request.version])}
                workspaceId={activityWorkspace} requestId={request.id} version={request.version} />}
            </>;
          } : undefined}
          requestedReleaseAvailable={exactAvailable}
          focusRequestedRow={!savedReleaseSection}
          preserveDirectoryContext={preserveDirectoryContext}
          items={requests.map(request=>({
          id:request.id,title:request.title,status:request.status,version:request.version,
          environment:request.releaseContext.scope.targetEnvironment,updatedAt:request.updatedAt,
          prReview: ownsView() && !loading && !loadError ? recordedPrReview(request.releaseContext.approval) : undefined,
          requesterName: ownsView() && !loading && !loadError ? request.requesterName : undefined,
          nextStep:releaseJourney({status:request.status,...request.releaseContext.approval,...request.releaseContext.readiness,rollbackAvailability:request.releaseContext.recovery.rollbackAvailability,stale:loading||!!loadError}).next.title,
          attention:!!loadError||request.releaseContext.readiness.blockers.length>0||!!historyErrors[request.id]||!!operationErrors[request.id]||!!githubEvidenceErrors[JSON.stringify([request.id, request.version])]||!!generationErrors[request.id],
          busy:[loadingRevisionId,loadingHistoryId,loadingOperationsId,generatingRequestId,loadingPlaybookId].includes(request.id)||collectingGitHubEvidenceId===JSON.stringify([request.id,request.version])||(closingBusy&&closingRequest?.id===request.id),
        }))}>{(item, closeButton) => {
          const request=requests.find(request=>request.id===item.id)!;
          const evidenceKey = JSON.stringify([request.id, request.version]);
          const recordedRun = ownsView() && !loading && !loadError ? workflowEvidence[evidenceKey]?.run : undefined;
          const targetedSection = active && !loading && ownsView() && exactAvailable &&
            request.id === savedRelease?.id && request.version === savedRelease.version ? savedReleaseSection : undefined;
          const canOpenReleaseReview = request.status === "submitted" && !request.releaseContext.approval.noPrRequired;
          const reviewUnavailable = !ownsView() || loading || Boolean(loadError);
          const closureVersionChanged = closingRequest?.id === request.id && closingRequest.version !== request.version;
          return (
            <div key={request.id} className="release-request-card glass-card p-5">
              <div className="studio-release-inspector-toolbar">
                {closeButton}
                <header className="studio-release-detail-header">
                  <details className="text-[11px] text-zinc-400">
                    <summary data-help-id="releases.workspace.request-identifiers" className="cursor-pointer hover:text-zinc-300">Request identifiers</summary>
                    <p className="mt-2 break-all font-mono">Request {request.id}</p>
                    <p className="mt-1 break-all font-mono">Correlation {request.correlationId}</p>
                    <p className="mt-1">Updated <time dateTime={request.updatedAt}>{new Date(request.updatedAt).toLocaleString()}</time></p>
                  </details>
                  <h3 className="release-focus-detail-title">{request.title}</h3>
                  <div className="studio-release-detail-metadata">
                    <span className="studio-release-detail-version">Version {request.version}</span>
                    <span className="capitalize">{request.status.replaceAll("_", " ")}</span>
                  </div>
                </header>
                <ReleaseDetailNavigation key={evidenceKey} entry={targetedSection && !preserveDirectoryContext ? savedRelease : undefined} section={targetedSection} />
                {canOpenReleaseReview && (
                  <div className="studio-release-review-action">
                    <button type="button" disabled={reviewUnavailable} className="btn-primary studio-release-approval-link"
                      onClick={event => {
                        if (ownsView() && active && !loading && !loadError) focusReleaseDetail(event.currentTarget, "review");
                      }}>
                      <ShieldCheck size={15} aria-hidden="true" />View release review
                    </button>
                  </div>
                )}
              </div>
              <div className="studio-release-detail-body">
              <div data-release-detail="overview" role="region" aria-label="Release overview" tabIndex={-1}>
                <ReleaseContext request={request} stale={!ownsView() || loading || !!loadError}
                  workflow={ownsView() && !loading && !loadError ? workflowEvidence[evidenceKey] : undefined}
                  recordedChange={ownsView() && !loading && !loadError ? recordedChanges[evidenceKey] : undefined}
                  providerDecision={ownsView() && !loading && !loadError ? providerDecisions[evidenceKey] : undefined}
                  deploymentEvent={ownsView() && !loading && !loadError ? deploymentEvents[evidenceKey] : undefined} />
              </div>
              <div className="release-action-toolbar flex flex-wrap items-end justify-between gap-3 mt-4">
                {request.status !== "submitted" && <p className="text-xs text-zinc-500">Exact approvals and verified evidence are required before execution.</p>}
                <div className="flex flex-wrap gap-2">
                  {request.status === "draft" ? <>
                    <button data-help-id="releases.workspace.complete-details" type="button" className="btn-primary" disabled={loadingRevisionId === request.id} onClick={event => void startRevision(request.id, event.currentTarget)}>{loadingRevisionId === request.id ? "Opening…" : "Complete release details"}</button>
                    <button data-help-id="releases.workspace.draft-history" type="button" className="btn-secondary" disabled={loadingHistoryId === request.id} onClick={() => void loadRevisionHistory(request.id)}>Review history</button>
                  </> : <>

                  <details className="relative self-start text-xs text-zinc-400">
                    <summary data-help-id="releases.workspace.planning-tools" className="btn-secondary cursor-pointer list-none">Planning tools</summary>
                    <div className="mt-2 flex flex-wrap gap-2 rounded-lg border border-white/10 p-2">
                  <button data-help-id="releases.workspace.terraform-evidence" type="button" className="btn-secondary" onClick={() => setTerraformRequestId(current => current === request.id ? undefined : request.id)}>Review Terraform evidence</button>
                  <button data-help-id="releases.workspace.playbook-generate"
                    type="button"
                    className="btn-secondary disabled:opacity-50"
                    disabled={request.status === "closed" || generatingRequestId === request.id}
                    onClick={() => void generatePlaybook(request.id)}
                  >
                    {generatingRequestId === request.id ? "Generating…" : "Generate next playbook"}
                  </button>
                    </div>
                  </details>
                  <button data-help-id="releases.workspace.revise"
                    type="button"
                    className="btn-secondary disabled:opacity-50"
                    disabled={request.status === "closed" || loadingRevisionId === request.id}
                    onClick={event => void startRevision(request.id, event.currentTarget)}
                  >
                    {loadingRevisionId === request.id ? "Opening…" : "Revise"}
                  </button>
                  <button data-help-id="releases.workspace.request-history"
                    type="button"
                    className="btn-secondary disabled:opacity-50"
                    disabled={loadingHistoryId === request.id}
                    onClick={() => void loadRevisionHistory(request.id)}
                  >
                    {loadingHistoryId === request.id ? "Loading history…" : "Review history"}
                  </button>
                  <button data-help-id="releases.workspace.execution-controls"
                    type="button"
                    className="btn-primary disabled:opacity-50"
                    disabled={loadingOperationsId === request.id}
                    onClick={() => void loadOperations(request.id)}
                  >
                    {loadingOperationsId === request.id ? "Loading controls…" : "Review execution controls"}
                  </button>
                </>}
                </div>
              </div>
              {request.status === "draft" ? <p className="mt-3 text-xs text-amber-200">Draft only. Resolve repository, workflow, readiness and approval details before submitting the release.</p> : null}
              {terraformRequestId === request.id && <TerraformPlanReview key={`${request.id}:${request.version}`} requestId={request.id} requestVersion={request.version} />}
              <section className="studio-release-evidence" data-release-detail="evidence" aria-label="Release evidence" tabIndex={-1}>
                <h3>Evidence</h3>
                {request.status !== "draft" && <button data-help-id="releases.workspace.github-evidence"
                  type="button" className="btn-secondary" disabled={!!collectingGitHubEvidenceId || loading || !!loadError}
                  onClick={() => void collectGitHubEvidence(request)}>
                  {collectingGitHubEvidenceId === evidenceKey ? "Reading GitHub…" : "Collect GitHub evidence"}
                </button>}
                {githubEvidenceErrors[evidenceKey] && <p role="alert">{githubEvidenceErrors[evidenceKey]}</p>}
                {!loadError && githubEvidence[evidenceKey] && <GitHubEvidenceCard evidence={githubEvidence[evidenceKey]} />}
                {!loading && !loadError && activityWorkspace && request.releaseContext.scope.changeNotApplicable !== true &&
                  <RecordedChangeRead key={evidenceKey} requestId={request.id} version={request.version} onChangeNumber={number => {
                    if(ownsView())setRecordedChanges(current => ({...current,[evidenceKey]:number}));
                  }} />}
                {!loading && !loadError && activityWorkspace && <SelectedReleaseOperationEvidence
                  key={JSON.stringify([activityWorkspace, request.id, request.version])}
                  requestId={request.id} version={request.version} workspaceId={activityWorkspace}
                  onProviderDecision={decision => {
                    if (ownsView()) setProviderDecisions(current => ({...current, [evidenceKey]: decision}));
                  }}
                  onDeploymentEvent={event => {
                    if (ownsView()) setDeploymentEvents(current => ({...current, [evidenceKey]: event}));
                  }}
                  onWorkflowEvidence={evidence => {
                    if (ownsView()) setWorkflowEvidence(current => ({...current, [evidenceKey]: evidence}));
                  }}/>}
              </section>
              <section className="studio-release-evidence" data-release-detail="logs" aria-label="Release logs" tabIndex={-1}>
                <h3>Logs</h3>
                {recordedRun && (
                  <RecordedWorkflowLogsLink run={recordedRun} className="btn-secondary"/>
                )}
                <p>Live logs and application health are unavailable for this request.</p>
              </section>
              <ReleaseTicketWorkspace requestId={request.id} version={request.version} releaseStatus={request.status}/>
              {targetedSection === "review" && !canOpenReleaseReview &&
                <p data-release-detail="review" tabIndex={-1} role="status" className="mt-3 text-xs text-zinc-400">
                  Merge review is unavailable for this release version.
                </p>}
              {canOpenReleaseReview && <>
                <div hidden={reviewUnavailable} inert={reviewUnavailable}>
                  <ReleaseMergeReview key={evidenceKey} requestId={request.id} version={request.version} />
                </div>
                {reviewUnavailable && <p role="status" className="mt-3 text-xs text-zinc-400">
                  {loading ? "Checking the release version before merge review…" : "Refresh releases to verify this version before merge review."}
                </p>}
              </>}
              {!loading && !loadError && request.status === "submitted" && (request.releaseContext.batches?.selectedRunCount ?? 0) > 0 && <>
                <ReleaseBatchReadiness requestId={request.id} version={request.version} count={request.releaseContext.batches!.selectedRunCount} />
                <ReleaseBatchMonitor requestId={request.id} version={request.version} />
                {onInspectReleaseBatches && active && !showForm && !showResolutionDraft &&
                  <button type="button" className="btn-secondary mt-3" onClick={() => {
                    if (ownsView()) onInspectReleaseBatches({id: request.id, version: request.version});
                  }}>Inspect release dependencies</button>}
              </>}
              {request.status === "draft" ? null : request.status === "closed" ? (
                <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-100">
                  Closure recorded{request.closedAt ? ` ${new Date(request.closedAt).toLocaleString()}` : ""}. This record documents a reported external outcome; it did not dispatch a deployment.
                </div>
              ) : closingRequest?.id === request.id ? (
                <div className="mt-3 rounded-lg border border-white/20 bg-white/5 p-3">
                  <p className="text-xs font-medium text-zinc-100">Record external outcome</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">Attach the external validation or change reference. This closes only the V19 record; it cannot deploy, merge, or approve anything.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input data-help-id="releases.workspace.closure-reference" value={closureEvidenceId} onChange={(event) => setClosureEvidenceId(event.target.value)} placeholder="Validation or change reference" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white" />
                    <input data-help-id="releases.workspace.closure-summary" value={closureSummary} onChange={(event) => setClosureSummary(event.target.value)} placeholder="Recorded outcome summary" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white" />
                  </div>
                  {closureVersionChanged && <p role="status" className="mt-2 text-xs text-zinc-300">
                    This draft is for version {closingRequest.version}. Cancel and reopen to record an outcome for version {request.version}.
                  </p>}
                  {!closureVersionChanged && closureError && <p role="alert" className="mt-2 text-xs text-rose-300">Closure was not recorded: {closureError}</p>}
                  <div className="mt-3 flex justify-end gap-2">
                    <button data-help-id="releases.workspace.closure-cancel" type="button" disabled={closingBusy} onClick={() => { setClosingRequest(undefined); setClosureError(undefined); }} className="btn-secondary">Cancel</button>
                    <button data-help-id="releases.workspace.closure-record" type="button" disabled={closingBusy || loading || !!loadError || closureVersionChanged} onClick={() => void closeRequest(request)} className="btn-primary disabled:opacity-50">{closingBusy ? "Recording…" : "Record closure"}</button>
                  </div>
                </div>
              ) : (
                <button data-help-id="releases.workspace.closure-open" type="button" disabled={closingBusy} onClick={() => { setClosingRequest({id: request.id, version: request.version}); setClosureEvidenceId(""); setClosureSummary(""); setClosureError(undefined); }} className="mt-3 text-[11px] font-medium text-zinc-400 transition hover:text-white">
                  Record external outcome and close request →
                </button>
              )}
              {historyErrors[request.id] && (
                <p role="alert" className="mt-3 text-xs text-rose-300">
                  Revision history could not be loaded: {historyErrors[request.id]}
                </p>
              )}
              {revisionHistory[request.id] && (
                <div className="mt-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2">
                  <p className="text-xs font-medium text-zinc-100">Governed revision history</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    This view lists only safe field categories. Contacts, URLs, workflow inputs, evidence references, and full member identities remain private.
                  </p>
                  <ol className="mt-3 space-y-2">
                    {revisionHistory[request.id].map((entry) => (
                      <li key={`${request.id}-${entry.version}`} className="rounded-md border border-white/5 bg-black/10 px-2.5 py-2">
                        <p className="text-[11px] font-medium text-zinc-200">
                          Version {entry.version} · {entry.author}
                          <span className="font-normal text-zinc-500"> · {new Date(entry.createdAt).toLocaleString()}</span>
                        </p>
                        <p className="mt-1 text-[10px] leading-4 text-zinc-400">{entry.changes.join(" · ")}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {operationErrors[request.id] && (
                <p role="alert" className="mt-3 text-xs text-rose-300">
                  Request-wide operation history could not be loaded.
                </p>
              )}
              {operationLedger[request.id] && (
                <div className="mt-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2">
                  <p className="text-xs font-medium text-zinc-100">Request-wide operation history</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    Read-only durable operation status across request versions.
                  </p>
                  {operationLedger[request.id].length === 0 ? (
                    <p className="mt-3 text-[11px] text-zinc-400">No consequential operation has been recorded for this request.</p>
                  ) : (
                    <ol className="mt-3 space-y-2">
                      {operationLedger[request.id].map((operation, index) => (
                        <li key={`${request.id}-${operation.kind}-${operation.createdAt}-${index}`} className="rounded-md border border-white/5 bg-black/10 px-2.5 py-2">
                          <p className="text-[11px] font-medium text-zinc-200">
                            {operation.kind.replaceAll("_", " ")} · {operation.status.replaceAll("_", " ")}
                          </p>
                          <p className="mt-1 text-[10px] leading-4 text-zinc-500">
                            Recorded {new Date(operation.createdAt).toLocaleString()} · {operation.attemptCount} attempt{operation.attemptCount === 1 ? "" : "s"}
                            {operation.lastReconciledAt ? ` · reconciled ${new Date(operation.lastReconciledAt).toLocaleString()}` : ""}
                            {operation.externallyReferenced ? " · external outcome reference recorded" : ""}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
              {request.latestPlaybook && !generatedPlaybooks[request.id] && (
                <div className="mt-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2">
                  <p className="text-xs text-zinc-100">
                    {request.latestPlaybook.status === "superseded"
                      ? `Previous playbook v${request.latestPlaybook.version} was superseded by a request revision.`
                      : `Latest persisted playbook: v${request.latestPlaybook.version} · ${request.latestPlaybook.status.replaceAll("_", " ")}`}
                  </p>
                  <p className="text-[10px] font-mono text-zinc-500 mt-1 break-all">
                    SHA-256 {request.latestPlaybook.contentHash} · stored {new Date(request.latestPlaybook.createdAt).toLocaleString()}
                  </p>
                  <button data-help-id="releases.workspace.playbook-read"
                    type="button"
                    className="mt-2 text-[11px] font-medium text-zinc-200 transition hover:text-white disabled:opacity-50"
                    disabled={loadingPlaybookId === request.id}
                    onClick={() => void loadLatestPlaybook(request.id)}
                  >
                    {loadingPlaybookId === request.id ? "Opening playbook…" : request.latestPlaybook.status === "superseded" ? "Review historical playbook" : "Review persisted playbook"}
                  </button>
                </div>
              )}
              {generationErrors[request.id] && (
                <p role="alert" className="text-xs text-rose-300 mt-3">
                  Playbook was not generated: {generationErrors[request.id]}
                </p>
              )}
              {generatedPlaybooks[request.id] && (
                <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-emerald-100">
                      Playbook v{generatedPlaybooks[request.id].version} persisted
                    </p>
                    <span className="text-[10px] font-mono text-emerald-300">
                      {generatedPlaybooks[request.id].stepCount} steps
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    {generatedPlaybooks[request.id].scope}
                  </p>
                  <p className="text-[10px] font-mono text-zinc-500 mt-2 break-all">
                    SHA-256 {generatedPlaybooks[request.id].contentHash}
                  </p>
                  <ol className="mt-3 space-y-2">
                    {generatedPlaybooks[request.id].steps.map((step) => (
                      <li key={step.id} className="text-xs text-zinc-300 flex gap-2">
                        <span className="font-mono text-zinc-500">{step.order}.</span>
                        <span>
                          {step.title} · {step.requiredRole.replaceAll("_", " ")}
                          {step.activation !== "always" ? ` · ${step.activation.replaceAll("_", " ")}` : ""}
                          {step.evidenceRequired ? " · evidence required" : ""}
                          {step.validationInstruction ? (
                            <span className="block text-zinc-500 mt-0.5">
                              Validate: {step.validationInstruction}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="text-xs text-zinc-200/80 mt-3">
                    Generated and audited only. No merge, dispatch, release, or environment approval was performed.
                  </p>
                </div>
              )}
              </div>
            </div>
          );}}
        </FocusedReleaseWorkspace>
      )}
    </ViewShell>
  );
}

function LoadedReleaseSummary({requests}: {requests: DeploymentRequestSummary[]}) {
  const metrics = [
    {label: "Loaded requests", count: requests.length},
    {label: "Drafts", count: requests.filter(request => request.status === "draft").length},
    {label: "Submitted", count: requests.filter(request => request.status === "submitted").length},
    {label: "Closed", count: requests.filter(request => request.status === "closed").length},
  ];
  return <dl aria-label="Loaded release request summary" className="studio-release-summary">
    {metrics.map(({label, count}) => <div key={label}>
      <dt>{label}</dt>
      <dd>{count.toLocaleString()}</dd>
    </div>)}
  </dl>;
}

function SelectedReleaseLifecycle({request, workflow, deploymentEvent, providerDecision, onReviewPlans}: {
  request: DeploymentRequestSummary;
  workflow?: RecordedWorkflowEvidence;
  deploymentEvent?: RecordedDeploymentEvent;
  providerDecision?: RecordedProviderDecision;
  onReviewPlans?: () => void;
}) {
  const {readiness, observation} = request.releaseContext;
  const count = readiness.validationStepCount;
  const planSubmitted = request.status === "submitted" || (request.status === "closed" && Boolean(request.submittedAt));
  const readyForReview = request.status === "submitted"
    && readiness.approvalDecision === "ready_for_human_approval"
    && !providerDecision && !deploymentEvent && !workflow;
  const stages = [
    {label: "Plan", recorded: planSubmitted, detail: request.status === "draft" ? "Draft request"
      : request.status === "submitted" ? "Request submitted" : request.status === "closed" ? "Request closed" : "Request details available"},
    {label: "Validate", detail: count > 0 ? `${count} planned validation step${count === 1 ? "" : "s"}` : "No steps recorded",
      evidence: readiness.deferredValidation ? "Deferral recorded" : undefined},
    {label: "Approve", readyForReview, detail: providerDecision
      ? `${savedMergeDecisionLabels[providerDecision.type]} · PR #${providerDecision.pullRequest}`
      : readiness.approvalDecision === "ready_for_human_approval" ? "Ready for review" : "Readiness needs attention"},
    {label: "Deploy", detail: deploymentEvent ? deploymentExecutionEventLabels[deploymentEvent.type]
      : request.status === "draft" ? "Draft request" : "See execution controls",
      evidence: workflow && `Workflow run · ${recordedWorkflowStatus(workflow)}`},
    {label: "Verify", detail: "Verification unavailable",
      evidence: observation.recordedMonitoringPlan ? "Monitoring plan recorded" : undefined},
  ];

  return <section aria-label="Selected release lifecycle" className="studio-release-lifecycle">
    <header>
      <h3>Selected release lifecycle</h3>
      {onReviewPlans && <button data-help-id="releases.workspace.review-agent-plans" type="button" className="btn-secondary" onClick={onReviewPlans}>Review saved plans in Agent</button>}
    </header>
    <ol>
      {stages.map(({label, detail, evidence, recorded, readyForReview}, index) => <li key={label}>
        <span aria-hidden="true" className="studio-release-stage-number" data-recorded={recorded || undefined}
          data-review-ready={readyForReview || undefined}>
          {recorded ? <CheckIcon size={12} /> : index + 1}
        </span>
        <strong>{label}</strong>
        <small>{detail}</small>
        {evidence && <small>{evidence}</small>}
      </li>)}
    </ol>
  </section>;
}

function RecordedChangeRead({requestId,version,onChangeNumber}:{requestId:string;version:number;onChangeNumber:(number:string|undefined)=>void}) {
  const [status,setStatus]=useState<"idle"|"reading"|"recorded"|"unavailable">("idle");
  const flight=useRef<AbortController|null>(null);
  useEffect(()=>()=>flight.current?.abort(),[]);
  async function read(){
    if(flight.current)return;
    const controller=new AbortController();
    const owner=desktopClient.config;
    const revision=desktopClient.getContextRevision();
    flight.current=controller;
    setStatus("reading");
    onChangeNumber(undefined);
    try{
      const response=await desktopClient.recordedServiceNowChange(requestId,version,controller.signal);
      if(controller.signal.aborted||desktopClient.config!==owner||desktopClient.getContextRevision()!==revision)return;
      const number=response.ok?response.data.number:undefined;
      if(number)onChangeNumber(number);
      setStatus(number?"recorded":"unavailable");
    }catch{
      if(!controller.signal.aborted&&desktopClient.config===owner&&desktopClient.getContextRevision()===revision)setStatus("unavailable");
    }finally{flight.current=null;}
  }
  return <div className="mt-2 space-y-1">
    <button data-help-id="releases.workspace.read-recorded-change" type="button" className="btn-secondary" disabled={status==="reading"} onClick={()=>void read()}>
      {status==="reading"?"Reading recorded change…":"Read recorded ServiceNow change"}
    </button>
    {status==="recorded"&&<p role="status">Recorded ServiceNow change shown in Overview.</p>}
    {status==="unavailable"&&<p role="status">A published ServiceNow change could not be verified for this release version.</p>}
  </div>;
}

const savedMergeDecisionLabels = { approved: "Merge approval recorded", revoked: "Merge approval revoked", consumed: "Merge approval used" } as const;

function recordedWorkflowStatus(workflow: RecordedWorkflowEvidence) {
  return workflow.state === "success" ? "Success recorded" : `Recorded as ${recordedWorkflowOutcomes[workflow.state]}`;
}

function RecordedWorkflowLogsLink({run, className}: {run: RecordedWorkflowRun; className: string}) {
  const repository = run.repository.split("/").map(encodeURIComponent).join("/");
  return <ExternalLink href={`https://github.com/${repository}/actions/runs/${run.id}/attempts/${run.attempt}`} className={className}>
    View GitHub logs for attempt {run.attempt}
  </ExternalLink>;
}

function recordedPrReview({ prStatus, noPrRequired }: DeploymentRequestSummary["releaseContext"]["approval"]) {
  if (noPrRequired || prStatus === "not_applicable") return "PR not required";
  if (prStatus === "approved") return "Approved (recorded)";
  if (prStatus === "pending") return "Pending";
  return "Unavailable";
}

const governanceUrl = "https://visionxixlabs.com/control/governance";

function OpenGovernance() {
  const [openFailed, setOpenFailed] = useState(false);

  async function openInBrowser() {
    setOpenFailed(false);
    try {
      await open(governanceUrl);
    } catch {
      setOpenFailed(true);
    }
  }

  return <>
    <button type="button" className="mt-2 underline" onClick={() => void openInBrowser()}>
      Open Agent Approval Center in browser
    </button>
    {openFailed && <p className="mt-2" role="alert">
      Could not open the browser. Try again or open {governanceUrl}.
    </p>}
  </>;
}

function ReleaseContext({ request, stale, workflow, recordedChange, providerDecision, deploymentEvent }: {
  request: DeploymentRequestSummary;
  stale: boolean;
  workflow?: RecordedWorkflowEvidence;
  recordedChange?: string;
  providerDecision?: RecordedProviderDecision;
  deploymentEvent?: RecordedDeploymentEvent;
}) {
  const context = request.releaseContext;
  const workflowCommit = workflow?.state === "success" ? workflow.commit : undefined;
  const workflowStatus = workflow ? recordedWorkflowStatus(workflow) : "Unavailable";
  const prerequisitesMet = context.readiness.approvalDecision === "ready_for_human_approval";
  const approval = recordedPrReview(context.approval);
  const rollback = context.recovery.rollbackAvailability.replaceAll("_", " ");
  const validationCount = context.readiness.validationStepCount;
  const plannedValidation = validationCount > 0
    ? `${validationCount} step${validationCount === 1 ? "" : "s"}`
    : "No steps recorded";

  return (
    <div className="mt-3" role="group" aria-label="Release context">
      <section aria-label="Recorded release summary">
        <dl className="studio-release-recorded-facts studio-release-overview-facts">
          <div><dt>Target</dt><dd>{stale ? "Unavailable" : context.scope.targetEnvironment ?? "Unavailable"}</dd></div>
          <div><dt>Repository</dt><dd>{!stale && Array.isArray(context.scope.githubRepositories) && context.scope.githubRepositories.length > 0
            ? <ul>{context.scope.githubRepositories.map(repository => <li key={repository}>{repository}</li>)}</ul>
            : "Unavailable"}</dd></div>
          <div><dt>Commit</dt><dd>{workflowCommit
            ? <code title={`Verified workflow commit ${workflowCommit}`} aria-label={`Verified workflow commit ${workflowCommit}`}>{workflowCommit.slice(0, 7)}</code>
            : "Unavailable"}</dd></div>
          <div><dt>Change</dt><dd>{recordedChange ?? (!stale && context.scope.changeNotApplicable === true ? "Not applicable" : "Unavailable")}</dd></div>
          <div><dt>Requested by</dt><dd>{stale ? "Unavailable" : request.requesterName ?? "Unavailable"}</dd></div>
        </dl>
        <section aria-label="Recorded approvals" className="studio-release-overview-section studio-release-approvals">
          <h4>Recorded approvals</h4>
          <dl className="studio-release-recorded-facts studio-release-overview-facts">
            <div><dt>Recorded PR state</dt><dd>{stale ? "Unavailable" : approval}</dd></div>
            <div><dt>Approval prerequisites</dt><dd>{stale ? "Unavailable" : prerequisitesMet ? "Ready for human review" : "Needs attention"}</dd></div>
            <div><dt>Saved merge approval</dt><dd>{stale || !providerDecision ? "Unavailable" : <>
              <span>{savedMergeDecisionLabels[providerDecision.type]} · PR #{providerDecision.pullRequest}</span>
              <time className="studio-release-approval-time" dateTime={providerDecision.at}>{new Date(providerDecision.at).toLocaleString()}</time>
            </>}</dd></div>
          </dl>
          {!stale && prerequisitesMet && <p className="studio-release-approval-note operational-note text-zinc-400">Human approval is still required.</p>}
          {!stale && !prerequisitesMet && context.readiness.blockers.length > 0 && (
            <details key={request.version} className="studio-release-approval-note text-xs text-zinc-400">
              <summary data-help-id="releases.workspace.approval-blockers" className="cursor-pointer">Review recorded blockers ({context.readiness.blockers.length})</summary>
              <ul className="operational-note mt-2 list-disc space-y-1 ps-4">
                {context.readiness.blockers.map((blocker, index) => <li key={index}>{blocker}</li>)}
              </ul>
            </details>
          )}
        </section>
        <section aria-label="Recorded readiness" className="studio-release-overview-section">
          <h4>Readiness</h4>
          <dl className="studio-release-recorded-facts studio-release-overview-facts">
            <div><dt>Workflow run</dt><dd>
              {stale ? "Unavailable" : workflowStatus}
              {!stale && workflow?.run && <RecordedWorkflowLogsLink run={workflow.run} className="mt-1 block underline underline-offset-2"/>}
            </dd></div>
            {!stale && deploymentEvent && <div><dt>Recorded deployment execution</dt><dd>
              <span>{deploymentExecutionEventLabels[deploymentEvent.type]} · PR #{deploymentEvent.pullRequest}</span>
              <time className="studio-release-approval-time" dateTime={deploymentEvent.at}>{new Date(deploymentEvent.at).toLocaleString()}</time>
            </dd></div>}
            <div><dt>Development readiness</dt><dd>{stale ? "Unavailable" : context.readiness.developmentReady ? "Recorded" : "Not recorded"}</dd></div>
            <div><dt>Production readiness</dt><dd>{stale ? "Unavailable" : context.readiness.productionReady ? "Recorded" : "Not recorded"}</dd></div>
            <div><dt>Planned validation</dt><dd>{stale ? "Unavailable" : <>{plannedValidation}{context.readiness.deferredValidation ? " · deferred" : ""}</>}</dd></div>
            <div><dt>Rollback availability</dt><dd>{stale ? "Unavailable" : rollback}</dd></div>
            {!stale && context.recovery.backupRequired && <div><dt>Recovery backup</dt><dd>Required by saved intake</dd></div>}
            <div><dt>Monitoring plan</dt><dd>{!stale && context.observation.recordedMonitoringPlan ? "Recorded" : "Unavailable"}</dd></div>
          </dl>
        </section>
      </section>
      {request.status === "submitted" && (
        <div className="studio-release-execution-requirements">
          <h4><LockKeyhole size={14} aria-hidden="true" />Execution requirements</h4>
          <p>Exact approvals and verified evidence are required before execution.</p>
        </div>
      )}
      <CustomerJourneyPanel label="Release next step" journey={releaseJourney({status:request.status,approvalDecision:context.readiness.approvalDecision,blockers:context.readiness.blockers,prStatus:context.approval.prStatus,noPrRequired:context.approval.noPrRequired,rollbackAvailability:context.recovery.rollbackAvailability,stale})}/>
      <details className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400">
        <summary data-help-id="releases.workspace.recorded-details" className="cursor-pointer py-1">Recorded release details</summary>
        <dl className="studio-release-recorded-facts">
          <div><dt>Recorded window</dt><dd>{stale ? "Unavailable" : <RecordedReleaseWindow window={context.window} />}</dd></div>
          <div><dt>Scope</dt><dd>{stale ? "Unavailable" : <>{context.scope.applicationCount} app{context.scope.applicationCount === 1 ? "" : "s"} · {context.scope.repositoryCount} repo{context.scope.repositoryCount === 1 ? "" : "s"}</>}</dd></div>
          <div><dt>Evidence references</dt><dd>{stale ? "Unavailable" : context.recovery.evidenceCount}</dd></div>
          <div><dt>Backup evidence</dt><dd>{stale ? "Unavailable" : context.recovery.backupRequired ? "Required" : "Not required"}</dd></div>
          <div><dt>Post-release observation</dt><dd>Not connected</dd></div>
        </dl>
        <p className="mt-2 rounded-lg border border-white/5 bg-white/1.5 px-3 py-2 text-[10px] leading-4 text-zinc-500">
          Release decisions require exact review and current authority. This overview records evidence, and production health is unavailable.
        </p>
        <OpenGovernance />
      </details>
    </div>
  );
}

const releaseDetailSections = [
  { id: "overview", title: "Overview" },
  { id: "evidence", title: "Evidence" },
  { id: "logs", title: "Logs" },
] as const;

type ReleaseDetailSection = (typeof releaseDetailSections)[number]["id"];

function focusReleaseDetail(origin: HTMLElement | null, id: ReleaseDetailSection | "review") {
  const card = origin?.closest(".release-request-card");
  const region = card?.querySelector<HTMLElement>(`[data-release-detail="${id}"]`);
  if (!region || region.closest("[hidden]")) return false;
  region.focus({preventScroll: true});
  const body = region.closest<HTMLElement>(".studio-release-detail-body");
  // On wide layouts the inspector body scrolls independently of the directory.
  if (body && body.clientHeight > 0 && getComputedStyle(body).overflowY === "auto") {
    body.scrollTop += region.getBoundingClientRect().top - body.getBoundingClientRect().top - body.clientTop;
    return true;
  }

  const toolbar = card?.querySelector<HTMLElement>(".studio-release-inspector-toolbar");
  const page = toolbar?.closest<HTMLElement>(".studio-deployments");
  if (toolbar && page && getComputedStyle(toolbar).position === "sticky") {
    const panelTop = page.getBoundingClientRect().top + page.clientTop + toolbar.offsetHeight;
    page.scrollTop += region.getBoundingClientRect().top - panelTop;
  } else {
    region.scrollIntoView?.({block: "nearest"});
  }
  return true;
}

function ReleaseDetailNavigation({entry, section}: {entry?: SavedReleaseLink; section?: "evidence" | "review"}) {
  const [current, setCurrent] = useState<ReleaseDetailSection>("overview");
  const navigation = useRef<HTMLElement>(null);
  const handledEntry = useRef<SavedReleaseLink | undefined>(undefined);
  function openSection(id: ReleaseDetailSection) {
    if (focusReleaseDetail(navigation.current, id)) setCurrent(id);
  }
  useEffect(() => {
    if (!entry || !section || handledEntry.current === entry) return;
    if (!focusReleaseDetail(navigation.current, section)) return;
    handledEntry.current = entry;
    if (section === "evidence") setCurrent(section);
  }, [entry, section]);
  return <nav ref={navigation} className="studio-release-drawer-nav" aria-label="Release detail sections">
    {releaseDetailSections.map(({id, title}) => <button data-help-id="releases.workspace.detail-navigation" key={id} type="button"
      aria-current={current === id ? "location" : undefined}
      onClick={() => openSection(id)}>
      {title}
    </button>)}
  </nav>;
}

function GitHubEvidenceCard({ evidence }: { evidence: GitHubReleaseEvidence }) {
  return (
    <div className="mt-3 rounded-lg border border-white/15 bg-white/5 px-3 py-3">
      <p className="text-xs font-medium text-zinc-100">GitHub release evidence</p>
      <p className="mt-1 text-[10px] leading-4 text-zinc-500">
        Read-only signals from the repositories and pull requests already recorded on this request. No workflow, pull request, deployment, or approval was changed.
      </p>
      <ul className="mt-3 space-y-2">
        {evidence.repositories.map((repository) => (
          <li key={repository.repository} className="rounded-md border border-white/5 bg-black/10 px-2.5 py-2 text-[11px] text-zinc-300">
            <span className="font-medium text-zinc-100">{repository.repository}</span>
            <span className="text-zinc-500"> · {repository.state === "observed" ? "read" : "not available"} · branch {repository.branchProtection.replaceAll("_", " ")} · workflow {repository.latestWorkflow.replaceAll("_", " ")}</span>
          </li>
        ))}
        {evidence.pullRequests.map((pullRequest) => (
          <li key={`${pullRequest.repository}-${pullRequest.number}`} className="rounded-md border border-white/5 bg-black/10 px-2.5 py-2 text-[11px] text-zinc-300">
            <span className="font-medium text-zinc-100">{pullRequest.repository} · PR #{pullRequest.number}</span>
            <span className="text-zinc-500"> · {pullRequest.pullRequestState.replaceAll("_", " ")} · checks {pullRequest.checks.replaceAll("_", " ")}</span>
          </li>
        ))}
      </ul>
      {evidence.pullRequests.length === 0 && (
        <p className="mt-3 text-[11px] text-zinc-500">No matching production pull request was recorded for this request.</p>
      )}
    </div>
  );
}

function DeploymentIntakeForm({ onCreated, revision }: { onCreated: () => void; revision?: RevisionSeed }) {
  const [draft, setDraft] = useState(() => revision ? draftFromIntake(revision.intake) : initialDraft);
  const [workflowRef, setWorkflowRef] = useState(() => restoredWorkflowRef(revision?.intake.workflowSource, singleGithubRepository(draft.repositoryUrls), workflowFilePath(draft.workflowName)));
  const effectiveWorkflowRef = workflowRef.trim() || draft.sourceBranch.trim();
  const contextRevision = useSyncExternalStore(desktopClient.subscribeContext, desktopClient.getContextRevision, desktopClient.getContextRevision);
  const [sourceObservation, setSourceObservation] = useState(() => ({ value: revision?.intake.workflowSource as unknown, config: desktopClient.config, revision: contextRevision }));
  const workflowSource = sourceObservation.config === desktopClient.config && sourceObservation.revision === contextRevision
    ? matchingWorkflowObservation(sourceObservation.value, singleGithubRepository(draft.repositoryUrls), effectiveWorkflowRef, workflowFilePath(draft.workflowName)) : undefined;
  const recordWorkflowSource = useCallback((value: WorkflowSourceObservation) => setSourceObservation({ value, config: desktopClient.config, revision: contextRevision }), [contextRevision]);
  const [step, setStep] = useState(0);
  const stepHeading = useRef<HTMLParagraphElement>(null);
  const previousStep = useRef(step);
  useLayoutEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    stepHeading.current?.focus();
  }, [step]);
  const [submitting, setSubmitting] = useState(false);
  const submissionFlight = useRef(false), intakeMounted = useRef(true);
  const intakeOwner = useRef({ config: desktopClient.config, revision: desktopClient.getContextRevision() }).current;
  const ownsIntake = () => intakeMounted.current && intakeOwner.config === desktopClient.config && intakeOwner.revision === desktopClient.getContextRevision();
  useEffect(() => { intakeMounted.current = true; return () => { intakeMounted.current = false; }; }, []);
  const [error, setError] = useState<string>();
  const [submissionId] = useState(() => crypto.randomUUID());
  const [workflowInputIssue, setWorkflowInputIssue] = useState<string>();
  const [batchDependency, setBatchDependency] = useState(() => {
    const parsed = releaseAirflowDependencySchema.safeParse(revision?.intake.airflowDependency);
    return parsed.success ? parsed.data : undefined;
  });
  const [batchIssue, setBatchIssue] = useState<string>();
  const completingResolutionDraft = revision?.intake.kind === "resolution_draft";
  const isAdHoc = draft.requestClass === "ad_hoc" || draft.requestClass === "emergency";

  function update<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    if (submissionFlight.current || !ownsIntake()) return;
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submissionFlight.current || !ownsIntake()) return;
    setError(undefined);

    if (workflowInputIssue || batchIssue) { setStep(2); setError(workflowInputIssue ?? batchIssue); return; }

    for (let candidate = 0; candidate < INTAKE_STEPS.length; candidate += 1) {
      const issue = validateStep(candidate, draft);
      if (issue) {
        setStep(candidate);
        setError(issue);
        return;
      }
    }

    let workflowInputs: Record<string, string>;
    try {
      const parsed = JSON.parse(draft.workflowInputs) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
          Object.values(parsed).some((value) => typeof value !== "string")) {
        throw new Error("Workflow inputs must be a JSON object containing string values.");
      }
      workflowInputs = parsed as Record<string, string>;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Workflow inputs are invalid.");
      return;
    }

    const windowStartUtc = localToIso(draft.windowStart);
    const windowEndUtc = localToIso(draft.windowEnd);
    if (!windowStartUtc || !windowEndUtc) {
      setError("Enter a valid deployment-window start and end.");
      return;
    }

    const manualSteps = draft.manualInstruction.trim()
      ? [{
          id: textValue(objectValue(Array.isArray(revision?.intake.manualSteps) ? revision?.intake.manualSteps[0] : undefined).id) || crypto.randomUUID(),
          instruction: draft.manualInstruction.trim(),
          owner: draft.manualOwner.trim(),
          evidenceRequired: true,
          completed: false,
          validationInstruction: draft.manualValidationInstruction.trim(),
        }]
      : [];

    const payload: Record<string, unknown> = {
      title: draft.title,
      serviceImpactingNow: false,
      requestClass: draft.requestClass,
      ...(isAdHoc ? {
        adHocReason: draft.adHocReason,
        adHocPriority: draft.adHocPriority,
        businessImpact: draft.businessImpact,
        scheduleExceptionReason: draft.scheduleExceptionReason,
      } : {}),
      windowStartUtc,
      windowEndUtc,
      displayTimeZone: draft.displayTimeZone,
      changeTypes: [draft.changeType],
      applications: splitLines(draft.applications),
      clients: splitLines(draft.clients),
      deploymentContact: draft.deploymentContact,
      repositoryUrls: splitLines(draft.repositoryUrls),
      productionPrUrls: splitLines(draft.productionPrUrls),
      noPrRequired: draft.noPrRequired,
      prApprovalStatus: draft.noPrRequired ? "not_applicable" : draft.prApprovalStatus,
      sourceBranch: draft.sourceBranch,
      targetBranch: draft.targetBranch,
      deploymentMethod: draft.deploymentMethod,
      workflowName: draft.workflowName,
      targetEnvironment: draft.targetEnvironment,
      workflowInputs,
      ...(batchDependency ? { airflowDependency: batchDependency } : {}),
      ...(workflowSource ? { workflowSource } : {}),
      manualSteps,
      lowerEnvironmentTested: splitLines(draft.lowerEnvironments),
      lowerEnvironmentValidation: "yes",
      developmentReady: draft.developmentReady,
      productionReady: draft.productionReady,
      validationSteps: [
        {
          id: textValue(objectValue(Array.isArray(revision?.intake.validationSteps) ? revision?.intake.validationSteps[0] : undefined).id) || crypto.randomUUID(),
          instruction: draft.validationInstruction,
          owner: draft.validationOwner,
          evidenceRequired: true,
          completed: false,
        },
        ...(draft.functionalValidationRequired ? [{
          id: textValue(objectValue(Array.isArray(revision?.intake.validationSteps) ? revision?.intake.validationSteps[1] : undefined).id) || crypto.randomUUID(),
          instruction: draft.functionalValidationInstruction,
          owner: draft.functionalValidationOwner,
          evidenceRequired: true,
          completed: false,
        }] : []),
      ],
      expectedProductionResult: draft.expectedProductionResult,
      validationOwner: draft.validationOwner,
      ...(draft.deferredValidation ? {
        deferredValidation: {
          reason: draft.deferredReason,
          trigger: draft.deferredTrigger,
          expectedDateUtc: localToIso(draft.deferredDate),
          owner: draft.deferredOwner,
          monitoringPlan: draft.monitoringPlan,
        },
      } : {}),
      rollbackAvailability: draft.rollbackAvailability,
      rollbackSteps: draft.rollbackAvailability === "yes" ? [{
        id: textValue(objectValue(Array.isArray(revision?.intake.rollbackSteps) ? revision?.intake.rollbackSteps[0] : undefined).id) || crypto.randomUUID(),
        instruction: draft.rollbackInstruction,
        owner: draft.rollbackOwner,
        evidenceRequired: true,
        completed: false,
      }] : [],
      rollbackOwner: draft.rollbackOwner || undefined,
      backupRequired: draft.backupRequired,
      backupEvidenceIds: splitLines(draft.backupEvidenceIds),
      changeCreationMethod: draft.changeCreationMethod,
      applicationContact: draft.applicationContact,
      escalationContact: draft.escalationContact,
      facts: [{
        id: textValue(objectValue(Array.isArray(revision?.intake.facts) ? revision?.intake.facts[0] : undefined).id) || crypto.randomUUID(),
        classification: "confirmed",
        value: draft.confirmedFact,
        sourceEvidenceId: draft.sourceEvidenceId,
        confirmedBy: draft.factConfirmedBy,
      }],
    };

    submissionFlight.current = true;
    setSubmitting(true);
    try {
      const result = revision
        ? await desktopClient.reviseDeploymentRequest(revision.id, revision.version, payload)
        : await desktopClient.createDeploymentRequest(payload, submissionId);
      if (!ownsIntake()) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCreated();
    } catch {
      if (ownsIntake()) setError("The save could not be confirmed. Your captured form is retained. Check saved requests before submitting again.");
    } finally {
      submissionFlight.current = false;
      if (ownsIntake()) setSubmitting(false);
    }
  }

  const parsedSource = changeDraftSourceSchema.safeParse(revision?.intake.sourceTicket);
  const source = parsedSource.success ? parsedSource.data : undefined;
  return (
    <form onSubmit={(event) => void submit(event)} aria-busy={submitting} className="glass-card p-5 space-y-5">
      {submitting && <p role="status" className="text-sm text-zinc-300">Saving release details. Editing is paused. Leaving does not cancel this save; check saved requests before starting another.</p>}
      <fieldset disabled={submitting} aria-label="Release intake fields" className="min-w-0 space-y-5 border-0 p-0">
      {revision?.intake.kind === "resolution_draft" && <aside className="rounded-lg border border-white/10 p-3 text-xs text-zinc-300"><p className="font-semibold">Original ticket request</p>{source && <p className="mt-1">{source.provider === "jira" ? "Jira" : "ServiceNow"} · {source.reference}</p>}<p className="mt-1 whitespace-pre-wrap">{textValue(revision.intake.requestDetails)}</p>{textValue(revision.intake.ticketUrl) && <p className="mt-1 break-all">{textValue(revision.intake.ticketUrl)}</p>}<p className="mt-2 text-zinc-500">The original draft remains in the immutable record. Complete every required release control before submission.</p></aside>}
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 data-release-intake-focus tabIndex={-1} className="text-sm font-semibold text-white">{completingResolutionDraft ? "Complete release details for submission" : revision ? `Revise release request · v${revision.version} → v${revision.version + 1}` : "New release request"}</h2>
            <p ref={stepHeading} tabIndex={-1} className="mt-1 text-xs text-zinc-500">Step {step + 1} of {INTAKE_STEPS.length} · {INTAKE_STEPS[step]}</p>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Complete each step before submitting</span>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2" aria-label="Intake progress">
          {INTAKE_STEPS.map((label, index) => (
            <button data-help-id="releases.workspace.intake-step" key={label} type="button" disabled={index > step || submitting} aria-current={index === step ? "step" : undefined} onClick={() => { if (index <= step) { setStep(index); setError(undefined); } }} className={`rounded-lg border px-2 py-2 text-[10px] font-mono transition-colors ${index === step ? "border-white/40 bg-white/10 text-zinc-200" : index < step ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300" : "cursor-default border-white/5 text-zinc-600"}`}>
              {index + 1}. {label}
            </button>
          ))}
        </div>
      </div>

      {step === 0 && <Section title="Change and deployment window">
        <Field label="Request title" value={draft.title} onChange={(value) => update("title", value)} required />
        <SelectField label="Request class" value={draft.requestClass} onChange={(value) => update("requestClass", value)}
          options={["planned_biweekly_release", "planned_release", "ad_hoc", "emergency", "maintenance", "other"]} />
        {isAdHoc && (
          <>
            <Field label="Reason" value={draft.adHocReason} onChange={(value) => update("adHocReason", value)} required />
            <Field label="Priority" value={draft.adHocPriority} onChange={(value) => update("adHocPriority", value)} required />
            <Field label="Business impact" value={draft.businessImpact} onChange={(value) => update("businessImpact", value)} required />
            <Field label="Schedule exception" value={draft.scheduleExceptionReason} onChange={(value) => update("scheduleExceptionReason", value)} required />
          </>
        )}
        <Field label="Window start" type="datetime-local" value={draft.windowStart} onChange={(value) => update("windowStart", value)} required />
        <Field label="Window end" type="datetime-local" value={draft.windowEnd} onChange={(value) => update("windowEnd", value)} required />
        <SelectField label="Display time zone" value={draft.displayTimeZone} onChange={(value) => update("displayTimeZone", value)}
          options={["ET", "CT", "MT", "PT", "UTC", "Other"]} />
        <SelectField label="Change type" value={draft.changeType} onChange={(value) => update("changeType", value)}
          options={["enhancement", "new_feature", "new_client_implementation", "configuration_change", "infrastructure_change", "database_change", "security_image_refresh", "credential_rotation", "workflow_change", "manual_configuration", "bug_fix", "other"]} />
      </Section>}

      {step === 1 && <Section title="Scope, ownership, and source control">
        <Field label="Applications (comma or line separated)" value={draft.applications} onChange={(value) => update("applications", value)} required />
        <Field label="Clients (comma or line separated)" value={draft.clients} onChange={(value) => update("clients", value)} required />
        <Field label="Deployment owner" value={draft.deploymentContact} onChange={(value) => update("deploymentContact", value)} required />
        <Field label="Application owner" value={draft.applicationContact} onChange={(value) => update("applicationContact", value)} required />
        <Field label="Escalation owner" value={draft.escalationContact} onChange={(value) => update("escalationContact", value)} required />
        <Field label="Repository URLs" value={draft.repositoryUrls} onChange={(value) => update("repositoryUrls", value)} required />
        <Check label="No production PR required" checked={draft.noPrRequired} onChange={(value) => update("noPrRequired", value)} />
        {!draft.noPrRequired && (
          <>
            <Field label="Production PR URLs" value={draft.productionPrUrls} onChange={(value) => update("productionPrUrls", value)} required />
            <SelectField label="PR approval" value={draft.prApprovalStatus} onChange={(value) => update("prApprovalStatus", value)}
              options={["pending", "approved"]} />
          </>
        )}
        <Field label="Source branch" value={draft.sourceBranch} onChange={(value) => update("sourceBranch", value)} required />
        <Field label="Target branch" value={draft.targetBranch} onChange={(value) => update("targetBranch", value)} required />
      </Section>}

      <div hidden={step !== 2}><Section title="Production trigger and exact execution">
        <Field label="Deployment method" value={draft.deploymentMethod} onChange={(value) => update("deploymentMethod", value)} required />
        <Field label="Workflow name / trigger" value={draft.workflowName} onChange={(value) => update("workflowName", value)} required />
        <Field label="Target environment" value={draft.targetEnvironment} onChange={(value) => update("targetEnvironment", value)} required />
        <Field label="Workflow source ref (branch or tag)" value={workflowRef} onChange={setWorkflowRef} />
        <p className="text-xs text-zinc-400">Leave blank to use the source branch. For a protected-tag deployment, enter the exact tag and read its workflow fields again. This does not change the PR source branch.</p>
        <WorkflowCatalogue repositoryFullName={singleGithubRepository(draft.repositoryUrls)} refName={effectiveWorkflowRef} workflowPath={workflowFilePath(draft.workflowName)} onSelect={(path) => update("workflowName", path)} />
        <WorkflowDefinitionInputs repositoryFullName={singleGithubRepository(draft.repositoryUrls)} refName={effectiveWorkflowRef} workflowPath={workflowFilePath(draft.workflowName)} value={draft.workflowInputs} onChange={(value) => update("workflowInputs", value)} onIssueChange={setWorkflowInputIssue} onSourceChange={recordWorkflowSource} />
        <ReleaseBatchSelection value={batchDependency} onChange={setBatchDependency} onIssueChange={setBatchIssue} />
        <TextArea label="Optional manual instruction" value={draft.manualInstruction} onChange={(value) => update("manualInstruction", value)} />
        {draft.manualInstruction && (
          <>
            <Field label="Manual-step owner" value={draft.manualOwner} onChange={(value) => update("manualOwner", value)} required />
            <TextArea label="How to validate the manual step" value={draft.manualValidationInstruction} onChange={(value) => update("manualValidationInstruction", value)} required />
          </>
        )}
      </Section></div>

      {step === 3 && <Section title="Readiness and production validation">
        <Field label="Tested lower environments" value={draft.lowerEnvironments} onChange={(value) => update("lowerEnvironments", value)} required />
        <Check label="Development ready" checked={draft.developmentReady} onChange={(value) => update("developmentReady", value)} />
        <Check label="Production ready" checked={draft.productionReady} onChange={(value) => update("productionReady", value)} />
        <TextArea label="Exact technical production validation" value={draft.validationInstruction} onChange={(value) => update("validationInstruction", value)} required />
        <SelectField label="Technical validation owner" value={draft.validationOwner} onChange={(value) => update("validationOwner", value)}
          options={["devops", "application_team", "shared", "l1", "dba", "other"]} />
        <Check label="Application-specific functional validation required" checked={draft.functionalValidationRequired} onChange={(value) => update("functionalValidationRequired", value)} />
        {draft.functionalValidationRequired && (
          <>
            <TextArea label="Exact functional validation instruction" value={draft.functionalValidationInstruction} onChange={(value) => update("functionalValidationInstruction", value)} required />
            <SelectField label="Functional validation owner" value={draft.functionalValidationOwner} onChange={(value) => update("functionalValidationOwner", value)}
              options={["application_team", "devops", "shared", "l1", "dba", "other"]} />
          </>
        )}
        <TextArea label="Expected production result" value={draft.expectedProductionResult} onChange={(value) => update("expectedProductionResult", value)} required />
        <Check label="Validation must be deferred" checked={draft.deferredValidation} onChange={(value) => update("deferredValidation", value)} />
        {draft.deferredValidation && (
          <>
            <Field label="Deferral reason" value={draft.deferredReason} onChange={(value) => update("deferredReason", value)} required />
            <Field label="Follow-up trigger" value={draft.deferredTrigger} onChange={(value) => update("deferredTrigger", value)} required />
            <Field label="Expected follow-up date" type="datetime-local" value={draft.deferredDate} onChange={(value) => update("deferredDate", value)} required />
            <Field label="Follow-up owner" value={draft.deferredOwner} onChange={(value) => update("deferredOwner", value)} required />
            <TextArea label="Monitoring plan" value={draft.monitoringPlan} onChange={(value) => update("monitoringPlan", value)} required />
          </>
        )}
      </Section>}

      {step === 4 && <Section title="Rollback, backup, change, and source evidence">
        <SelectField label="Rollback availability" value={draft.rollbackAvailability} onChange={(value) => update("rollbackAvailability", value)}
          options={["yes", "no", "not_applicable"]} />
        {draft.rollbackAvailability === "yes" && (
          <>
            <TextArea label="Exact rollback instruction" value={draft.rollbackInstruction} onChange={(value) => update("rollbackInstruction", value)} required />
            <Field label="Rollback owner" value={draft.rollbackOwner} onChange={(value) => update("rollbackOwner", value)} required />
          </>
        )}
        <Check label="Backup required" checked={draft.backupRequired} onChange={(value) => update("backupRequired", value)} />
        {draft.backupRequired && <Field label="Backup evidence identifiers" value={draft.backupEvidenceIds} onChange={(value) => update("backupEvidenceIds", value)} required />}
        <SelectField label="Change creation" value={draft.changeCreationMethod} onChange={(value) => update("changeCreationMethod", value)}
          options={["rca_workflow", "dbployer_automatic", "manual_servicenow", "existing_change", "not_applicable", "other"]} />
        <TextArea label="Confirmed operational fact" value={draft.confirmedFact} onChange={(value) => update("confirmedFact", value)} required />
        <Field label="Source evidence identifier" value={draft.sourceEvidenceId} onChange={(value) => update("sourceEvidenceId", value)} required />
        <Field label="Confirmed by" value={draft.factConfirmedBy} onChange={(value) => update("factConfirmedBy", value)} required />
      </Section>}

      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <button data-help-id="releases.workspace.intake-back" type="button" disabled={step === 0 || submitting} onClick={() => { setStep((current) => Math.max(0, current - 1)); setError(undefined); }} className="btn-secondary disabled:opacity-40">Back</button>
        <p className="text-xs text-zinc-500">{completingResolutionDraft ? "This submits the completed release request and preserves the original draft. It does not deploy." : revision ? "Saves a new version and keeps the request history. It does not deploy." : "Saves this request to your workspace. It does not deploy."}</p>
        {step < INTAKE_STEPS.length - 1 ? (
          <button data-help-id="releases.workspace.intake-continue" key="continue-step" type="button" className="btn-primary" onClick={(event) => {
            event.preventDefault();
            const issue = (step === 2 ? workflowInputIssue ?? batchIssue : undefined) ?? validateStep(step, draft);
            if (issue) { setError(issue); return; }
            setError(undefined);
            setStep((current) => Math.min(INTAKE_STEPS.length - 1, current + 1));
          }}>Continue</button>
        ) : (
          <button data-help-id="releases.workspace.intake-submit" key="submit-request" type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? (completingResolutionDraft ? "Submitting…" : revision ? "Saving revision…" : "Submitting…") : (completingResolutionDraft ? "Submit completed request" : revision ? "Save revision" : "Submit release request")}
          </button>
        )}
      </div>
      </fieldset>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid grid-cols-2 gap-3 border border-white/5 rounded-xl p-4">
      <legend className="px-2 text-xs font-semibold text-zinc-200">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({ label, value, onChange, required, type = "text" }: {
  label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string;
}) {
  return (
    <label className="text-xs text-zinc-400 space-y-1">
      <span>{label}</span>
      <input data-help-id="releases.workspace.text-field" className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white"
        type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange, required }: {
  label: string; value: string; onChange: (value: string) => void; required?: boolean;
}) {
  return (
    <label className="text-xs text-zinc-400 space-y-1 col-span-2">
      <span>{label}</span>
      <textarea data-help-id="releases.workspace.multiline-field" className="w-full min-h-20 rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white font-mono"
        value={value} required={required} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (value: string) => void; options: string[];
}) {
  return (
    <label className="text-xs text-zinc-400 space-y-1">
      <span>{label}</span>
      <select data-help-id="releases.workspace.select-field" className="w-full rounded-lg bg-zinc-950 border border-white/10 px-3 py-2 text-sm text-white"
        value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
      </select>
    </label>
  );
}

function Check({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-300 py-2">
      <input data-help-id="releases.workspace.checkbox-field" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function StateCard({ children, tone = "normal" }: {
  children: React.ReactNode; tone?: "normal" | "error";
}) {
  return (
    <div className={`glass-card p-5 text-sm border ${tone === "error" ? "text-rose-300 border-rose-500/20" : "text-zinc-400 border-white/5"}`}>
      {children}
    </div>
  );
}
