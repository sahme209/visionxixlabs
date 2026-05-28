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
    a: "No. Approval-only-no-execution is a contract at the type level. Every proposal is staged as an approval packet and the operator either approves or rejects. The cockpit refuses to run an action that lacks a signed approval row.",
    proof: { href: "/trust", label: "trust contract" },
  },
  {
    category: "safety",
    q: "What's the kill switch?",
    a: "A single tenant-charter toggle freezes all autonomy verdicts platform-wide. In-flight approvals are voided and the audit row records who pulled the switch. No cluster-wide reboot needed.",
    proof: { href: "/dashboard/charter", label: "autonomy charter" },
  },
  {
    category: "safety",
    q: "Who's accountable when it makes a wrong call?",
    a: "The approver who signed the packet. Every action carries a sha-256 rationale row with the council vote, the boundary verdict, and the human signature. Accountability is a row, not a vibe.",
    proof: { href: "/dashboard/audit", label: "audit log" },
  },
  {
    category: "control",
    q: "How do I scope blast radius?",
    a: "Boundary gates classify every proposed action into a closed-union severity tier. Tenant charters set which tier autonomy can touch — everything above that requires a multi-party approval packet.",
    proof: { href: "/dashboard/automation-boundaries", label: "boundary catalog" },
  },
  {
    category: "control",
    q: "Can I dry-run before approving?",
    a: "Yes. The simulator sandboxes the proposal end-to-end and returns a verdict before the packet is ever assembled. Operators see the simulated outcome attached to the approval card.",
  },
  {
    category: "data",
    q: "Where does my data live?",
    a: "Tenant data stays inside the cloud accounts you wire up. Axiom never copies telemetry into a shared lake — it reads on demand and emits typed events back to your accounts. No vendor data plane.",
    proof: { href: "/trust", label: "trust contract" },
  },
  {
    category: "data",
    q: "How does GDPR data-subject access work?",
    a: "The GDPR DSR handler enforces Article 12 timelines, assembles a per-subject packet across surfaces, and emits a durable audit row. The deletion path is the same flow with a different verdict.",
    proof: { href: "/dashboard/compliance-packet", label: "compliance packet" },
  },
  {
    category: "data",
    q: "What about prompt injection?",
    a: "All operator-bound LLM calls go through a closed-union provider router with PII redaction up front and an output validator on the return path. Untrusted context is quarantined into a read-only frame the agent kernel can't escape.",
  },
  {
    category: "cost",
    q: "How is pricing predictable?",
    a: "Five fixed tiers on /plans, annual toggle for a discount, no per-action surprise. The free-tier AI provider chain (GitHub Models → Ollama → Groq → …) absorbs day-to-day model spend so you don't see provider invoices bleeding through.",
    proof: { href: "/plans", label: "plans" },
  },
  {
    category: "cost",
    q: "What happens if I exceed my tier?",
    a: "Tier caps stage an approval packet — they don't auto-upgrade your bill. The operator decides whether to lift the cap, throttle, or hold. Same contract as every other action.",
  },
  {
    category: "fit",
    q: "Does Axiom replace my engineers?",
    a: "Axiom replaces the work nobody on the team actually wants — the on-call paging, the access-review tickets, the SOC 2 evidence gathering, the cross-tool causal timeline. Your engineers get the headroom to ship features.",
    proof: { href: "/disciplines", label: "26 disciplines" },
  },
  {
    category: "fit",
    q: "Does it work alongside Cursor / Cline / Copilot?",
    a: "Yes — Axiom is a cockpit, not an IDE. Use the editor copilot for code; use Axiom for the operator-facing surface that pairs with your whole company.",
    proof: { href: "/compare", label: "side-by-side" },
  },
  {
    category: "fit",
    q: "Is there a free trial?",
    a: "Yes. The Starter tier is free and runs against your real cloud accounts in read-only mode. You see the proposals stack up without any of them executing until you toggle write access on a per-boundary basis.",
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
  cost:    "text-amber-300   bg-amber-500/10   border-amber-500/30",
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
                            href={e.proof.href}
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
          The fastest path to a real answer is a 30-minute call. We'll route to
          the kernel module that proves the claim — or admit we haven't built it
          yet.
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
