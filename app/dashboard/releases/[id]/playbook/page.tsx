"use client";

/**
 * /dashboard/releases/[id]/playbook — Phase TBD.
 *
 * Unified release playbook with progressive disclosure:
 * - Tab 1: WHAT IS HAPPENING? (glanceable status of all 9 stages)
 * - Tab 2: WHAT NEEDS ATTENTION? (critical items only)
 * - Tab 3: WHAT CHANGED? (revision history + audit trail)
 *
 * Makes the Playbook the center: Request → Readiness → Playbook → Risk →
 * Approval → Execution → Validation → Evidence → Closure.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { ReleasePlaybookStageCard } from "@/components/dashboard/ReleasePlaybookStageCard";

interface PlaybookData {
  id: string;
  releaseTag: string | null;
  commitSha: string | null;
  status: string;
  lifecycle: Record<string, string | null>;
  request: Record<string, unknown>;
  readiness: Record<string, unknown>;
  playbook: Record<string, unknown>;
  risk: Record<string, unknown>;
  approval: Record<string, unknown>;
  execution: Record<string, unknown>;
  validation: Record<string, unknown>;
  evidence: Record<string, unknown>;
  closure: Record<string, unknown>;
  auditEventCount: number;
  lastUpdated: string;
}

type Tab = "what" | "attention" | "changed";

/** Stage counts may arrive as a plain number or as a DataSourceState
 * ({ available: false, reason }) when the backing model doesn't exist yet.
 * Stringifying the object directly would render "[object Object]". */
function describeCount(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && "available" in value && (value as { available: unknown }).available === false) {
    return "Preview";
  }
  return "—";
}

/** Same DataSourceState unwrap as describeCount, but as a number for
 * arithmetic/comparison — null means "not yet evaluated," never 0. */
function requiredCount(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

interface GithubEvidenceCounts {
  pullRequestCount: number;
  workflowRunsTotal: number;
  workflowRunsSucceeded: number;
  workflowRunsFailed: number;
}

function isGithubEvidenceCounts(value: unknown): value is GithubEvidenceCounts {
  return !!value && typeof value === "object" && "pullRequestCount" in value;
}

function describeGithubEvidence(value: unknown): string {
  if (isGithubEvidenceCounts(value)) {
    return `${value.pullRequestCount} PR${value.pullRequestCount === 1 ? "" : "s"} · ${value.workflowRunsSucceeded}/${value.workflowRunsTotal} workflow runs passed`;
  }
  return "Not bound";
}

export default function UnifiedPlaybookPage() {
  const params = useParams();
  const releaseId = String(params.id);
  const [data, setData] = useState<PlaybookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("what");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/release-playbook/${encodeURIComponent(releaseId)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: PlaybookData; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setData(j.data);
        else setError(j.error?.userMessage ?? "Failed to load playbook");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Network error"))
      .finally(() => setLoading(false));
  }, [releaseId]);

  return (
    <div className="relative">
      {/* Navigation */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <Link href="/dashboard/releases" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-white">
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          All releases
        </Link>
      </div>

      {/* Header */}
      {data && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
            <h1 className="text-[24px] font-bold text-white">
              {data.releaseTag ?? "(Untagged Release)"}
            </h1>
            <span className="text-[11px] font-mono uppercase px-2 py-1 rounded bg-white/5 border border-white/[0.08] text-zinc-300">
              {data.status}
            </span>
          </div>
          {data.commitSha && (
            <p className="text-[11px] font-mono text-zinc-500">
              sha {data.commitSha.slice(0, 12)}…
            </p>
          )}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-white/[0.06]">
        <button
          onClick={() => setTab("what")}
          className={`px-3 py-2 text-[12px] font-semibold border-b-2 transition ${
            tab === "what"
              ? "border-violet-400 text-white"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          What is happening?
        </button>
        <button
          onClick={() => setTab("attention")}
          className={`px-3 py-2 text-[12px] font-semibold border-b-2 transition ${
            tab === "attention"
              ? "border-violet-400 text-white"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          What needs attention?
        </button>
        <button
          onClick={() => setTab("changed")}
          className={`px-3 py-2 text-[12px] font-semibold border-b-2 transition ${
            tab === "changed"
              ? "border-violet-400 text-white"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          What changed?
        </button>
      </div>

      {/* Content */}
      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-[12px] text-zinc-400">
          Loading playbook…
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {data && !loading && !error && (
        <>
          {tab === "what" && (
            <div className="space-y-4">
              <p className="text-[12px] text-zinc-400">
                All 9 stages of your release journey. Click any stage to expand details.
              </p>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <ReleasePlaybookStageCard
                  stage="request"
                  status={data.request.summary ? "complete" : "pending"}
                  title="Request"
                  description={data.request.summary as string | null}
                  facts={[
                    { label: "Requested", value: `${new Date(data.lifecycle.requestedAt!).toLocaleDateString()}` },
                    { label: "Owner", value: (data.request.owner as string) || "—" },
                    { label: "Environment", value: (data.request.targetEnvironment as string) || "—" },
                  ]}
                  detailLink={`#request`}
                />
                <ReleasePlaybookStageCard
                  stage="readiness"
                  status={!data.readiness.evaluatedAt ? "pending" : (data.readiness.blockerCount as number) > 0 ? "warning" : "complete"}
                  title="Readiness"
                  description={!data.readiness.evaluatedAt ? "Not yet evaluated" : `Score: ${data.readiness.overallScore}/100 (${data.readiness.riskLevel})`}
                  facts={[
                    { label: "Score", value: data.readiness.evaluatedAt ? `${data.readiness.overallScore}/100` : "—" },
                    { label: "Risk", value: data.readiness.riskLevel as string },
                    { label: "Blockers", value: data.readiness.evaluatedAt ? `${data.readiness.blockerCount}` : "—" },
                  ]}
                  detailLink={`#readiness`}
                />
                <ReleasePlaybookStageCard
                  stage="playbook"
                  status={(data.playbook.policyViolationCount as unknown as number) > 0 ? "error" : "pending"}
                  title="Playbook"
                  description={`${describeCount(data.playbook.stepCount)} steps`}
                  facts={[
                    { label: "Steps", value: describeCount(data.playbook.stepCount) },
                    { label: "Cherry-picks", value: `${data.playbook.cherryPickCount}` },
                    { label: "Violations", value: `${data.playbook.policyViolationCount}` },
                  ]}
                  detailLink={`#playbook`}
                />
                <ReleasePlaybookStageCard
                  stage="risk"
                  status={
                    data.risk.blastRadius === "unscored"
                      ? "pending"
                      : data.risk.blastRadius === "critical" || data.risk.blastRadius === "high"
                        ? "warning"
                        : "complete"
                  }
                  title="Risk"
                  description={`Blast radius: ${data.risk.blastRadius}`}
                  facts={[
                    { label: "Radius", value: data.risk.blastRadius as string },
                    { label: "Services", value: describeCount(data.risk.affectedServiceCount) },
                  ]}
                  detailLink={`#risk`}
                />
                <ReleasePlaybookStageCard
                  stage="approval"
                  status={
                    requiredCount(data.approval.required) === null
                      ? "pending"
                      : (requiredCount(data.approval.required) as number) > 0 && (data.approval.granted as unknown as number) >= (requiredCount(data.approval.required) as number)
                        ? "complete"
                        : "pending"
                  }
                  title="Approval"
                  description={
                    requiredCount(data.approval.required) === null
                      ? "Not yet evaluated"
                      : `${data.approval.granted as unknown as number}/${requiredCount(data.approval.required)} approvals`
                  }
                  facts={[
                    { label: "Granted", value: `${data.approval.granted as unknown as number}` },
                    { label: "Required", value: describeCount(data.approval.required) },
                  ]}
                  detailLink={`#approval`}
                />
                <ReleasePlaybookStageCard
                  stage="execution"
                  status={
                    data.execution.status === "completed"
                      ? "complete"
                      : data.execution.status === "failed"
                        ? "error"
                        : data.execution.status === "rolled_back"
                          ? "warning"
                          : "pending"
                  }
                  title="Execution"
                  description={data.execution.status as string}
                  facts={[
                    { label: "Status", value: data.execution.status as string },
                  ]}
                  detailLink={`#execution`}
                />
                <ReleasePlaybookStageCard
                  stage="validation"
                  status="pending"
                  title="Validation"
                  description={`${describeCount(data.validation.planCount)} checks planned`}
                  facts={[
                    { label: "Planned", value: describeCount(data.validation.planCount) },
                    { label: "Results", value: describeCount(data.validation.resultsCount) },
                  ]}
                  detailLink={`#validation`}
                />
                <ReleasePlaybookStageCard
                  stage="evidence"
                  status={data.evidence.generatedAt ? "complete" : "pending"}
                  title="Evidence"
                  description={data.evidence.generatedAt ? "Pack ready" : "Pending"}
                  facts={[
                    { label: "Generated", value: data.evidence.generatedAt ? "Yes" : "No" },
                    { label: "Signed", value: data.evidence.signedAt ? "Yes" : "No" },
                    { label: "GitHub", value: describeGithubEvidence(data.evidence.githubEvidence) },
                  ]}
                  detailLink={`#evidence`}
                />
                <ReleasePlaybookStageCard
                  stage="closure"
                  status={data.closure.status === "closed" ? "complete" : data.closure.status === "terminated" ? "error" : "pending"}
                  title="Closure"
                  description={data.closure.status as string}
                  facts={[
                    { label: "Status", value: data.closure.status as string },
                  ]}
                  detailLink={`#closure`}
                />
              </div>
            </div>
          )}

          {tab === "attention" && (
            <div className="space-y-4">
              <p className="text-[12px] text-zinc-400">
                Only items that need action. Everything else is green.
              </p>
              <div className="space-y-3">
                {!data.readiness.evaluatedAt && (
                  <div className="rounded-2xl border border-zinc-500/[0.25] bg-zinc-500/[0.04] p-5">
                    <div className="flex items-start gap-3">
                      <div className="text-zinc-400 mt-0.5">•</div>
                      <div className="flex-1">
                        <h4 className="text-[13px] font-semibold text-zinc-300 mb-1">Readiness not yet evaluated</h4>
                        <p className="text-[12px] text-zinc-400">No readiness snapshot has been recorded for this release. Blockers cannot be determined until an evaluation runs.</p>
                      </div>
                    </div>
                  </div>
                )}
                {Boolean(data.readiness.evaluatedAt) && (data.readiness.blockerCount as unknown as number) > 0 && (
                  <div className="rounded-2xl border border-orange-500/[0.25] bg-orange-500/[0.04] p-5">
                    <div className="flex items-start gap-3">
                      <div className="text-orange-400 mt-0.5">⚠️</div>
                      <div className="flex-1">
                        <h4 className="text-[13px] font-semibold text-orange-300 mb-1">
                          {data.readiness.blockerCount as unknown as number} readiness {(data.readiness.blockerCount as unknown as number) === 1 ? "blocker" : "blockers"}
                        </h4>
                        <p className="text-[12px] text-zinc-400">
                          {data.readiness.riskLevel === "high" ? "High-risk release needs remediation" : "Address blockers before approval"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {requiredCount(data.approval.required) === null && (
                  <div className="rounded-2xl border border-zinc-500/[0.25] bg-zinc-500/[0.04] p-5">
                    <div className="flex items-start gap-3">
                      <div className="text-zinc-400 mt-0.5">•</div>
                      <div className="flex-1">
                        <h4 className="text-[13px] font-semibold text-zinc-300 mb-1">Approval requirement not yet evaluated</h4>
                        <p className="text-[12px] text-zinc-400">No approval chain has been created for this release yet. Run readiness/policy evaluation to determine how many approvals are required.</p>
                      </div>
                    </div>
                  </div>
                )}
                {(() => {
                  const required = requiredCount(data.approval.required);
                  const granted = data.approval.granted as unknown as number;
                  if (required === null || granted >= required) return null;
                  const remaining = required - granted;
                  return (
                    <div className="rounded-2xl border border-amber-500/[0.25] bg-amber-500/[0.04] p-5">
                      <div className="flex items-start gap-3">
                        <div className="text-amber-400 mt-0.5">⏳</div>
                        <div className="flex-1">
                          <h4 className="text-[13px] font-semibold text-amber-300 mb-1">
                            {remaining} approval{remaining === 1 ? "" : "s"} pending
                          </h4>
                          <p className="text-[12px] text-zinc-400">
                            {granted}/{required} required approvals collected
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {(data.playbook.policyViolationCount as unknown as number) > 0 && (
                  <div className="rounded-2xl border border-rose-500/[0.25] bg-rose-500/[0.04] p-5">
                    <div className="flex items-start gap-3">
                      <div className="text-rose-400 mt-0.5">🔴</div>
                      <div className="flex-1">
                        <h4 className="text-[13px] font-semibold text-rose-300 mb-1">
                          {data.playbook.policyViolationCount as unknown as number} policy {(data.playbook.policyViolationCount as unknown as number) === 1 ? "violation" : "violations"}
                        </h4>
                        <p className="text-[12px] text-zinc-400">
                          Playbook contains steps that violate deployment policy
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {Boolean(data.readiness.evaluatedAt) && (data.readiness.blockerCount as unknown as number) === 0 && requiredCount(data.approval.required) !== null && requiredCount(data.approval.required) === (data.approval.granted as unknown as number) && (data.playbook.policyViolationCount as unknown as number) === 0 && (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 text-[12px] text-zinc-400">
                    ✓ No blockers, no pending approvals, no policy violations. Ready to proceed.
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "changed" && (
            <div className="space-y-4">
              <p className="text-[12px] text-zinc-400">
                Release revisions and audit trail ({data.auditEventCount} events).
              </p>
              <div className="space-y-3">
                {data.lifecycle.closedAt && (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-emerald-400 mt-0.5 text-[14px]">✓</div>
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-white">Release closed</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {new Date(data.lifecycle.closedAt).toLocaleDateString()} at {new Date(data.lifecycle.closedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {data.lifecycle.validationCompleteAt && (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-emerald-400 mt-0.5 text-[14px]">✓</div>
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-white">Validation completed</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {new Date(data.lifecycle.validationCompleteAt).toLocaleDateString()} at {new Date(data.lifecycle.validationCompleteAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {data.lifecycle.executionStartedAt && (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-emerald-400 mt-0.5 text-[14px]">▶</div>
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-white">Execution started</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {new Date(data.lifecycle.executionStartedAt).toLocaleDateString()} at {new Date(data.lifecycle.executionStartedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {data.lifecycle.approvalGrantedAt && (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-emerald-400 mt-0.5 text-[14px]">✓</div>
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-white">Approval granted</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {new Date(data.lifecycle.approvalGrantedAt).toLocaleDateString()} at {new Date(data.lifecycle.approvalGrantedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {data.lifecycle.readinessScoredAt && (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-amber-400 mt-0.5 text-[14px]">📊</div>
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-white">Readiness scored</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {new Date(data.lifecycle.readinessScoredAt).toLocaleDateString()} at {new Date(data.lifecycle.readinessScoredAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {data.lifecycle.scopeFinalizedAt && (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-blue-400 mt-0.5 text-[14px]">🎯</div>
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-white">Scope finalized</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {new Date(data.lifecycle.scopeFinalizedAt).toLocaleDateString()} at {new Date(data.lifecycle.scopeFinalizedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {data.lifecycle.requestedAt && (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-blue-400 mt-0.5 text-[14px]">📝</div>
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-white">Request created</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {new Date(data.lifecycle.requestedAt).toLocaleDateString()} at {new Date(data.lifecycle.requestedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
