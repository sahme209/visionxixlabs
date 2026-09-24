"use client";

import { useMemo, useState } from "react";
import {
  generatePlaybook,
  validateIntake,
  type DeploymentIntake,
  type DeploymentPlaybook,
} from "@/lib/tauri/deploymentOperations";

const fictionalIntake: DeploymentIntake = {
  id: "TAURI-DEMO-001",
  tenantId: "fictional-northstar",
  title: "Northstar checkout configuration release",
  serviceImpactingNow: false,
  requestClass: "planned_release",
  windowStartUtc: "2026-10-10T18:00:00.000Z",
  windowEndUtc: "2026-10-10T20:00:00.000Z",
  displayTimeZone: "ET",
  changeTypes: ["configuration_change"],
  applications: ["Northstar Checkout"],
  clients: ["Sample Client A"],
  deploymentContact: "release.operator@example.test",
  repositoryUrls: ["https://git.example.test/demo/checkout-config"],
  productionPrUrls: ["https://git.example.test/demo/checkout-config/pull/42"],
  noPrRequired: false,
  prApprovalStatus: "approved",
  sourceBranch: "release/demo",
  targetBranch: "main",
  deploymentMethod: "GitHub Actions Manual Workflow",
  workflowName: "Deploy Config",
  targetEnvironment: "Production",
  workflowInputs: { branch: "main", environment: "Production", client: "Sample Client A" },
  manualSteps: [],
  lowerEnvironmentTested: ["Stage"],
  lowerEnvironmentValidation: "yes",
  developmentReady: true,
  productionReady: true,
  validationSteps: [{
    id: "validation-1",
    instruction: "Confirm the approved configuration exists at Data / Version 2 / Settings.",
    owner: "application_team",
    evidenceRequired: true,
    completed: false,
  }],
  expectedProductionResult: "Production configuration matches the approved pull request.",
  validationOwner: "shared",
  deferredValidation: {
    reason: "Full behavior requires the next fictional client file.",
    trigger: "Next scheduled input file",
    expectedDateUtc: "2026-10-11T14:00:00.000Z",
    owner: "application.sme@example.test",
    monitoringPlan: "Monitor workflow completion and the next batch alert.",
  },
  rollbackAvailability: "yes",
  rollbackSteps: [{
    id: "rollback-1",
    instruction: "Redeploy the prior known-good configuration revision.",
    owner: "devops",
    evidenceRequired: true,
    completed: false,
  }],
  rollbackOwner: "release.operator@example.test",
  backupRequired: false,
  backupEvidenceIds: [],
  changeCreationMethod: "manual_servicenow",
  applicationContact: "application.sme@example.test",
  escalationContact: "incident.commander@example.test",
  facts: [{
    id: "fact-1",
    classification: "confirmed",
    value: "Publishing the workflow is a manual production action.",
    sourceEvidenceId: "demo-evidence-1",
    confirmedBy: "repository.owner@example.test",
  }],
};

const modules = [
  ["Intake Requests", "Dynamic planned, ad hoc, support, and incident routing"],
  ["Deployments", "Versioned playbooks and guided production execution"],
  ["Change Requests", "Automatic, RCA/compliance, manual, and existing changes"],
  ["Approvals", "Peer, Code Owner, IT, business, leadership, and environment gates"],
  ["Repository Catalog", "Per-repository trigger, permission, validation, and rollback behavior"],
  ["Access Matrix", "Approval, merge, workflow, environment, database, and platform capabilities"],
  ["KT Sessions", "Transcript evidence, sourced facts, questions, access gaps, and readiness"],
  ["Evidence", "Screenshots, logs, SQL output, workflow runs, validation, and audit packages"],
  ["Integrations", "Explicit mock, sandbox, read, and approved write modes"],
  ["Reports", "Success, wait time, access gaps, validation, rollback, KT, and open items"],
];

const statusTone: Record<string, string> = {
  pending: "border-zinc-700 bg-zinc-900 text-zinc-300",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  blocked: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  skipped: "border-amber-500/30 bg-amber-500/10 text-amber-200",
};

export default function TauriDashboardPage() {
  const [intake, setIntake] = useState<DeploymentIntake>(fictionalIntake);
  const [playbook, setPlaybook] = useState<DeploymentPlaybook | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const issues = useMemo(() => validateIntake(intake), [intake]);
  const inputClass = "mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-violet-400";
  const labelClass = "text-[11px] font-mono uppercase tracking-wider text-zinc-400";

  function createPlaybook() {
    if (issues.length) return;
    setPlaybook(generatePlaybook(intake, new Date().toISOString()));
    setCurrentStep(0);
  }

  function completeCurrentStep() {
    if (!playbook) return;
    const steps = playbook.steps.map((step, index) =>
      index === currentStep ? { ...step, status: "completed" as const } : step,
    );
    setPlaybook({ ...playbook, steps });
    setCurrentStep(Math.min(currentStep + 1, steps.length - 1));
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-white/[0.025] to-cyan-500/5 p-6">
        <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-violet-300">TAURI · Deployment Operations</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">The request becomes the playbook.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
              Govern intake, access, approvals, change control, execution, validation, rollback, evidence, and knowledge transfer without silently inventing production details.
            </p>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
            Sanitized demo mode
          </span>
        </div>
      </header>

      <section aria-labelledby="module-heading">
        <h2 id="module-heading" className="mb-3 text-xs font-mono uppercase tracking-wider text-zinc-500">Operations modules</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {modules.map(([name, description]) => (
            <article key={name} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <h3 className="text-sm font-semibold text-white">{name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5" aria-labelledby="intake-heading">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-cyan-300">Step 1 · Intake</p>
              <h2 id="intake-heading" className="mt-1 text-xl font-semibold text-white">Deployment request</h2>
            </div>
            <span className="text-xs text-zinc-500">{issues.length ? `${issues.length} blockers` : "Ready to submit"}</span>
          </div>

          <fieldset className="mt-5 rounded-xl border border-white/[0.07] p-4">
            <legend className="px-2 text-sm font-medium text-white">Is something broken right now or impacting service?</legend>
            <div className="mt-2 flex gap-2">
              {[false, true].map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  aria-pressed={intake.serviceImpactingNow === value}
                  onClick={() => setIntake({ ...intake, serviceImpactingNow: value })}
                  className={`rounded-lg border px-3 py-2 text-sm ${intake.serviceImpactingNow === value ? "border-violet-400 bg-violet-500/15 text-white" : "border-white/10 text-zinc-400"}`}
                >
                  {value ? "Yes — incident/support" : "No — planned request"}
                </button>
              ))}
            </div>
          </fieldset>

          {intake.serviceImpactingNow ? (
            <div role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
              Active service impact is routed to incident/support. A planned production playbook cannot be submitted from this path.
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>Request classification
                <select className={inputClass} value={intake.requestClass} onChange={(event) => setIntake({ ...intake, requestClass: event.target.value as DeploymentIntake["requestClass"] })}>
                  <option value="planned_biweekly_release">Planned Biweekly Release</option>
                  <option value="planned_release">Planned Release</option>
                  <option value="ad_hoc">Ad Hoc</option>
                  <option value="emergency">Emergency</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className={labelClass}>Application / service
                <input className={inputClass} value={intake.applications.join(", ")} onChange={(event) => setIntake({ ...intake, applications: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} />
              </label>
              <label className={labelClass}>Window start · stored UTC
                <input type="datetime-local" className={inputClass} value={intake.windowStartUtc.slice(0, 16)} onChange={(event) => setIntake({ ...intake, windowStartUtc: new Date(event.target.value).toISOString() })} />
              </label>
              <label className={labelClass}>Window end · stored UTC
                <input type="datetime-local" className={inputClass} value={intake.windowEndUtc.slice(0, 16)} onChange={(event) => setIntake({ ...intake, windowEndUtc: new Date(event.target.value).toISOString() })} />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>Repository URL
                <input type="url" className={inputClass} value={intake.repositoryUrls[0]} onChange={(event) => setIntake({ ...intake, repositoryUrls: [event.target.value] })} />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>Production PR URL
                <input type="url" className={inputClass} value={intake.productionPrUrls[0]} onChange={(event) => setIntake({ ...intake, productionPrUrls: [event.target.value] })} />
              </label>
              <label className={labelClass}>Workflow / action
                <input className={inputClass} value={intake.workflowName} onChange={(event) => setIntake({ ...intake, workflowName: event.target.value })} />
              </label>
              <label className={labelClass}>Target environment
                <input className={inputClass} value={intake.targetEnvironment} onChange={(event) => setIntake({ ...intake, targetEnvironment: event.target.value })} />
              </label>
            </div>
          )}

          {issues.length > 0 && (
            <div className="mt-4" role="alert" aria-live="polite">
              <p className="text-xs font-semibold text-rose-200">Submission blockers</p>
              <ul className="mt-2 space-y-1 text-xs text-rose-200/80">
                {issues.map((issue) => <li key={`${issue.code}-${issue.field}`}>• {issue.message}</li>)}
              </ul>
            </div>
          )}

          <button type="button" disabled={issues.length > 0} onClick={createPlaybook} className="mt-5 w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40">
            Validate and generate versioned playbook
          </button>
        </section>

        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5" aria-labelledby="run-heading">
          <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-300">Step 2 · Guided run</p>
          <h2 id="run-heading" className="mt-1 text-xl font-semibold text-white">Production execution</h2>
          {!playbook ? (
            <div className="mt-5 rounded-xl border border-dashed border-white/10 p-8 text-center">
              <p className="text-sm text-zinc-400">Complete the intake to generate an executable playbook.</p>
              <p className="mt-2 text-xs text-zinc-600">No production action is performed automatically.</p>
            </div>
          ) : (
            <div className="mt-5">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Metric label="Version" value={String(playbook.version)} />
                <Metric label="Steps" value={String(playbook.steps.length)} />
                <Metric label="Completed" value={String(playbook.steps.filter((step) => step.status === "completed").length)} />
              </div>
              <div className="mt-4 rounded-xl border border-violet-500/25 bg-violet-500/10 p-4">
                <p className="text-[10px] font-mono uppercase tracking-wider text-violet-300">Current step · {currentStep + 1} of {playbook.steps.length}</p>
                <h3 className="mt-2 text-lg font-semibold text-white">{playbook.steps[currentStep].title}</h3>
                <p className="mt-2 text-sm text-zinc-300">{playbook.steps[currentStep].instructions}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div><dt className="text-zinc-500">Required role</dt><dd className="mt-1 text-white">{playbook.steps[currentStep].requiredRole}</dd></div>
                  <div><dt className="text-zinc-500">Evidence</dt><dd className="mt-1 text-white">{playbook.steps[currentStep].evidenceRequired ? "Required" : "Optional"}</dd></div>
                </dl>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={completeCurrentStep} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-black hover:bg-emerald-400">Confirm complete</button>
                  <button type="button" onClick={() => setPlaybook({ ...playbook, steps: playbook.steps.map((step, index) => index === currentStep ? { ...step, status: "blocked" } : step) })} className="rounded-lg border border-rose-500/30 px-3 py-2 text-xs text-rose-200">Block & escalate</button>
                </div>
              </div>
              <ol className="mt-4 max-h-[340px] space-y-2 overflow-auto pr-1">
                {playbook.steps.map((step, index) => (
                  <li key={step.id}>
                    <button type="button" onClick={() => setCurrentStep(index)} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${statusTone[step.status]} ${index === currentStep ? "ring-1 ring-violet-400" : ""}`}>
                      <span className="font-mono text-xs">{String(step.order).padStart(2, "0")}</span>
                      <span className="flex-1 text-xs font-medium">{step.title}</span>
                      <span className="text-[9px] font-mono uppercase">{step.status}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/20 p-3">
      <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
    </div>
  );
}
