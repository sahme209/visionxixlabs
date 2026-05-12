"use client";

import { FormEvent, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  EnvelopeIcon,
  UserIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";

export default function FreeReviewPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: formData.get("name")?.toString() || "",
      email: formData.get("email")?.toString() || "",
      company: formData.get("company")?.toString() || "",
      topic: "Free Cloud & AI Infrastructure Review",
      companySize: formData.get("companySize")?.toString() || "",
      cloudProvider: formData.get("cloudProvider")?.toString() || "",
      mainConcern: formData.get("mainConcern")?.toString() || "",
      setupMaturity: formData.get("setupMaturity")?.toString() || "",
      aiUsageStatus: formData.get("aiUsageStatus")?.toString() || "",
      message: formData.get("message")?.toString() || "Free Cloud & AI Infrastructure Review request.",
      source: "free-review",
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to submit.");
      setSubmitted(true);
      formRef.current?.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Navigation />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-24">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-zinc-400 hover:text-violet-400 mb-8"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to home
        </Link>

        <div className="mb-4 rounded-2xl border border-indigo-200 border-violet-500/20 bg-indigo-50/70 bg-violet-500/10 p-4">
          <p className="text-xs font-semibold text-white mb-1">
            Prefer instant infrastructure intelligence? Run Axiom.
          </p>
          <p className="text-xs text-zinc-200 mb-3">
            Axiom analyzes your cloud, CI/CD, cost, and security automatically. This page is for a human-led review session.
          </p>
          <Link
            href="/cloud-operator"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Run Axiom Analysis
            <ArrowLeftIcon className="h-3 w-3 rotate-180" />
          </Link>
        </div>

        <div className="bg-white/[0.02] rounded-2xl shadow-xl border border-white/[0.06] p-8 md:p-10">
          <header className="mb-8 text-center">
            <div className="inline-flex items-center justify-center rounded-full bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-400 mb-4">
              No obligation · 30 minutes
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-3 text-white">
              Free Cloud &amp; AI Infrastructure Review
            </h1>
            <p className="text-sm text-zinc-400 max-w-lg mx-auto">
              Share your environment and priorities. Our engineers will prepare and deliver a focused, human-led review and, if useful, a custom demo outline. We’ll send a discovery call prep after we review your submission.
            </p>
          </header>

          {submitted ? (
            <div className="text-center py-8">
              <CheckCircleIcon className="h-14 w-14 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Request received
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                We’ll review your details and send a confirmation. We typically respond within 1–2 business days and will share a discovery call prep and custom demo outline after we review.
              </p>
              <Link
                href="/"
                className="inline-flex items-center text-violet-400 font-medium text-sm hover:underline"
              >
                Return to home
                <ArrowLeftIcon className="h-4 w-4 ml-1" />
              </Link>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-lg bg-red-50 bg-red-500/10 border border-red-200 border-red-500/20 px-4 py-3 text-sm text-red-700 text-red-400">
                  {error}
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="flex items-center text-sm font-medium text-zinc-300 mb-1">
                    <UserIcon className="h-4 w-4 mr-1.5" /> Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="flex items-center text-sm font-medium text-zinc-300 mb-1">
                    <EnvelopeIcon className="h-4 w-4 mr-1.5" /> Work email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="company" className="flex items-center text-sm font-medium text-zinc-300 mb-1">
                  <BuildingOfficeIcon className="h-4 w-4 mr-1.5" /> Company
                </label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="companySize" className="text-sm font-medium text-zinc-300 mb-1 block">Company size</label>
                  <select
                    id="companySize"
                    name="companySize"
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    defaultValue=""
                  >
                    <option value="">Select</option>
                    <option>1–5</option>
                    <option>6–20</option>
                    <option>21–50</option>
                    <option>51–200</option>
                    <option>200+</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="cloudProvider" className="text-sm font-medium text-zinc-300 mb-1 block">Primary cloud provider</label>
                  <select
                    id="cloudProvider"
                    name="cloudProvider"
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    defaultValue=""
                  >
                    <option value="">Select</option>
                    <option>AWS</option>
                    <option>Azure</option>
                    <option>GCP</option>
                    <option>Multi-cloud</option>
                    <option>Other / Not sure</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="setupMaturity" className="text-sm font-medium text-zinc-300 mb-1 block">Current deployment method</label>
                <select
                  id="setupMaturity"
                  name="setupMaturity"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  defaultValue=""
                >
                  <option value="">Select</option>
                  <option>Mostly manual (console, scripts)</option>
                  <option>Some automation (basic pipelines / scripts)</option>
                  <option>CI/CD in place, needs hardening</option>
                  <option>Mature setup, seeking external review</option>
                </select>
              </div>

              <div>
                <label htmlFor="mainConcern" className="text-sm font-medium text-zinc-300 mb-1 block">Security / main concerns</label>
                <select
                  id="mainConcern"
                  name="mainConcern"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  defaultValue=""
                >
                  <option value="">Select</option>
                  <option>Cloud security hardening</option>
                  <option>DevOps / CI/CD automation</option>
                  <option>Cost optimization</option>
                  <option>AI workflow integration</option>
                  <option>Combination of the above</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="aiUsageStatus" className="text-sm font-medium text-zinc-300 mb-1 block">AI usage status</label>
                <select
                  id="aiUsageStatus"
                  name="aiUsageStatus"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  defaultValue=""
                >
                  <option value="">Select</option>
                  <option>Not using AI yet</option>
                  <option>Experimenting (demos, POCs)</option>
                  <option>Some production AI workloads</option>
                  <option>Scaling AI in production</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="text-sm font-medium text-zinc-300 mb-1 block">Anything else we should know?</label>
                <textarea
                  id="message"
                  name="message"
                  rows={3}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Optional: timeline, specific pain points, or questions."
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {loading ? "Sending…" : "Request free review"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
