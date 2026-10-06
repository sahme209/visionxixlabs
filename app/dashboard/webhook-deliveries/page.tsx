"use client";

/**
 * /dashboard/webhook-deliveries — Phase 497.
 *
 * Live tail of GitHub webhook deliveries the platform has received.
 * Confirms the receiver is wired up; deliveries for unregistered
 * repositories appear with outcome=ignored.
 */

import { useEffect, useState } from "react";
import {
  InboxIcon,
  CheckCircleIcon,
  NoSymbolIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

interface DeliveryView {
  id: string;
  provider: string;
  deliveryId: string;
  eventKind: string;
  eventAction: string | null;
  outcome: "accepted" | "ignored" | "error" | "unknown";
  summary: string;
  receivedAtIso: string;
}

interface ListData {
  generatedAt: string;
  deliveries: DeliveryView[];
  summary: { total: number; accepted: number; ignored: number; errored: number };
}

type ListBody =
  | { ok: true; data: ListData }
  | { ok: false; error: string; hint?: string };

const OUTCOME_CLASS: Record<DeliveryView["outcome"], string> = {
  accepted: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  ignored:  "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  error:    "bg-rose-500/15 text-rose-300 border-rose-500/25",
  unknown:  "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export default function WebhookDeliveriesPage() {
  const [resp, setResp] = useState<ListBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/webhook-delivery-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: ListBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadList(); }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <div className="relative">
      <PageIntro
        kicker={`ReleaseOps · webhooks${data ? ` · ${data.summary.total} deliveries` : ""}`}
        title={<>Every webhook. <span className="text-zinc-500">Verified, deduped.</span></>}
        description="Live tail of GitHub webhook deliveries the platform has received. Idempotent on (provider, deliveryId); retries collapse to a single row. Deliveries for unregistered repositories are accepted but marked ignored."
        helps="Use this to confirm the webhook URL + secret are wired correctly. New deliveries appear within seconds of a GitHub push / PR / release event."
        connectFirst={"Configure the webhook on your repo · URL: https://<your-host>/api/webhooks/github · Content type: application/json · Secret: GITHUB_WEBHOOK_SECRET · Events: push, pull_request, release, workflow_run"}
        engineers={["DevOps", "Release Captain"]}
        requiresApproval="Signature verification rejects unsigned or wrong-secret requests with 401."
        actions={[
          { label: "Repositories", href: "/dashboard/repositories" },
          { label: "Release audit", href: "/dashboard/release-audit" },
        ]}
        safetyNote="HMAC-SHA256 verified · per-org isolation via repository lookup · 100-row page cap"
      />

      {data && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={InboxIcon} label="Total" value={String(data.summary.total)} tone="zinc" />
          <Stat icon={CheckCircleIcon} label="Accepted" value={String(data.summary.accepted)} tone={data.summary.accepted > 0 ? "emerald" : "zinc"} />
          <Stat icon={NoSymbolIcon} label="Ignored" value={String(data.summary.ignored)} tone="zinc" />
          <Stat icon={ExclamationTriangleIcon} label="Errored" value={String(data.summary.errored)} tone={data.summary.errored > 0 ? "rose" : "zinc"} />
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading webhook deliveries…
        </div>
      )}

      {!loading && networkError && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {networkError}
        </div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
            <p className="text-[12px] font-semibold text-amber-200">Schema migration pending</p>
          </div>
          <p className="text-[12.5px] text-zinc-300">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Sign in required.
        </div>
      )}

      {data && (
        data.deliveries.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
            No webhook deliveries received yet. Configure the GitHub webhook (see description above) and trigger an event to see it land here.
          </div>
        ) : (
          <div className="space-y-2 mb-8">
            {data.deliveries.map((d) => (
              <div key={d.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${OUTCOME_CLASS[d.outcome]}`}>
                    {d.outcome}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">{d.provider}:{d.eventKind}</span>
                  {d.eventAction && (
                    <span className="text-[10px] font-mono text-zinc-500">· {d.eventAction}</span>
                  )}
                  <span className="text-[10px] font-mono text-zinc-500 ml-auto">
                    {new Date(d.receivedAtIso).toLocaleString()}
                  </span>
                </div>
                <p className="text-[12.5px] text-zinc-200">{d.summary}</p>
                <p className="text-[10px] font-mono text-zinc-600 mt-1">delivery: {d.deliveryId}</p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof InboxIcon; label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <Icon className="h-4 w-4 opacity-80" />
        <p className="text-[20px] font-bold">{value}</p>
      </div>
    </div>
  );
}
