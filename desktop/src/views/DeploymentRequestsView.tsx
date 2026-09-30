import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ViewShell } from "../components/Primitives";
import { desktopClient } from "../lib/desktopClient";

interface RequestSummary {
  id: string;
  title: string;
  status: string;
  version: number;
  correlationId: string;
  submittedAt: string | null;
  updatedAt: string;
  latestPlaybook: {
    id: string;
    version: number;
    status: string;
    contentHash: string;
    createdAt: string;
  } | null;
}

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
  targetEnvironment: "Production",
  workflowInputs: "{\n  \"environment\": \"Production\"\n}",
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

export function DeploymentRequestsView() {
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [lastSuccessfulLoadAt, setLastSuccessfulLoadAt] = useState<Date>();
  const [showForm, setShowForm] = useState(false);
  const [generatingRequestId, setGeneratingRequestId] = useState<string>();
  const [generatedPlaybooks, setGeneratedPlaybooks] = useState<Record<string, GeneratedPlaybook>>({});
  const [generationErrors, setGenerationErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    const result = await desktopClient.deploymentRequests();
    if (result.ok) {
      setRequests(result.data);
      setLastSuccessfulLoadAt(new Date());
    } else setLoadError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    desktopClient.deploymentRequests().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setRequests(result.data);
        setLastSuccessfulLoadAt(new Date());
      } else setLoadError(result.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  async function generatePlaybook(requestId: string) {
    setGeneratingRequestId(requestId);
    setGenerationErrors((current) => {
      const next = { ...current };
      delete next[requestId];
      return next;
    });
    const result = await desktopClient.generateDeploymentPlaybook(requestId);
    setGeneratingRequestId(undefined);
    if (!result.ok) {
      setGenerationErrors((current) => ({ ...current, [requestId]: result.error }));
      return;
    }
    setGeneratedPlaybooks((current) => ({ ...current, [requestId]: result.data }));
  }

  return (
    <ViewShell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Deployment requests</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Capture the change once, then generate and execute a governed, versioned playbook.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="btn-secondary">
            Refresh
          </button>
          <button type="button" onClick={() => setShowForm((value) => !value)} className="btn-primary">
            {showForm ? "Cancel intake" : "New request"}
          </button>
        </div>
      </div>

      {showForm && (
        <DeploymentIntakeForm
          onCreated={() => {
            setShowForm(false);
            void load();
          }}
        />
      )}

      {lastSuccessfulLoadAt && (
        <p role="status" className="text-[11px] text-zinc-500">
          Service last responded {lastSuccessfulLoadAt.toLocaleString()}.
        </p>
      )}
      {loading && requests.length === 0 && <StateCard>Loading current workspace requests…</StateCard>}
      {!loading && loadError && (
        <StateCard tone="error">
          {requests.length > 0
            ? `Refresh failed: ${loadError}. Showing the last successfully loaded records; they may be stale.`
            : `Could not load deployment requests: ${loadError}. Nothing has been simulated.`}
        </StateCard>
      )}
      {!loading && !loadError && requests.length === 0 && (
        <StateCard>
          No deployment requests exist in this workspace. Start a request to capture scope,
          authority, production trigger, validation, evidence, and rollback requirements.
        </StateCard>
      )}
      {requests.length > 0 && (
        <div className="space-y-2">
          {requests.map((request) => (
            <div key={request.id} className="glass-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{request.title}</p>
                  <p className="text-[10px] font-mono text-zinc-500 mt-1">
                    {request.id} · version {request.version} · correlation {request.correlationId}
                  </p>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border border-violet-500/25 bg-violet-500/10 text-violet-200">
                  {request.status.replaceAll("_", " ")}
                </span>
              </div>
              <div className="flex items-end justify-between gap-3 mt-3">
                <p className="text-xs text-zinc-500">
                  Request updated {new Date(request.updatedAt).toLocaleString()}.
                </p>
                <button
                  type="button"
                  className="btn-secondary disabled:opacity-50"
                  disabled={generatingRequestId === request.id}
                  onClick={() => void generatePlaybook(request.id)}
                >
                  {generatingRequestId === request.id ? "Generating…" : "Generate next playbook"}
                </button>
              </div>
              {request.latestPlaybook && !generatedPlaybooks[request.id] && (
                <div className="mt-3 rounded-lg border border-violet-500/15 bg-violet-500/5 px-3 py-2">
                  <p className="text-xs text-violet-100">
                    Latest persisted playbook: v{request.latestPlaybook.version} · {request.latestPlaybook.status.replaceAll("_", " ")}
                  </p>
                  <p className="text-[10px] font-mono text-zinc-500 mt-1 break-all">
                    SHA-256 {request.latestPlaybook.contentHash} · stored {new Date(request.latestPlaybook.createdAt).toLocaleString()}
                  </p>
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
                  <p className="text-xs text-amber-200/80 mt-3">
                    Generated and audited only. No merge, dispatch, release, or environment approval was performed.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ViewShell>
  );
}

function DeploymentIntakeForm({ onCreated }: { onCreated: () => void }) {
  const [draft, setDraft] = useState(initialDraft);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [submissionId] = useState(() => crypto.randomUUID());
  const isAdHoc = draft.requestClass === "ad_hoc" || draft.requestClass === "emergency";

  function update<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);

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
          id: crypto.randomUUID(),
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
      manualSteps,
      lowerEnvironmentTested: splitLines(draft.lowerEnvironments),
      lowerEnvironmentValidation: "yes",
      developmentReady: draft.developmentReady,
      productionReady: draft.productionReady,
      validationSteps: [
        {
          id: crypto.randomUUID(),
          instruction: draft.validationInstruction,
          owner: draft.validationOwner,
          evidenceRequired: true,
          completed: false,
        },
        ...(draft.functionalValidationRequired ? [{
          id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
        classification: "confirmed",
        value: draft.confirmedFact,
        sourceEvidenceId: draft.sourceEvidenceId,
        confirmedBy: draft.factConfirmedBy,
      }],
    };

    setSubmitting(true);
    const result = await desktopClient.createDeploymentRequest(payload, submissionId);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated();
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="glass-card p-5 space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">New governed deployment request</p>
            <p className="mt-1 text-xs text-zinc-500">Step {step + 1} of {INTAKE_STEPS.length} · {INTAKE_STEPS[step]}</p>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Required controls stay visible in sequence</span>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2" aria-label="Intake progress">
          {INTAKE_STEPS.map((label, index) => (
            <button key={label} type="button" onClick={() => { if (index <= step) { setStep(index); setError(undefined); } }} className={`rounded-lg border px-2 py-2 text-[10px] font-mono transition-colors ${index === step ? "border-violet-500/40 bg-violet-500/10 text-violet-200" : index < step ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300" : "cursor-default border-white/5 text-zinc-600"}`}>
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

      {step === 2 && <Section title="Production trigger and exact execution">
        <Field label="Deployment method" value={draft.deploymentMethod} onChange={(value) => update("deploymentMethod", value)} required />
        <Field label="Workflow name / trigger" value={draft.workflowName} onChange={(value) => update("workflowName", value)} required />
        <Field label="Target environment" value={draft.targetEnvironment} onChange={(value) => update("targetEnvironment", value)} required />
        <TextArea label="Immutable workflow inputs (JSON string values)" value={draft.workflowInputs} onChange={(value) => update("workflowInputs", value)} required />
        <TextArea label="Optional manual instruction" value={draft.manualInstruction} onChange={(value) => update("manualInstruction", value)} />
        {draft.manualInstruction && (
          <>
            <Field label="Manual-step owner" value={draft.manualOwner} onChange={(value) => update("manualOwner", value)} required />
            <TextArea label="How to validate the manual step" value={draft.manualValidationInstruction} onChange={(value) => update("manualValidationInstruction", value)} required />
          </>
        )}
      </Section>}

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
        <button type="button" disabled={step === 0 || submitting} onClick={() => { setStep((current) => Math.max(0, current - 1)); setError(undefined); }} className="btn-secondary disabled:opacity-40">Back</button>
        <p className="text-xs text-zinc-500">This creates a tenant-scoped record and audit event. It does not deploy.</p>
        {step < INTAKE_STEPS.length - 1 ? (
          <button type="button" className="btn-primary" onClick={() => {
            const issue = validateStep(step, draft);
            if (issue) { setError(issue); return; }
            setError(undefined);
            setStep((current) => Math.min(INTAKE_STEPS.length - 1, current + 1));
          }}>Continue</button>
        ) : (
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
            {submitting ? "Submitting…" : "Submit governed request"}
          </button>
        )}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid grid-cols-2 gap-3 border border-white/5 rounded-xl p-4">
      <legend className="px-2 text-xs font-semibold text-violet-200">{title}</legend>
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
      <input className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white"
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
      <textarea className="w-full min-h-20 rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white font-mono"
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
      <select className="w-full rounded-lg bg-zinc-950 border border-white/10 px-3 py-2 text-sm text-white"
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
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
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
