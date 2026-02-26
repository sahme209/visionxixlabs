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

export default function RequestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>("starter");

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
    <div className="axiom-page min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/40 to-fuchsia-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors mb-8"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Home
          </Link>
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border-2 border-slate-200/80 dark:border-slate-700/80 p-8 sm:p-10">
            <header className="mb-8 text-center">
              <div className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-100 to-fuchsia-100 dark:from-violet-900/40 dark:to-fuchsia-900/40 px-4 py-2 text-xs font-semibold text-violet-700 dark:text-violet-300 mb-4">
                Website Builder + Managed Cloud
              </div>
              <h1 className="axiom-heading-xl text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">
                AI-built site, production-ready hosting
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Generate a site and deploy to Managed Cloud, AWS, Azure, or GCP with CDN, SSL, and CI/CD.
              </p>
              <Link
                href="/website-builder"
                className="inline-flex items-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
              >
                Prefer a simple prompt? Try AI Website Builder →
              </Link>
            </header>

            <div className="mb-6 rounded-2xl border-2 border-violet-200/80 dark:border-violet-800/80 bg-gradient-to-br from-violet-50/80 to-fuchsia-50/60 dark:from-violet-900/20 dark:to-fuchsia-900/20 p-4 text-sm text-slate-900 dark:text-slate-100">
              <p className="mb-1 font-semibold text-violet-900 dark:text-violet-100">
                Need full cloud, security, and automation strategy?
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                Run{" "}
                <Link href="/cloud-operator" className="font-semibold text-violet-600 dark:text-violet-400 underline hover:no-underline">
                  Axiom
                </Link>{" "}
                before building to get infrastructure scores and a 30-day optimization roadmap.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <UserIcon className="h-4 w-4" />
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-900/50"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label htmlFor="email" className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <EnvelopeIcon className="h-4 w-4" />
                  Email *
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-900/50"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="company" className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <BuildingOfficeIcon className="h-4 w-4" />
                Company / Business name
              </label>
              <input
                id="company"
                name="company"
                type="text"
                className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-900/50"
                placeholder="Your company"
              />
            </div>

            <div>
              <label htmlFor="industry" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                Industry
              </label>
              <select
                id="industry"
                name="industry"
                className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-900/50"
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
              <label htmlFor="message" className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <DocumentTextIcon className="h-4 w-4" />
                Tell us about your website needs
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-900/50"
                placeholder="Describe your business, target audience, and what you want your website to convey."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                Do you have a domain name?
              </label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input type="radio" name="hasDomain" value="yes" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Yes</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="hasDomain" value="no" defaultChecked />
                  <span className="text-sm text-slate-600 dark:text-slate-400">No</span>
                </label>
              </div>
            </div>

            <div>
              <label htmlFor="domainName" className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <GlobeAltIcon className="h-4 w-4" />
                Domain (if you have one)
              </label>
              <input
                id="domainName"
                name="domainName"
                type="text"
                className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-900/50"
                placeholder="example.com"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                <SparklesIcon className="h-4 w-4" />
                Choose your tier
              </label>
              <div className="space-y-3">
                {Object.values(WEBSITE_BUILD_TIERS).map((t) => (
                  <label
                    key={t.id}
                    className="flex items-start gap-3 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer hover:border-violet-400 dark:hover:border-violet-500 has-[:checked]:border-violet-500 has-[:checked]:ring-2 has-[:checked]:ring-violet-200 dark:has-[:checked]:ring-violet-900/40 transition-all"
                  >
                    <input type="radio" name="tier" value={t.id} defaultChecked={t.id === "starter"} onChange={() => setSelectedTier(t.id)} className="mt-1" />
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{t.name}</span>
                      <span className="ml-2 text-violet-600 dark:text-violet-400 font-medium">
                        {t.id === "enterprise" ? t.priceRange : `$${t.price}`}
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border-2 border-rose-200 dark:border-rose-800 bg-rose-50/80 dark:bg-rose-900/30 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
                {error}
              </div>
            )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 font-semibold text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
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

              <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                Managed cloud preview in 1–3 minutes. Select AWS/Azure/GCP on the next page if needed.
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
