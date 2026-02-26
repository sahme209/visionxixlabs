"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import {
  CheckCircleIcon,
  ArrowRightIcon,
  GlobeAltIcon,
  SparklesIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { PARENT_WEBSITE } from "@/lib/constants/company";

interface NextStepsDomainHosting {
  haveDomainHosting?: { whatWeNeed?: string[] };
  needHelp?: {
    recommendedRegistrar?: string;
    recommendedHosting?: string;
    stepsWeHandle?: string[];
  };
}

export default function ThankYouPage() {
  const searchParams = useSearchParams();
  const min = Number(searchParams.get("min")) || 0;
  const max = Number(searchParams.get("max")) || 0;
  const leadId = searchParams.get("leadId") ?? "";
  const token = searchParams.get("token") ?? "";

  const [starterStatus, setStarterStatus] = useState<"idle" | "pending" | "ready" | "error">("idle");
  const [previewStatus, setPreviewStatus] = useState<"idle" | "pending" | "ready" | "error">("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [nextSteps, setNextSteps] = useState<NextStepsDomainHosting | null>(null);

  const hasEstimate = min > 0 && max > 0;
  const formatted = hasEstimate ? `$${min.toLocaleString()} - $${max.toLocaleString()}` : "—";
  const hasTokenFlow = Boolean(leadId && token);

  const fetchStarter = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/starter?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (data.error === true) {
      setStarterStatus("error");
      return;
    }
    if (data.pending) {
      setStarterStatus("pending");
      return;
    }
    if (data.aiStarterPackage) {
      setStarterStatus("ready");
      const n = data.aiStarterPackage?.nextStepsDomainHosting;
      if (n && typeof n === "object") setNextSteps(n);
      return data;
    }
  }, [leadId, token]);

  const triggerStarterGenerate = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/starter/generate?token=${encodeURIComponent(token)}`, {
      method: "POST",
    });
    const data = await res.json();
    if (res.ok && data.aiStarterPackage) {
      setStarterStatus("ready");
      const n = data.aiStarterPackage?.nextStepsDomainHosting;
      if (n && typeof n === "object") setNextSteps(n);
      return data;
    }
    if (res.ok && data.alreadyPresent) {
      return fetchStarter();
    }
    setStarterStatus("error");
  }, [leadId, token, fetchStarter]);

  const triggerPreviewDeploy = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/preview/deploy?token=${encodeURIComponent(token)}`, {
      method: "POST",
    });
    const data = await res.json();
    if (res.ok && data.previewUrl) {
      setPreviewUrl(data.previewUrl);
      setPreviewStatus("ready");
      return;
    }
    setPreviewStatus("error");
  }, [leadId, token]);

  const pollPreview = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/preview?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (data.previewUrl) {
      setPreviewUrl(data.previewUrl);
      setPreviewStatus("ready");
    }
  }, [leadId, token]);

  useEffect(() => {
    if (!hasTokenFlow) return;
    setStarterStatus("pending");
  }, [hasTokenFlow]);

  useEffect(() => {
    if (!hasTokenFlow || starterStatus !== "pending") return;
    let cancelled = false;
    const run = async () => {
      const s = await fetchStarter();
      if (cancelled) return;
      if (s) return;
      await triggerStarterGenerate();
    };
    run();
    return () => { cancelled = true; };
  }, [hasTokenFlow, starterStatus, fetchStarter, triggerStarterGenerate]);

  useEffect(() => {
    if (!hasTokenFlow || starterStatus !== "ready") return;
    if (previewStatus !== "idle") return;
    setPreviewStatus("pending");
    let cancelled = false;
    const run = async () => {
      await pollPreview();
      if (cancelled) return;
      await triggerPreviewDeploy();
    };
    run();
    return () => { cancelled = true; };
  }, [hasTokenFlow, starterStatus, previewStatus, triggerPreviewDeploy, pollPreview]);

  useEffect(() => {
    if (!hasTokenFlow || previewStatus !== "pending") return;
    if (previewUrl) return;
    const t = setInterval(pollPreview, 4000);
    return () => clearInterval(t);
  }, [hasTokenFlow, previewStatus, previewUrl, pollPreview]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      <nav className="border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href={PARENT_WEBSITE}
            className="font-semibold text-[var(--text-primary)] hover:text-[var(--uscis-blue)]"
          >
            Vision XIX Labs
          </Link>
          <Link
            href="/request"
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--uscis-blue)]"
          >
            New request
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center px-4 py-16">
        <div className="w-full max-w-xl">
          <div className="flex justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--uscis-green)]/20 text-[var(--uscis-green)]">
              <CheckCircleIcon className="h-10 w-10" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-3 text-center">
            Thank you!
          </h1>
          <p className="text-[var(--text-secondary)] mb-8 text-center">
            We&apos;ve received your website request and will be in touch within 1–2 business days.
          </p>

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 mb-6 text-left">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              Estimated Project Range
            </h2>
            <p className="text-2xl font-bold text-[var(--uscis-blue)] mb-4">{formatted}</p>
            <p className="text-sm text-[var(--text-tertiary)]">
              This is an estimate only. Final pricing will be confirmed after review.
            </p>
          </div>

          {hasTokenFlow && (
            <>
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <SparklesIcon className="h-5 w-5 text-[var(--uscis-blue)]" />
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Your Website Preview
                  </h2>
                </div>
                {previewStatus === "ready" && previewUrl ? (
                  <div>
                    <p className="text-[var(--text-secondary)] mb-3">
                      Your website preview is ready.
                    </p>
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-[var(--uscis-blue)] px-4 py-3 font-semibold text-white hover:bg-[var(--uscis-blue-dark)]"
                    >
                      <GlobeAltIcon className="h-5 w-5" />
                      View your preview
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    </a>
                  </div>
                ) : previewStatus === "error" ? (
                  <p className="text-sm text-[var(--uscis-red)]">
                    Preview generation failed. Our team will follow up with your preview.
                  </p>
                ) : (
                  <p className="text-sm text-[var(--text-tertiary)]">
                    Generating your preview… This usually takes a minute. Refresh in a moment.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 mb-6">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                  Domain & Hosting Next Steps
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  No call required — we&apos;ll coordinate via email.
                </p>
                {nextSteps ? (
                  <div className="space-y-4 text-sm text-[var(--text-secondary)]">
                    <div>
                      <p className="font-medium text-[var(--text-primary)] mb-1">If you have a domain:</p>
                      <ul className="list-disc list-inside space-y-1 text-[var(--text-tertiary)]">
                        {(nextSteps.haveDomainHosting?.whatWeNeed ?? [
                          "Registrar login or DNS access",
                          "Admin/panel access for hosting",
                          "Point DNS to our hosting",
                        ]).map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-[var(--text-primary)] mb-1">If you need help:</p>
                      <p className="text-[var(--text-tertiary)] mb-1">
                        Recommended registrar: {nextSteps.needHelp?.recommendedRegistrar ?? "Namecheap, Google Domains, or Cloudflare"}
                      </p>
                      <p className="text-[var(--text-tertiary)] mb-1">
                        Recommended hosting: {nextSteps.needHelp?.recommendedHosting ?? "Vercel, Netlify, or managed hosting"}
                      </p>
                      <p className="text-[var(--text-tertiary)] mt-2">
                        We can purchase and set up with your approval. Reply to our follow-up email to get started.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 text-sm text-[var(--text-secondary)]">
                    <p>If you have a domain: we&apos;ll need registrar or DNS access and hosting admin access.</p>
                    <p>If you don&apos;t: we recommend Namecheap or Cloudflare for domains, and we can purchase and configure with your approval.</p>
                  </div>
                )}
              </div>
            </>
          )}

          <Link
            href={PARENT_WEBSITE}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--uscis-blue)] px-6 py-3 font-semibold text-white hover:bg-[var(--uscis-blue-dark)]"
          >
            Back to Vision XIX Labs
            <ArrowRightIcon className="h-5 w-5" />
          </Link>
        </div>
      </main>
    </div>
  );
}
