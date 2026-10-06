/** /dashboard/workforce/compliance_framework_engineer/assessments — Phase 636. */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { COMPLIANCE_FRAMEWORK_TARGET_KIND } from "@/lib/workforce/domains/complianceFrameworkEngineer";

export const dynamic = "force-dynamic";

const OUTCOME_TONE: Record<string, string> = {
  ai_generated: "text-emerald-300",
  fallback_rules: "text-zinc-300",
  error: "text-rose-300",
};

const FRAMEWORK_OPTIONS: Array<{ value: string; label: string; tagline: string }> = [
  { value: "soc2", label: "SOC2 (Trust Service Criteria)", tagline: "Security, Availability, Confidentiality, Processing Integrity, Privacy" },
  { value: "iso27001", label: "ISO/IEC 27001:2022", tagline: "Annex A · 93 controls in 4 themes (2022 revision)" },
  { value: "hipaa", label: "HIPAA Security Rule", tagline: "Administrative, Physical, Technical safeguards · §164.308–312" },
  { value: "pci_dss", label: "PCI-DSS v4", tagline: "12 requirements for the cardholder data environment" },
  { value: "nist_800_53", label: "NIST SP 800-53 Rev. 5", tagline: "20 control families · federal/state baseline" },
  { value: "cis_benchmark", label: "CIS Benchmark", tagline: "CIS AWS/Azure/GCP foundations · cloud account hardening" },
];

export default async function ComplianceFrameworkAssessmentsPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/compliance_framework_engineer/assessments");
  }

  const rows = await prisma.aiRationaleEnrichment.findMany({
    where: { organizationId: String(ctx.organizationId), targetKind: COMPLIANCE_FRAMEWORK_TARGET_KIND },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { targetId: true, narrative: true, outcome: true, modelHint: true, updatedAt: true, nextActionsJson: true },
  }).catch(() => []);

  const decoded = rows.map((r) => {
    let title = r.targetId;
    let framework: string | null = null;
    let frameworkLabel: string | null = null;
    let score: number | null = null;
    if (Array.isArray(r.nextActionsJson)) {
      for (const e of r.nextActionsJson as unknown[]) {
        if (typeof e !== "string") continue;
        if (e.startsWith("title|")) title = e.slice("title|".length);
        else if (e.startsWith("framework|")) framework = e.slice("framework|".length);
        else if (e.startsWith("framework_label|")) frameworkLabel = e.slice("framework_label|".length);
        else if (e.startsWith("overall_score|")) {
          const v = Number(e.slice("overall_score|".length));
          if (Number.isFinite(v)) score = v;
        }
      }
    }
    return { targetId: r.targetId, title, framework, frameworkLabel, score, narrative: r.narrative, outcome: r.outcome, modelHint: r.modelHint, updatedAt: r.updatedAt };
  });

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Workforce
      </Link>
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">compliance-framework</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-500">point-in-time assessments</span>
        </p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <ShieldCheckIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          Compliance framework assessment
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Score your cloud posture against SOC2, ISO27001, HIPAA, PCI-DSS, NIST 800-53, or CIS
          Benchmark. Engineer cites the framework&apos;s verbatim control IDs and produces an
          auditor-grade evidence/gap/remediation triple per control. Suitable for SOC2 Type II
          kickoff packets or PCI-DSS Report on Compliance scoping.
        </p>
      </header>

      <section className="mb-10 rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <form action="/api/workforce/compliance_framework_engineer/run-domain" method="POST" className="space-y-4">
          <div>
            <label htmlFor="title" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">title</label>
            <input id="title" name="title" required maxLength={200} placeholder="e.g. Q3 SOC2 Type II readiness assessment"
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
          </div>
          <div>
            <label htmlFor="framework" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">target framework</label>
            <select id="framework" name="framework" required defaultValue="soc2"
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-emerald-500/40 transition-colors">
              {FRAMEWORK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-[10.5px] text-zinc-500 mt-1.5 leading-snug font-mono">
              soc2 :: Trust Service Criteria · iso27001 :: Annex A · hipaa :: §164 · pci_dss :: 12 reqs · nist_800_53 :: 20 families · cis_benchmark :: cloud hardening
            </p>
          </div>
          <div>
            <label htmlFor="cloudPosture" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">cloud posture description</label>
            <textarea id="cloudPosture" name="cloudPosture" required rows={10} maxLength={8000}
              placeholder={"Describe your current state: cloud accounts connected, encryption posture, IAM model, logging setup, backup cadence, change-management process, employee onboarding/offboarding, etc. The richer this is, the more precise the assessment."}
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none" />
          </div>
          <div>
            <label htmlFor="auditContext" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">audit context (optional)</label>
            <input id="auditContext" name="auditContext" maxLength={800}
              placeholder="e.g. SOC2 Type II audit with Coalfire scheduled for August 2026"
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
          </div>
          <div>
            <label htmlFor="inScopeControls" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">in-scope controls (optional, comma-separated)</label>
            <input id="inScopeControls" name="inScopeControls" maxLength={1000}
              placeholder="e.g. CC6.1, CC6.2, CC7.2 · leave blank to assess the most material controls for the framework"
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-zinc-500 font-mono">metered AI · billable · ~$0.40 per assessment</p>
            <button type="submit" className="text-[11px] font-mono uppercase tracking-wider px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/15 transition-colors">
              run assessment →
            </button>
          </div>
        </form>
      </section>

      {decoded.length === 0 ? (
        <div className="rounded-md border border-white/[0.06] bg-white/[0.012] px-6 py-12 text-center">
          <p className="text-[13px] text-zinc-400">No assessments yet.</p>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">submit the form above to run the first one</p>
        </div>
      ) : (
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
            <span className="text-zinc-700">//</span>
            <span className="text-emerald-300">recent-assessments</span>
            <span className="text-zinc-700">::</span>
            <span className="text-zinc-400 tabular-nums">{decoded.length}</span>
          </p>
          <ul className="rounded-md border border-white/[0.06] bg-white/[0.012] divide-y divide-white/[0.04] overflow-hidden">
            {decoded.map((d) => (
              <li key={d.targetId} className="hover:bg-emerald-500/[0.04] transition-colors">
                <div className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                    {d.framework && <span className="text-emerald-300">{d.framework}</span>}
                    {d.score !== null && (
                      <>
                        <span className="text-zinc-700">::</span>
                        <span className={d.score >= 75 ? "text-emerald-300" : d.score >= 50 ? "text-zinc-300" : "text-rose-300"}>
                          {d.score}/100
                        </span>
                      </>
                    )}
                    <span className="text-zinc-500">·</span>
                    <span className={OUTCOME_TONE[d.outcome] ?? "text-zinc-400"}>{d.outcome.replace(/_/g, " ")}</span>
                    {d.modelHint && (<><span className="text-zinc-500">·</span><span className="text-zinc-400">{d.modelHint}</span></>)}
                    <span className="text-zinc-500 ml-auto">{d.updatedAt.toISOString().slice(0, 19).replace("T", " ")}</span>
                  </div>
                  <p className="text-[14px] font-medium text-white">{d.title}</p>
                  {d.frameworkLabel && (
                    <p className="text-[11.5px] text-zinc-500 mt-0.5 font-mono">{d.frameworkLabel}</p>
                  )}
                  <p className="text-[12.5px] text-zinc-400 leading-relaxed mt-1 line-clamp-2">{d.narrative}</p>
                  <div className="flex items-center gap-4 mt-2.5 flex-wrap">
                    <Link
                      href={`/dashboard/workforce/compliance_framework_engineer/assessments/${encodeURIComponent(d.targetId)}/packet`}
                      className="text-[11px] font-mono uppercase tracking-wider text-emerald-300 hover:text-white transition-colors"
                    >
                      audit-packet →
                    </Link>
                    <Link
                      href={`/dashboard/agi-memory/${encodeURIComponent(`${COMPLIANCE_FRAMEWORK_TARGET_KIND}:${d.targetId}`)}`}
                      className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 hover:text-emerald-300 transition-colors"
                    >
                      raw-entry →
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
