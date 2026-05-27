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
import { useEffect, useState } from "react";

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
  const [activeStep, setActiveStep] = useState<number>(reduce ? REVEAL_SEQUENCE.length - 1 : 0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => {
      setActiveStep((s) => (s + 1) % (REVEAL_SEQUENCE.length + 2));
    }, 1400);
    return () => clearInterval(id);
  }, [reduce]);

  const liveAgentId = REVEAL_SEQUENCE[Math.min(activeStep, REVEAL_SEQUENCE.length - 1)];

  return (
    <div className="relative">
      {/* Huly aurora — coral × violet × cyan */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="ambient-drift absolute -top-1/4 left-1/3 h-[60vh] w-[50vw] rounded-full bg-brand-violet/[0.08] blur-[140px]" />
        <div className="ambient-drift absolute top-[20%] right-[5%] h-[50vh] w-[40vw] rounded-full bg-brand-coral/[0.06] blur-[130px]" style={{ animationDelay: "-8s" }} />
        <div className="ambient-drift absolute bottom-[10%] left-[5%] h-[40vh] w-[35vw] rounded-full bg-cyan-500/[0.04] blur-[120px]" style={{ animationDelay: "-14s" }} />
      </div>

      {/* ===== HERO ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pt-24 pb-12">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mono-label inline-flex items-center gap-3"
        >
          <span className="text-brand-coral/90 tabular-nums">HW</span>
          <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
          How Axiom works
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-display mt-5 text-4xl md:text-6xl font-bold leading-[1.04]"
        >
          Ten agents.{" "}
          <span className="relative inline-block">
            One human gate.
            <span aria-hidden className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-5 max-w-2xl text-[16px] text-zinc-400 leading-relaxed"
        >
          Every action moves through a typed agent chain. Each agent has a single
          job. The council weighs them. The operator approves. The auditor stamps
          a sha-256 rationale row. Nothing ships without you.
        </motion.p>
      </section>

      {/* ===== AGENT DIAGRAM ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pb-8">
        <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-4 md:p-8 overflow-hidden">
          <div className="aspect-[16/9] relative">
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
                const activeIdx = Math.min(activeStep, REVEAL_SEQUENCE.length - 1);
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
                    transition={{ duration: 0.4 }}
                  />
                );
              })}

              {/* Active pulse on the current node */}
              {nodeById(liveAgentId) && (
                <motion.circle
                  cx={nodeById(liveAgentId)!.x}
                  cy={nodeById(liveAgentId)!.y}
                  r={3}
                  fill="rgba(99,102,241,0.35)"
                  initial={false}
                  animate={{ r: [3, 6, 3], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                />
              )}
            </svg>

            {/* Nodes — absolutely positioned for crisp text */}
            {NODES.map((n) => {
              const activeIdx = Math.min(activeStep, REVEAL_SEQUENCE.length - 1);
              const lit = NODE_INDEX[n.id] <= activeIdx;
              return (
                <motion.div
                  key={n.id}
                  initial={false}
                  animate={{
                    opacity: lit ? 1 : 0.35,
                    scale: n.id === liveAgentId ? 1.05 : 1,
                  }}
                  transition={{ duration: 0.35 }}
                  style={{ left: `${n.x}%`, top: `${n.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full border bg-[#0f0f1f] border-white/[0.08] shadow-[0_0_20px_rgba(0,0,0,0.4)]"
                >
                  <p className="text-[11px] font-semibold text-white whitespace-nowrap">{n.label}</p>
                  <p className="text-[9px] font-mono text-indigo-300 whitespace-nowrap">{n.emits}</p>
                </motion.div>
              );
            })}

            {/* Operator gate overlay — the human approval moment */}
            {activeStep >= REVEAL_SEQUENCE.length && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-2 right-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-emerald-300"
              >
                operator approval · approval_only_no_execution
              </motion.div>
            )}
          </div>

          {/* Steps legend */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-2">
            {NODES.map((n) => {
              const lit = NODE_INDEX[n.id] <= Math.min(activeStep, REVEAL_SEQUENCE.length - 1);
              return (
                <div
                  key={n.id}
                  className={[
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition",
                    n.id === liveAgentId
                      ? "bg-indigo-500/10 border border-indigo-500/30"
                      : lit
                      ? "bg-white/[0.03] border border-white/[0.06]"
                      : "bg-white/[0.01] border border-white/[0.04] opacity-50",
                  ].join(" ")}
                >
                  <span className="text-[12px] font-semibold w-32 truncate">{n.label}</span>
                  <span className="text-[11px] text-zinc-400 flex-1">{n.role}</span>
                  <span className="text-[10px] font-mono text-indigo-300 hidden sm:inline">{n.emits}</span>
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
              title: "Approval-only-no-execution",
              body: "Every change becomes a packet for review. Axiom never auto-applies; it only stages.",
            },
            {
              title: "Closed-union types end-to-end",
              body: "Agent roles, message kinds, severities — hallucinated values break the build, never reach prod.",
            },
            {
              title: "Auditor sha256 stamps",
              body: "Every rationale row is hash-stamped. Auditors verify the row by recomputing the hash.",
            },
          ].map((c) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6 }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
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
