"use client";

/**
 * Animated 10-agent communication walkthrough.
 *
 * A scripted sequence walks the user through detector → reasoner →
 * simulator → policy_gate → boundary_gate → council → approver →
 * verifier → auditor → improver. Each step lights up its node + the
 * inbound edge with a Framer Motion stagger, then the operator's
 * approval gate is highlighted in green to drive home the safety
 * contract.
 */

import { motion, useReducedMotion } from "framer-motion";
import { PageHero } from "@/components/marketing/PageHero";

interface AgentNode {
  id: string;
  label: string;
  role: string;
  emits: string;
  x: number;       // 0..100
  y: number;       // 0..100
}

// Layout chosen so the council sits at the center and the operator
// approval node sits above as the human gate.
const NODES: readonly AgentNode[] = [
  { id: "detector",      label: "Detector",      role: "watches telemetry",                  emits: "broadcast_signal",     x: 8,  y: 50 },
  { id: "reasoner",      label: "Reasoner",      role: "forms a hypothesis",                 emits: "hypothesis_proposed",  x: 22, y: 28 },
  { id: "simulator",     label: "Simulator",     role: "sandboxes the change",                emits: "simulation_result",    x: 22, y: 72 },
  { id: "policy_gate",   label: "Policy gate",   role: "applies tenant charter",              emits: "policy_verdict",       x: 42, y: 20 },
  { id: "boundary_gate", label: "Boundary gate", role: "classifies blast radius",             emits: "boundary_verdict",     x: 42, y: 80 },
  { id: "council",       label: "Council",       role: "weighted vote · ⅔ default",           emits: "council_consensus",    x: 62, y: 50 },
  { id: "approver",      label: "Approver",      role: "stages an approval packet",           emits: "approval_request",     x: 80, y: 28 },
  { id: "verifier",      label: "Verifier",      role: "post-execution check",                emits: "verification_outcome", x: 80, y: 72 },
  { id: "auditor",       label: "Auditor",       role: "writes the durable rationale row",    emits: "audit_completed",      x: 93, y: 50 },
  { id: "improver",      label: "Improver",      role: "proposes method improvements",        emits: "method_improvement",   x: 50, y: 95 },
];

interface Edge {
  from: string;
  to: string;
  kind: string;
}

const EDGES: readonly Edge[] = [
  { from: "detector",      to: "reasoner",      kind: "broadcast_signal" },
  { from: "reasoner",      to: "simulator",     kind: "hypothesis_proposed" },
  { from: "reasoner",      to: "policy_gate",   kind: "hypothesis_proposed" },
  { from: "simulator",     to: "boundary_gate", kind: "simulation_result" },
  { from: "policy_gate",   to: "council",       kind: "policy_verdict" },
  { from: "boundary_gate", to: "council",       kind: "boundary_verdict" },
  { from: "council",       to: "approver",      kind: "council_consensus" },
  { from: "approver",      to: "verifier",      kind: "approval_request" },
  { from: "verifier",      to: "auditor",       kind: "verification_outcome" },
  { from: "auditor",       to: "improver",      kind: "audit_completed" },
];

// Reveal order — staggered timing for the diagram animation.
const REVEAL_SEQUENCE: readonly string[] = [
  "detector", "reasoner", "simulator", "policy_gate",
  "boundary_gate", "council", "approver", "verifier", "auditor", "improver",
];

const NODE_INDEX: Record<string, number> = Object.fromEntries(
  REVEAL_SEQUENCE.map((id, i) => [id, i]),
);

function nodeById(id: string): AgentNode | undefined {
  return NODES.find((n) => n.id === id);
}

export function HowItWorksClient() {
  const reduce = useReducedMotion();
  const activeStep = REVEAL_SEQUENCE.length;

  const displayStep = reduce ? REVEAL_SEQUENCE.length : activeStep;
  const liveAgentId = REVEAL_SEQUENCE[Math.min(displayStep, REVEAL_SEQUENCE.length - 1)];

  return (
    <div className="public-detail-page public-how-it-works-page">
      <section className="public-detail-header">
        <PageHero eyebrow="Axiom · Control architecture" title="Ten agents." muted="One human gate." lead="Inspect the typed agent chain: each agent has a single job, the council weighs its outputs, the operator reviews the proposal, and the auditor records a SHA-256 rationale row." note="Conceptual communication diagram, not live deployment activity. Complete Governance coverage and activation remain incomplete." />
      </section>

      {/* ===== AGENT DIAGRAM ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pb-8">
        <div className="public-agent-diagram rounded-3xl border border-white/6 bg-white/2 p-4 md:p-8 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <p className="text-xs text-zinc-400">Illustrated architecture · no actions performed</p>

          </div>
          <div className="public-agent-diagram-canvas aspect-video relative">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full"
              role="img"
              aria-label="Agent communication diagram"
            >
              {/* Edges */}
              {EDGES.map((e, i) => {
                const a = nodeById(e.from);
                const b = nodeById(e.to);
                if (!a || !b) return null;
                const activeIdx = Math.min(displayStep, REVEAL_SEQUENCE.length - 1);
                const lit = NODE_INDEX[e.from] <= activeIdx && NODE_INDEX[e.to] <= activeIdx;
                return (
                  <motion.line
                    key={`${e.from}-${e.to}-${i}`}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={lit ? "rgba(165,180,252,0.85)" : "rgba(255,255,255,0.08)"}
                    strokeWidth={lit ? 0.4 : 0.2}
                    strokeLinecap="round"
                    initial={false}
                    animate={{ opacity: lit ? 1 : 0.35 }}
                    transition={{ duration: reduce ? 0 : 0.4 }}
                  />
                );
              })}

              {/* Active pulse on the current node */}

            </svg>

            {/* Nodes — absolutely positioned for crisp text */}
            {NODES.map((n) => {
              const activeIdx = Math.min(displayStep, REVEAL_SEQUENCE.length - 1);
              const lit = NODE_INDEX[n.id] <= activeIdx;
              return (
                <motion.div
                  key={n.id}
                  initial={false}
                  animate={{
                    opacity: lit ? 1 : 0.35,
                    scale: reduce ? 1 : n.id === liveAgentId ? 1.05 : 1,
                  }}
                  transition={{ duration: reduce ? 0 : 0.35 }}
                  style={{ left: `${n.x}%`, top: `${n.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/8 bg-brand-ink-card px-3 py-1.5 shadow-[0_0_20px_rgba(0,0,0,0.4)]"
                >
                  <p className="text-[11px] font-semibold text-white whitespace-nowrap">{n.label}</p>
                  <p className="text-[9px] font-mono text-zinc-300 whitespace-nowrap">{n.emits}</p>
                </motion.div>
              );
            })}

            {/* Operator gate overlay — the human approval moment */}
            {displayStep >= REVEAL_SEQUENCE.length && (
              <motion.div
                initial={reduce ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-2 right-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-emerald-300"
              >
                operator approval · approval_only_no_execution
              </motion.div>
            )}
          </div>

          {/* Steps legend */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-2" role="list" aria-label="Agent responsibilities">
            {NODES.map((n) => {
              const lit = NODE_INDEX[n.id] <= Math.min(displayStep, REVEAL_SEQUENCE.length - 1);
              return (
                <div
                  key={n.id}
                  role="listitem"
                  className={[
                    "public-agent-legend-row flex items-center gap-3 px-3 py-2 rounded-lg transition",
                    n.id === liveAgentId
                      ? "bg-zinc-500/10 border border-zinc-500/30"
                      : lit
                      ? "bg-white/3 border border-white/6"
                      : "bg-white/1 border border-white/4 opacity-50",
                  ].join(" ")}
                >
                  <span className="text-[12px] font-semibold w-32 shrink-0">{n.label}</span>
                  <span className="text-[11px] text-zinc-400 flex-1">{n.role}</span>
                  <span className="text-[10px] font-mono text-zinc-300">{n.emits}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== SAFETY CONTRACT ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: "Preparation, review, execution",
              body: "Preparation and review are separate from execution. Supported operations can make real changes under their exact permission, approval and operation checks. A staged plan is not a completed action.",
            },
            {
              title: "Typed contracts and validation",
              body: "Typed contracts describe supported roles, message kinds and severities, with runtime validation where implemented. Types alone do not validate every runtime input or prove production safety.",
            },
            {
              title: "Auditor sha256 stamps",
              body: "Every rationale row is hash-stamped. Auditors verify the row by recomputing the hash.",
            },
          ].map((c) => (
            <motion.div
              key={c.title}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: reduce ? 0 : 0.6 }}
              className="surface-glass rounded-2xl p-5 hover:border-brand-coral/25 transition-all"
            >
              <p className="text-[13px] font-semibold text-white">{c.title}</p>
              <p className="mt-2 text-[12px] text-zinc-400 leading-relaxed">{c.body}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
