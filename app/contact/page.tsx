"use client";

import { FormEvent, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  EnvelopeIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "../../components/Navigation";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name")?.toString() || "",
          email: formData.get("email")?.toString() || "",
          company: formData.get("company")?.toString() || "",
          message: formData.get("message")?.toString() || "",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send message");
      }

      setSubmitted(true);
      formRef.current?.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Navigation />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50 mb-3">
            Get in touch
          </h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-lg">
            Questions about Axiom, enterprise plans, or how autonomous cloud operations works for your infrastructure? We respond within one business day.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-6">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Message sent</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  We&apos;ve received your message and will get back to you soon.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Work email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
            </div>
            <div>
              <label htmlFor="company" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Company
              </label>
              <input
                id="company"
                name="company"
                type="text"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                How can we help?
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                required
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 resize-none"
                placeholder="Tell us about your cloud environment and what you're looking for."
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-slate-100 px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send message"}
                {!loading && <ArrowRightIcon className="h-4 w-4" />}
              </button>
              <a
                href="mailto:support@visionxixlabs.com"
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                support@visionxixlabs.com
              </a>
            </div>
          </form>
        )}

        <div className="mt-16 pt-8 border-t border-slate-100 dark:border-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Ready to scan your infrastructure now?
          </p>
          <Link
            href="/operator/onboarding"
            className="inline-flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
          >
            Run Axiom — connect your AWS account in 5 minutes
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </main>
    </div>
  );
}
