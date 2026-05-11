"use client";

import Link from "next/link";
import {
  CloudIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  BoltIcon,
  ArrowRightIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { BackgroundBlobs } from "@/components/BackgroundBlobs";

const FEATURES = [
  {
    icon: CloudIcon,
    title: "Intelligent scanning",
    desc: "Deep infrastructure analysis across AWS (Azure and GCP on the roadmap). Cost waste, security gaps, drift detection, and resource inventory.",
  },
  {
    icon: CpuChipIcon,
    title: "Cognitive reasoning engine",
    desc: "A 9-phase AI reasoning loop — observe, interpret, reason, prioritize, plan, execute, verify, reflect, learn — that thinks through your infrastructure like a senior engineer.",
  },
  {
    icon: ChartBarIcon,
    title: "Phased execution plans",
    desc: "Auto-generated Terraform and CLI plans with dependency graphs, blast radius estimates, and rollback strategies — reviewed before any change is applied.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Governance & safety",
    desc: "Trust levels, approval gates, blast radius limits, and compliance policies ensure no change happens without verified safety. The agent never self-escalates its own autonomy.",
  },
  {
    icon: BoltIcon,
    title: "Safe execution with rollback",
    desc: "Apply approved changes with pre-verified rollback, full audit trail, and post-apply verification. Read-only by default — nothing changes without your explicit approval.",
  },
];

export default function AxiomPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative">
      <BackgroundBlobs />
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 mb-8">
          ← Back to Home
        </Link>
        <header className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 dark:bg-blue-900/40 px-4 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 mb-6">
            <CpuChipIcon className="h-4 w-4" />
            Axiom — Autonomous Cloud Operations Agent
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Your autonomous cloud operations agent
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-8">
            Axiom scans your AWS infrastructure, reasons about what to fix, generates phased execution plans, and applies approved changes — with governance policies, rollback coordination, and a full audit trail.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/cloud-operator"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-2xl font-semibold shadow-lg hover:shadow-violet-500/30 transition-all"
            >
              Run Axiom
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
            <Link
              href="/axiom/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
            >
              View pricing
            </Link>
          </div>
        </header>
        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 hover:border-violet-300 dark:hover:border-violet-600 transition-colors"
              >
                <div className="rounded-xl bg-violet-100 dark:bg-violet-900/40 p-3 w-fit mb-4">
                  <Icon className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{f.desc}</p>
              </div>
            );
          })}
        </section>
        <div className="mt-16 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            One account. Shared authentication. <Link href="/builder" className="text-violet-600 dark:text-violet-400 hover:underline">Build websites</Link> with our separate Builder product.
          </p>
        </div>
      </main>
    </div>
  );
}
