"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeftIcon,
  EnvelopeIcon,
  UserIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  SparklesIcon,
  CloudIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";
import { WEBSITE_BUILD_TIERS } from "@/lib/websiteBuildPricing";
import { INFRASTRUCTURE_ADDONS } from "@/lib/infrastructureAddOns";
import { Navigation } from "@/components/Navigation";

const CLOUD_PROVIDERS = [
  { id: "vercel", label: "Vercel (default preview)" },
  { id: "aws", label: "AWS" },
  { id: "azure", label: "Azure" },
  { id: "gcp", label: "GCP" },
] as const;

export default function RequestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useMyCloud, setUseMyCloud] = useState(false);
  const [cloudProvider, setCloudProvider] = useState<string>("vercel");
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
    const cloud = formData.get("cloudProvider")?.toString() || "vercel";
    const useCloud = formData.get("useMyCloud") === "yes";
    const addOns = formData.getAll("addOns").filter((v): v is string => typeof v === "string");
    const awsAccessKey = formData.get("awsAccessKey")?.toString();
    const awsSecretKey = formData.get("awsSecretKey")?.toString();
    const awsBucket = formData.get("awsBucket")?.toString();
    const azureServicePrincipal = formData.get("azureServicePrincipal")?.toString();
    const gcpServiceAccount = formData.get("gcpServiceAccount")?.toString();

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
          cloudProvider: cloud,
          useMyCloud: useCloud,
          addOns,
          awsAccessKey: useCloud && cloud === "aws" ? awsAccessKey : undefined,
          awsSecretKey: useCloud && cloud === "aws" ? awsSecretKey : undefined,
          awsBucket: useCloud && cloud === "aws" ? awsBucket : undefined,
          azureServicePrincipal: useCloud && cloud === "azure" ? azureServicePrincipal : undefined,
          gcpServiceAccount: useCloud && cloud === "gcp" ? gcpServiceAccount : undefined,
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-8"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Home
        </Link>
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <header className="mb-8 text-center">
            <div className="inline-flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-4 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-4">
              AI Website Builder
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Describe your business. Get a live website preview.
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              AI generates your 4-page website in minutes. Preview it live—no code, no complexity.
            </p>
          </header>

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
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
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
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
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
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
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
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
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
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
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
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                placeholder="example.com"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <CloudIcon className="h-4 w-4" />
                Preferred cloud provider
              </label>
              <select
                name="cloudProvider"
                value={cloudProvider}
                onChange={(e) => setCloudProvider(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              >
                {CLOUD_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                Use my cloud account?
              </label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input type="radio" name="useMyCloud" value="yes" checked={useMyCloud} onChange={() => setUseMyCloud(true)} />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Yes</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="useMyCloud" value="no" checked={!useMyCloud} onChange={() => setUseMyCloud(false)} />
                  <span className="text-sm text-slate-600 dark:text-slate-400">No (use platform-managed)</span>
                </label>
              </div>
            </div>

            {useMyCloud && cloudProvider === "aws" && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <KeyIcon className="h-4 w-4" /> AWS credentials (temporary)
                </h3>
                <input name="awsAccessKey" type="text" placeholder="Access Key" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm" />
                <input name="awsSecretKey" type="password" placeholder="Secret Key" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm" />
                <input name="awsBucket" type="text" placeholder="S3 Bucket name" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm" />
              </div>
            )}
            {useMyCloud && cloudProvider === "azure" && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <KeyIcon className="h-4 w-4" /> Azure Service Principal JSON
                </h3>
                <textarea name="azureServicePrincipal" rows={4} placeholder="Paste Service Principal JSON" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono" />
              </div>
            )}
            {useMyCloud && cloudProvider === "gcp" && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <KeyIcon className="h-4 w-4" /> GCP Service Account JSON
                </h3>
                <textarea name="gcpServiceAccount" rows={4} placeholder="Paste Service Account JSON" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono" />
              </div>
            )}

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                <SparklesIcon className="h-4 w-4" />
                Choose your tier
              </label>
              <div className="space-y-3">
                {Object.values(WEBSITE_BUILD_TIERS).map((t) => (
                  <label
                    key={t.id}
                    className="flex items-start gap-3 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 has-[:checked]:border-indigo-500 has-[:checked]:ring-2 has-[:checked]:ring-indigo-200 dark:has-[:checked]:ring-indigo-900/40"
                  >
                    <input type="radio" name="tier" value={t.id} defaultChecked={t.id === "starter"} onChange={() => setSelectedTier(t.id)} className="mt-1" />
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{t.name}</span>
                      <span className="ml-2 text-indigo-600 dark:text-indigo-400 font-medium">
                        {t.id === "done_for_you" ? t.priceRange : `$${t.price}`}
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {(selectedTier === "professional" || selectedTier === "done_for_you") && (
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                  Infrastructure add-ons
                </label>
                <div className="space-y-2">
                  {INFRASTRUCTURE_ADDONS[cloudProvider as keyof typeof INFRASTRUCTURE_ADDONS]?.filter((a) => (selectedTier === "done_for_you" ? true : a.tier === selectedTier)).map((a) => (
                    <label key={a.id} className="flex items-center gap-2">
                      <input type="checkbox" name="addOns" value={a.id} />
                      <span className="text-sm text-slate-600 dark:text-slate-400">{a.label}</span>
                    </label>
                  )) || null}
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/30 px-4 py-3 text-sm text-red-800 dark:text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting...
                </>
              ) : (
                "Get my AI-built website preview"
              )}
            </button>

            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              Preview in 1–3 minutes. Link sent by email and shown on the next page.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
