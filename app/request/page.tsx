"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  EnvelopeIcon,
  UserIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { WEBSITE_BUILD_TIERS } from "@/lib/websiteBuildPricing";
import { Navigation } from "@/components/Navigation";
import { AxiomButton } from "@/components/axiom-ui/AxiomButton";
import { Reveal } from "@/components/motion/Reveal";

export default function RequestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>("growth");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get("name")?.toString() || "";
    const email = formData.get("email")?.toString() || "";
    const company = formData.get("company")?.toString() || "";
    const message = formData.get("message")?.toString() || "";
    const industry = formData.get("industry")?.toString() || "";
    const hasDomain = formData.get("hasDomain") === "yes";
    const domainName = formData.get("domainName")?.toString() || "";
    const tier = formData.get("tier")?.toString() || "starter";

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          company,
          message,
          industry,
          hasDomain,
          domainName,
          tier,
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

  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-dots opacity-10 pointer-events-none" aria-hidden />
      <div className="spotlight-orb absolute -top-40 -right-40 w-[400px] h-[400px] rounded-full bg-violet-500/10 blur-[120px] pointer-events-none" aria-hidden />
      <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-fuchsia-600/10 blur-[120px] pointer-events-none animate-pulse" aria-hidden />
      <div className="absolute top-1/3 left-1/2 w-64 h-64 rounded-full bg-violet-500/[0.03] blur-[100px] pointer-events-none" aria-hidden />

      <Navigation />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 relative">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-violet-400 transition-colors mb-8"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Home
          </Link>

          <Reveal direction="up" blur delay={0.05}>
            <div className="glass-card rounded-3xl border-2 border-white/[0.06] p-8 sm:p-10">
              <header className="mb-8 text-center">
                <div className="huly-badge inline-flex items-center justify-center rounded-full bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-300 mb-4">
                  Website Builder + Managed Cloud
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2 tracking-[-0.04em]">
                  AI-built site, <span className="text-gradient">production-ready</span> hosting
                </h1>
                <p className="text-sm text-zinc-400 mb-4">
                  Generate a site and deploy to Managed Cloud, AWS, Azure, or GCP with CDN, SSL, and CI/CD.
                </p>
                <div className="flex flex-wrap gap-4 justify-center">
                  <Link
                    href="/builder"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-violet-400 hover:text-white"
                  >
                    Prefer a simple prompt? Try AI Website Builder →
                  </Link>
                  <Link
                    href="/builder/pricing"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-violet-400 hover:text-white"
                  >
                    View Plans &amp; Membership →
                  </Link>
                </div>
              </header>

              <Reveal direction="up" blur delay={0.1}>
                <div className="mb-6 glow-border-card rounded-2xl border-2 border-violet-500/20 bg-gradient-to-br from-violet-900/20 to-fuchsia-900/10 p-4 text-sm text-white">
                  <p className="mb-1 font-semibold text-violet-400">
                    Need full cloud, security, and automation strategy?
                  </p>
                  <p className="text-zinc-300">
                    Run{" "}
                    <Link href="/cloud-operator" className="font-semibold text-violet-400 underline hover:no-underline">
                      Axiom
                    </Link>{" "}
                    before building to get infrastructure scores and a 30-day optimization roadmap.
                  </p>
                </div>
              </Reveal>

              <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1">
                    <UserIcon className="h-4 w-4" />
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    className="w-full rounded-xl border-2 border-white/[0.06] bg-white/[0.02] px-3 py-2 text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-colors"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1">
                    <EnvelopeIcon className="h-4 w-4" />
                    Email *
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="w-full rounded-xl border-2 border-white/[0.06] bg-white/[0.02] px-3 py-2 text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-colors"
                    placeholder="you@company.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="company" className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1">
                  <BuildingOfficeIcon className="h-4 w-4" />
                  Company / Business name
                </label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  className="w-full rounded-xl border-2 border-white/[0.06] bg-white/[0.02] px-3 py-2 text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-colors"
                  placeholder="Your company"
                />
              </div>

              <div>
                <label htmlFor="industry" className="text-sm font-medium text-zinc-300 mb-1 block">
                  Industry
                </label>
                <select
                  id="industry"
                  name="industry"
                  className="w-full rounded-xl border-2 border-white/[0.06] bg-white/[0.02] px-3 py-2 text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-colors"
                >
                  <option value="">Select</option>
                  <option>Professional services</option>
                  <option>E-commerce</option>
                  <option>Healthcare</option>
                  <option>Technology</option>
                  <option>Nonprofit</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1">
                  <DocumentTextIcon className="h-4 w-4" />
                  Tell us about your website needs
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  className="w-full rounded-xl border-2 border-white/[0.06] bg-white/[0.02] px-3 py-2 text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-colors"
                  placeholder="Describe your business, target audience, and what you want your website to convey."
                />
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-300 mb-2 block">
                  Do you have a domain name?
                </label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="hasDomain" value="yes" />
                    <span className="text-sm text-zinc-400">Yes</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="hasDomain" value="no" defaultChecked />
                    <span className="text-sm text-zinc-400">No</span>
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="domainName" className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1">
                  <GlobeAltIcon className="h-4 w-4" />
                  Domain (if you have one)
                </label>
                <input
                  id="domainName"
                  name="domainName"
                  type="text"
                  className="w-full rounded-xl border-2 border-white/[0.06] bg-white/[0.02] px-3 py-2 text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-colors"
                  placeholder="example.com"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-3">
                  <SparklesIcon className="h-4 w-4" />
                  Choose your plan
                </label>
                <p className="text-xs text-zinc-500 mb-3">
                  Choose Builder or Axiom plans. Separate products, one account.{" "}
                  <Link href="/products" className="font-semibold text-violet-400 hover:underline">
                    View pricing →
                  </Link>
                </p>
                <div className="space-y-3">
                  {Object.values(WEBSITE_BUILD_TIERS).map((t) => (
                    <label
                      key={t.id}
                      className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all card-hover ${
                        t.popular
                          ? "border-violet-500 bg-violet-500/10 hover:border-violet-500"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-violet-500/30"
                      } has-[:checked]:border-violet-500 has-[:checked]:ring-2 has-[:checked]:ring-violet-500/20`}
                    >
                      <input type="radio" name="tier" value={t.id} defaultChecked={t.id === "growth"} onChange={() => setSelectedTier(t.id)} className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white">{t.name}</span>
                          {t.popular && (
                            <span className="huly-badge px-2 py-0.5 rounded-full bg-violet-600 text-[10px] font-semibold text-white">Most popular</span>
                          )}
                          <span className="text-violet-400 font-medium">
                            {"priceRange" in t ? t.priceRange : t.priceLabel}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{t.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-2xl border-2 border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  {error}
                </div>
              )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-huly cta-glow w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 font-semibold text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                  aria-busy={loading}
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    "Get my AI-built site preview"
                  )}
                </button>

                <p className="text-center text-xs text-zinc-500">
                  Managed cloud preview in 1-3 minutes. Select AWS/Azure/GCP on the next page if needed.
                </p>
              </form>
            </div>
          </Reveal>
        </div>
      </main>
    </div>
  );
}
