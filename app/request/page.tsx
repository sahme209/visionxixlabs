"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UserIcon,
  BriefcaseIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import { PARENT_WEBSITE, SUPPORT_EMAIL } from "@/lib/constants/company";
import type { LeadFormData } from "@/lib/leads/leadSchema";
import {
  PROJECT_TYPES,
  INDUSTRIES,
  PROJECT_GOALS,
  TIMELINE_OPTIONS,
  BUDGET_RANGES,
  HOSTING_STATUS,
} from "@/lib/leads/leadSchema";
import { RequestPricingPanel } from "./RequestPricingPanel";

const STEPS = [
  { id: 1, title: "Contact", icon: UserIcon },
  { id: 2, title: "Project", icon: BriefcaseIcon },
  { id: 3, title: "Details", icon: DocumentTextIcon },
  { id: 4, title: "Review", icon: CheckCircleIcon },
];

const initialForm: LeadFormData = {
  fullName: "",
  businessName: "",
  email: "",
  phone: "",
  currentWebsiteUrl: "",
  industry: "technology",
  projectType: "new_website",
  numberOfPages: 5,
  requiredSections: "",
  projectGoals: [],
  designPreference: "",
  referenceSites: "",
  copywritingNeeded: false,
  logoBrandAssetsReady: false,
  hostingDomainStatus: "unsure",
  timeline: "flexible",
  budgetRange: "undecided",
  additionalNotes: "",
  _honeypot: "",
  _startTime: undefined,
};

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
      {children}
    </label>
  );
}

export default function RequestPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<LeadFormData>(initialForm);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!startTime) setStartTime(Date.now());
  }, [startTime]);

  const update = <K extends keyof LeadFormData>(k: K, v: LeadFormData[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }));
  };

  const toggleGoal = (g: (typeof PROJECT_GOALS)[number]) => {
    setForm((prev) => ({
      ...prev,
      projectGoals: prev.projectGoals.includes(g)
        ? prev.projectGoals.filter((x) => x !== g)
        : [...prev.projectGoals, g],
    }));
  };

  const validateStep1 = () => {
    if (!form.fullName.trim()) return "Full name is required";
    if (!form.email.trim()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Please enter a valid email";
    if (form.currentWebsiteUrl && !/^https?:\/\/\S+$/.test(form.currentWebsiteUrl.trim()))
      return "Please enter a valid URL or leave blank";
    return null;
  };

  const validateStep2 = () => {
    if (form.numberOfPages < 1 || form.numberOfPages > 100) return "Pages must be 1–100";
    if (!form.projectGoals.length) return "Select at least one project goal";
    return null;
  };

  const canNext1 = () => !validateStep1();
  const canNext2 = () => !validateStep2();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStatus("loading");
    try {
      const payload = {
        ...form,
        _honeypot: form._honeypot,
        _startTime: startTime ?? Date.now(),
      };
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.push(
          `/request/thank-you?leadId=${data.leadId}&min=${data.estimate.min}&max=${data.estimate.max}`
        );
        return;
      }
      setError(data.error || "Something went wrong. Please try again.");
      setStatus("error");
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <nav className="border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href={PARENT_WEBSITE}
            className="flex items-center gap-2 text-[var(--text-primary)] hover:text-[var(--uscis-blue)]"
          >
            <span className="font-semibold">Vision XIX Labs</span>
          </Link>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--uscis-blue)]"
          >
            Contact
          </a>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7 xl:col-span-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-2">
          New Website Request / Instant Quote
        </h1>
        <p className="text-[var(--text-secondary)] mb-4">
          Tell us about your project. We&apos;ll send you a tailored estimate.
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-1 mb-8 text-sm text-[var(--text-secondary)]">
          <li>No call required.</li>
          <li>Takes less than 2 minutes.</li>
          <li>We&apos;ll respond within 24 hours.</li>
        </ul>

        <div className="h-1 w-full rounded-full bg-[var(--border-color)] mb-6" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={4}>
          <div
            className="h-full rounded-full bg-[var(--uscis-blue)] transition-all duration-300 ease-out"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-8">
          Step {step} of 4
        </p>

        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                  step >= s.id
                    ? "border-[var(--uscis-blue)] bg-[var(--uscis-blue)] text-white"
                    : "border-[var(--border-color)] text-[var(--text-tertiary)]"
                }`}
              >
                {step > s.id ? <CheckCircleIcon className="h-5 w-5" /> : s.id}
              </div>
              <span
                className={`hidden sm:inline text-sm font-medium ${
                  step >= s.id ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"
                }`}
              >
                {s.title}
              </span>
              {i < STEPS.length - 1 && (
                <div className="h-px w-6 sm:w-12 bg-[var(--border-color)]" />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="_honeypot"
            tabIndex={-1}
            autoComplete="off"
            value={form._honeypot}
            onChange={(e) => update("_honeypot", e.target.value)}
            className="sr-only absolute opacity-0 pointer-events-none"
            aria-hidden="true"
          />
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <Label htmlFor="fullName">Full name *</Label>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-color)] px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent"
                  placeholder="Your name"
                />
              </div>
              <div>
                <Label htmlFor="businessName">Business name</Label>
                <input
                  id="businessName"
                  type="text"
                  value={form.businessName}
                  onChange={(e) => update("businessName", e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-color)] px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent"
                  placeholder="Company or brand"
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-color)] px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-color)] px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <Label htmlFor="currentWebsiteUrl">Current website URL</Label>
                <input
                  id="currentWebsiteUrl"
                  type="url"
                  value={form.currentWebsiteUrl}
                  onChange={(e) => update("currentWebsiteUrl", e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-color)] px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent"
                  placeholder="https://example.com"
                />
              </div>
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!canNext1()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--uscis-blue)] px-6 py-3 font-semibold text-white hover:bg-[var(--uscis-blue-dark)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ArrowRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <Label htmlFor="industry">Industry</Label>
                <select
                  id="industry"
                  value={form.industry}
                  onChange={(e) => update("industry", e.target.value as LeadFormData["industry"])}
                  className="w-full rounded-xl border border-[var(--border-color)] px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent"
                >
                  {INDUSTRIES.map((v) => (
                    <option key={v} value={v}>
                      {v.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="projectType">Project type</Label>
                <select
                  id="projectType"
                  value={form.projectType}
                  onChange={(e) => update("projectType", e.target.value as LeadFormData["projectType"])}
                  className="w-full rounded-xl border border-[var(--border-color)] px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent"
                >
                  {PROJECT_TYPES.map((v) => (
                    <option key={v} value={v}>
                      {v.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="numberOfPages">Number of pages</Label>
                <input
                  id="numberOfPages"
                  type="number"
                  min={1}
                  max={100}
                  value={form.numberOfPages}
                  onChange={(e) => update("numberOfPages", Number(e.target.value))}
                  className="w-full rounded-xl border border-[var(--border-color)] px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent"
                />
              </div>
              <div>
                <Label>Project goals * (select at least one)</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PROJECT_GOALS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGoal(g)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        form.projectGoals.includes(g)
                          ? "bg-[var(--uscis-blue)] text-white"
                          : "border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--uscis-blue)] hover:text-[var(--uscis-blue)]"
                      }`}
                    >
                      {g.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="requiredSections">Required sections</Label>
                <textarea
                  id="requiredSections"
                  rows={3}
                  value={form.requiredSections}
                  onChange={(e) => update("requiredSections", e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-color)] px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent resize-none"
                  placeholder="e.g. Home, About, Services, Blog, Contact"
                />
              </div>
              <div>
                <Label htmlFor="designPreference">Design preference</Label>
                <input
                  id="designPreference"
                  type="text"
                  value={form.designPreference}
                  onChange={(e) => update("designPreference", e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-color)] px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent"
                  placeholder="e.g. Minimal, modern, dark theme"
                />
              </div>
              <div>
                <Label htmlFor="referenceSites">Reference sites</Label>
                <input
                  id="referenceSites"
                  type="text"
                  value={form.referenceSites}
                  onChange={(e) => update("referenceSites", e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-color)] px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent"
                  placeholder="Sites you like (URLs or descriptions)"
                />
              </div>
              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-6 py-3 font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]"
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!canNext2()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--uscis-blue)] px-6 py-3 font-semibold text-white hover:bg-[var(--uscis-blue-dark)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ArrowRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-3">
                <input
                  id="copywriting"
                  type="checkbox"
                  checked={form.copywritingNeeded}
                  onChange={(e) => update("copywritingNeeded", e.target.checked)}
                  className="h-5 w-5 rounded border-[var(--border-color)] text-[var(--uscis-blue)] focus:ring-[var(--uscis-blue)]"
                />
                <Label htmlFor="copywriting">Copywriting needed</Label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="brandAssets"
                  type="checkbox"
                  checked={form.logoBrandAssetsReady}
                  onChange={(e) => update("logoBrandAssetsReady", e.target.checked)}
                  className="h-5 w-5 rounded border-[var(--border-color)] text-[var(--uscis-blue)] focus:ring-[var(--uscis-blue)]"
                />
                <Label htmlFor="brandAssets">Logo & brand assets ready</Label>
              </div>
              <div>
                <Label htmlFor="hosting">Hosting / domain status</Label>
                <select
                  id="hosting"
                  value={form.hostingDomainStatus}
                  onChange={(e) =>
                    update("hostingDomainStatus", e.target.value as LeadFormData["hostingDomainStatus"])
                  }
                  className="w-full rounded-xl border border-[var(--border-color)] px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent"
                >
                  {HOSTING_STATUS.map((v) => (
                    <option key={v} value={v}>
                      {v.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="timeline">Timeline</Label>
                <select
                  id="timeline"
                  value={form.timeline}
                  onChange={(e) => update("timeline", e.target.value as LeadFormData["timeline"])}
                  className="w-full rounded-xl border border-[var(--border-color)] px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent"
                >
                  {TIMELINE_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="budget">Budget range</Label>
                <select
                  id="budget"
                  value={form.budgetRange}
                  onChange={(e) =>
                    update("budgetRange", e.target.value as LeadFormData["budgetRange"])
                  }
                  className="w-full rounded-xl border border-[var(--border-color)] px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent"
                >
                  {BUDGET_RANGES.map((v) => (
                    <option key={v} value={v}>
                      {v.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="notes">Additional notes</Label>
                <textarea
                  id="notes"
                  rows={4}
                  value={form.additionalNotes}
                  onChange={(e) => update("additionalNotes", e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-color)] px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent resize-none"
                  placeholder="Tell us more about your project..."
                />
              </div>
              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-6 py-3 font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]"
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--uscis-blue)] px-6 py-3 font-semibold text-white hover:bg-[var(--uscis-blue-dark)]"
                >
                  Next
                  <ArrowRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Review & submit</h2>
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-3 text-sm">
                <p><span className="font-medium text-[var(--text-secondary)]">Name:</span> {form.fullName}</p>
                <p><span className="font-medium text-[var(--text-secondary)]">Email:</span> {form.email}</p>
                <p><span className="font-medium text-[var(--text-secondary)]">Project:</span> {form.projectType.replace(/_/g, " ")} · {form.numberOfPages} pages</p>
                <p><span className="font-medium text-[var(--text-secondary)]">Goals:</span> {form.projectGoals.map((g) => g.replace(/_/g, " ")).join(", ")}</p>
              </div>
              {error && (
                <p className="text-sm text-[var(--uscis-red)]" role="alert">
                  {error}
                </p>
              )}
              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-6 py-3 font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]"
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--uscis-blue)] px-6 py-3 font-semibold text-white hover:bg-[var(--uscis-blue-dark)] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {status === "loading" ? (
                    <>
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Get instant quote
                      <CheckCircleIcon className="h-5 w-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>

        <p className="mt-8 text-sm text-[var(--text-tertiary)]">
          By submitting, you agree to receive follow-up from Vision XIX Labs. We respect your privacy.
        </p>
          </div>

          <div className="mt-10 lg:mt-0 lg:col-span-5 xl:col-span-4">
            <RequestPricingPanel form={form} className="lg:sticky lg:top-24" />
          </div>
        </div>
      </div>
    </div>
  );
}
