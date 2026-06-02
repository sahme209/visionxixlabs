/**
 * /dashboard/agi-memory/[entry] — Phase 539.
 *
 * Per-entry AGI memory drilldown. The Phase 521 list page renders a
 * scrolling feed; this page makes any single rationale entry
 * deep-linkable + shareable + auditable in isolation.
 *
 * Route slug is "<targetKind>:<targetId>" (URL-encoded). The
 * @@unique([organizationId, targetKind, targetId]) constraint
 * guarantees one row resolves cleanly. Empty / bad slugs notFound.
 *
 * Renders the full narrative, all risk factors, all next actions,
 * the model hint, engine version, outcome, and links back to the
 * source surface (council / triage / remediation) when a stable
 * route exists.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, ExclamationTriangleIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { AGENT_WORKFORCE_REGISTRY } from "@/lib/workforce/agentWorkforceRegistry";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  council:                       "Council",
  triage:                        "Triage",
  remediation:                   "Remediation",
  engineer_specialty:            "Engineer specialty",
  engineer_qa:                   "Engineer Q&A",
  workforce_synthesis:           "Workforce synthesis",
  engineer_compliance_report:    "Compliance engineer report",
  engineer_detector_signals:     "Detector engineer signals",
};

const OUTCOME_TONE: Record<string, string> = {
  ai_generated:   "text-emerald-300",
  fallback_rules: "text-amber-300",
  error:          "text-rose-300",
};

const SOURCE_HREF: Record<string, string> = {
  council:     "/dashboard/agi-cockpit",
  triage:      "/dashboard/incidents",
  remediation: "/dashboard/remediation",
  // engineer_specialty intentionally not mapped here — the canonical
  // home for that entry is the engineer detail itself, which we
  // synthesize from targetId below.
};

// Mirror of agiKindsForDepartment in /dashboard/workforce/[id]. We
// invert the mapping here so a rationale entry can name the
// engineers whose work it's reasoning about.
function engineersForKind(kind: string): string[] {
  if (kind === "council") {
    return ["safety", "planning", "reasoning"];
  }
  if (kind === "triage" || kind === "remediation") {
    return ["incident_response", "security", "devops", "finops", "observability"];
  }
  return [];
}

function parseSlug(raw: string): { targetKind: string; targetId: string } | null {
  const decoded = decodeURIComponent(raw);
  const colonIdx = decoded.indexOf(":");
  if (colonIdx === -1 || colonIdx === 0 || colonIdx === decoded.length - 1) return null;
  return {
    targetKind: decoded.slice(0, colonIdx),
    targetId: decoded.slice(colonIdx + 1),
  };
}

export default async function AgiMemoryEntryPage({
  params,
}: {
  params: Promise<{ entry: string }>;
}) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/agi-memory");
  }
  const { entry: entryRaw } = await params;
  const parsed = parseSlug(entryRaw);
  if (!parsed) notFound();

  const entry = await prisma.aiRationaleEnrichment.findUnique({
    where: {
      organizationId_targetKind_targetId: {
        organizationId: String(ctx.organizationId),
        targetKind: parsed.targetKind,
        targetId: parsed.targetId,
      },
    },
    select: {
      id: true,
      targetKind: true,
      targetId: true,
      narrative: true,
      riskFactorsJson: true,
      nextActionsJson: true,
      outcome: true,
      errorMessage: true,
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

  const kindLabel = KIND_LABEL[entry.targetKind] ?? entry.targetKind;
  // For engineer_specialty entries the targetId IS the engineer id;
  // for engineer_qa it's `<engineerId>:<timestamp>` — route both at
  // the engineer's surface accordingly. For workforce_synthesis the
  // targetId is a sweep correlation — route back to the ask-all view
  // filtered to that sweep.
  let sourceHref: string | undefined;
  if (entry.targetKind === "engineer_specialty") {
    sourceHref = `/dashboard/workforce/${entry.targetId}`;
  } else if (entry.targetKind === "engineer_qa") {
    const colon = entry.targetId.indexOf(":");
    const engineerId = colon === -1 ? entry.targetId : entry.targetId.slice(0, colon);
    sourceHref = `/dashboard/workforce/${engineerId}/ask`;
  } else if (entry.targetKind === "workforce_synthesis") {
    sourceHref = `/dashboard/workforce/ask-all?sweep=${encodeURIComponent(entry.targetId)}`;
  } else if (entry.targetKind === "engineer_compliance_report") {
    sourceHref = `/dashboard/compliance`;
  } else if (entry.targetKind === "engineer_detector_signals") {
    sourceHref = `/dashboard/workforce/detector_engineer`;
  } else {
    sourceHref = SOURCE_HREF[entry.targetKind];
  }

  // Engineers whose department the kind maps to. Filter to client
  // engineers only — internal_admin engineers never surface on
  // operator pages.
  const relevantDepts = engineersForKind(entry.targetKind);
  const relevantEngineers = AGENT_WORKFORCE_REGISTRY.filter(
    (e) => e.productLayer === "client" && relevantDepts.includes(e.department),
  );

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/agi-memory" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        AGI memory
      </Link>

      <header className="mb-10">
        <div className="flex items-center gap-2 mb-3 flex-wrap text-[10px] font-mono uppercase tracking-[0.18em]">
          <span className="text-zinc-300">{kindLabel}</span>
          <span className="text-zinc-500">·</span>
          <span className={OUTCOME_TONE[entry.outcome] ?? "text-zinc-400"}>{entry.outcome.replace(/_/g, " ")}</span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-500">v{entry.engineVersion}</span>
          {entry.modelHint && (
            <>
              <span className="text-zinc-500">·</span>
              <span className="text-zinc-400 font-mono">{entry.modelHint}</span>
            </>
          )}
        </div>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <SparklesIcon className="h-6 w-6 text-violet-300 shrink-0 self-center" />
          AGI rationale
        </h1>
        <p className="text-[12px] font-mono text-zinc-500">target · {entry.targetKind}:{entry.targetId}</p>
        <p className="text-[11px] text-zinc-500 mt-1">
          generated {entry.generatedAt.toISOString()}
          {entry.updatedAt.getTime() !== entry.generatedAt.getTime() && <> · updated {entry.updatedAt.toISOString()}</>}
        </p>
      </header>

      {/* Narrative — the headline payload. Preserve newlines, never
          truncate. Operators may copy this into a postmortem. */}
      <section className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3">narrative</p>
        <p className="text-[14px] text-zinc-200 leading-relaxed whitespace-pre-line">{entry.narrative}</p>
        {entry.errorMessage && (
          <div className="mt-4 rounded-lg border border-rose-500/15 bg-rose-500/[0.04] px-4 py-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-rose-300 mb-1 inline-flex items-center gap-1">
              <ExclamationTriangleIcon className="h-3 w-3" /> error
            </p>
            <p className="text-[12px] text-rose-200/90 leading-relaxed">{entry.errorMessage}</p>
          </div>
        )}
      </section>

      {/* Risk factors */}
      {riskFactors.length > 0 && (
        <section className="mb-8">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3">risk factors · {riskFactors.length}</p>
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {riskFactors.map((f, i) => (
              <li key={`${i}_${f.slice(0, 24)}`} className="px-5 py-3 text-[13px] text-zinc-200 leading-relaxed">{f}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Next actions */}
      {nextActions.length > 0 && (
        <section className="mb-8">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3">next actions · {nextActions.length}</p>
          <ul className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] divide-y divide-white/[0.04] overflow-hidden">
            {nextActions.map((a, i) => (
              <li key={`${i}_${a.slice(0, 24)}`} className="px-5 py-3 text-[13px] text-emerald-100/90 leading-relaxed">{a}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Relevant engineers — the departments this rationale's
          targetKind reasons about, expanded to the canonical
          engineers in each. Mirrors the engineer detail's AGI panel
          (Phase 550) so the link round-trip stays honest. */}
      {relevantEngineers.length > 0 && (
        <section className="mb-8">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3">relevant engineers · {relevantEngineers.length}</p>
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {relevantEngineers.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/dashboard/workforce/${e.id}`}
                  className="group flex items-center justify-between gap-3 px-5 py-3 hover:bg-white/[0.015] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 shrink-0">{e.department}</span>
                    <p className="text-[12.5px] font-medium text-white truncate">{e.displayName}</p>
                  </div>
                  <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-zinc-500 mt-2 leading-snug">
            The {kindLabel.toLowerCase()} surface reasons about work owned by these departments.
            Each link drops into the engineer detail page where this entry already appears in the AGI rationale strip.
          </p>
        </section>
      )}

      {/* Source surface link when the targetKind maps to a stable
          dashboard route. We don't fabricate routes for unknown kinds. */}
      {sourceHref && (
        <Link
          href={sourceHref}
          className="group block rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-4 hover:border-white/[0.12] transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-white">Open {kindLabel.toLowerCase()} surface</p>
              <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">See where this rationale lives in the broader operating context.</p>
            </div>
            <ArrowRightIcon className="h-4 w-4 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>
      )}
    </div>
  );
}
