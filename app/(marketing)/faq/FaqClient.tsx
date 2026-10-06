"use client";

/**
 * /faq — operator-honest answers.
 *
 * Each entry maps to a real question a buyer raises in the first
 * call. Answers are deliberately short and link back to the page
 * that proves the claim (trust contract, plans, dashboard module).
 * If a question requires a hand-wave, leave it off this page.
 */

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";

interface FaqEntry {
  q: string;
  category: "safety" | "control" | "data" | "cost" | "fit";
  a: string;
  proof?: { href: string; label: string };
}

const ENTRIES: readonly FaqEntry[] = [
  {
    category: "safety",
    q: "Can Axiom act on production on its own?",
    a: "No. The current product is a governed, desktop-first release workspace. A Playbook can record the decision, required approvals, evidence, validation, and recovery context; it does not claim autonomous production deployment.",
    proof: { href: "/product", label: "product boundaries" },
  },
  {
    category: "safety",
    q: "What's the kill switch?",
    a: "Axiom does not present a self-serve autonomy control as a released production safety mechanism. Sensitive authority remains in the installed Agent and external systems; teams should use their existing provider and change-management controls alongside Axiom.",
    proof: { href: "/security", label: "security boundaries" },
  },
  {
    category: "safety",
    q: "Who's accountable when it makes a wrong call?",
    a: "The authorized human decision remains accountable. In supported workflows, Axiom keeps the release version, actor, decision, validation notes, and evidence context available for review instead of treating an AI recommendation as authority.",
    proof: { href: "/product", label: "governed workflow" },
  },
  {
    category: "control",
    q: "How do I scope blast radius?",
    a: "Keep affected scope, risk context, recovery planning, and required approvers in the Playbook before review. Axiom makes those facts visible; it does not replace your provider controls or change-management policy.",
    proof: { href: "/product", label: "Playbook model" },
  },
  {
    category: "control",
    q: "Can I dry-run before approving?",
    a: "Axiom supports review and dry-run planning where the supported workflow provides it. It does not currently claim a general isolated production-rehearsal environment, so a preview is never presented as proof that production will succeed.",
    proof: { href: "/security", label: "current limits" },
  },
  {
    category: "data",
    q: "Where does my data live?",
    a: "Data handling depends on the supported workflow and customer deployment. Axiom documents tenant scope, credential boundaries, and validation status; teams should complete their own data-flow, retention, and vendor review before connecting regulated systems.",
    proof: { href: "/security", label: "security boundaries" },
  },
  {
    category: "data",
    q: "Is Axiom certified for regulated workloads?",
    a: "No certification or customer compliance outcome is implied. Axiom is designed around practical controls such as least authority, human approval, credential boundaries, and evidence. Healthcare, defense, and other regulated deployments require their own agreements, assessments, and independent evidence.",
    proof: { href: "/security", label: "security posture" },
  },
  {
    category: "data",
    q: "What about prompt injection?",
    a: "Axiom's governed provider path uses service-managed providers, workspace allowlists, and server-side routing controls. Model output is guidance, not deployment authority, and teams must avoid supplying sensitive information beyond their approved data-handling posture.",
  },
  {
    category: "cost",
    q: "How is pricing predictable?",
    a: "Axiom is currently invite-only and no-charge while we validate the governed deployment workflow with design partners. There is no self-serve checkout, no surprise per-action billing, and no promise of a paid plan before the workflow proves useful.",
    proof: { href: "/plans", label: "pilot access" },
  },
  {
    category: "cost",
    q: "What happens when the pilot changes?",
    a: "We discuss any production scope, support expectations, connector permissions, and commercial terms with the workspace owner before changing access. Axiom does not auto-upgrade a workspace or charge a card.",
  },
  {
    category: "fit",
    q: "Does Axiom replace my engineers?",
    a: "No. Axiom helps engineers and approvers make a release understandable and reviewable. It is designed to support human judgment, existing controls, and the operating systems teams already use.",
    proof: { href: "/product", label: "how Axiom fits" },
  },
  {
    category: "fit",
    q: "Does it work alongside Cursor / Cline / Copilot?",
    a: "Yes. Coding tools help create the change; Axiom is intended to organize the governed release decision around that change. Integration availability is shown honestly per workspace and provider, rather than assumed.",
    proof: { href: "/product", label: "product boundaries" },
  },
  {
    category: "fit",
    q: "Can I evaluate Axiom before connecting production systems?",
    a: "Yes. Explore the isolated website sandbox with labeled sample data, then download Axiom Agent. Any evaluation using real services requires an agreed non-production scope and appropriate credentials.",
    proof: { href: "/plans", label: "plans" },
  },
];

const CATEGORIES: ReadonlyArray<{ id: FaqEntry["category"] | "all"; label: string }> = [
  { id: "all",     label: "All questions" },
  { id: "safety",  label: "Safety" },
  { id: "control", label: "Control" },
  { id: "data",    label: "Data + privacy" },
  { id: "cost",    label: "Cost" },
  { id: "fit",     label: "Fit" },
];

const CATEGORY_TONE: Record<FaqEntry["category"], string> = {
  safety:  "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  control: "text-indigo-300  bg-indigo-500/10  border-indigo-500/30",
  data:    "text-cyan-300    bg-cyan-500/10    border-cyan-500/30",
  cost:    "text-zinc-300   bg-white/10   border-white/30",
  fit:     "text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/30",
};

export function FaqClient() {
  const [filter, setFilter] = useState<FaqEntry["category"] | "all">("all");
  const [open, setOpen] = useState<number | null>(0);

  const visible = useMemo(
    () => (filter === "all" ? ENTRIES : ENTRIES.filter((e) => e.category === filter)),
    [filter],
  );

  return (
    <div className="relative">
      {/* Huly aurora — coral × violet × cyan */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="ambient-drift absolute -top-1/4 right-1/4 h-[60vh] w-[50vw] rounded-full bg-brand-violet/[0.08] blur-[140px]" />
        <div className="ambient-drift absolute top-[15%] left-[5%] h-[50vh] w-[40vw] rounded-full bg-brand-coral/[0.06] blur-[130px]" style={{ animationDelay: "-8s" }} />
        <div className="ambient-drift absolute bottom-[5%] right-[10%] h-[40vh] w-[35vw] rounded-full bg-cyan-500/[0.04] blur-[120px]" style={{ animationDelay: "-14s" }} />
      </div>

      {/* ===== HERO ===== */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 md:px-10 pt-24 pb-10">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mono-label inline-flex items-center gap-3"
        >
          <span className="text-brand-coral/90 tabular-nums">FQ</span>
          <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
          Buyer-first answers
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-display mt-5 text-4xl md:text-5xl font-bold leading-[1.04]"
        >
          The honest{" "}
          <span className="relative inline-block">
            FAQ.
            <span aria-hidden className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-5 max-w-2xl text-[15px] text-zinc-400 leading-relaxed"
        >
          {ENTRIES.length} questions a serious buyer raises before the first
          demo. Each answer is short, opinionated, and links back to the page
          that proves the claim.
        </motion.p>
      </section>

      {/* ===== FILTER PILLS ===== */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 md:px-10 pb-6">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { setFilter(c.id); setOpen(null); }}
              className={[
                "rounded-full px-3.5 py-1.5 text-[12px] font-medium transition border",
                filter === c.id
                  ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-200"
                  : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.05]",
              ].join(" ")}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* ===== ACCORDION ===== */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 md:px-10 pb-16">
        <div className="space-y-2">
          {visible.map((e, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={`${filter}-${e.q}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.025, 0.2) }}
                className="surface-glass rounded-2xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-start justify-between gap-4 text-left px-5 py-4 hover:bg-white/[0.02] transition"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={["text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border", CATEGORY_TONE[e.category]].join(" ")}>
                      {e.category}
                    </span>
                    <span className="text-[14px] font-medium text-white">{e.q}</span>
                  </div>
                  <span className="font-mono text-zinc-500 text-[14px] flex-shrink-0 mt-0.5">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      key="body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pt-1 text-[13.5px] text-zinc-400 leading-relaxed border-t border-white/[0.04]">
                        <p className="mt-3">{e.a}</p>
                        {e.proof ? (
                          <Link
                            href={e.proof.href.startsWith("/dashboard") ? "/docs" : e.proof.href}
                            className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-mono text-indigo-300 hover:text-indigo-200 transition"
                          >
                            → {e.proof.label}
                          </Link>
                        ) : null}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ===== CLOSER ===== */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 md:px-10 py-12 text-center">
        <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
          Question we didn't answer?
        </h3>
        <p className="mt-3 text-zinc-400 text-[14px]">
          The fastest path to a real answer is a 30-minute call. We&apos;ll explain
          the supported workflow, the evidence behind it, and any limits that
          still need to be verified.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-[12.5px] font-medium text-white shadow-[0_0_20px_rgba(99,102,241,0.45)] hover:bg-indigo-400 transition"
          >
            Book a call
          </Link>
          <Link
            href="/compare"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[12.5px] font-medium text-zinc-200 hover:bg-white/[0.07] transition"
          >
            Side-by-side
          </Link>
        </div>
      </section>
    </div>
  );
}
