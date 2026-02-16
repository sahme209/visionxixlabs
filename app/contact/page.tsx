"use client";

import { FormEvent, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  EnvelopeIcon,
  UserIcon,
  BuildingOfficeIcon,
  CloudIcon,
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

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = formData.get("name")?.toString() || "";
    const email = formData.get("email")?.toString() || "";
    const company = formData.get("company")?.toString() || "";
    const topic = formData.get("topic")?.toString() || "";
    const message = formData.get("message")?.toString() || "";

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          company,
          topic,
          message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Show more detailed error message
        const errorMessage = data.error || "Failed to send message";
        throw new Error(errorMessage);
      }

      setSubmitted(true);
      // Reset form using ref or stored form reference
      if (formRef.current) {
        formRef.current.reset();
      } else if (form) {
        form.reset();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 md:p-10">
          <header className="mb-8 text-center">
            <div className="inline-flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-4">
              Cloud &amp; AI Engineering
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3 text-slate-900 dark:text-slate-100">
              Discuss your requirements
            </h1>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Share your environment, goals, and timeline. We review every request and follow up to align on scope—cloud infrastructure, CI/CD, cost, reliability, security, or AI.
            </p>
          </header>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label
                  htmlFor="name"
                  className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  <UserIcon className="h-4 w-4 mr-1.5" />
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  <EnvelopeIcon className="h-4 w-4 mr-1.5" />
                  Work Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label
                  htmlFor="company"
                  className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  <BuildingOfficeIcon className="h-4 w-4 mr-1.5" />
                  Company
                </label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label
                  htmlFor="topic"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block"
                >
                  What do you want to focus on?
                </label>
                <select
                  id="topic"
                  name="topic"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  defaultValue="AWS Cloud Infrastructure"
                >
                  <option>AWS Cloud Infrastructure</option>
                  <option>CI/CD &amp; Octopus Deploy</option>
                  <option>Cost Optimization / FinOps</option>
                  <option>Reliability &amp; Observability</option>
                  <option>Security &amp; Governance</option>
                  <option>Other / Not sure yet</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="message"
                className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block"
              >
                How can we help?
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Briefly describe your AWS environment, current challenges, and timelines."
              />
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Sending...
                  </>
                ) : (
                  "Send Message"
                )}
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                We&apos;ll review your message and get back to you at{" "}
                <a
                  href="mailto:support@visionxixlabs.com"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  support@visionxixlabs.com
                </a>
                .
              </p>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/40 dark:text-red-100">
                {error}
              </div>
            )}

            {submitted && (
              <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100 flex items-start">
                <CheckCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Message sent successfully!</p>
                  <p className="text-xs">
                    Thank you for reaching out. We&apos;ve received your message and will get back to you soon.
                  </p>
                </div>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}

