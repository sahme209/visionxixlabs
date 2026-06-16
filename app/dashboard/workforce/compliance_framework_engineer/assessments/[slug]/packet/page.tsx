/**
 * /dashboard/workforce/compliance_framework_engineer/assessments/[slug]/packet
 * Phase 637 — printable audit packet.
 *
 * Reads a compliance_framework_engineer assessment row and renders it
 * in a print-optimized layout. Operator clicks "Download as PDF"
 * (which calls window.print) and saves to PDF via the browser's
 * built-in print dialog. The print CSS hides navigation, increases
 * contrast, paginates control assessments cleanly.
 *
 * No new dependency — relies on browser print-to-PDF, which every
 * customer/auditor already trusts.
 *
 * The shared/[token] route (Phase 634) can also point at this page
 * when the targetKind is engineer_compliance_framework_assessment,
 * so a single share link reaches the printable layout directly.
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { COMPLIANCE_FRAMEWORK_TARGET_KIND } from "@/lib/workforce/domains/complianceFrameworkEngineer";
import { ShareEntryButton } from "@/components/workforce/ShareEntryButton";
import { PrintButton } from "@/components/workforce/PrintButton";

export const dynamic = "force-dynamic";

interface ControlRow {
  controlId: string;
  status: string;
  controlTitle: string;
  evidence: string;
  gap: string;
  remediation: string;
}

function decodePayload(payload: unknown): {
  title: string;
  framework: string;
  frameworkLabel: string;
  overallScore: number | null;
  controls: ControlRow[];
} {
  const out = {
    title: "",
    framework: "",
    frameworkLabel: "",
    overallScore: null as number | null,
    controls: [] as ControlRow[],
  };
  if (!Array.isArray(payload)) return out;
  const byId = new Map<string, ControlRow>();
  for (const e of payload as unknown[]) {
    if (typeof e !== "string") continue;
    if (e.startsWith("title|")) out.title = e.slice("title|".length);
    else if (e.startsWith("framework|")) out.framework = e.slice("framework|".length);
    else if (e.startsWith("framework_label|")) out.frameworkLabel = e.slice("framework_label|".length);
    else if (e.startsWith("overall_score|")) {
      const v = Number(e.slice("overall_score|".length));
      if (Number.isFinite(v)) out.overallScore = v;
    } else if (e.startsWith("control|")) {
      const parts = e.split("|");
      if (parts.length >= 4) {
        const cid = parts[1] ?? "";
        const row = byId.get(cid) ?? { controlId: cid, status: "", controlTitle: "", evidence: "", gap: "", remediation: "" };
        row.status = parts[2] ?? "";
        row.controlTitle = parts.slice(3).join("|");
        byId.set(cid, row);
      }
    } else if (e.startsWith("evidence|")) {
      const parts = e.split("|");
      const cid = parts[1] ?? "";
      const row = byId.get(cid) ?? { controlId: cid, status: "", controlTitle: "", evidence: "", gap: "", remediation: "" };
      row.evidence = parts.slice(2).join("|");
      byId.set(cid, row);
    } else if (e.startsWith("gap|")) {
      const parts = e.split("|");
      const cid = parts[1] ?? "";
      const row = byId.get(cid) ?? { controlId: cid, status: "", controlTitle: "", evidence: "", gap: "", remediation: "" };
      row.gap = parts.slice(2).join("|");
      byId.set(cid, row);
    } else if (e.startsWith("remediation|")) {
      const parts = e.split("|");
      const cid = parts[1] ?? "";
      const row = byId.get(cid) ?? { controlId: cid, status: "", controlTitle: "", evidence: "", gap: "", remediation: "" };
      row.remediation = parts.slice(2).join("|");
      byId.set(cid, row);
    }
  }
  out.controls = Array.from(byId.values());
  return out;
}

const STATUS_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  pass: { label: "PASS", bg: "bg-emerald-100", text: "text-emerald-900" },
  partial: { label: "PARTIAL", bg: "bg-amber-100", text: "text-amber-900" },
  fail: { label: "FAIL", bg: "bg-rose-100", text: "text-rose-900" },
  na: { label: "N/A", bg: "bg-zinc-100", text: "text-zinc-700" },
};

export default async function AuditPacketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin");
  }
  const { slug } = await params;

  const row = await prisma.aiRationaleEnrichment.findUnique({
    where: {
      organizationId_targetKind_targetId: {
        organizationId: String(ctx.organizationId),
        targetKind: COMPLIANCE_FRAMEWORK_TARGET_KIND,
        targetId: slug,
      },
    },
    select: {
      narrative: true,
      riskFactorsJson: true,
      nextActionsJson: true,
      outcome: true,
      modelHint: true,
      generatedAt: true,
      updatedAt: true,
    },
  }).catch(() => null);

  if (!row) notFound();

  const decoded = decodePayload(row.nextActionsJson);
  const prioritizedGaps = Array.isArray(row.riskFactorsJson)
    ? (row.riskFactorsJson as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  return (
    <>
      {/* Inline print CSS: hide every UI chrome element, scale to A4,
          increase contrast for paper readability. */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .audit-packet {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }
          .audit-packet h1, .audit-packet h2, .audit-packet h3 {
            color: black !important;
          }
          .audit-packet .row { page-break-inside: avoid; }
          .audit-packet section { page-break-inside: avoid; }
          @page {
            margin: 0.6in 0.5in;
            size: A4 portrait;
          }
        }
      `}</style>

      {/* Toolbar — print-hidden */}
      <div className="no-print max-w-4xl mx-auto px-4 -mt-2 mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap py-3">
          <Link
            href="/dashboard/workforce/compliance_framework_engineer/assessments"
            className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors font-mono"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            assessments
          </Link>
          <div className="flex items-center gap-3">
            <ShareEntryButton targetKind={COMPLIANCE_FRAMEWORK_TARGET_KIND} targetId={slug} ttlDays={30} />
            <PrintButton />
          </div>
        </div>
      </div>

      {/* Packet — print-target */}
      <article className="audit-packet max-w-4xl mx-auto px-6 py-10 bg-white text-zinc-900 rounded-md shadow-2xl">
        {/* Cover */}
        <header className="border-b-2 border-zinc-900 pb-6 mb-8">
          <div className="flex items-baseline justify-between gap-4 flex-wrap mb-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-zinc-600">
              AUDIT PACKET · POINT-IN-TIME ASSESSMENT
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              generated {row.generatedAt.toISOString().slice(0, 10)}
            </p>
          </div>
          <h1 className="text-[28px] font-bold text-zinc-900 leading-[1.2] mb-2 tracking-tight">
            {decoded.title || slug}
          </h1>
          {decoded.frameworkLabel && (
            <p className="text-[15px] text-zinc-700 mb-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 mr-2">Framework</span>
              <span className="font-semibold">{decoded.frameworkLabel}</span>
            </p>
          )}
          {decoded.overallScore !== null && (
            <div className="inline-flex items-center gap-3 px-4 py-2 border border-zinc-300 rounded-sm">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">overall posture</span>
              <span className={`text-[24px] font-bold tabular-nums ${
                decoded.overallScore >= 75 ? "text-emerald-700" :
                decoded.overallScore >= 50 ? "text-amber-700" : "text-rose-700"
              }`}>
                {decoded.overallScore}/100
              </span>
            </div>
          )}
        </header>

        {/* Executive summary */}
        <section className="mb-10">
          <h2 className="text-[14px] font-mono uppercase tracking-[0.18em] text-zinc-600 mb-3 border-b border-zinc-300 pb-1.5">
            Executive Summary
          </h2>
          <p className="text-[14px] text-zinc-800 leading-relaxed">{row.narrative}</p>
        </section>

        {/* Prioritized gaps */}
        {prioritizedGaps.length > 0 && (
          <section className="mb-10">
            <h2 className="text-[14px] font-mono uppercase tracking-[0.18em] text-zinc-600 mb-3 border-b border-zinc-300 pb-1.5">
              Prioritized Gaps · {prioritizedGaps.length}
            </h2>
            <ol className="space-y-2">
              {prioritizedGaps.map((g, i) => (
                <li key={i} className="text-[13px] text-zinc-800 leading-relaxed flex gap-3 row">
                  <span className="font-mono text-zinc-500 tabular-nums shrink-0">{(i + 1).toString().padStart(2, "0")}.</span>
                  <span>{g}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Control assessments */}
        {decoded.controls.length > 0 && (
          <section className="mb-10">
            <h2 className="text-[14px] font-mono uppercase tracking-[0.18em] text-zinc-600 mb-4 border-b border-zinc-300 pb-1.5">
              Control Assessments · {decoded.controls.length}
            </h2>
            <div className="space-y-5">
              {decoded.controls.map((c) => {
                const st = STATUS_STYLE[c.status] ?? STATUS_STYLE.partial;
                return (
                  <div key={c.controlId} className="border border-zinc-300 rounded-sm p-4 row">
                    <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
                      <p className="font-mono text-[13px] font-bold text-zinc-900">{c.controlId}</p>
                      <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm ${st.bg} ${st.text}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-[13px] font-semibold text-zinc-900 mb-3">{c.controlTitle}</p>
                    {c.evidence && (
                      <div className="mb-2">
                        <p className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-500 mb-0.5">Evidence</p>
                        <p className="text-[12px] text-zinc-700 leading-relaxed">{c.evidence}</p>
                      </div>
                    )}
                    {c.gap && (
                      <div className="mb-2">
                        <p className="font-mono text-[9.5px] uppercase tracking-wider text-rose-700 mb-0.5">Gap</p>
                        <p className="text-[12px] text-zinc-700 leading-relaxed">{c.gap}</p>
                      </div>
                    )}
                    {c.remediation && (
                      <div>
                        <p className="font-mono text-[9.5px] uppercase tracking-wider text-emerald-700 mb-0.5">Remediation</p>
                        <p className="text-[12px] text-zinc-700 leading-relaxed">{c.remediation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Methodology + footer */}
        <footer className="mt-12 pt-4 border-t border-zinc-300 text-[10px] text-zinc-500 leading-relaxed">
          <p className="mb-1">
            <span className="font-mono uppercase tracking-wider">methodology</span> · Each control assessed against the customer-supplied
            cloud posture description, status weighted (pass=1.0, partial=0.5, fail=0, na excluded).
            Overall posture is the weighted average rounded to integer.
          </p>
          <p>
            <span className="font-mono uppercase tracking-wider">authored</span> ·
            visionxixlabs.runtime · compliance_framework_engineer v1
            {row.modelHint && <> · model {row.modelHint}</>}
            {" · "}assessment ref <span className="font-mono">{slug}</span>
          </p>
        </footer>
      </article>
    </>
  );
}
