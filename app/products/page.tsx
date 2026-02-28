"use client";

import Link from "next/link";
import { SparklesIcon, CloudIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { BackgroundBlobs } from "@/components/BackgroundBlobs";

export default function ProductsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/40 to-fuchsia-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative">
      <BackgroundBlobs />
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">
            Choose your product
          </h1>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            Separate pricing for each product. One account, unified billing.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          <Link
            href="/builder/pricing"
            className="group rounded-3xl border-2 border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-900 p-8 hover:border-violet-500 dark:hover:border-violet-500 transition-all card-hover"
          >
            <div className="rounded-2xl bg-violet-100 dark:bg-violet-900/40 p-4 w-fit mb-6">
              <SparklesIcon className="h-10 w-10 text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Website Builder</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              AI website generation, real preview, one-click deploy. Optional chatbot add-on.
            </p>
            <span className="inline-flex items-center gap-2 font-semibold text-violet-600 dark:text-violet-400 group-hover:gap-3 transition-all">
              View Builder pricing
              <ArrowRightIcon className="h-5 w-5" />
            </span>
          </Link>
          <Link
            href="/axiom/pricing"
            className="group rounded-3xl border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 p-8 hover:border-blue-500 dark:hover:border-blue-500 transition-all card-hover"
          >
            <div className="rounded-2xl bg-blue-100 dark:bg-blue-900/40 p-4 w-fit mb-6">
              <CloudIcon className="h-10 w-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Axiom (Cloud Automation)</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Cloud scan, cost optimization, security analysis, auto-fix. Optional AI Ops Assistant.
            </p>
            <span className="inline-flex items-center gap-2 font-semibold text-blue-600 dark:text-blue-400 group-hover:gap-3 transition-all">
              View Axiom pricing
              <ArrowRightIcon className="h-5 w-5" />
            </span>
          </Link>
        </div>
        <p className="mt-12 text-center text-sm text-slate-500 dark:text-slate-400">
          One account. Shared authentication. Use one product or both.
        </p>
      </main>
    </div>
  );
}
