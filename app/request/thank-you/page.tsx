"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  LinkIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  CloudIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";

export default function ThankYouPage() {
  const [token, setToken] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [hasDomain, setHasDomain] = useState<boolean | null>(null);
  const [domainName, setDomainName] = useState<string>("");
  const [changeRequest, setChangeRequest] = useState("");
  const [changeSubmitting, setChangeSubmitting] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [revisionsRemaining, setRevisionsRemaining] = useState<number | null>(null);
  const [infrastructure, setInfrastructure] = useState<{
    cloudProvider?: string;
    cdnEnabled?: boolean;
    sslEnabled?: boolean;
    cicdEnabled?: boolean;
    securityLevel?: string;
    addOns?: string[];
  } | null>(null);
  const [infraProvider, setInfraProvider] = useState<string>("managed");
  const [infraSaving, setInfraSaving] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/leads/status?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (res.ok) {
        setStatus(data.status || "");
        setPreviewUrl(data.previewUrl || null);
        setLeadId(data.leadId || null);
        setRevisionsRemaining(data.revisionsRemaining ?? null);
        const inf = data.infrastructure || null;
        setInfrastructure(inf);
        if (inf?.cloudProvider) setInfraProvider(String(inf.cloudProvider));
        return data;
      }
    } catch {
      // ignore
    }
    return null;
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    setToken(t);

    if (!t) return;

    // Trigger generation + deploy (fire-and-forget)
    fetch(`/api/leads/trigger?token=${encodeURIComponent(t)}`, { method: "POST" }).catch(() => {});

    // Initial status
    fetchStatus().then((d) => {
      if (d?.form) {
        setHasDomain(Boolean(d.form.hasDomain));
        setDomainName(String(d.form.domainName || ""));
      }
    });

    // Poll every 3s
    setPolling(true);
    const interval = setInterval(async () => {
      const d = await fetchStatus();
      if (d?.form) {
        setHasDomain(Boolean(d.form.hasDomain));
        setDomainName(String(d.form.domainName || ""));
      }
      if (d?.infrastructure) {
        setInfrastructure(d.infrastructure);
        if (d.infrastructure.cloudProvider) setInfraProvider(String(d.infrastructure.cloudProvider));
      }
      if (d?.deployReady) {
        clearInterval(interval);
        setPolling(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [token, fetchStatus]);

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <Navigation />
        <main className="max-w-2xl mx-auto px-4 py-24 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">Invalid or missing access. Please submit your request from the form.</p>
          <Link href="/request" className="text-indigo-600 dark:text-indigo-400 hover:underline">
            Go to AI + Cloud Deployment Request
          </Link>
        </main>
      </div>
    );
  }

  const isReady = previewUrl && (status === "deploy_ready" || status === "published");

  const saveInfrastructureSelection = async (provider: string) => {
    if (!token || !leadId || infraSaving) return;
    setInfraSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/infrastructure?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInfraProvider(provider);
        setInfrastructure((prev) => (prev ? { ...prev, cloudProvider: provider } : { cloudProvider: provider }));
      }
    } catch {
      // ignore
    } finally {
      setInfraSaving(false);
    }
  };

  const submitChangeRequest = async () => {
    if (!token || !leadId || !changeRequest.trim()) return;
    setChangeSubmitting(true);
    setChangeError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/preview/update?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeRequest: changeRequest.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setPreviewUrl(data.previewUrl || previewUrl);
        setChangeRequest("");
        setRevisionsRemaining(data.revisionsRemaining ?? revisionsRemaining);
      } else {
        setChangeError(data.error || "Update failed");
      }
    } catch {
      setChangeError("Update failed. Please try again.");
    } finally {
      setChangeSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link
          href="/request"
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-8"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Request
        </Link>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <div className="text-center mb-8">
            <CheckCircleIcon className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Thank you
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Your AI + Enterprise Cloud deployment is in progress. You&apos;ll see your live preview link when it&apos;s ready.
            </p>
          </div>

          {polling && !isReady && (
            <div className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-6 text-center">
              <div className="animate-pulse flex items-center justify-center gap-3 mb-2">
                <div className="h-3 w-3 rounded-full bg-indigo-500 animate-ping" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Generating your managed cloud preview...
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Managed cloud preview in 1–3 minutes. We&apos;ll email you when it&apos;s ready.
              </p>
            </div>
          )}

          {isReady && (
            <div className="mb-8 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20 p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-emerald-600" />
                Your AI-built site is live
              </h2>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
              >
                View your website
                <LinkIcon className="h-4 w-4" />
              </a>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Link also sent by email. Select your infrastructure below.
              </p>

              <div className="mt-6 pt-6 border-t border-emerald-200 dark:border-emerald-700">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Infrastructure selection</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                  Choose your cloud provider for production deployment.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "managed", label: "Managed Cloud (default)" },
                    { id: "aws", label: "AWS" },
                    { id: "azure", label: "Azure" },
                    { id: "gcp", label: "GCP" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => saveInfrastructureSelection(p.id)}
                      disabled={infraSaving}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        infraProvider === p.id
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-emerald-200 dark:border-emerald-700">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Request changes</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                  Tell us what to adjust. We&apos;ll regenerate and redeploy.{revisionsRemaining !== null && revisionsRemaining >= 0 && (
                    <span className="ml-1">({revisionsRemaining} revisions left)</span>
                  )}
                </p>
                <textarea
                  value={changeRequest}
                  onChange={(e) => setChangeRequest(e.target.value)}
                  placeholder="e.g. Make the tone more formal, add a section about our team..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 mb-2"
                />
                {changeError && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{changeError}</p>}
                <button
                  onClick={submitChangeRequest}
                  disabled={changeSubmitting || !changeRequest.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {changeSubmitting ? "Updating..." : "Submit changes"}
                </button>
              </div>
            </div>
          )}

          {isReady && (
            <section className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <CloudIcon className="h-5 w-5 text-indigo-600" />
                Infrastructure Stack
              </h2>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">Provider</dt>
                  <dd className="font-medium text-slate-700 dark:text-slate-300 capitalize">{infrastructure?.cloudProvider || infraProvider || "Managed Cloud"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">CDN</dt>
                  <dd className="font-medium text-slate-700 dark:text-slate-300">{infrastructure?.cdnEnabled ? "Enabled" : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">SSL</dt>
                  <dd className="font-medium text-slate-700 dark:text-slate-300">{infrastructure?.sslEnabled ? "Enabled" : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">CI/CD</dt>
                  <dd className="font-medium text-slate-700 dark:text-slate-300">{infrastructure?.cicdEnabled ? "Enabled" : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">Security status</dt>
                  <dd className="font-medium text-slate-700 dark:text-slate-300 capitalize">{infrastructure?.securityLevel || "Basic"}</dd>
                </div>
              </dl>
              {infrastructure?.addOns && infrastructure.addOns.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Selected Add-ons</h3>
                  <ul className="flex flex-wrap gap-2">
                    {infrastructure.addOns.map((a) => (
                      <li key={a} className="px-2 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium capitalize">
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <DocumentTextIcon className="h-5 w-5 text-indigo-600" />
              Domain & hosting next steps
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              We&apos;ll help you connect your domain and go live—no call required. Reply to our email with the info below.
            </p>

            {hasDomain && domainName ? (
              <div>
                <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-2">You have a domain: {domainName}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Please send us:</p>
                <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <li>Registrar name (e.g. Namecheap, GoDaddy, Cloudflare)</li>
                  <li>Access to update DNS records, or willingness to add the records we provide</li>
                  <li>We&apos;ll handle the rest and confirm when your site is live</li>
                </ul>
              </div>
            ) : (
              <div>
                <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                  <GlobeAltIcon className="h-4 w-4" />
                  You don&apos;t have a domain yet
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  We recommend registrars like Namecheap, Cloudflare Registrar, or Google Domains for simple setup. Tell us:
                </p>
                <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1 mb-4">
                  <li>What domain you&apos;d like (e.g. yourcompany.com)</li>
                  <li>Whether you&apos;ll purchase it yourself or want us to purchase and set it up with your approval</li>
                </ul>
                <p className="text-sm text-slate-500 dark:text-slate-500 italic">
                  We can purchase and set up the domain with your approval. Just let us know in your reply.
                </p>
              </div>
            )}
          </section>

          <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Questions? Email us at{" "}
            <a href="mailto:support@visionxixlabs.com" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              support@visionxixlabs.com
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
