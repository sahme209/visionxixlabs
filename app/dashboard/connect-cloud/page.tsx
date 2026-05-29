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

const PROVIDER_TONE: Record<Provider, string> = {
  aws:   "from-amber-500/20  to-amber-500/5  border-amber-500/30  text-amber-200",
  azure: "from-sky-500/20    to-sky-500/5    border-sky-500/30    text-sky-200",
  gcp:   "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-200",
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
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white mb-6">
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Dashboard
        </Link>
        <h1 className="text-3xl font-semibold text-white tracking-tight mb-2">Connect a cloud.</h1>
        <p className="text-sm text-zinc-400 mb-8 max-w-xl">
          Read-only by default. Axiom never stores root credentials — only
          the assumed role / service principal it needs to scan.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          {(["aws", "azure", "gcp"] as Provider[]).map((p) => (
            <button
              key={p}
              onClick={() => startProvider(p)}
              className={`group rounded-2xl border bg-gradient-to-br ${PROVIDER_TONE[p]} p-5 text-left transition-transform hover:-translate-y-0.5`}
            >
              <CloudIcon className="h-6 w-6 mb-3" />
              <p className="text-sm font-semibold text-white mb-1">{PROVIDER_LABELS[p]}</p>
              <p className="text-[11px] text-zinc-400">
                {p === "aws"   && "CloudFormation Quick-Create"}
                {p === "azure" && "Cloud Shell · service principal"}
                {p === "gcp"   && "Cloud Shell · service account"}
              </p>
            </button>
          ))}
        </div>
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
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-6">
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
