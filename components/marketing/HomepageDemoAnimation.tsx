"use client";

/**
 * HomepageDemoAnimation — premium animated product walkthrough.
 *
 * Cursor precision: each step's primary action element carries a
 * `data-cursor-target="true"` attribute. After the AppStateBody mounts
 * (post framer-motion mode="wait" enter), the cursor reads the target's
 * bounding rect relative to the viewport container and animates to its
 * centre — so the cursor actually clicks on real UI, not a fixed %.
 *
 * Re-measures on window resize. Falls back to viewport centre if no
 * target is found.
 *
 * Self-contained — no fake-data leak into client surfaces. Public
 * marketing homepage only.
 */

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CloudIcon,
  ShieldExclamationIcon,
  BoltIcon,
  RocketLaunchIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  SignalIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";

type AppState =
  | "connector_validating"
  | "scan_running"
  | "iam_risk_detected"
  | "alert_linked"
  | "deployment_checked"
  | "approval_requested"
  | "approval_granted"
  | "report_generated"
  | "dashboard_healthy";

interface Step {
  id: number;
  label: string;
  description: string;
  state: AppState;
  holdMs: number;
}

const STEPS: readonly Step[] = [
  { id: 1, label: "Connect AWS",        description: "Cursor clicks Connect → IAM role validated.",                state: "connector_validating", holdMs: 2400 },
  { id: 2, label: "Scan environment",   description: "Cloud Agent inventories resources in 3 regions.",            state: "scan_running",         holdMs: 2400 },
  { id: 3, label: "IAM risk detected",  description: "Security Agent flags an over-privileged role.",              state: "iam_risk_detected",    holdMs: 2400 },
  { id: 4, label: "Alert linked",       description: "Monitoring Agent attaches an alert to the affected service.",state: "alert_linked",         holdMs: 2200 },
  { id: 5, label: "Check deployment",   description: "DevOps Agent reviews the most recent deploy.",               state: "deployment_checked",   holdMs: 2200 },
  { id: 6, label: "Approval requested", description: "Risky remediation staged — waiting for human sign-off.",     state: "approval_requested",   holdMs: 2600 },
  { id: 7, label: "Human approves",     description: "One click — the loop continues with an audit row written.",  state: "approval_granted",     holdMs: 2200 },
  { id: 8, label: "Report generated",   description: "Operator gets a one-page summary with linked evidence.",     state: "report_generated",     holdMs: 2400 },
  { id: 9, label: "Dashboard healthy",  description: "All services back to green. Cycle loops.",                   state: "dashboard_healthy",    holdMs: 2400 },
];

export function HomepageDemoAnimation() {
  const [stepIdx, setStepIdx] = useState(0);
  const [cursorXY, setCursorXY] = useState<{ x: number; y: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Advance steps.
  useEffect(() => {
    const t = setTimeout(() => setStepIdx((i) => (i + 1) % STEPS.length), STEPS[stepIdx].holdMs);
    return () => clearTimeout(t);
  }, [stepIdx]);

  const step = STEPS[stepIdx];

  // Measure the active target element and pin the cursor to its centre.
  // Runs after the AnimatePresence enter (~400ms), then again on resize.
  useLayoutEffect(() => {
    let raf = 0;
    const measure = () => {
      const vp = viewportRef.current;
      if (!vp) return;
      const target = vp.querySelector<HTMLElement>('[data-cursor-target="true"]');
      const vpRect = vp.getBoundingClientRect();
      if (target) {
        const tRect = target.getBoundingClientRect();
        setCursorXY({
          x: tRect.left - vpRect.left + tRect.width / 2,
          y: tRect.top  - vpRect.top  + tRect.height / 2,
        });
      } else {
        // Fallback — viewport centre.
        setCursorXY({ x: vpRect.width / 2, y: vpRect.height / 2 });
      }
    };

    // Wait for body enter animation (~400ms) before locking onto the new target.
    const t = setTimeout(() => { raf = requestAnimationFrame(measure); }, 420);

    const onResize = () => { raf = requestAnimationFrame(measure); };
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [step.state]);

  return (
    <div className="relative">
      {/* Soft coral × violet gradient mesh behind the frame — Huly-style */}
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 blur-3xl opacity-60"
        style={{
          background:
            "radial-gradient(40% 50% at 20% 30%, rgba(168,85,247,0.35), transparent 60%)," +
            "radial-gradient(35% 40% at 80% 60%, rgba(244,114,182,0.28), transparent 60%)," +
            "radial-gradient(30% 30% at 50% 90%, rgba(56,189,248,0.20), transparent 60%)",
        }}
      />

      <div className="product-frame-glow" aria-hidden />
      <div className="product-frame rounded-xl overflow-hidden">
        {/* Browser chrome */}
        <div className="bg-[#0a0a0c] border-b border-white/[0.05] px-4 py-2.5 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
          <div className="ml-3 flex-1 max-w-[280px] rounded-md bg-white/[0.04] border border-white/[0.06] px-2.5 py-0.5">
            <span className="text-[10px] font-mono text-zinc-400">Axiom Agent · installed application</span>
          </div>
        </div>

        {/* App viewport — ref-tracked for cursor positioning */}
        <div ref={viewportRef} className="relative bg-[#0c0c0e] aspect-[16/11] overflow-hidden">
          {/* Step label ribbon — Huly-style 01 / 09 numerals + coral hairline */}
          <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-2">
            <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-rose-200/90 bg-rose-500/[0.12] border border-rose-400/30 rounded-full px-2 py-0.5 tabular-nums">
              {String(step.id).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
            </span>
            <span className="text-[10.5px] font-medium text-zinc-100 tracking-tight">{step.label}</span>
          </div>

          {/* App body — content swaps based on state */}
          <div className="absolute inset-0 p-4 pt-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.state}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="h-full"
              >
                <AppStateBody state={step.state} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Animated cursor — only render once we have a real target. */}
          {cursorXY && (
            <motion.div
              className="absolute z-30 pointer-events-none"
              animate={{ left: cursorXY.x, top: cursorXY.y }}
              /* Slower cinematic ease — Apple product-video feel. */
              transition={{ duration: 1.2, ease: [0.16, 1, 0.30, 1] }}
              style={{ translateX: "-50%", translateY: "-50%" }}
            >
              <CursorIcon />
              {/* Single deliberate click flash — slower, softer, more intentional */}
              <motion.span
                className="absolute -translate-x-1/2 -translate-y-1/2 left-0 top-0 rounded-full border"
                style={{ borderColor: "rgba(244,114,182,0.55)" }}
                initial={{ width: 0, height: 0, opacity: 0 }}
                animate={{ width: 44, height: 44, opacity: [0, 0.7, 0] }}
                transition={{ duration: 1.4, ease: [0.16, 1, 0.30, 1], repeat: Infinity, repeatDelay: 1.6 }}
                aria-hidden
              />
            </motion.div>
          )}
        </div>

        {/* Description footer */}
        <div className="bg-[#0a0a0c] border-t border-white/[0.05] px-4 py-2.5 min-h-[44px] flex items-center">
          <p className="text-[11.5px] text-zinc-300/85 leading-snug">{step.description}</p>
        </div>
      </div>

      {/* Step pips — coral active, white rest */}
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setStepIdx(i)}
            aria-label={`Jump to ${s.label}`}
            className={`h-1 rounded-full transition-all ${
              i === stepIdx ? "w-7 bg-gradient-to-r from-rose-400 to-violet-400" : "w-1.5 bg-white/15 hover:bg-white/25"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function CursorIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="drop-shadow-[0_2px_10px_rgba(244,114,182,0.55)]">
      <path
        d="M3 2 L3 17 L7 13 L10 19 L13 18 L10 12 L17 12 Z"
        fill="white"
        stroke="rgba(244,114,182,0.9)"
        strokeWidth="1.2"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Per-state bodies — each one MARKS its primary action element with
// `data-cursor-target="true"`. The outer component locks the cursor to
// that element's centre. Bodies also wrap the target in a soft coral
// highlight ring so the click visibly lands on a "real" UI affordance.
// ---------------------------------------------------------------------------

const targetRing =
  "rounded-md ring-2 ring-rose-400/35 ring-offset-2 ring-offset-[#0c0c0e] shadow-[0_0_20px_rgba(244,114,182,0.18)]";

function AppStateBody({ state }: { state: AppState }) {
  switch (state) {
    case "connector_validating":
      return (
        <div className="space-y-2.5">
          <div data-cursor-target="true" className={targetRing}>
            <Row icon={CloudIcon} tone="text-amber-300" title="Connect AWS" detail="Verifying IAM role… STS GetCallerIdentity OK." />
          </div>
          <Row icon={CloudIcon} tone="text-zinc-500" title="Connect Azure" detail="Not yet connected." muted />
          <Row icon={CloudIcon} tone="text-zinc-500" title="Connect GCP"   detail="Not yet connected." muted />
          <Progress label="Validating credentials" pct={68} tone="amber" />
        </div>
      );
    case "scan_running":
      return (
        <div className="space-y-2.5">
          <div data-cursor-target="true" className={targetRing}>
            <Row icon={CpuChipIcon} tone="text-cyan-300" title="Cloud Agent · scanning" detail="3 regions · 412 resources · 17 candidate findings." />
          </div>
          <Progress label="Scan progress" pct={72} tone="cyan" />
          <div className="grid grid-cols-3 gap-2">
            <Stat label="EC2" value="148" />
            <Stat label="S3"  value="93"  />
            <Stat label="RDS" value="12"  />
          </div>
        </div>
      );
    case "iam_risk_detected":
      return (
        <div className="space-y-2.5">
          <div data-cursor-target="true" className={targetRing}>
            <Row icon={ShieldExclamationIcon} tone="text-rose-300" title="IAM risk · ProductionAdmin role" detail="17 services granted unused. Suggested fix ready." />
          </div>
          <Row icon={ShieldExclamationIcon} tone="text-amber-300" title="Public S3 bucket" detail="prod-static-assets · suggested fix: enable block-public." muted />
          <Pill text="Severity · critical" tone="rose" />
        </div>
      );
    case "alert_linked":
      return (
        <div className="space-y-2.5">
          <div data-cursor-target="true" className={targetRing}>
            <Row icon={SignalIcon} tone="text-cyan-300" title="Alert linked → payments-api"  detail="p95 ↑ 240ms → 950ms · 3 alerts merged into one incident." />
          </div>
          <Row icon={SignalIcon} tone="text-zinc-300" title="2 related alerts suppressed"  detail="Same root cause — noise reducer combined them." muted />
        </div>
      );
    case "deployment_checked":
      return (
        <div className="space-y-2.5">
          <Row icon={RocketLaunchIcon} tone="text-violet-300" title="payments-api · deploy 18:42 UTC" detail="Suspect change · IAM policy diff in same window." />
          <span data-cursor-target="true" className={`inline-block ${targetRing}`}>
            <Pill text="Rollback drafted · awaiting approval" tone="amber" />
          </span>
        </div>
      );
    case "approval_requested":
      return (
        <div className="space-y-2.5">
          <Row icon={BoltIcon} tone="text-amber-300" title="Approval request · scoped rollback" detail="Risk: medium · Blast radius: payments-api only · Diff included." />
          <div className="flex items-center gap-2">
            <button
              data-cursor-target="true"
              className={`text-[11px] px-3 py-1.5 rounded-md bg-emerald-500/25 text-emerald-100 border border-emerald-400/50 font-medium ${targetRing}`}
            >
              Approve
            </button>
            <button className="text-[11px] px-2.5 py-1 rounded-md bg-white/[0.04] text-zinc-300 border border-white/[0.10]">Edit</button>
            <button className="text-[11px] px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/30">Reject</button>
          </div>
        </div>
      );
    case "approval_granted":
      return (
        <div className="space-y-2.5">
          <div data-cursor-target="true" className={targetRing}>
            <Row icon={CheckCircleIcon} tone="text-emerald-300" title="Approved · executing rollback" detail="Audit row written · sha-256 rationale persisted · 3-step plan running." />
          </div>
          <Progress label="Applying rollback" pct={94} tone="emerald" />
        </div>
      );
    case "report_generated":
      return (
        <div className="space-y-2.5">
          <div data-cursor-target="true" className={targetRing}>
            <Row icon={DocumentTextIcon} tone="text-violet-300" title="Incident report · ready" detail="Timeline · root cause · 6 follow-up tasks · postmortem attached." />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="MTTR"       value="11m" />
            <Stat label="Tasks"      value="6"   />
            <Stat label="Audit rows" value="42"  />
          </div>
        </div>
      );
    case "dashboard_healthy":
      return (
        <div className="space-y-2.5">
          <Row icon={CheckCircleIcon} tone="text-emerald-300" title="All services healthy" detail="payments-api · search-api · jobs-worker · auth-svc · all green." />
          <div className="grid grid-cols-4 gap-2">
            {["payments", "search", "jobs", "auth"].map((s, i) => (
              <div
                key={s}
                data-cursor-target={i === 0 ? "true" : undefined}
                className={`rounded-md border border-emerald-500/20 bg-emerald-500/[0.05] px-2 py-1.5 ${i === 0 ? targetRing : ""}`}
              >
                <p className="text-[10px] font-mono text-emerald-200">{s}</p>
                <p className="text-[9px] text-zinc-400">healthy</p>
              </div>
            ))}
          </div>
        </div>
      );
  }
}

function Row({ icon: Icon, tone, title, detail, muted }: { icon: typeof CloudIcon; tone: string; title: string; detail: string; muted?: boolean }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-md border border-white/[0.05] ${muted ? "bg-white/[0.01]" : "bg-white/[0.025]"} px-3 py-2`}>
      <Icon className={`h-4 w-4 ${tone} shrink-0 mt-0.5`} />
      <div className="min-w-0">
        <p className={`text-[12px] font-semibold ${muted ? "text-zinc-400" : "text-white"}`}>{title}</p>
        <p className="text-[10.5px] text-zinc-500 mt-0.5 leading-snug">{detail}</p>
      </div>
    </div>
  );
}

function Progress({ label, pct, tone }: { label: string; pct: number; tone: "amber" | "cyan" | "emerald" }) {
  const bar =
    tone === "amber"   ? "bg-amber-400/70"   :
    tone === "cyan"    ? "bg-cyan-400/70"    :
                         "bg-emerald-400/70";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{label}</p>
        <p className="text-[10px] font-mono text-zinc-400">{pct}%</p>
      </div>
      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className={`h-full ${bar}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.0, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/[0.05] bg-white/[0.02] px-2 py-1.5">
      <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-[14px] font-semibold text-white tabular-nums">{value}</p>
    </div>
  );
}

function Pill({ text, tone }: { text: string; tone: "rose" | "amber" }) {
  const cls =
    tone === "rose"
      ? "text-rose-300 bg-rose-500/10 border-rose-500/30"
      : "text-amber-300 bg-amber-500/10 border-amber-500/30";
  return (
    <span className={`inline-block text-[10px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${cls}`}>
      {text}
    </span>
  );
}
