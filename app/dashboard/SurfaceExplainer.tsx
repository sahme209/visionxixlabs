"use client";

/**
 * Surface explainer — Phase 532.
 *
 * Drops a small "what am I looking at?" card at the top of any
 * dashboard surface. Renders ONLY when the operator is in demo mode
 * AND has clicked "Explain this page" in the demo banner.
 *
 * Each page passes a `surface` key (`agi-cockpit`, `agi-memory`, ...)
 * — the component looks up the copy here. Keeping the knowledge base
 * inline so it ships in one PR with the demo wiring, and so any
 * engineer adding a new surface adds its explainer here in the same
 * commit. Closed-union prevents typos.
 */

import { useEffect, useState } from "react";
import { LightBulbIcon } from "@heroicons/react/24/outline";

export const EXPLAINER_SURFACES = [
  "agi-cockpit",
  "agi-memory",
  "agi-suggestions",
  "advisor-council",
  "incident-triage",
  "remediation-proposals",
  "slack-notifications",
  "ai-call-log",
  "releaseops-autonomy",
  "releases",
  "start-here",
] as const;
export type ExplainerSurface = (typeof EXPLAINER_SURFACES)[number];

interface Explanation {
  headline: string;
  body: string;
  /** Optional 2-3 bullets the operator should look for on this page. */
  tour: string[];
}

const EXPLAINERS: Record<ExplainerSurface, Explanation> = {
  "agi-cockpit": {
    headline: "One-pane-of-glass for every AGI engine.",
    body: "Pending recommendations from the release advisor, policy-proposal engine, and proactive-suggestion engine — all in one place, severity-aware, with a single call-to-action banner.",
    tour: [
      "Top stat tiles show your full pending backlog.",
      "AI provider availability strip rolls success rate over the last 50 calls.",
      "Run AGI now triggers all 5 engines on demand.",
    ],
  },
  "agi-memory": {
    headline: "Every Claude-generated rationale, in chronological order.",
    body: "Council decisions, triage routings, remediation proposals — each one gets a 'why this?' narrative + risk factors + next actions. Demo mode preloads a handful of representative entries.",
    tour: [
      "Filter pills scope the feed to one engine.",
      "Ask the AGI to summarize the recent window.",
      "Chat panel asks Claude free-form questions; citations link to source.",
    ],
  },
  "agi-suggestions": {
    headline: "Operator next-actions proposed by Claude.",
    body: "The AGI reads its own memory + meta-summaries and proposes 0–5 concrete things to look at right now. Each suggestion deep-links to the source surface and tracks operator decision (acted / dismissed).",
    tour: [
      "Generate suggestions runs the engine on demand.",
      "Each card has a confidence chip and a kind chip.",
      "Act / Dismiss feeds the audit log so the AGI learns over time.",
    ],
  },
  "advisor-council": {
    headline: "Multi-voter consensus over each release.",
    body: "Three rule-based voters (rule_based, conservative, pragmatic) plus an optional AI-native voter cast votes; the council picks a majority kind weighted by confidence and surfaces dissent.",
    tour: [
      "Each row is one release decision with all voter weights.",
      "Operator can accept / override / dismiss the consensus.",
      "Toggle 'Include AI-native voter' to add Claude as the fourth voter.",
    ],
  },
  "incident-triage": {
    headline: "P0–P3 priority assignment for each incident.",
    body: "The engine reads incident + release + advisor signals + past incidents and projects priority, owner team, ETA, recommended runbook, and an auto-escalate flag.",
    tour: [
      "Each card shows the engine's full rationale.",
      "AI rationale card adds a Claude-generated 'why this?' below the engine output.",
      "Operator can accept the priority or override with a note.",
    ],
  },
  "remediation-proposals": {
    headline: "Concrete on-call action proposals.",
    body: "8 closed-union kinds (rollback_release, disable_feature_flag, restart_service, escalate_to_vendor, ...). Each proposal carries prereqs, expected impact, rollback plan, and reversibility flag.",
    tour: [
      "Demo mode seeds one proposal per incident.",
      "Accept marks it done and writes an audit row.",
      "AI rationale card explains the proposal in plain English.",
    ],
  },
  "slack-notifications": {
    headline: "Critical AGI signals → your Slack.",
    body: "Configure an incoming webhook and pick which signal kinds route (council_critical, triage_auto_escalate, learning_loop_signal, remediation_p0, proactive_suggestion_batch). Every dispatch is logged.",
    tour: [
      "Paste a Slack incoming webhook URL.",
      "Toggle the 5 signal kinds.",
      "Recent deliveries table shows every send / skip / error.",
    ],
  },
  "ai-call-log": {
    headline: "Engineer observability for every AI provider call.",
    body: "Every Claude call across every engine — timed, token-counted, breakered. The circuit breaker opens after 3 failures in the last 10 calls and short-circuits subsequent calls to the rule-based fallback.",
    tour: [
      "Per-engine breakdown shows circuit state, p50/p95 latency, success rate.",
      "Switch scope between your org and global (engineer ops view).",
      "Filter pills scope by engine name.",
    ],
  },
  "releaseops-autonomy": {
    headline: "The hourly autonomous cron's recent activity.",
    body: "Every hour the platform runs all 5 AGI engines (advisor, triage, remediation, policy, proactive suggestion) for every org without operator clicks. This page shows the per-tick report.",
    tour: [
      "Each row is one cron tick.",
      "Per-org breakdown shows ok / error / skipped counts.",
      "Skip thresholds prevent re-running engines that already ran recently.",
    ],
  },
  "releases": {
    headline: "Per-release status, readiness, and evidence.",
    body: "Each row is a release with its current status, readiness score, blocker count, branch governance, and evidence pack pointer.",
    tour: [
      "Status badge: draft / ready / deploying / deployed / failed / rolled_back.",
      "Click into a release for the council + triage + remediation history.",
      "Demo mode seeds three releases at different lifecycle stages.",
    ],
  },
  "start-here": {
    headline: "Zero-touch path to your first audited release.",
    body: "Walks new operators through: sign in, connect a cloud, generate a council decision, accept or override, and ship. Demo mode skips the connect step.",
    tour: [
      "Top section: prerequisite checklist.",
      "Middle: live status of your first connected cloud.",
      "Bottom: the next recommended action.",
    ],
  },
};

export function SurfaceExplainer({ surface }: { surface: ExplainerSurface }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function read() {
      const explainerOn = typeof localStorage !== "undefined" && localStorage.getItem("axiom_demo_explainer") === "1";
      // Only render when BOTH demo mode is active AND the explainer toggle is on.
      const demoOn = typeof document !== "undefined" && document.cookie.split("; ").some((c) => c === "axiom_demo_mode=1");
      setVisible(explainerOn && demoOn);
    }
    read();
    window.addEventListener("axiom-demo-explainer-changed", read);
    return () => window.removeEventListener("axiom-demo-explainer-changed", read);
  }, []);

  if (!visible) return null;
  const ex = EXPLAINERS[surface];

  return (
    <div className="mb-5 rounded-2xl border border-white/[0.10] bg-white/[0.015] p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.12] flex items-center justify-center flex-shrink-0">
          <LightBulbIcon className="h-4 w-4 text-violet-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-violet-300/90 mb-1">what you&apos;re looking at</p>
          <p className="text-[14px] font-medium text-white tracking-[-0.01em] mb-1.5">{ex.headline}</p>
          <p className="text-[12.5px] text-zinc-300 leading-relaxed mb-3 font-light max-w-3xl">{ex.body}</p>
          {ex.tour.length > 0 && (
            <ul className="space-y-1">
              {ex.tour.map((t, i) => (
                <li key={i} className="text-[12px] text-zinc-400 flex gap-2">
                  <span className="text-zinc-500/70 font-mono text-[10.5px] mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
