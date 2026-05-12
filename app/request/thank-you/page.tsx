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
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { WebsiteBuilderJourney } from "@/components/WebsiteBuilderJourney";
import { Reveal } from "@/components/motion/Reveal";

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
  const [deployStatus, setDeployStatus] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/leads/status?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (res.ok) {
        setStatus(data.status || "");
        setPreviewUrl(data.previewUrl || null);
        setLeadId(data.leadId || null);
        setDeployStatus(data.deployStatus || null);
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
      if (d?.deployReady || d?.deployStatus === "managed_pending") {
        clearInterval(interval);
        setPolling(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [token, fetchStatus]);

  if (!token) {
    return (
      <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
        <div className="absolute inset-0 bg-dots opacity-10 pointer-events-none" aria-hidden />
        <Navigation />
        <main className="max-w-2xl mx-auto px-4 py-24 text-center relative">
          <p className="text-zinc-400 mb-4">Invalid or missing access. Please submit your request from the form.</p>
          <Link href="/request" className="text-violet-400 hover:underline">
            Go to AI + Cloud Deployment Request
          </Link>
        </main>
      </div>
    );
  }

  const isReady = previewUrl && (status === "deploy_ready" || status === "published");
  const isManagedPending = deployStatus === "managed_pending" || (status === "package_ready" && !previewUrl);

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
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-dots opacity-10 pointer-events-none" aria-hidden />
      <div className="spotlight-orb absolute -top-40 right-1/4 w-[400px] h-[400px] rounded-full bg-violet-600/[0.06] blur-[130px] pointer-events-none" aria-hidden />
      <div className="absolute bottom-20 -left-20 w-72 h-72 rounded-full bg-fuchsia-600/[0.04] blur-[100px] pointer-events-none" aria-hidden />

      <Navigation />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Link
            href="/request"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-violet-400"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Request
          </Link>
          <Link
            href="/builder"
            className="text-sm text-zinc-500 hover:text-violet-400"
          >
            Build another site
          </Link>
        </div>

        {/* Your journey -- where you are, what's next */}
        <div className="mb-8">
          <WebsiteBuilderJourney
            variant="full"
            currentStep={!!isReady ? "axiom" : "deploy"}
            previewReady={!!isReady}
            deploySubmitted={!!isReady}
            token={token ?? undefined}
          />
        </div>

        <Reveal direction="up" blur delay={0.05}>
          <div className="glass-card rounded-3xl border-2 border-white/[0.06] p-8 sm:p-10">
            <div className="text-center mb-8">
              <CheckCircleIcon className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-white mb-2 tracking-[-0.04em]">
                Thank <span className="text-gradient">you</span>
              </h1>
              <p className="text-zinc-400">
                Your AI + Enterprise Cloud deployment is in progress. You&apos;ll see your live preview link when it&apos;s ready.
              </p>
            </div>

            {polling && !isReady && !isManagedPending && (
              <div className="mb-8 space-y-4">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 w-48 mx-auto rounded-full bg-zinc-700" />
                    <div className="h-40 rounded-xl bg-white/[0.04] mt-4" />
                  </div>
                </div>
                <p className="text-xs text-zinc-500 text-center">
                  Managed cloud preview in 1-3 minutes. We&apos;ll email you when it&apos;s ready.
                </p>
              </div>
            )}

            {isManagedPending && (
              <Reveal direction="up" blur delay={0.1}>
                <div className="mb-8 glow-border-card rounded-xl border-2 border-amber-500/20 bg-amber-500/10 p-6">
                  <h2 className="text-lg font-semibold text-white mb-2">
                    Your AI site is ready—preview pending
                  </h2>
                  <p className="text-sm text-zinc-400 mb-3">
                    We&apos;ve generated your site. Preview deployment requires our team to complete it—we&apos;ll deploy and email you when it&apos;s live.
                  </p>
                  <p className="text-xs text-zinc-500">
                    Questions? Email us at{" "}
                    <a href="mailto:support@visionxixlabs.com" className="text-violet-400 hover:underline">
                      support@visionxixlabs.com
                    </a>
                  </p>
                  <Link
                    href="/contact"
                    className="btn-huly mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Contact us
                  </Link>
                </div>
              </Reveal>
            )}

            {isReady && (
              <Reveal direction="up" blur delay={0.1}>
                <div className="mb-8 glow-border-card rounded-xl border-2 border-emerald-500/20 bg-emerald-500/10 p-6 transition-opacity duration-200 ease-in-out">
                  <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                    <LinkIcon className="h-5 w-5 text-emerald-400" />
                    Your AI-built site is live
                  </h2>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-huly cta-glow inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                  >
                    View your website
                    <LinkIcon className="h-4 w-4" />
                  </a>
                  <p className="mt-2 text-sm text-zinc-400">
                    Link also sent by email. Select your infrastructure below.
                  </p>

                  <div className="mt-6 pt-6 border-t border-emerald-500/20">
                    <h3 className="text-sm font-semibold text-white mb-2">Infrastructure selection</h3>
                    <p className="text-xs text-zinc-400 mb-3">
                      Choose your cloud provider for production deployment.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: "managed", label: "Managed Cloud (Vercel)" },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => saveInfrastructureSelection(p.id)}
                          disabled={infraSaving}
                          className={`btn-huly px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            infraProvider === p.id
                              ? "bg-indigo-600 text-white"
                              : "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.06]"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-emerald-500/20">
                    <h3 className="text-sm font-semibold text-white mb-2">Request changes</h3>
                    <p className="text-xs text-zinc-400 mb-2">
                      Tell us what to adjust. We&apos;ll regenerate and redeploy.{revisionsRemaining !== null && revisionsRemaining >= 0 && (
                        <span className="ml-1">({revisionsRemaining} revisions left)</span>
                      )}
                    </p>
                    <textarea
                      value={changeRequest}
                      onChange={(e) => setChangeRequest(e.target.value)}
                      placeholder="e.g. Make the tone more formal, add a section about our team..."
                      rows={3}
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 mb-2 transition-colors"
                    />
                    {changeError && <p className="text-sm text-red-400 mb-2">{changeError}</p>}
                    <button
                      type="button"
                      onClick={submitChangeRequest}
                      disabled={changeSubmitting || !changeRequest.trim()}
                      className="btn-huly rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {changeSubmitting ? "Updating..." : "Submit changes"}
                    </button>
                  </div>
                </div>
              </Reveal>
            )}

            {isReady && (
              <Reveal direction="up" blur delay={0.15}>
                <section className="mb-8 glass-card rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <CloudIcon className="h-5 w-5 text-violet-400" />
                    Infrastructure Stack
                  </h2>
                  <dl className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Provider</dt>
                      <dd className="font-medium text-zinc-300 capitalize">{infrastructure?.cloudProvider || infraProvider || "Managed Cloud"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">CDN</dt>
                      <dd className="font-medium text-zinc-300">{infrastructure?.cdnEnabled ? "Enabled" : "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">SSL</dt>
                      <dd className="font-medium text-zinc-300">{infrastructure?.sslEnabled ? "Enabled" : "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">CI/CD</dt>
                      <dd className="font-medium text-zinc-300">{infrastructure?.cicdEnabled ? "Enabled" : "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Security status</dt>
                      <dd className="font-medium text-zinc-300 capitalize">{infrastructure?.securityLevel || "Basic"}</dd>
                    </div>
                  </dl>
                  {infrastructure?.addOns && infrastructure.addOns.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/[0.06]">
                      <h3 className="text-sm font-medium text-zinc-300 mb-2">Selected Add-ons</h3>
                      <ul className="flex flex-wrap gap-2">
                        {infrastructure.addOns.map((a) => (
                          <li key={a} className="huly-badge px-2 py-1 rounded-lg bg-violet-500/10 text-violet-400 text-xs font-medium capitalize">
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              </Reveal>
            )}

            <Reveal direction="up" blur delay={0.2}>
              <section className="glass-card rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <DocumentTextIcon className="h-5 w-5 text-violet-400" />
                  Domain & hosting next steps
                </h2>
                <p className="text-sm text-zinc-400 mb-4">
                  We&apos;ll help you connect your domain and go live—no call required. Reply to our email with the info below.
                </p>

                {hasDomain && domainName ? (
                  <div>
                    <h3 className="font-medium text-zinc-200 mb-2">You have a domain: {domainName}</h3>
                    <p className="text-sm text-zinc-400 mb-2">Please send us:</p>
                    <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                      <li>Registrar name (e.g. Namecheap, GoDaddy, Cloudflare)</li>
                      <li>Access to update DNS records, or willingness to add the records we provide</li>
                      <li>We&apos;ll handle the rest and confirm when your site is live</li>
                    </ul>
                  </div>
                ) : (
                  <div>
                    <h3 className="font-medium text-zinc-200 mb-2 flex items-center gap-2">
                      <GlobeAltIcon className="h-4 w-4" />
                      You don&apos;t have a domain yet
                    </h3>
                    <p className="text-sm text-zinc-400 mb-2">
                      We recommend registrars like Namecheap, Cloudflare Registrar, or Google Domains for simple setup. Tell us:
                    </p>
                    <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1 mb-4">
                      <li>What domain you&apos;d like (e.g. yourcompany.com)</li>
                      <li>Whether you&apos;ll purchase it yourself or want us to purchase and set it up with your approval</li>
                    </ul>
                    <p className="text-sm text-zinc-500 italic">
                      We can purchase and set up the domain with your approval. Just let us know in your reply.
                    </p>
                  </div>
                )}
              </section>
            </Reveal>

            <div className="section-divider my-8" />

            {/* End goal: Membership CTA */}
            <Reveal direction="up" blur delay={0.25}>
              <section className="rounded-2xl border-2 border-violet-500/20 bg-gradient-to-br from-violet-900/20 to-fuchsia-900/10 p-6">
                <h2 className="text-lg font-bold text-white mb-2 tracking-[-0.04em]">
                  Ready for <span className="text-gradient">full access</span>?
                </h2>
                <p className="text-sm text-zinc-400 mb-4">
                  Membership unlocks Axiom, chatbots, priority support, and all products. One plan, everything included.
                </p>
                <Link
                  href="/products"
                  className="btn-huly cta-glow inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 transition-all"
                >
                  View plans
                  <ArrowRightIcon className="h-5 w-5" />
                </Link>
                <span className="mx-3 text-zinc-500">or</span>
                <Link
                  href={token ? `/cloud-operator?ref=${encodeURIComponent(token)}` : "/cloud-operator"}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-violet-400 hover:underline"
                >
                  Run Axiom on this project
                  <CloudIcon className="h-4 w-4" />
                </Link>
              </section>
            </Reveal>

            <p className="mt-8 text-center text-sm text-zinc-500">
              Questions? Email us at{" "}
              <a href="mailto:support@visionxixlabs.com" className="text-violet-400 hover:underline">
                support@visionxixlabs.com
              </a>
            </p>
          </div>
        </Reveal>
      </main>
    </div>
  );
}
