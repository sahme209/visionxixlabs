"use client";

/**
 * Huly-style animated marketing hero + discipline showcase + ROI.
 *
 * All client-side — pulls Framer Motion's variants + scroll-revealed
 * sections + a pointer-tracking aurora glow.
 */

import { motion, useScroll, useTransform, useSpring, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
// `useRef` is used by the AnimatedNumber sub-component below.
import Link from "next/link";
import { RoiCalculatorClient } from "./RoiCalculatorClient";
import { SocialProofRail } from "../_components/SocialProofRail";

const DISCIPLINES: ReadonlyArray<{ label: string; tagline: string; emoji?: never; symbol: string }> = [
  { label: "DevOps",            tagline: "Runbooks + IaC drift + auto-rollback",        symbol: "△" },
  { label: "SRE",               tagline: "SLOs, burn rate, postmortems",                 symbol: "○" },
  { label: "Security",          tagline: "KEV correlation, IAM least-priv, baseline",    symbol: "◇" },
  { label: "Platform",          tagline: "Policy gate, boundary gate, drift detector",   symbol: "▽" },
  { label: "FinOps",            tagline: "Cost forecast, anomaly attribution",           symbol: "◊" },
  { label: "Data",              tagline: "Query plan, feature freshness",                 symbol: "⬡" },
  { label: "ML",                tagline: "PSI drift, free-tier AI provider chain",        symbol: "⌬" },
  { label: "QA",                tagline: "Visual regression, lint summary, PR risk",      symbol: "✕" },
  { label: "Network",           tagline: "DNS sanity, subnet allocator",                  symbol: "⌖" },
  { label: "Mobile",            tagline: "Crash fingerprint, push, deep links",           symbol: "▣" },
  { label: "Frontend / a11y",   tagline: "WCAG aggregator, Web Vitals budget",            symbol: "◧" },
  { label: "IT helpdesk",       tagline: "Ticket triage + SLA breach",                    symbol: "◮" },
  { label: "IAM lifecycle",     tagline: "SCIM joiner / mover / leaver",                  symbol: "✎" },
  { label: "Observability",     tagline: "Log aggregator, fingerprinted errors",          symbol: "◐" },
  { label: "Customer success",  tagline: "Health score per tenant",                       symbol: "✦" },
  { label: "Localization",      tagline: "i18n bundle + placeholder validator",           symbol: "✪" },
  { label: "DR / BC",           tagline: "RTO/RPO + drill cadence + failover",            symbol: "❖" },
  { label: "Privacy",           tagline: "GDPR DSR workflow, PII redactor",               symbol: "❉" },
  { label: "Release",           tagline: "Deploy windows, release notes",                 symbol: "▼" },
  { label: "Capacity",          tagline: "Auto-scale planner, saturation",                symbol: "⬢" },
];

const STATS = [
  { label: "Engineering disciplines", value: 25, suffix: "+" },
  { label: "Agent kernels",           value: 10, suffix: "" },
  { label: "Free AI providers",       value: 9,  suffix: "" },
  { label: "Modules shipped",         value: 150, suffix: "+" },
  { label: "Tests passing",           value: 1122, suffix: "" },
  { label: "Surfaces (web / mobile / desktop)", value: 3, suffix: "" },
];

// Rough US-market loaded annual cost per specialist (base + benefits + tooling).
const ROLE_COSTS_USD: ReadonlyArray<{ role: string; loadedAnnual: number }> = [
  { role: "Senior DevOps",          loadedAnnual: 220_000 },
  { role: "Senior SRE",             loadedAnnual: 240_000 },
  { role: "Senior security",        loadedAnnual: 260_000 },
  { role: "Platform engineer",      loadedAnnual: 230_000 },
  { role: "FinOps analyst",         loadedAnnual: 170_000 },
  { role: "Data engineer",          loadedAnnual: 220_000 },
  { role: "ML engineer",            loadedAnnual: 260_000 },
  { role: "QA lead",                loadedAnnual: 180_000 },
  { role: "Network engineer",       loadedAnnual: 200_000 },
  { role: "Frontend engineer",      loadedAnnual: 200_000 },
  { role: "Mobile engineer",        loadedAnnual: 210_000 },
  { role: "IT helpdesk lead",       loadedAnnual: 140_000 },
  { role: "IAM / identity",         loadedAnnual: 200_000 },
  { role: "Observability engineer", loadedAnnual: 230_000 },
];

const TEAM_TOTAL = ROLE_COSTS_USD.reduce((s, r) => s + r.loadedAnnual, 0);
const usd = (n: number): string => `$${n.toLocaleString("en-US")}`;

function useAuroraPointer() {
  const [coords, setCoords] = useState({ x: 0.5, y: 0.3 });
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setCoords({ x: e.clientX / Math.max(1, w), y: e.clientY / Math.max(1, h) });
    }
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  return coords;
}

function AnimatedNumber({ value, durationMs = 1500 }: { value: number; durationMs?: number }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const seen = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !seen.current) {
            seen.current = true;
            const start = performance.now();
            const tick = (now: number) => {
              const t = Math.min(1, (now - start) / durationMs);
              const eased = 1 - Math.pow(1 - t, 3);
              setN(Math.round(value * eased));
              if (t < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, durationMs]);

  return <span ref={ref} className="tabular-nums">{n.toLocaleString("en-US")}</span>;
}

export function TeamOfOneClient() {
  const reduce = useReducedMotion();
  const aurora = useAuroraPointer();

  const { scrollYProgress } = useScroll();
  const ySpring = useSpring(scrollYProgress, { stiffness: 80, damping: 30 });
  const heroOpacity = useTransform(ySpring, [0, 0.2], [1, 0.3]);
  const heroScale = useTransform(ySpring, [0, 0.2], [1, 0.95]);

  const cursorStyle = useMemo<React.CSSProperties>(
    () => ({
      background: `radial-gradient(640px circle at ${aurora.x * 100}% ${aurora.y * 100}%, rgba(99,102,241,0.18), transparent 65%)`,
    }),
    [aurora.x, aurora.y],
  );

  return (
    <div className="relative min-h-screen bg-[#070713] text-zinc-100 overflow-x-hidden">
      {/* Cursor-tracking aurora — pointer is hidden when prefers-reduced-motion */}
      {!reduce && <div className="pointer-events-none fixed inset-0 z-0" style={cursorStyle} />}

      {/* Huly aurora — coral × violet × cyan */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="ambient-drift absolute -top-1/4 left-1/4 h-[70vh] w-[55vw] rounded-full bg-brand-violet/[0.10] blur-[150px]" />
        <div className="ambient-drift absolute top-[15%] right-[5%] h-[55vh] w-[45vw] rounded-full bg-brand-coral/[0.07] blur-[140px]" style={{ animationDelay: "-8s" }} />
        <div className="ambient-drift absolute -bottom-1/4 right-1/4 h-[60vh] w-[45vw] rounded-full bg-cyan-500/[0.06] blur-[130px]" style={{ animationDelay: "-14s" }} />
      </div>

      <style jsx>{`
        @keyframes aurora-a { 0% { transform: translate(0,0); } 100% { transform: translate(8vw,-4vh); } }
        @keyframes aurora-b { 0% { transform: translate(0,0); } 100% { transform: translate(-6vw,4vh); } }
      `}</style>

      {/* ===== HERO ===== */}
      <motion.section
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pt-28 pb-24"
      >
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="mono-label inline-flex items-center gap-3"
        >
          <span className="text-brand-coral/90 tabular-nums">T1</span>
          <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
          </span>
          AGI ops · approval_only_no_execution
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.15 }}
          className="font-display mt-6 text-5xl md:text-7xl font-bold leading-[1.04]"
        >
          A whole IT team{" "}
          <span className="relative inline-block">
            in one platform.
            <span aria-hidden className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3 }}
          className="mt-6 max-w-2xl text-[17px] leading-relaxed text-zinc-400"
        >
          Twenty-five engineering disciplines. Ten specialist agents that coordinate over a typed
          bus. Three surfaces — web, mobile, desktop. Nine free AI providers with deterministic
          fallback. Axiom amplifies a single operator across cloud, DevOps, security, observability,
          and business operations — and never applies a change without an approval.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.45 }}
          className="mt-8 flex flex-wrap items-center gap-3"
        >
          <Link
            href="/dashboard/command-center"
            className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_30px_rgba(99,102,241,0.45)] hover:bg-indigo-400 transition"
          >
            Open the cockpit →
          </Link>
          <Link
            href="/status"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-5 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.06] transition"
          >
            Live platform status
          </Link>
        </motion.div>

        {/* Animated number band */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-6">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                <AnimatedNumber value={s.value} />{s.suffix}
              </p>
              <p className="mt-1 text-[12px] uppercase tracking-widest text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* ===== DISCIPLINE SHOWCASE ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 py-16">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7 }}
          className="text-3xl md:text-4xl font-bold tracking-[-0.025em]"
        >
          One person, twenty-five specialists in their head.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-3 max-w-2xl text-[15px] text-zinc-400"
        >
          Every discipline gets a typed kernel + deterministic fallback. No vendor lock-in. No
          paid-API requirement. Each card below is a real module shipped + unit-tested in this repo.
        </motion.p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DISCIPLINES.map((d, i) => (
            <motion.div
              key={d.label}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.5, delay: Math.min(i * 0.03, 0.4) }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-indigo-500/30 hover:bg-white/[0.04] transition"
            >
              <div className="text-2xl text-indigo-300 mb-2 font-mono">{d.symbol}</div>
              <p className="text-[14px] font-semibold text-white">{d.label}</p>
              <p className="mt-1 text-[12px] leading-snug text-zinc-400">{d.tagline}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===== MILLION DOLLAR TEAM ROI ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7 }}
          className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-indigo-500/[0.07] via-violet-500/[0.04] to-transparent p-8 md:p-12"
        >
          <p className="text-[10px] font-mono uppercase tracking-widest text-indigo-300 mb-3">
            ROI · loaded annual cost
          </p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-[-0.025em] leading-[1.05]">
            A US-market specialist roster costs{" "}
            <span className="bg-gradient-to-r from-emerald-300 to-indigo-300 bg-clip-text text-transparent">
              <AnimatedNumber value={TEAM_TOTAL} durationMs={2200} />
            </span>{" "}
            / year.
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] text-zinc-400 leading-relaxed">
            That's just 14 senior roles, loaded salary + benefits + tooling. Hiring all of them
            takes 12-18 months and they still need an on-call rotation. Axiom covers the same
            disciplines on day one — and every action lands on a human's review queue, not in
            production.
          </p>

          <div className="mt-10 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  <th className="py-2">Role</th>
                  <th className="py-2 text-right">Loaded annual</th>
                </tr>
              </thead>
              <tbody>
                {ROLE_COSTS_USD.map((r) => (
                  <tr key={r.role} className="border-t border-white/[0.04]">
                    <td className="py-2 text-zinc-300">{r.role}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-zinc-200">{usd(r.loadedAnnual)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-indigo-500/30">
                  <td className="py-3 font-semibold text-white">Total</td>
                  <td className="py-3 text-right font-mono tabular-nums font-bold text-indigo-200">{usd(TEAM_TOTAL)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.div>
      </section>

      {/* ===== INTERACTIVE ROI CALCULATOR ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 py-12">
        <RoiCalculatorClient />
      </section>

      {/* ===== SOCIAL PROOF ===== */}
      <SocialProofRail />

      {/* ===== CLOSER ===== */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 md:px-10 py-24 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7 }}
          className="text-3xl md:text-5xl font-bold tracking-[-0.025em] leading-[1.05]"
        >
          The team is built. The cockpit is open.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-4 text-zinc-400"
        >
          Every action is staged, reviewed, and recorded. Axiom never applies a change on its own.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-8 flex items-center justify-center gap-3"
        >
          <Link
            href="/dashboard/command-center"
            className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-6 py-3 text-sm font-medium text-white shadow-[0_0_30px_rgba(99,102,241,0.45)] hover:bg-indigo-400 transition"
          >
            Open the cockpit →
          </Link>
          <Link
            href="/plans"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-6 py-3 text-sm text-zinc-300 hover:bg-white/[0.06] transition"
          >
            See plans
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
