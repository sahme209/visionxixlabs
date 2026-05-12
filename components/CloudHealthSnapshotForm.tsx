"use client";

import { FormEvent, useState } from "react";

export function CloudHealthSnapshotForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = formData.get("email")?.toString() || "";
    const company = formData.get("company")?.toString() || "";
    const cloudProvider = formData.get("cloudProvider")?.toString() || "";

    if (!email) {
      setError("Email is required");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: company || "Cloud Health Snapshot",
          email,
          company,
          topic: "Free Cloud Health Snapshot",
          companySize: "Not specified",
          cloudProvider: cloudProvider || "Not specified",
          mainConcern: "Cloud health snapshot",
          setupMaturity: "Not specified",
          message: `Cloud Health Snapshot request. Company: ${company || "—"}. Cloud: ${cloudProvider || "—"}`,
          source: "cloud-health-snapshot",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      setSubmitted(true);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try emailing support@visionxixlabs.com");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-emerald-300 text-sm">
        Thanks! We&apos;ll send your Cloud Health Snapshot soon. Check your inbox.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left max-w-md mx-auto">
      <div>
        <label htmlFor="snapshot-email" className="block text-sm font-medium text-zinc-300 mb-1">Work email *</label>
        <input
          id="snapshot-email"
          name="email"
          type="email"
          required
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="snapshot-company" className="block text-sm font-medium text-zinc-300 mb-1">Company</label>
        <input
          id="snapshot-company"
          name="company"
          type="text"
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="snapshot-cloud" className="block text-sm font-medium text-zinc-300 mb-1">Primary cloud provider</label>
        <select
          id="snapshot-cloud"
          name="cloudProvider"
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm"
        >
          <option value="">Select</option>
          <option value="AWS">AWS</option>
          <option value="Azure">Azure</option>
          <option value="GCP">GCP</option>
          <option value="Multi-cloud">Multi-cloud</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex justify-center items-center px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Sending..." : "Get my snapshot"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
