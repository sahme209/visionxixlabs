"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { PARENT_WEBSITE } from "@/lib/constants/company";

interface AiStarterPackage {
  siteStructure: { pages: Array<{ name: string; sections: string[] }> };
  heroHeadline: string;
  heroSubheadline: string;
  draftCopy: { home: string; services: string; about: string; contact: string };
  nextStepsDomainHosting: {
    haveDomainHosting: { whatWeNeed: string[] };
    needHelp: {
      recommendedRegistrar: string;
      recommendedHosting: string;
      stepsWeHandle: string[];
    };
  };
}

function ThankYouContent() {
  const searchParams = useSearchParams();
  const leadId = searchParams.get("leadId");
  const token = searchParams.get("token");
  const min = Number(searchParams.get("min")) || 0;
  const max = Number(searchParams.get("max")) || 0;
  const hasEstimate = min > 0 && max > 0;
  const formatted = hasEstimate
    ? `$${min.toLocaleString()} – $${max.toLocaleString()}`
    : "—";

  const [starter, setStarter] = useState<AiStarterPackage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [starterStatus, setStarterStatus] = useState<
    "loading" | "pending" | "ready" | "error" | "no-token"
  >(leadId && token ? "loading" : leadId && !token ? "no-token" : "ready");
  const [previewStatus, setPreviewStatus] = useState<
    "idle" | "pending" | "ready" | "error"
  >("idle");

  useEffect(() => {
    if (!leadId || !token) return;

    const fetchStarter = async () => {
      try {
        const res = await fetch(
          `/api/leads/${leadId}/starter?token=${encodeURIComponent(token)}`
        );
        const data = await res.json();

        if (res.status === 401) {
          setStarterStatus("no-token");
          return;
        }
        if (data.error === true) {
          setStarterStatus("error");
          return;
        }
        if (data.pending) {
          setStarterStatus("pending");
          if (data.previewUrl) setPreviewUrl(data.previewUrl);
          return;
        }
        if (data.aiStarterPackage) {
          setStarter(data.aiStarterPackage);
          setStarterStatus("ready");
          if (data.previewUrl) {
            setPreviewUrl(data.previewUrl);
            setPreviewStatus("ready");
          } else {
            setPreviewStatus("idle");
          }
        }
      } catch {
        setStarterStatus("error");
      }
    };

    fetchStarter();
  }, [leadId, token]);

  useEffect(() => {
    if (starterStatus !== "pending" || !leadId || !token) return;

    const triggerGenerate = async () => {
      try {
        await fetch(
          `/api/leads/${leadId}/starter/generate?token=${encodeURIComponent(token)}`,
          { method: "POST" }
        );
      } catch {
        // ignore
      }
    };
    triggerGenerate();
  }, [starterStatus, leadId, token]);

  useEffect(() => {
    if (starterStatus !== "pending" || !leadId || !token) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/leads/${leadId}/starter?token=${encodeURIComponent(token)}`
        );
        const data = await res.json();
        if (data.aiStarterPackage) {
          setStarter(data.aiStarterPackage);
          setStarterStatus("ready");
          if (data.previewUrl) {
            setPreviewUrl(data.previewUrl);
            setPreviewStatus("ready");
          } else {
            setPreviewStatus("idle");
          }
        } else if (data.error === true) {
          setStarterStatus("error");
        }
      } catch {
        // keep polling
      }
    }, 3000);
    return () => clearInterval(t);
  }, [starterStatus, leadId, token]);

  useEffect(() => {
    if (starterStatus !== "ready" || !starter || previewStatus !== "idle" || !leadId || !token)
      return;

    const triggerDeploy = async () => {
      setPreviewStatus("pending");
      try {
        const res = await fetch(
          `/api/leads/${leadId}/preview/deploy?token=${encodeURIComponent(token)}`,
          { method: "POST" }
        );
        const data = await res.json();
        if (res.ok && data.previewUrl) {
          setPreviewUrl(data.previewUrl);
          setPreviewStatus("ready");
        } else {
          setPreviewStatus("error");
        }
      } catch {
        setPreviewStatus("error");
      }
    };
    triggerDeploy();
  }, [starterStatus, starter, previewStatus, leadId, token]);

  useEffect(() => {
    if (previewStatus !== "pending" || !leadId || !token) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/leads/${leadId}/preview/status?token=${encodeURIComponent(token)}`
        );
        const data = await res.json();
        if (data.previewUrl) {
          setPreviewUrl(data.previewUrl);
          setPreviewStatus("ready");
        }
      } catch {
        // keep polling
      }
    }, 4000);
    return () => clearInterval(t);
  }, [previewStatus, leadId, token]);

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
        <div className="w-full max-w-xl text-center">
          <div className="flex justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--uscis-green)]/20 text-[var(--uscis-green)]">
              <CheckCircleIcon className="h-10 w-10" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-3">
            Thank you!
          </h1>
          <p className="text-[var(--text-secondary)] mb-8">
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

          {leadId && token && (
            <>
              {starterStatus === "loading" && (
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 mb-6 text-left">
                  <p className="text-[var(--text-secondary)]">Loading your AI starter package…</p>
                  <div className="mt-4 h-2 w-full rounded-full bg-[var(--border-color)] overflow-hidden">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--uscis-blue)]" />
                  </div>
                </div>
              )}
              {starterStatus === "pending" && (
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 mb-6 text-left">
                  <p className="text-[var(--text-secondary)]">Generating your AI starter package and preview site…</p>
                  <div className="mt-4 h-2 w-full rounded-full bg-[var(--border-color)] overflow-hidden">
                    <div className="h-full w-2/3 animate-pulse rounded-full bg-[var(--uscis-blue)]" />
                  </div>
                </div>
              )}
              {starterStatus === "ready" && starter && (
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 mb-6 text-left space-y-4">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Your Website Starter Package
                  </h2>
                  <p className="text-[var(--text-secondary)]">{starter.heroHeadline}</p>
                  <p className="text-sm text-[var(--text-tertiary)]">{starter.heroSubheadline}</p>
                  {previewStatus === "pending" && (
                    <p className="text-sm text-[var(--uscis-blue)]">
                      Deploying your preview site…
                    </p>
                  )}
                  {previewUrl && previewStatus === "ready" && (
                    <div className="rounded-xl bg-[var(--uscis-green)]/10 border border-[var(--uscis-green)]/30 p-4">
                      <p className="text-sm font-semibold text-[var(--uscis-green)] mb-2">
                        Your website preview is ready
                      </p>
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-[var(--uscis-blue)] px-4 py-2 font-semibold text-white hover:bg-[var(--uscis-blue-dark)]"
                      >
                        View preview
                        <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                      </a>
                    </div>
                  )}
                  {previewStatus === "error" && (
                    <p className="text-sm text-[var(--uscis-red)]">
                      Preview deployment is delayed. We&apos;ll email you when it&apos;s ready.
                    </p>
                  )}
                </div>
              )}
              {starterStatus === "error" && (
                <div className="rounded-2xl border border-[var(--uscis-red)]/30 bg-[var(--uscis-red)]/5 p-6 mb-6 text-left">
                  <p className="text-[var(--uscis-red)]">
                    AI generation encountered an issue. Our team will follow up.
                  </p>
                </div>
              )}
              {starterStatus === "no-token" && (
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 mb-6 text-left">
                  <p className="text-[var(--text-secondary)]">
                    Use the link in your confirmation email to view your AI package and preview.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 mb-8 text-left">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
              Domain & Hosting Next Steps
            </h2>
            <p className="text-[var(--text-secondary)] text-sm mb-4">
              No call required—we can handle everything via email.
            </p>
            <div className="space-y-3 text-sm text-[var(--text-secondary)]">
              <div>
                <p className="font-medium text-[var(--text-primary)]">If you have a domain</p>
                <p>We&apos;ll need registrar/DNS access. Reply to our confirmation email when ready.</p>
              </div>
              <div>
                <p className="font-medium text-[var(--text-primary)]">If you don&apos;t have one yet</p>
                <p>We recommend Namecheap or Cloudflare. We can purchase and set up with your approval—just reply to our email.</p>
              </div>
            </div>
          </div>

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

export default function ThankYouPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--uscis-blue)] border-t-transparent" />
        </div>
      }
    >
      <ThankYouContent />
    </Suspense>
  );
}
