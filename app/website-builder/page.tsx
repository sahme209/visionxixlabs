"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  SparklesIcon,
  CloudIcon,
  ChatBubbleLeftRightIcon,
  Squares2X2Icon,
  CheckCircleIcon,
  ShieldCheckIcon,
  BoltIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { BackgroundBlobs } from "@/components/BackgroundBlobs";
import { WebsiteBuilderJourney } from "@/components/WebsiteBuilderJourney";

type WebsitePlan = {
  sections: { id: string; name: string; description: string }[];
  designLanguage: string;
  colorPalette: { primary: string; secondary: string; accent: string };
  siteName: string;
  heroHtml?: string;
  fullPageHtml?: string;
  layout?: string;
  visualStyle?: string;
  inferredOperatorProfile?: {
    projectType: string;
    hostingProvider: string;
    trafficLevel: string;
    hasCiCd: string;
    publicExposure: string;
    primaryGoal: string;
  };
};

export default function WebsiteBuilderPage() {
  const [prompt, setPrompt] = useState("");
  const [visualStyle, setVisualStyle] = useState("");
  const [layout, setLayout] = useState("");
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<WebsitePlan | null>(null);
  const [step, setStep] = useState<"prompt" | "plan" | "form">("prompt");
  const [loading, setLoading] = useState(false);
  const [axiomLoading, setAxiomLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const PROMPT_TEMPLATES = [
    "Build a professional immigration consulting site – trustworthy, with services, testimonials, and contact form",
    "Create a high-converting SaaS landing page – modern, bold, with pricing tiers and demo CTA",
    "Design a personal portfolio – dark mode, futuristic, glassmorphism with project grid",
    "Build an e-commerce storefront – streetwear luxury, black and white, minimal",
    "Create a corporate website – Fortune 500 trust, navy and gold, authoritative",
    "Design a blog – editorial, Substack-style, cream background, serif headlines",
  ];

  const VISUAL_STYLES = [
    { id: "modern professional", label: "Modern professional" },
    { id: "bold minimal", label: "Bold & minimal" },
    { id: "glassmorphism dark", label: "Glassmorphism / dark" },
    { id: "editorial warm", label: "Editorial & warm" },
    { id: "corporate trustworthy", label: "Corporate & trustworthy" },
  ];

  const LAYOUTS = [
    { id: "split", label: "Split screen" },
    { id: "bento", label: "Bento grid" },
    { id: "zigzag", label: "Zig-zag" },
    { id: "grid", label: "Clean grid" },
    { id: "editorial", label: "Editorial" },
  ];

  const handlePromptSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || planning) return;
    setPlanning(true);
    setError(null);
    try {
      const res = await fetch("/api/website-builder/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          visualStyle: visualStyle || undefined,
          layout: layout || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate plan");
      setPlan(data);
      setStep("plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setPlanning(false);
    }
  };

  const handleGetSite = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim(),
          company: plan?.siteName || undefined,
          message: prompt.trim(),
          industry: plan ? "Technology" : undefined,
          tier: "starter",
          websiteBuilderPlan: plan
            ? {
                siteName: plan.siteName,
                fullPageHtml: plan.fullPageHtml,
                heroHtml: plan.heroHtml,
                designLanguage: plan.designLanguage,
                colorPalette: plan.colorPalette,
                sections: plan.sections,
                layout: plan.layout,
                visualStyle: plan.visualStyle,
              }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      const token = encodeURIComponent(data.token);
      window.location.href = `/request/thank-you?token=${token}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRunAxiom = async () => {
    if (!plan?.inferredOperatorProfile || axiomLoading) return;
    setAxiomLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/website-builder/run-axiom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inferredProfile: plan.inferredOperatorProfile,
          siteName: plan.siteName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const token = encodeURIComponent(data.token);
      window.location.href = `/cloud-operator?token=${token}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start Axiom");
    } finally {
      setAxiomLoading(false);
    }
  };

  // Huly-inspired: generous white space, vibrant gradients, rounded-3xl, clean typography
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/40 to-fuchsia-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative">
      <BackgroundBlobs />
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors mb-10"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Home
        </Link>

        <header className="mb-12">
          <div className="flex items-center gap-2 mb-4 overflow-x-auto">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${step === "prompt" ? "bg-violet-500 text-white" : "bg-emerald-500 text-white"}`}>
              {step === "prompt" ? "Step 1" : "Step 2"}
            </span>
            <span className="text-slate-400 dark:text-slate-500 text-xs">of 2</span>
            <span className="text-slate-500 dark:text-slate-400 text-xs">
              {step === "prompt" ? "Describe your site" : "Preview & deploy"}
            </span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-100 to-fuchsia-100 dark:from-violet-900/40 dark:to-fuchsia-900/40 px-4 py-2 text-xs font-semibold text-violet-700 dark:text-violet-300 mb-5">
            <SparklesIcon className="h-4 w-4" />
            AI Website Builder — Builds everything
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
            Design, structure, graphics — one prompt.
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mb-2">
            Premium sites with real images, animations, gradients, and balanced design—competing with Wix and Webflow. One prompt, production-ready.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500">
            Vibrant colors, smooth animations, Unsplash imagery. Deploy to cloud with CDN, SSL, CI/CD. Add Axiom for infra.
          </p>
        </header>

        {/* Step 1: Prompt */}
        {step === "prompt" && (
          <section className="space-y-6">
            <form onSubmit={handlePromptSubmit} className="space-y-4">
              <div className="rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-xl shadow-slate-200/50 dark:shadow-none p-6 sm:p-8 space-y-4">
                <div>
                  <label htmlFor="prompt" className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    <ChatBubbleLeftRightIcon className="h-5 w-5 text-violet-500" />
                    Describe your site — we build design, structure & copy
                  </label>
                  <textarea
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. Build a professional immigration consulting site – trustworthy, with services, testimonials, and contact form"
                    rows={4}
                    required
                    disabled={planning}
                    className="w-full rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-900/50 transition-all resize-none"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {PROMPT_TEMPLATES.slice(0, 4).map((t, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPrompt(t)}
                      className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                    >
                      {t.length > 45 ? `${t.slice(0, 45)}…` : t}
                    </button>
                  ))}
                </div>
                <div className="grid sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Visual style</label>
                    <select
                      value={visualStyle}
                      onChange={(e) => setVisualStyle(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Auto</option>
                      {VISUAL_STYLES.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Layout</label>
                    <select
                      value={layout}
                      onChange={(e) => setLayout(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Auto</option>
                      {LAYOUTS.map((l) => (
                        <option key={l.id} value={l.id}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {error && (
                  <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={planning || !prompt.trim()}
                  className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 font-semibold text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 hover:from-violet-500 hover:to-fuchsia-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-violet-500/30"
                >
                  {planning ? (
                    <>
                      <svg className="animate-spin h-5 w-5 shrink-0" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Building full site…
                    </>
                  ) : (
                    <>
                      Build everything
                      <ArrowRightIcon className="h-5 w-5" />
                    </>
                  )}
                </button>
                {planning && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <span className="inline-flex gap-1">
                      <span className="animate-pulse">●</span> Generating design
                    </span>
                    <span>→</span>
                    <span>Creating sections</span>
                    <span>→</span>
                    <span>Preparing preview</span>
                  </div>
                )}
              </div>
            </form>

            {/* Cloud integration hook — curiosity */}
            <div className="rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 p-3">
                    <CloudIcon className="h-8 w-8 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">Site + cloud, together</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                      After generating your plan, add Axiom for infra scores, CI/CD automation, and cost optimization.
                    </p>
                    <Link
                      href="/cloud-operator"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
                    >
                      Run Axiom Analysis
                      <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Step 2: Plan preview + live hero + enterprise hooks */}
        {step === "plan" && plan && (
          <section className="space-y-8">
            {/* Journey + next steps — clear path to deploy & membership */}
            <div className="rounded-2xl border-2 border-violet-200/80 dark:border-violet-700/80 bg-white/80 dark:bg-slate-900/80 p-4 mb-4">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">What&apos;s next?</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Enter your email below to deploy your site. Then add Axiom for infra, or join membership for full access.
              </p>
            </div>
            {/* Live preview — full page when available, else hero */}
            {(plan.fullPageHtml || plan.heroHtml) && (
              <div className="rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none">
                <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Live preview {plan.fullPageHtml ? "(full site)" : "(hero)"}
                  </span>
                </div>
                <div className="h-[340px] sm:h-[480px] overflow-auto">
                  <iframe
                    title="Site preview"
                    srcDoc={plan.fullPageHtml || plan.heroHtml}
                    sandbox="allow-same-origin"
                    className="w-full h-full min-h-[320px] border-0"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Get site deployed — PRIMARY CTA */}
            <form onSubmit={handleGetSite} className="rounded-3xl border-2 border-violet-500/80 dark:border-violet-500/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-xl shadow-violet-500/20 dark:shadow-violet-500/10 p-6 sm:p-8 ring-2 ring-violet-200/50 dark:ring-violet-800/50">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500 text-white text-sm font-bold">2</span>
                Get your site deployed
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Enter your email — we&apos;ll deploy to managed cloud with CDN, SSL, and email you the live link in 1–3 minutes.
              </p>
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email *</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  />
                </div>
              </div>
              {error && <p className="mb-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-8 py-3 font-semibold text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Submitting…
                  </>
                ) : (
                  <>
                    Deploy my site
                    <ArrowRightIcon className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>

            {/* Your journey — full path to membership */}
            <WebsiteBuilderJourney
              variant="full"
              currentStep="deploy"
              previewReady
              deploySubmitted={false}
            />

            <div className="rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Your plan: {plan.siteName}
                </h2>
              </div>
              <p className="text-slate-700 dark:text-slate-300 mb-4 text-sm">{plan.designLanguage}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="w-6 h-6 rounded-lg shadow-inner" style={{ backgroundColor: plan.colorPalette.primary }} title="Primary" />
                <span className="w-6 h-6 rounded-lg shadow-inner" style={{ backgroundColor: plan.colorPalette.secondary }} title="Secondary" />
                <span className="w-6 h-6 rounded-lg shadow-inner" style={{ backgroundColor: plan.colorPalette.accent }} title="Accent" />
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                <Squares2X2Icon className="h-4 w-4 text-violet-500" />
                Sections
              </div>
              <ul className="space-y-2">
                {plan.sections.map((s) => (
                  <li key={s.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{s.name}</span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{s.description}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Infrastructure readiness — psychological hook */}
            <div className="rounded-3xl border-2 border-amber-200/80 dark:border-amber-800/80 bg-gradient-to-br from-amber-50/80 to-orange-50/60 dark:from-amber-900/20 dark:to-orange-900/20 p-6 sm:p-8">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5 text-amber-600" />
                Infrastructure readiness
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                What enterprise teams unlock before going live
              </p>
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                <div className="flex items-center gap-3 rounded-xl bg-white/80 dark:bg-slate-800/80 px-4 py-3 border border-slate-200 dark:border-slate-700">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-500 shrink-0" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">CDN + SSL</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-white/80 dark:bg-slate-800/80 px-4 py-3 border border-slate-200 dark:border-slate-700">
                  <QuestionMarkCircleIcon className="h-5 w-5 text-amber-500 shrink-0" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">CI/CD automation</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-white/80 dark:bg-slate-800/80 px-4 py-3 border border-slate-200 dark:border-slate-700">
                  <QuestionMarkCircleIcon className="h-5 w-5 text-amber-500 shrink-0" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Cost optimization</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-white/80 dark:bg-slate-800/80 px-4 py-3 border border-slate-200 dark:border-slate-700">
                  <QuestionMarkCircleIcon className="h-5 w-5 text-amber-500 shrink-0" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">30-day roadmap</span>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                Teams that add infra analysis see faster deploys and lower risk. Run Axiom to unlock.
              </p>
              {plan.inferredOperatorProfile ? (
                <button
                  type="button"
                  onClick={handleRunAxiom}
                  disabled={axiomLoading}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 dark:bg-slate-100 px-5 py-2.5 font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-60"
                >
                  {axiomLoading ? (
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <>
                      <BoltIcon className="h-5 w-5" />
                      Run Axiom with this project
                    </>
                  )}
                </button>
              ) : (
                <Link
                  href="/cloud-operator"
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 dark:bg-slate-100 px-5 py-2.5 font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
                >
                  <BoltIcon className="h-5 w-5" />
                  Run Axiom Analysis
                </Link>
              )}
              {error && plan.inferredOperatorProfile && (
                <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>
              )}
            </div>

            {/* End goal: Membership — full journey destination */}
            <div className="rounded-3xl border-2 border-violet-500/60 dark:border-violet-500/60 bg-gradient-to-br from-violet-100/80 to-fuchsia-100/60 dark:from-violet-900/40 dark:to-fuchsia-900/30 p-6 sm:p-8 shadow-xl shadow-violet-500/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-bold">5</span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Join membership — full access</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                One plan unlocks Axiom, website builder, chatbots, cloud guidance, and priority support. Everything you need to scale.
              </p>
              <Link
                href="/visionxix-ai/pricing"
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 font-semibold text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 hover:from-violet-500 hover:to-fuchsia-500 transition-all"
              >
                View plans & membership
                <ArrowRightIcon className="h-5 w-5" />
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setStep("prompt")}
              className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400"
            >
              ← Change prompt
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
