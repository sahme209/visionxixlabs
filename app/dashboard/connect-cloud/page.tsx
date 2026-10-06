"use client";

/**
 * /dashboard/connect-cloud — the dashboard-native connect flow.
 *
 * Until this page existed, the dashboard's "Connect AWS" CTA bounced
 * the user out to /operator/onboarding — a public, pre-login surface.
 * Confused signed-in users: they'd land back on /dashboard after
 * connecting and see "Connect AWS" again because the two surfaces
 * didn't share state.
 *
 * This page keeps signed-in users inside the dashboard chrome:
 *   1. Pick a provider (AWS / Azure / GCP).
 *   2. Hit /api/cloud-operator/start to mint a Lead + starter token
 *      (Lead gets the signed-in user id, so the bridge can derive the
 *      org id from email and upsert ConnectorSetupSession).
 *   3. Push the token onto the URL so AwsKeyConnect picks it up via
 *      useSearchParams (existing reusable component).
 *   4. Reuse AwsKeyConnect / AzureDeployConnect / GcpDeployConnect.
 *   5. On onValidated → /api/connectors/link → bridge runs → success.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CloudIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  LockClosedIcon,
  EyeIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { AwsKeyConnect } from "@/app/operator/onboarding/AwsKeyConnect";
import { AzureDeployConnect } from "@/app/operator/onboarding/AzureDeployConnect";
import { GcpDeployConnect } from "@/app/operator/onboarding/GcpDeployConnect";

type Provider = "aws" | "azure" | "gcp";
type Phase = "select" | "starting" | "setup" | "linking" | "linked" | "error";

const PROVIDER_LABELS: Record<Provider, string> = {
  aws:   "Amazon Web Services",
  azure: "Microsoft Azure",
  gcp:   "Google Cloud",
};

// Removed per-provider gradients — the page used to flash amber / sky /
// emerald cards in a row, which broke the calm. Provider cards now share
// the same surface; the brand badge in the corner is the only differentiator.

const PROVIDER_BADGES: Record<Provider, string> = {
  aws:   "AWS",
  azure: "Azure",
  gcp:   "GCP",
};

type ProviderInfo = {
  tagline: string;
  setup: string;
  authMethod: string;
  capabilities: string[];
};

const PROVIDER_INFO: Record<Provider, ProviderInfo> = {
  aws: {
    tagline: "Full autonomous operations — scan, reason, plan, execute with approval gates.",
    setup:   "CloudFormation Quick-Create · ~90 seconds",
    authMethod: "Cross-account IAM role · External ID condition",
    capabilities: [
      "Infrastructure discovery (all regions)",
      "IAM exposure scan",
      "Security posture + drift detection",
      "Cost + waste analysis",
      "Resilience + DR readiness",
      "Compliance evidence collection",
      "Approval-gated remediation",
      "Audit-grade activity log",
    ],
  },
  azure: {
    tagline: "Full autonomous operations — scan, reason, plan, execute with approval gates.",
    setup:   "Cloud Shell · single command",
    authMethod: "Service principal · Reader role",
    capabilities: [
      "Subscription + resource discovery",
      "Entra ID exposure scan",
      "Security posture + drift detection",
      "Cost + commitment analysis",
      "Resilience + DR readiness",
      "Compliance evidence collection",
      "Approval-gated remediation",
      "Audit-grade activity log",
    ],
  },
  gcp: {
    tagline: "Full autonomous operations — scan, reason, plan, execute with approval gates.",
    setup:   "Cloud Shell · single command",
    authMethod: "Service account · Viewer + Security Reviewer",
    capabilities: [
      "Project + resource discovery",
      "IAM exposure scan",
      "Security posture + drift detection",
      "Cost + waste analysis",
      "Resilience + DR readiness",
      "Compliance evidence collection",
      "Approval-gated remediation",
      "Audit-grade activity log",
    ],
  },
};

function ConnectCloudInner() {
  const router = useRouter();
  const search = useSearchParams();
  // Provider can be deep-linked via ?provider= so the dashboard CTAs
  // can land on the right card without the user re-selecting.
  const initialProvider = (search.get("provider") as Provider | null) ?? null;
  const tokenFromUrl = search.get("token");

  const [provider, setProvider] = useState<Provider | null>(initialProvider);
  const [phase, setPhase] = useState<Phase>(tokenFromUrl ? "setup" : "select");
  const [token, setToken] = useState<string | null>(tokenFromUrl);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — pick a provider and mint a starter token.
  const startProvider = useCallback(async (p: Provider) => {
    setProvider(p);
    setError(null);
    setPhase("starting");
    try {
      const res = await fetch("/api/cloud-operator/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: p }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setError(data.error ?? "Could not start a connect session. Try again.");
        setPhase("error");
        return;
      }
      setToken(data.token);
      // Push the token + provider into the URL so the reused
      // AwsKeyConnect can read it via useSearchParams.
      const next = new URLSearchParams(search.toString());
      next.set("provider", p);
      next.set("token", data.token);
      router.replace(`/dashboard/connect-cloud?${next.toString()}`);
      setPhase("setup");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
      setPhase("error");
    }
  }, [router, search]);

  // Auto-start when the URL already names a provider (e.g. deep-linked
  // from /dashboard) but no token yet. Lets the dashboard's CTAs feel
  // instant — user clicks Connect AWS, lands here, the form is already
  // running.
  useEffect(() => {
    if (!provider || token || phase !== "select") return;
    void startProvider(provider);
  }, [provider, token, phase, startProvider]);

  // Step 2 — after the provider-specific component verifies the role /
  // service principal / SA, call /api/connectors/link to persist the
  // connector on the Lead. The bridge inside link/route.ts then
  // upserts ConnectorSetupSession so /dashboard reflects "Connected".
  const finishLink = useCallback(async (linkBody: Record<string, unknown>) => {
    if (!token) return;
    setPhase("linking");
    setError(null);
    try {
      const res = await fetch(`/api/connectors/link?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(linkBody),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Could not register the connector.");
        setPhase("error");
        return;
      }
      setPhase("linked");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error finalizing the connection.");
      setPhase("error");
    }
  }, [token]);

  // ─── linked / success ────────────────────────────────────────────────
  if (phase === "linked") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] to-transparent p-10 text-center">
          <CheckCircleIcon className="h-12 w-12 text-emerald-300 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-white mb-2">
            {provider ? PROVIDER_LABELS[provider] : "Cloud"} connected.
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-lg mx-auto mb-7">
            Axiom can now read your environment. Head back to the dashboard
            to start a scan or connect another provider.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 transition-colors"
            >
              Back to dashboard
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/dashboard/connect-cloud"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-zinc-200 hover:border-white/20 transition-colors"
            >
              Connect another
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── provider selector ──────────────────────────────────────────────
  if (phase === "select" || (!provider && phase !== "starting")) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white mb-6">
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Dashboard
        </Link>

        {/* Header */}
        <div className="mb-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">connect a cloud</p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight mb-3">
            Pick where you want Axiom to start.
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
            Three providers. One read-only handshake. Axiom never holds your
            data — it reasons over a normalized snapshot you can revoke at any
            time.
          </p>
        </div>

        {/* Provider rows — calm shared surface, brand differentiated only by badge */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden mb-12">
          {(["aws", "azure", "gcp"] as Provider[]).map((p) => {
            const info = PROVIDER_INFO[p];
            return (
              <button
                key={p}
                onClick={() => startProvider(p)}
                className="group w-full px-6 sm:px-7 py-6 text-left hover:bg-white/[0.015] transition-colors focus:outline-none"
              >
                <div className="flex items-start gap-5">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 text-[10px] font-mono font-semibold tracking-wider text-zinc-300">
                    {PROVIDER_BADGES[p]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-white mb-1">{PROVIDER_LABELS[p]}</p>
                    <p className="text-[12px] text-zinc-500 leading-relaxed mb-2">{info.tagline}</p>
                    <p className="text-[11px] text-zinc-600">{info.setup} · {info.authMethod}</p>
                  </div>
                  <ArrowRightIcon className="h-4 w-4 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all mt-1 shrink-0" />
                </div>
              </button>
            );
          })}
        </div>

        {/* How Axiom connects — three plain promises */}
        <div className="grid md:grid-cols-3 gap-x-10 gap-y-6 mb-12">
          <Promise
            icon={LockClosedIcon}
            title="Read-only by default"
            body="Only the role or service principal you create. No keys, no JSON. Revoke from your console and access ends in seconds."
          />
          <Promise
            icon={ShieldCheckIcon}
            title="Approval-gated writes"
            body="Discovery + analysis runs unattended. Anything that mutates infrastructure pauses at a human-readable approval first."
          />
          <Promise
            icon={EyeIcon}
            title="Audit-grade log"
            body="Every read, plan, approval, and write captured as a signed row you can export to your SIEM."
          />
        </div>

        {/* Capability detail — collapsed by default so the picker stays calm */}
        <details className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] open:bg-white/[0.02] transition-colors">
          <summary className="cursor-pointer list-none px-6 sm:px-7 py-4 flex items-center justify-between text-[13px] text-zinc-400 hover:text-white">
            <span>What does each provider unlock?</span>
            <span className="text-[10px] font-mono text-zinc-600 group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="grid sm:grid-cols-3 gap-x-8 gap-y-5 px-6 sm:px-7 pb-6 pt-1">
            {(["aws", "azure", "gcp"] as Provider[]).map((p) => (
              <div key={p}>
                <p className="text-[11px] text-zinc-500 mb-3">{PROVIDER_LABELS[p]}</p>
                <ul className="space-y-1.5">
                  {PROVIDER_INFO[p].capabilities.map((cap) => (
                    <li key={cap} className="text-[12px] text-zinc-400 leading-relaxed">
                      {cap}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      </div>
    );
  }

  // ─── starting / linking spinner ─────────────────────────────────────
  if (phase === "starting" || phase === "linking") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="h-6 w-6 mx-auto mb-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        <p className="text-sm text-zinc-400">
          {phase === "starting" ? "Preparing your connect session…" : "Registering the connector…"}
        </p>
      </div>
    );
  }

  // ─── error ──────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-6">
          <div className="flex items-start gap-3 mb-3">
            <ExclamationCircleIcon className="h-5 w-5 text-rose-300 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-100 leading-relaxed">{error ?? "Something went wrong."}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setError(null); setToken(null); setProvider(null); setPhase("select"); router.replace("/dashboard/connect-cloud"); }}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:border-white/20"
            >
              Start over
            </button>
            <Link href="/dashboard" className="rounded-full bg-white/[0.04] px-4 py-2 text-sm text-zinc-300 hover:bg-white/[0.06]">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── setup: render the matching provider component ──────────────────
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Dashboard
      </Link>
      {provider === "aws" && (
        <AwsKeyConnect
          onValidated={async ({ accountId, roleArn, externalId }) => {
            await finishLink({
              connectorType: "aws",
              authMethod: "assume-role",
              roleArn,
              awsAccountId: accountId ?? "",
              externalId,
            });
          }}
        />
      )}
      {provider === "azure" && (
        <AzureDeployConnect
          onValidated={async ({ tenantId, subscriptionId, clientId, credentialsJson }) => {
            // Same body shape as /operator/onboarding/page.tsx — see
            // there for the credentialsJson vs clientSecret split that
            // the connector expects.
            await finishLink({
              connectorType: "azure",
              authMethod: "service-principal",
              tenantId,
              subscriptionId,
              clientId,
              credentialsJson,
            });
          }}
        />
      )}
      {provider === "gcp" && (
        <GcpDeployConnect
          onValidated={async ({ projectId, serviceAccountJson }) => {
            await finishLink({
              connectorType: "gcp",
              authMethod: "service-account",
              projectId,
              serviceAccountJson,
            });
          }}
        />
      )}
    </div>
  );
}

function Promise({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof CloudIcon;
  title: string;
  body: string;
}) {
  return (
    <div>
      <Icon className="h-4 w-4 text-zinc-500 mb-3" />
      <p className="text-[14px] font-medium text-white mb-1.5">{title}</p>
      <p className="text-[12px] text-zinc-500 leading-relaxed">{body}</p>
    </div>
  );
}

export default function ConnectCloudPage() {
  return (
    <Suspense fallback={
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="h-6 w-6 mx-auto animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    }>
      <ConnectCloudInner />
    </Suspense>
  );
}
