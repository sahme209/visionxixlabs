/**
 * /dashboard/workforce/cognition — Phase 620.
 *
 * The "what is the AGI thinking" view. Renders the live composition
 * of the reasoning chain:
 *   · meta_reasoner observations paired with council verdicts
 *   · reasoner hypotheses with confidence
 *   · simulator verdicts
 *   · improvement proposals
 *
 * One surface that makes the cross-engineer collaboration visible
 * rather than scattered across individual detail pages.
 *
 * Pure projection — reads the persisted AiRationaleEnrichment rows
 * the engineers already produce, parses the pipe-delimited payload
 * shapes, and renders the joined view.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { META_REASONER_TARGET_KIND } from "@/lib/workforce/domains/metaReasonerEngineer";
import { COUNCIL_TARGET_KIND } from "@/lib/workforce/domains/councilEngineer";
import { REASONER_TARGET_KIND } from "@/lib/workforce/domains/reasonerEngineer";
import { SIMULATOR_TARGET_KIND } from "@/lib/workforce/domains/simulatorEngineer";
import { IMPROVEMENT_TARGET_KIND } from "@/lib/workforce/domains/improvementEngineer";

export const dynamic = "force-dynamic";

interface MetaObservation {
  observationId: string;
  stance: string;
  involvedEngineers: string[];
  observation: string;
  resolution: string;
}

interface CouncilDecision {
  observationId: string;
  verdict: string;
  involvedEngineers: string[];
  rationale: string;
  nextStep: string;
}

const VERDICT_TONE: Record<string, string> = {
  accept_first: "text-emerald-300",
  accept_second: "text-emerald-300",
  sequence: "text-sky-300",
  request_more_data: "text-amber-300",
  defer: "text-zinc-400",
};

const STANCE_TONE: Record<string, string> = {
  tension: "text-rose-300",
  convergence: "text-emerald-300",
};

function parseMetaPayload(payload: unknown): MetaObservation[] {
  if (!Array.isArray(payload)) return [];
  const byId = new Map<string, MetaObservation>();
  for (const raw of payload as unknown[]) {
    if (typeof raw !== "string") continue;
    const parts = raw.split("|");
    if (parts.length < 3) continue;
    const head = parts[0];
    const id = parts[1];
    if (!id) continue;
    if (head === "observation" && parts.length >= 5) {
      const stance = parts[2] ?? "";
      const involved = (parts[3] ?? "").split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      const observation = parts.slice(4).join("|");
      const existing = byId.get(id) ?? { observationId: id, stance: "", involvedEngineers: [], observation: "", resolution: "" };
      existing.stance = stance;
      existing.involvedEngineers = involved;
      existing.observation = observation;
      byId.set(id, existing);
    } else if (head === "resolution") {
      const resolution = parts.slice(2).join("|");
      const existing = byId.get(id) ?? { observationId: id, stance: "", involvedEngineers: [], observation: "", resolution: "" };
      existing.resolution = resolution;
      byId.set(id, existing);
    }
  }
  return Array.from(byId.values()).filter((o) => o.observation.length > 0);
}

function parseCouncilPayload(payload: unknown): CouncilDecision[] {
  if (!Array.isArray(payload)) return [];
  const byId = new Map<string, CouncilDecision>();
  for (const raw of payload as unknown[]) {
    if (typeof raw !== "string") continue;
    const parts = raw.split("|");
    if (parts.length < 3) continue;
    const head = parts[0];
    const id = parts[1];
    if (!id) continue;
    if (head === "verdict" && parts.length >= 5) {
      const verdict = parts[2] ?? "";
      const involved = (parts[3] ?? "").split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      const rationale = parts.slice(4).join("|");
      const existing = byId.get(id) ?? { observationId: id, verdict: "", involvedEngineers: [], rationale: "", nextStep: "" };
      existing.verdict = verdict;
      existing.involvedEngineers = involved;
      existing.rationale = rationale;
      byId.set(id, existing);
    } else if (head === "next_step") {
      const nextStep = parts.slice(2).join("|");
      const existing = byId.get(id) ?? { observationId: id, verdict: "", involvedEngineers: [], rationale: "", nextStep: "" };
      existing.nextStep = nextStep;
      byId.set(id, existing);
    }
  }
  return Array.from(byId.values());
}

function extractTag(payload: unknown, prefix: string): string | null {
  if (!Array.isArray(payload)) return null;
  for (const e of payload as unknown[]) {
    if (typeof e === "string" && e.startsWith(`${prefix}|`)) return e.slice(prefix.length + 1);
  }
  return null;
}

export default async function CognitionPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/cognition");
  }
  const orgId = String(ctx.organizationId);

  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Most recent meta + council. They live as singletons per workspace.
  const [metaRow, councilRow, reasonerRows, simulatorRows, improvementRow] = await Promise.all([
    prisma.aiRationaleEnrichment.findUnique({
      where: {
        organizationId_targetKind_targetId: {
          organizationId: orgId,
          targetKind: META_REASONER_TARGET_KIND,
          targetId: "meta_reasoner_engineer",
        },
      },
      select: { narrative: true, nextActionsJson: true, updatedAt: true, outcome: true, modelHint: true },
    }).catch(() => null),
    prisma.aiRationaleEnrichment.findUnique({
      where: {
        organizationId_targetKind_targetId: {
          organizationId: orgId,
          targetKind: COUNCIL_TARGET_KIND,
          targetId: "council_engineer",
        },
      },
      select: { narrative: true, nextActionsJson: true, updatedAt: true, outcome: true, modelHint: true },
    }).catch(() => null),
    prisma.aiRationaleEnrichment.findMany({
      where: { organizationId: orgId, targetKind: REASONER_TARGET_KIND, updatedAt: { gte: since14d } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { targetId: true, narrative: true, nextActionsJson: true, updatedAt: true, outcome: true, modelHint: true },
    }).catch(() => []),
    prisma.aiRationaleEnrichment.findMany({
      where: { organizationId: orgId, targetKind: SIMULATOR_TARGET_KIND, updatedAt: { gte: since14d } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { targetId: true, narrative: true, nextActionsJson: true, updatedAt: true, outcome: true, modelHint: true },
    }).catch(() => []),
    prisma.aiRationaleEnrichment.findUnique({
      where: {
        organizationId_targetKind_targetId: {
          organizationId: orgId,
          targetKind: IMPROVEMENT_TARGET_KIND,
          targetId: "improvement_engineer",
        },
      },
      select: { narrative: true, riskFactorsJson: true, updatedAt: true, outcome: true, modelHint: true },
    }).catch(() => null),
  ]);

  const metaObservations = metaRow ? parseMetaPayload(metaRow.nextActionsJson) : [];
  const councilDecisions = councilRow ? parseCouncilPayload(councilRow.nextActionsJson) : [];
  const councilByObs = new Map(councilDecisions.map((c) => [c.observationId, c]));

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Workforce
      </Link>
      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">cognition · what the AGI is thinking</p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <SparklesIcon className="h-6 w-6 text-violet-300 shrink-0 self-center" />
          Composed cognition
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          The cross-engineer reasoning chain in one view. Meta-reasoner tensions paired with
          council verdicts. Latest reasoner hypotheses + simulator verdicts. The platform's
          self-improvement proposal. Surfaces collaboration, not just individual reports.
        </p>
      </header>

      {/* Meta + Council chain — the headline composition. */}
      <section className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">
          meta-reasoner ↔ council · cross-engineer chain
        </p>
        {metaRow === null ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-12 text-center">
            <p className="text-[13px] text-zinc-400">Meta-reasoner hasn&apos;t produced a snapshot yet.</p>
            <p className="text-[11px] text-zinc-500 mt-1">
              Needs ≥2 engineer rationales in the workspace to start finding tensions. Run more engineers.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-5 mb-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-violet-300 mb-2">meta-reasoner summary</p>
              <p className="text-[13.5px] text-zinc-100 leading-relaxed">{metaRow.narrative}</p>
              <p className="text-[10px] font-mono text-zinc-500 mt-2">
                {metaRow.outcome.replace(/_/g, " ")}
                {metaRow.modelHint && <> · {metaRow.modelHint}</>}
                {" · "}{metaRow.updatedAt.toISOString().slice(0, 19).replace("T", " ")}
              </p>
            </div>
            {councilRow && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 mb-3">
                <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 mb-2">council summary</p>
                <p className="text-[13.5px] text-zinc-100 leading-relaxed">{councilRow.narrative}</p>
                <p className="text-[10px] font-mono text-zinc-500 mt-2">
                  {councilRow.outcome.replace(/_/g, " ")}
                  {councilRow.modelHint && <> · {councilRow.modelHint}</>}
                  {" · "}{councilRow.updatedAt.toISOString().slice(0, 19).replace("T", " ")}
                </p>
              </div>
            )}
            {metaObservations.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-6 text-center">
                <p className="text-[12px] text-zinc-400">
                  Meta-reasoner ran but produced no observations — engineers were all aligned this sweep.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {metaObservations.map((obs) => {
                  const verdict = councilByObs.get(obs.observationId);
                  return (
                    <li key={obs.observationId} className="rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
                      <div className="px-5 py-4 border-b border-white/[0.04]">
                        <div className="flex items-center gap-3 mb-2 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                          <span className={STANCE_TONE[obs.stance] ?? "text-zinc-400"}>{obs.stance}</span>
                          <span className="text-zinc-500">·</span>
                          <span className="text-zinc-400">{obs.involvedEngineers.join(" ↔ ") || "(unspecified)"}</span>
                        </div>
                        <p className="text-[13px] text-zinc-100 leading-relaxed">{obs.observation}</p>
                        {obs.resolution && (
                          <p className="text-[12px] text-zinc-400 leading-relaxed mt-2">
                            <span className="font-mono uppercase tracking-wider text-zinc-500">meta proposal:</span> {obs.resolution}
                          </p>
                        )}
                      </div>
                      {verdict ? (
                        <div className="px-5 py-4 bg-emerald-500/[0.025]">
                          <div className="flex items-center gap-2 mb-1 text-[10px] font-mono uppercase tracking-wider">
                            <span className="text-zinc-500">council verdict</span>
                            <span className="text-zinc-500">·</span>
                            <span className={VERDICT_TONE[verdict.verdict] ?? "text-zinc-300"}>{verdict.verdict.replace(/_/g, " ")}</span>
                          </div>
                          <p className="text-[12.5px] text-zinc-200 leading-relaxed">{verdict.rationale}</p>
                          {verdict.nextStep && (
                            <p className="text-[12px] text-emerald-100/80 leading-relaxed mt-2">
                              <span className="font-mono uppercase tracking-wider text-emerald-300/60">next step:</span> {verdict.nextStep}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="px-5 py-3 text-[11px] font-mono text-zinc-500 bg-white/[0.02]">
                          council has not yet voted on this observation
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>

      {/* Reasoner hypotheses */}
      <section className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">
          reasoner · recent hypotheses
        </p>
        {reasonerRows.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-8 text-center">
            <p className="text-[12px] text-zinc-400">No hypotheses yet. Paste observations on the reasoner page to form one.</p>
          </div>
        ) : (
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {reasonerRows.map((r) => {
              const confidenceRaw = extractTag(r.nextActionsJson, "confidence");
              const confidence = confidenceRaw && Number.isFinite(Number(confidenceRaw)) ? Number(confidenceRaw) : null;
              const title = extractTag(r.nextActionsJson, "title") ?? r.targetId;
              return (
                <li key={r.targetId}>
                  <Link href={`/dashboard/agi-memory/${encodeURIComponent(`${REASONER_TARGET_KIND}:${r.targetId}`)}`} className="block px-5 py-3.5 hover:bg-white/[0.015] transition-colors">
                    <div className="flex items-center justify-between gap-3 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                      <span className="text-zinc-400">{r.outcome.replace(/_/g, " ")}</span>
                      {confidence !== null && (<><span className="text-zinc-500">·</span><span className="text-violet-300">{confidence}% confidence</span></>)}
                      <span className="text-zinc-500 ml-auto">{r.updatedAt.toISOString().slice(0, 19).replace("T", " ")}</span>
                    </div>
                    <p className="text-[13.5px] font-medium text-white">{title}</p>
                    <p className="text-[12.5px] text-zinc-400 leading-relaxed mt-1 line-clamp-2">{r.narrative}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Simulator verdicts */}
      <section className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">
          simulator · recent dry-runs
        </p>
        {simulatorRows.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-8 text-center">
            <p className="text-[12px] text-zinc-400">No simulations yet. Paste an action on the simulator page to dry-run it.</p>
          </div>
        ) : (
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {simulatorRows.map((r) => {
              const verdict = extractTag(r.nextActionsJson, "verdict");
              const title = extractTag(r.nextActionsJson, "title") ?? r.targetId;
              const verdictTone = verdict === "safe" ? "text-emerald-300" : verdict === "unsafe" ? "text-rose-300" : "text-amber-300";
              return (
                <li key={r.targetId}>
                  <Link href={`/dashboard/agi-memory/${encodeURIComponent(`${SIMULATOR_TARGET_KIND}:${r.targetId}`)}`} className="block px-5 py-3.5 hover:bg-white/[0.015] transition-colors">
                    <div className="flex items-center justify-between gap-3 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                      {verdict && (<span className={verdictTone}>{verdict}</span>)}
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-400">{r.outcome.replace(/_/g, " ")}</span>
                      <span className="text-zinc-500 ml-auto">{r.updatedAt.toISOString().slice(0, 19).replace("T", " ")}</span>
                    </div>
                    <p className="text-[13.5px] font-medium text-white">{title}</p>
                    <p className="text-[12.5px] text-zinc-400 leading-relaxed mt-1 line-clamp-2">{r.narrative}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Improvement proposals */}
      <section className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">
          improvement · platform-level proposals
        </p>
        {improvementRow === null ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-8 text-center">
            <p className="text-[12px] text-zinc-400">No improvement proposals yet. The hourly cron sweeps this engineer.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.03] p-5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-violet-300 mb-2">summary</p>
            <p className="text-[13.5px] text-zinc-100 leading-relaxed">{improvementRow.narrative}</p>
            <p className="text-[10px] font-mono text-zinc-500 mt-2">
              {improvementRow.outcome.replace(/_/g, " ")}
              {improvementRow.modelHint && <> · {improvementRow.modelHint}</>}
              {" · "}{improvementRow.updatedAt.toISOString().slice(0, 19).replace("T", " ")}
            </p>
            {Array.isArray(improvementRow.riskFactorsJson) && improvementRow.riskFactorsJson.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {(improvementRow.riskFactorsJson as unknown[]).filter((x): x is string => typeof x === "string").map((f, i) => (
                  <li key={i} className="text-[12px] text-zinc-300 leading-relaxed">· {f}</li>
                ))}
              </ul>
            )}
            <p className="text-[10px] font-mono text-zinc-500 mt-4">
              <Link href={`/dashboard/agi-memory/${encodeURIComponent(`${IMPROVEMENT_TARGET_KIND}:improvement_engineer`)}`} className="hover:text-white">full proposal →</Link>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
