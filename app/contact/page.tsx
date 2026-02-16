"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  EnvelopeIcon,
  UserIcon,
  BuildingOfficeIcon,
  CloudIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "../../components/Navigation";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = formData.get("name") || "";
    const email = formData.get("email") || "";
    const company = formData.get("company") || "";
    const topic = formData.get("topic") || "";
    const message = formData.get("message") || "";

    const subject = encodeURIComponent("Vision XIX Labs – AWS & DevOps inquiry");
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nCompany: ${company}\nTopic: ${topic}\n\nMessage:\n${message}`,
    );

    window.location.href = `mailto:support@visionxixlabs.com?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 md:p-10">
          <header className="mb-8 text-center">
            <div className="inline-flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-4 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-4">
              AWS &amp; DevOps Engagements
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3 text-slate-900 dark:text-slate-100">
              Tell us about your AWS roadmap
            </h1>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Share a bit about your environment, challenges, and timelines. We&apos;ll
              review and follow up to discuss how we can help with cloud
              infrastructure, CI/CD, cost optimization, reliability, or security.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                Send via Email
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                When you submit, we&apos;ll open your email client with a
                pre-filled message to{" "}
                <a
                  href="mailto:support@visionxixlabs.com"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  support@visionxixlabs.com
                </a>
                .
              </p>
            </div>

            {submitted && (
              <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100">
                Thanks for reaching out. We&apos;ve opened a draft email with your
                details—once you send it, we&apos;ll review and get back to you.
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}

