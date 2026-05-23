/**
 * /platform-demo — Phase 405 public marketing demo.
 *
 * Short, polished, public route. Shows the headline product story
 * (connect → analyze → recommend → approve → report) using ONLY the
 * scenarios marked audience='public' in the scenarios registry.
 *
 * Intentionally lighter than /demo. /demo is the full sandbox (every
 * scenario); /platform-demo is the marketing-grade version a prospect
 * sees from the homepage CTA.
 */

import Link from "next/link";
import { listScenarios } from "@/lib/demo/demoScenarios";

export const dynamic = "force-dynamic";

export default function PlatformDemo() {
  // Only the audience='public' scenarios are surfaced here.
  const scenarios = listScenarios("public");

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-10">
      <section className="text-center space-y-4">
        <p className="text-[10px] font-mono text-violet-300 uppercase tracking-[0.32em]">how it works</p>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight max-w-3xl mx-auto leading-tight">
          Connect your stack. Read posture. Recommend safely.
        </h1>
        <p className="text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          VisionXIXLabs reads your cloud + CI + monitoring + database posture, surfaces risks, and proposes fixes —
          but the platform never changes anything without explicit human approval.
        </p>
        <div className="flex items-center justify-center gap-3 pt-4 flex-wrap">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-semibold transition-colors"
          >
            Open the sandbox →
          </Link>
          <Link
            href="/dashboard/start-here"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/[0.12] bg-white/[0.03] hover:bg-white/[0.06] text-zinc-200 text-[13px] font-semibold transition-colors"
          >
            Start a real workspace
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <FlowStep n={1} title="Connect tools" body="AWS · Azure · GCP · GitHub · monitoring · DB. Read-only at install." />
        <FlowStep n={2} title="AI engineers analyze" body="Cloud / DevOps / Security / Monitoring / Incident / Database." />
        <FlowStep n={3} title="Risk detected" body="With evidence + blast radius + ownership." />
        <FlowStep n={4} title="Recommendation" body="Diff + rollback plan + risk tier + confidence." />
        <FlowStep n={5} title="Approval required" body="Two-person human approval before any change runs." />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white">Public demo scenarios</h2>
        <p className="text-zinc-400 text-[13px]">Each one is a 5-12 minute interactive walkthrough using scripted example data.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {scenarios.map((s) => (
            <Link
              key={s.id}
              href={`/demo/${s.id}`}
              className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 hover:border-violet-500/30 hover:bg-violet-500/[0.04] transition-all group"
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <h3 className="text-[14px] font-semibold text-white group-hover:text-violet-200 transition-colors">{s.title}</h3>
                <span className="text-[10px] font-mono text-zinc-600">~{s.estimatedMinutes} min</span>
              </div>
              <p className="text-[12px] text-zinc-400 leading-relaxed">{s.pitch}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="text-center pt-4">
        <h2 className="text-2xl font-bold text-white mb-2">Ready for your own workspace?</h2>
        <p className="text-zinc-400 text-[13px] mb-4">12 setup steps, ~30 minutes, fully read-only until you say otherwise.</p>
        <Link
          href="/dashboard/start-here"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-[13px] font-semibold shadow-glow-violet transition-all"
        >
          Open the setup guide →
        </Link>
      </section>
    </main>
  );
}

function FlowStep({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
      <span className="text-[10px] font-mono text-violet-300 uppercase tracking-[0.18em]">step {n}</span>
      <h3 className="text-[14px] font-semibold text-white mt-1">{title}</h3>
      <p className="text-[12px] text-zinc-400 leading-relaxed mt-1">{body}</p>
    </div>
  );
}
