/**
 * /dashboard/sub-tools — the sub-tools center.
 *
 * Index of every sub-tool grouped by category (technical / business /
 * AI operations). Reads from lib/platform/subToolCatalog.ts so adding
 * a new sub-tool is a single config append.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRightIcon, PlusIcon } from "@heroicons/react/24/outline";
import {
  clientSubTools,
  SUB_TOOL_CATEGORY_META,
  SUB_TOOL_MATURITY_META,
  type SubToolCategory,
} from "@/lib/platform/subToolCatalog";

// Client tenants only see the client-layer slice. VisionXIXLabs
// internal tools (marketing, sales, etc.) live at /admin/* and
// never appear here.
const SUB_TOOLS = clientSubTools();
import { PlatformHero } from "@/components/platform/PlatformHero";
import { PlatformHealthStrip } from "@/components/platform/PlatformHealthStrip";

export const metadata: Metadata = {
  title: "Sub-tools · Axiom",
  description:
    "Every Axiom sub-tool grouped by domain — technical operations, business operations, AI operations. Each is a department in the AI-powered company OS.",
};

const CATEGORY_ORDER: readonly SubToolCategory[] = [
  "technical_ops",
  "business_ops",
  "ai_ops",
];

// AI Ops surfaces are top-level cockpit pages, not sub-tool catalog
// entries — surfaced here as a parallel rail so operators see the
// full operating-system structure on one page.
interface AiOpsSurface {
  href: string;
  label: string;
  purpose: string;
}

const AI_OPS_SURFACES: readonly AiOpsSurface[] = [
  { href: "/dashboard/agents",         label: "Agent Workforce", purpose: "25 agent kernels grouped by role — perception, reasoning, planning, safety, verification, memory, workflow." },
  { href: "/dashboard/automation",     label: "Automation Engine", purpose: "Script + workflow registry with risk levels, dry-run, approval gates, and execution mode (cloud / desktop)." },
  { href: "/dashboard/connectors",     label: "Connector Hub",   purpose: "Every external system Axiom speaks to, grouped by category, with audit boundaries." },
  { href: "/dashboard/desktop-agents", label: "Desktop Agents",  purpose: "Registered macOS / Windows / Linux devices, local capabilities, sync state, and pending tasks." },
  { href: "/dashboard/models",         label: "Model Registry",  purpose: "Local + cloud AI models with license, evaluation score, risk level, and approved-vs-candidate status." },
  { href: "/dashboard/learning",       label: "Learning Events", purpose: "What the agents learned from operator approvals, rejections, incidents, and automation outcomes." },
  { href: "/dashboard/gaps",           label: "Gap Detection",   purpose: "Findings across every sub-tool with severity, evidence, recommended action, and automation availability." },
  { href: "/dashboard/approvals",      label: "Approval Center", purpose: "Pending approvals across cloud, DevOps, security, support, finance — with risk, dry-run, and rollback." },
  { href: "/dashboard/audit",          label: "Audit Center",    purpose: "Immutable audit log of every agent action, human approval, connector change, and automation run." },
];

export default function SubToolsCenterPage() {
  const counts = SUB_TOOLS.reduce(
    (acc, s) => {
      acc[s.maturity] += 1;
      return acc;
    },
    { active: 0, partial: 0, planned: 0 },
  );

  return (
    <div className="relative">
      <PlatformHero
        eyebrow="Platform · operating system"
        eyebrowTone="violet"
        title="Sub-tools center"
        description="Each sub-tool is a department in the AI-powered company OS — with assigned agents, connected tools, owned workflows, and explicit scope. Adding a new sub-tool is a one-line config change to lib/platform/subToolCatalog.ts."
        right={
          <>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2.5 py-1 text-[11px] font-mono">
              {counts.active} active
            </span>
            <span className="rounded-full border border-white/30 bg-white/10 text-zinc-300 px-2.5 py-1 text-[11px] font-mono">
              {counts.partial} partial
            </span>
            <span className="rounded-full border border-zinc-500/30 bg-zinc-500/10 text-zinc-400 px-2.5 py-1 text-[11px] font-mono">
              {counts.planned} planned
            </span>
          </>
        }
      />

      <PlatformHealthStrip />

      {/* Sub-tool category rails */}
      {CATEGORY_ORDER.map((cat) => {
        const inCat = SUB_TOOLS.filter((s) => s.category === cat);
        const meta = SUB_TOOL_CATEGORY_META[cat];
        // AI Ops is rendered separately below from a parallel rail.
        if (cat === "ai_ops") return null;
        return (
          <section key={cat} className="mb-10">
            <header className="flex flex-wrap items-baseline gap-3 mb-4">
              <h2 className="text-[14px] font-semibold text-zinc-100">{meta.label}</h2>
              <p className="text-[12px] text-zinc-500">{meta.description}</p>
              <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                {inCat.length}
              </span>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {inCat.map((s) => {
                const maturity = SUB_TOOL_MATURITY_META[s.maturity];
                return (
                  <Link
                    key={s.slug}
                    href={`/dashboard/sub-tools/${s.slug}`}
                    className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 hover:border-white/[0.12] hover:bg-white/[0.025] transition flex flex-col"
                  >
                    <header className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[14px] font-semibold text-white">{s.name}</h3>
                        <p className="mt-0.5 text-[11px] text-zinc-500">{s.purpose}</p>
                      </div>
                      <span className={["text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border whitespace-nowrap", maturity.tone].join(" ")}>
                        {maturity.label}
                      </span>
                    </header>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] py-2">
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Agents</p>
                        <p className="mt-0.5 text-[13px] font-semibold text-white">{s.agentKernels.length}</p>
                      </div>
                      <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] py-2">
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Routes</p>
                        <p className="mt-0.5 text-[13px] font-semibold text-white">{s.ownedRoutes.length}</p>
                      </div>
                      <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] py-2">
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Conn.</p>
                        <p className="mt-0.5 text-[13px] font-semibold text-white">{s.connectors.length}</p>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-violet-300 group-hover:text-white transition">
                        Open
                        <ArrowRightIcon className="h-3 w-3" />
                      </span>
                      {s.notCoveredYet ? (
                        <span className="text-[10px] font-mono uppercase tracking-widest text-white/70">scope known</span>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* AI Ops parallel rail */}
      <section className="mb-10">
        <header className="flex flex-wrap items-baseline gap-3 mb-4">
          <h2 className="text-[14px] font-semibold text-zinc-100">{SUB_TOOL_CATEGORY_META.ai_ops.label}</h2>
          <p className="text-[12px] text-zinc-500">{SUB_TOOL_CATEGORY_META.ai_ops.description}</p>
          <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            {AI_OPS_SURFACES.length}
          </span>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {AI_OPS_SURFACES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 hover:border-emerald-500/30 hover:bg-white/[0.025] transition flex flex-col"
            >
              <h3 className="text-[14px] font-semibold text-white">{s.label}</h3>
              <p className="mt-2 text-[12.5px] text-zinc-400 leading-relaxed">{s.purpose}</p>
              <span className="mt-auto pt-4 inline-flex items-center gap-1 text-[12px] font-medium text-emerald-300 group-hover:text-emerald-200 transition">
                Open
                <ArrowRightIcon className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-[12px] text-zinc-500 max-w-3xl leading-relaxed flex items-start gap-2">
        <PlusIcon className="h-3.5 w-3.5 mt-0.5 text-zinc-500 flex-shrink-0" />
        <span>
          Adding a new sub-tool is one append to{" "}
          <span className="font-mono text-zinc-400">lib/platform/subToolCatalog.ts</span>. Each
          sub-tool then automatically appears here and at{" "}
          <span className="font-mono text-zinc-400">/dashboard/sub-tools/[slug]</span>.
        </span>
      </p>
    </div>
  );
}
