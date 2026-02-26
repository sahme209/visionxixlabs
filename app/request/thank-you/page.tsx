"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { PARENT_WEBSITE } from "@/lib/constants/company";

interface AiStarterPackage {
  siteStructure: { pages: Array<{ name: string; sections: string[] }> };
  heroHeadline: string;
  heroSubheadline: string;
  draftCopy: { home: string; services: string; about: string; contact: string };
  ctaRecommendations: Array<{ label: string; placement: string; type: string }>;
  colorStyleDirection: string;
  seoStarter: { keywords: string[]; metaTitle: string; metaDescription: string };
  nextStepsDomainHosting: {
    haveDomainHosting: { whatWeNeed: string[] };
    needHelp: {
      recommendedRegistrar: string;
      recommendedHosting: string;
      stepsWeHandle: string[];
    };
  };
  disclaimer: string;
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
  const [status, setStatus] = useState<"loading" | "pending" | "ready" | "error" | "no-token">(
    leadId && token ? "loading" : leadId && !token ? "no-token" : "ready"
  );

  useEffect(() => {
    if (!leadId || !token) return;

    const fetchStarter = async () => {
      try {
        const res = await fetch(`/api/leads/${leadId}/starter?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (res.status === 401) {
          setStatus("no-token");
          return;
        }
        if (data.error === true) {
          setStatus("error");
          return;
        }
        if (data.pending) {
          setStatus("pending");
          return;
        }
        if (data.aiStarterPackage) {
          setStarter(data.aiStarterPackage);
          setStatus("ready");
        }
      } catch {
        setStatus("error");
      }
    };

    fetchStarter();
  }, [leadId, token]);

  useEffect(() => {
    if (status !== "pending" || !leadId || !token) return;

    const triggerGenerate = async () => {
      try {
        await fetch(`/api/leads/${leadId}/starter/generate?token=${encodeURIComponent(token)}`, {
          method: "POST",
        });
      } catch {
        // ignore
      }
    };
    triggerGenerate();
  }, [status, leadId, token]);

  useEffect(() => {
    if (status !== "pending" || !leadId || !token) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/leads/${leadId}/starter?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (data.aiStarterPackage) {
          setStarter(data.aiStarterPackage);
          setStatus("ready");
        } else if (data.error === true) {
          setStatus("error");
        }
      } catch {
        // keep polling
      }
    }, 3000);
    return () => clearInterval(t);
  }, [status, leadId, token]);

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

      <main className="flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 text-green-600">
              <CheckCircleIcon className="h-10 w-10" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-3 text-center">
            Thank you!
          </h1>
          <p className="text-[var(--text-secondary)] mb-8 text-center">
            We&apos;ve received your website request and will be in touch within 1–2 business days.
          </p>

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 mb-8">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              Estimated Project Range
            </h2>
            <p className="text-2xl font-bold text-[var(--uscis-blue)] mb-4">{formatted}</p>
            <p className="text-sm text-[var(--text-tertiary)]">
              This is an estimate only. Final pricing will be confirmed after review.
            </p>
          </div>

          {status === "loading" && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-8 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--uscis-blue)] border-t-transparent mx-auto mb-4" />
              <p className="text-[var(--text-secondary)]">Loading your Website Starter Package…</p>
            </div>
          )}

          {status === "pending" && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-8 text-center">
              <DocumentTextIcon className="h-12 w-12 text-[var(--uscis-blue)] mx-auto mb-4" />
              <p className="text-[var(--text-secondary)] mb-2">
                We&apos;re preparing your Website Starter Package…
              </p>
              <p className="text-sm text-[var(--text-tertiary)]">
                This usually takes about 30 seconds. This page will update automatically.
              </p>
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--uscis-blue)] border-t-transparent mx-auto mt-4" />
            </div>
          )}

          {status === "no-token" && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 mb-8">
              <p className="text-[var(--text-primary)]">
                Use the link from your confirmation email to view your Website Starter Package, or we&apos;ll follow up within 1–2 business days.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 mb-8">
              <p className="text-[var(--text-primary)]">
                We received your request. Our team will follow up via email with your Website Starter Package.
              </p>
            </div>
          )}

          {status === "ready" && starter && (
            <div className="space-y-8 mb-10">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                  Your Website Starter Package
                </h2>
                {leadId && token && (
                  <a
                    href={`/api/leads/${leadId}/starter/download?token=${encodeURIComponent(token)}`}
                    download
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--uscis-blue)] px-5 py-2.5 font-medium text-white hover:opacity-90 transition-opacity"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                    Download Starter Package
                  </a>
                )}
              </div>

              <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6">
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-3">
                  Recommended Site Structure
                </h3>
                <ul className="space-y-3">
                  {starter.siteStructure?.pages?.map((p, i) => (
                    <li key={i} className="text-[var(--text-secondary)]">
                      <span className="font-medium text-[var(--text-primary)]">{p.name}</span>
                      {p.sections?.length ? (
                        <ul className="ml-4 mt-1 list-disc text-sm text-[var(--text-tertiary)]">
                          {p.sections.map((s, j) => (
                            <li key={j}>{s}</li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6">
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-3">Hero</h3>
                <p className="text-lg font-medium text-[var(--text-primary)] mb-1">
                  {starter.heroHeadline || "—"}
                </p>
                <p className="text-[var(--text-secondary)]">{starter.heroSubheadline || "—"}</p>
              </section>

              <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6">
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-3">
                  Draft Copy
                </h3>
                <div className="space-y-4 text-[var(--text-secondary)] text-sm">
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">Home</span>
                    <p className="mt-1">{starter.draftCopy?.home || "—"}</p>
                  </div>
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">Services</span>
                    <p className="mt-1">{starter.draftCopy?.services || "—"}</p>
                  </div>
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">About</span>
                    <p className="mt-1">{starter.draftCopy?.about || "—"}</p>
                  </div>
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">Contact</span>
                    <p className="mt-1">{starter.draftCopy?.contact || "—"}</p>
                  </div>
                </div>
              </section>

              {starter.ctaRecommendations?.length > 0 && (
                <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6">
                  <h3 className="text-base font-semibold text-[var(--text-primary)] mb-3">
                    CTA Recommendations
                  </h3>
                  <ul className="space-y-2">
                    {starter.ctaRecommendations.map((c, i) => (
                      <li key={i} className="text-[var(--text-secondary)] text-sm">
                        <span className="font-medium text-[var(--text-primary)]">{c.label}</span>
                        {" "}— {c.placement} ({c.type})
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {starter.colorStyleDirection && (
                <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6">
                  <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">
                    Color & Style Direction
                  </h3>
                  <p className="text-[var(--text-secondary)] text-sm">
                    {starter.colorStyleDirection}
                  </p>
                </section>
              )}

              <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6">
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-3">
                  SEO Starter
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-2">
                  <span className="font-medium text-[var(--text-primary)]">Keywords:</span>{" "}
                  {starter.seoStarter?.keywords?.join(", ") || "—"}
                </p>
                <p className="text-sm text-[var(--text-secondary)] mb-2">
                  <span className="font-medium text-[var(--text-primary)]">Meta Title:</span>{" "}
                  {starter.seoStarter?.metaTitle || "—"}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-primary)]">Meta Description:</span>{" "}
                  {starter.seoStarter?.metaDescription || "—"}
                </p>
              </section>

              <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6">
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-3">
                  Next Steps — Domain & Hosting
                </h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-medium text-[var(--text-primary)] mb-2">
                      If you have domain/hosting
                    </p>
                    <p className="text-[var(--text-secondary)] mb-1">What we need:</p>
                    <ul className="list-disc ml-4 text-[var(--text-secondary)]">
                      {starter.nextStepsDomainHosting?.haveDomainHosting?.whatWeNeed?.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                      {(!starter.nextStepsDomainHosting?.haveDomainHosting?.whatWeNeed?.length) && (
                        <li>Registrar access, DNS access, hosting login</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text-primary)] mb-2">If you need help</p>
                    <p className="text-[var(--text-secondary)] mb-1">
                      Recommended registrar:{" "}
                      {starter.nextStepsDomainHosting?.needHelp?.recommendedRegistrar || "—"}
                    </p>
                    <p className="text-[var(--text-secondary)] mb-2">
                      Recommended hosting:{" "}
                      {starter.nextStepsDomainHosting?.needHelp?.recommendedHosting || "—"}
                    </p>
                    <p className="text-[var(--text-secondary)] mb-1">What we&apos;ll handle:</p>
                    <ul className="list-disc ml-4 text-[var(--text-secondary)]">
                      {starter.nextStepsDomainHosting?.needHelp?.stepsWeHandle?.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <p className="text-xs text-[var(--text-tertiary)] italic">{starter.disclaimer}</p>
            </div>
          )}

          <div className="text-center">
            <Link
              href={PARENT_WEBSITE}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--uscis-blue)] px-6 py-3 font-semibold text-white hover:opacity-90"
            >
              Back to Vision XIX Labs
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
          </div>
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
