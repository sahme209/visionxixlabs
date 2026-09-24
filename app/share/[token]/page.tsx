/**
 * /share/[token] — Phase 634 · public read-only engineer report.
 *
 * No auth. The HMAC-signed token contains (orgId, kind, id, expiresAt).
 * Validation ensures the URL bearer can read exactly one
 * AiRationaleEnrichment row, nothing else. Expires after the TTL set
 * at token creation (default 14 days).
 *
 * Used by operators to share a single engineer output with someone
 * outside their workspace — a CFO, an auditor, a stakeholder, a
 * sales prospect during a pitch.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { SparklesIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/db";
import { validateShareToken } from "@/lib/workforce/domains/shareLinks";

export const dynamic = "force-dynamic";

const OUTCOME_TONE: Record<string, string> = {
  ai_generated: "text-emerald-300",
  fallback_rules: "text-amber-300",
  error: "text-rose-300",
};

export default async function SharedEngineerReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const validation = validateShareToken(token);
  if (!validation.ok || !validation.payload) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-6 text-center">
          <LockClosedIcon className="h-8 w-8 text-rose-300 mx-auto mb-3" />
          <p className="text-[14px] text-zinc-100 leading-relaxed mb-2">
            {validation.error === "expired" ? "This share link has expired." :
              validation.error === "bad_signature" ? "This share link is invalid or has been tampered with." :
              "This share link is malformed."}
          </p>
          <p className="text-[12px] text-zinc-400">
            Ask the workspace owner to generate a fresh link.
          </p>
        </div>
      </div>
    );
  }

  const { organizationId, targetKind, targetId } = validation.payload;

  const entry = await prisma.aiRationaleEnrichment.findUnique({
    where: {
      organizationId_targetKind_targetId: {
        organizationId,
        targetKind,
        targetId,
      },
    },
    select: {
      narrative: true,
      riskFactorsJson: true,
      nextActionsJson: true,
      outcome: true,
      modelHint: true,
      engineVersion: true,
      generatedAt: true,
      updatedAt: true,
    },
  }).catch(() => null);

  if (!entry) notFound();

  const riskFactors = Array.isArray(entry.riskFactorsJson)
    ? (entry.riskFactorsJson as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const nextActions = Array.isArray(entry.nextActionsJson)
    ? (entry.nextActionsJson as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  const expiresAt = new Date(validation.payload.expiresAt);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-3 flex-wrap text-[10px] font-mono uppercase tracking-[0.18em]">
          <span className="text-zinc-500">shared engineer report</span>
          <span className="text-zinc-500">·</span>
          <span className={OUTCOME_TONE[entry.outcome] ?? "text-zinc-400"}>{entry.outcome.replace(/_/g, " ")}</span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-500">v{entry.engineVersion}</span>
        </div>
        <h1 className="text-[26px] sm:text-[30px] font-semibold text-white tracking-[-0.02em] mb-2 inline-flex items-baseline gap-3">
          <SparklesIcon className="h-5 w-5 text-violet-300 shrink-0 self-center" />
          AGI rationale
        </h1>
        <p className="text-[12px] font-mono text-zinc-500">target · {targetKind}:{targetId}</p>
        <p className="text-[11px] text-zinc-500 mt-1">
          generated {entry.generatedAt.toISOString()}
          {entry.modelHint && <> · {entry.modelHint}</>}
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3">narrative</p>
        <p className="text-[14.5px] text-zinc-100 leading-relaxed whitespace-pre-line">{entry.narrative}</p>
      </section>

      {riskFactors.length > 0 && (
        <section className="mb-8">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3">risk factors · {riskFactors.length}</p>
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {riskFactors.map((f, i) => (
              <li key={`risk-${i}`} className="px-5 py-3 text-[13px] text-zinc-200 leading-relaxed">{f}</li>
            ))}
          </ul>
        </section>
      )}

      {nextActions.length > 0 && (
        <section className="mb-8">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3">structured payload · {nextActions.length}</p>
          <ul className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] divide-y divide-white/[0.04] overflow-hidden">
            {nextActions.map((a, i) => (
              <li key={`action-${i}`} className="px-5 py-3 text-[12.5px] text-emerald-100/90 leading-relaxed font-mono">{a}</li>
            ))}
          </ul>
        </section>
      )}

      <footer className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 mt-12">
        <div className="flex items-center justify-between gap-3 flex-wrap text-[11px]">
          <p className="text-zinc-500 inline-flex items-center gap-1.5">
            <LockClosedIcon className="h-3 w-3" />
            Read-only · expires {expiresAt.toISOString().slice(0, 19).replace("T", " ")}
          </p>
          <Link href="/" className="font-mono text-zinc-500 hover:text-white transition-colors">
            visionxixlabs ·  AI workforce →
          </Link>
        </div>
      </footer>
    </div>
  );
}
