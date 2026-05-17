import type { Metadata } from "next";
import { DocHeader, DocSection, Callout, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Source modes — Axiom Documentation",
  description: "How Axiom labels every data source it reads from — live, partial_live, preview, expanding, foundation, blocked, disabled, unknown. The honesty contract.",
};

const MODES: { mode: string; tone: string; meaning: string; example: string }[] = [
  {
    mode: "live",
    tone: "emerald",
    meaning: "Axiom is actively reading from the source via authenticated, read-only API calls. Every value rendered comes from the source itself, not a cached preview.",
    example: "AWS in live mode: STS AssumeRole + EC2 / S3 / RDS / VPC / SG / IAM read calls succeed; resource counts + findings are reported by the SDK.",
  },
  {
    mode: "partial_live",
    tone: "cyan",
    meaning: "Some signals from the source are live; others are still preview. Axiom never claims live for a capability that is not yet implemented.",
    example: "GitHub in partial_live: live repo + workflow + branch-protection discovery, but app-level secret-scanning insights are still preview.",
  },
  {
    mode: "preview",
    tone: "amber",
    meaning: "Axiom is using preview data only. No SDK calls have been made to the source. Findings + recommendations are derived from a normalized preview snapshot.",
    example: "Azure in preview: the validator + preview scanner have shipped; live ARM inventory traversal is gated behind AZURE_* credentials on the host.",
  },
  {
    mode: "expanding",
    tone: "amber",
    meaning: "Adapter foundation is in place; the source is moving from preview toward live but not all live calls are wired yet. Honest in-progress state.",
    example: "GCP in expanding: @google-cloud/resource-manager validator runs live; compute + storage inventory traversal is the next milestone.",
  },
  {
    mode: "foundation",
    tone: "zinc",
    meaning: "The surface exists as a typed contract but does not yet have a live signal source. Used for new product surfaces where the model has shipped before the connector.",
    example: "A new compliance framework surface where the control registry is defined but no source-of-truth has been wired yet.",
  },
  {
    mode: "blocked",
    tone: "rose",
    meaning: "Axiom cannot read from the source until an explicit operator action resolves the blocker. The blocker is always shown as a missingRequirements list.",
    example: "AWS in blocked mode: AWS_CONNECTOR_BROKER_ACCESS_KEY_ID + AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY env vars are not set on the host.",
  },
  {
    mode: "disabled",
    tone: "zinc",
    meaning: "The source is intentionally turned off by safety policy or operator config. Not a failure — a chosen state.",
    example: "Desktop localExecutionStatus is always `disabled` on this build — the desktop is a review workstation, never an executor.",
  },
  {
    mode: "unknown",
    tone: "zinc",
    meaning: "Axiom could not determine the source mode. Treated as the lowest-trust state. Never shown as live in any UI.",
    example: "A connector that crashed during initialization before its mode could be resolved.",
  },
];

const TONE_CLASSES: Record<string, { border: string; bg: string; text: string; pill: string }> = {
  emerald: { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300", pill: "bg-emerald-500/15 text-emerald-300" },
  cyan:    { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300",    pill: "bg-cyan-500/15 text-cyan-300"    },
  amber:   { border: "border-amber-500/[0.22]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300"   },
  rose:    { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.04]",    text: "text-rose-300",    pill: "bg-rose-500/15 text-rose-300"    },
  zinc:    { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-300",    pill: "bg-zinc-700/40 text-zinc-300"    },
};

export default function SourceModesPage() {
  return (
    <article className="max-w-3xl mx-auto">
      <DocHeader
        kicker="Honesty contract"
        title="Source modes"
        intro="Every source Axiom reads from carries a typed sourceMode. The UI never shows a value without showing which mode produced it. This page is the canonical reference for what each mode means."
      />

      <DocSection id="why" kicker="why this exists" title="Why label every source">
        <p className="text-zinc-300 leading-relaxed">
          Operators need to know which numbers on the dashboard are <em className="text-zinc-100 not-italic font-semibold">live</em> and which are <em className="text-zinc-100 not-italic font-semibold">preview</em>. A platform that fabricates dollar savings or fakes "connected" status loses operator trust permanently. The source-mode taxonomy is a typed contract: every <code className="font-mono text-[12px] text-cyan-300">ProviderPosture</code>, <code className="font-mono text-[12px] text-cyan-300">SectionEnvelope</code>, and <code className="font-mono text-[12px] text-cyan-300">AxiomOSState</code> shape carries a mode, and the rollup at the top reflects the most conservative section.
        </p>
        <Callout tone="success">
          The TypeScript literal type <code className="font-mono text-[12px] text-emerald-300">AxiomOSSourceMode</code> in <code className="font-mono text-[12px] text-emerald-300">lib/axiomOS/axiomOSModel.ts</code> enforces this. A new mode cannot be added without updating the rollup logic + every UI consumer.
        </Callout>
      </DocSection>

      <DocSection id="modes" kicker="taxonomy" title="The 8 source modes">
        <div className="space-y-3">
          {MODES.map((m) => {
            const t = TONE_CLASSES[m.tone] ?? TONE_CLASSES.zinc;
            return (
              <div key={m.mode} className={`rounded-2xl border ${t.border} ${t.bg} p-5`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${t.pill}`}>
                    {m.mode}
                  </span>
                </div>
                <p className="text-[14px] text-zinc-200 leading-relaxed mb-2">{m.meaning}</p>
                <p className="text-[12px] text-zinc-400 leading-relaxed">
                  <span className="text-zinc-500 font-mono uppercase tracking-wider text-[10px]">Example · </span>
                  {m.example}
                </p>
              </div>
            );
          })}
        </div>
      </DocSection>

      <DocSection id="rollup" kicker="how composites work" title="Rollup rules">
        <p className="text-zinc-300 leading-relaxed">
          Composite source modes (e.g. the overall <code className="font-mono text-[12px] text-cyan-300">AxiomOSState.sourceMode</code>) are computed by <code className="font-mono text-[12px] text-cyan-300">rollupSourceMode()</code> with strict precedence:
        </p>
        <ol className="mt-3 space-y-1 text-zinc-300 leading-relaxed list-decimal pl-5 text-[13px]">
          <li>If any section reports <code className="font-mono text-[12px]">disabled</code> → composite is <code className="font-mono text-[12px]">disabled</code>.</li>
          <li>If any section reports <code className="font-mono text-[12px]">blocked</code> → composite is <code className="font-mono text-[12px]">blocked</code>.</li>
          <li>If any section reports <code className="font-mono text-[12px]">preview</code> → composite is <code className="font-mono text-[12px]">preview</code>.</li>
          <li>If any section reports <code className="font-mono text-[12px]">partial_live</code> → composite is <code className="font-mono text-[12px]">partial_live</code>.</li>
          <li>If any section reports <code className="font-mono text-[12px]">expanding</code> → composite is <code className="font-mono text-[12px]">expanding</code>.</li>
          <li>Only if <em>every</em> section is <code className="font-mono text-[12px]">live</code> → composite is <code className="font-mono text-[12px]">live</code>.</li>
        </ol>
        <Callout tone="info">
          This is the conservative direction: the composite can never claim more than its weakest section. If one provider is in preview, the overall state is preview.
        </Callout>
      </DocSection>

      <DocSection id="where-to-look" kicker="in the product" title="Where source modes appear">
        <ul className="space-y-2 text-zinc-300 leading-relaxed list-disc pl-5 text-[13px]">
          <li><strong className="text-white">Command Center hero</strong> — the eyebrow pill reflects the overall <code className="font-mono text-[12px]">AxiomOSState.sourceMode</code>.</li>
          <li><strong className="text-white">/dashboard/sources</strong> — each provider card shows its per-provider mode.</li>
          <li><strong className="text-white">Posture strips</strong> — security / reliability / observability each show their section sourceMode.</li>
          <li><strong className="text-white">Approval queue</strong> — the queue header shows <code className="font-mono text-[12px]">approvalPosture.sourceMode</code>.</li>
          <li><strong className="text-white">Desktop runtime panel</strong> — header pill reflects <code className="font-mono text-[12px]">DesktopState.sourceMode</code>.</li>
          <li><strong className="text-white">Trust Center evidence</strong> — every evidence record carries the mode that produced it.</li>
        </ul>
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/architecture", label: "Architecture overview" }}
        next={{ href: "/docs/security-model", label: "Security model" }}
      />
      <DocFeedback />
    </article>
  );
}
