"use client";

/**
 * /dashboard/sops — Phase 448. Catalog of 10 deployment SOPs.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpenIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

interface CatalogEntry { deploymentType: string; label: string }
type RespBody =
  | { ok: true; data: { catalog: CatalogEntry[] } }
  | { ok: false; error: string };

const ICON_BY_TYPE: Record<string, string> = {
  application:           "🚀",
  kubernetes_helm:       "☸️",
  data_pipeline:         "🛢️",
  connector:             "🔌",
  database_liquibase:    "🗃️",
  airflow_dag:           "📅",
  terraform_iac:         "🏗️",
  emergency_fix:         "🚨",
  rollback_recovery:     "⏪",
  manual_reconciliation: "🔧",
};

const BLURB_BY_TYPE: Record<string, string> = {
  application:           "Service deploys to any environment with audited evidence.",
  kubernetes_helm:       "Helm chart → image → namespace → revision with rollback.",
  data_pipeline:         "Ingestion / transform pipelines with idempotency safeguards.",
  connector:             "Integration configurations with downstream coordination.",
  database_liquibase:    "Schema + DML changesets with rollback or recovery.",
  airflow_dag:           "DAG deploys with schedule / retry / dependency docs.",
  terraform_iac:         "IaC plan review + approval + state-lock safety.",
  emergency_fix:         "Minimal-scope production change with reconciliation task.",
  rollback_recovery:     "Revert to last verified state and validate.",
  manual_reconciliation: "Close the loop on a manual production change.",
};

export default function SopsCatalogPage() {
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/sops", { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => { if (!cancelled) setResp(j); })
      .catch((e) => { if (!cancelled) setNetworkError(e instanceof Error ? e.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <div className="relative">
      <PageIntro
        kicker="ReleaseOps · standard operating procedures"
        title={<>Ten SOPs. <span className="text-zinc-500">One canonical shape.</span></>}
        description="Standardized deployment procedures by type. Every SOP ships 16 sections: purpose, scope, roles, checklists, execution, validation, rollback, communication, go/no-go, audit, exception handling, emergency, post-incident."
        helps="Operators pick the matching SOP before any change touches production."
        connectFirst="Already wired — SOPs are generated from the Phase 446 catalog."
        engineers={["Release Captain", "DevOps", "L1/L2 Support"]}
        requiresApproval="Exception handling + emergency change pathways are inside each SOP."
        actions={[
          { label: "Releases", href: "/dashboard/releases" },
          { label: "ReleaseOps", href: "/dashboard/releaseops" },
        ]}
        safetyNote="Read-only · single canonical shape per type · 16 required sections"
      />

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading SOPs…
        </div>
      )}

      {!loading && networkError && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {networkError}
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
            <span>Sign in required to view SOPs.</span>
          </div>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {data.catalog.map((e) => (
            <Link
              key={e.deploymentType}
              href={`/dashboard/sops/${e.deploymentType}`}
              className="block rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.12] hover:bg-white/[0.03] transition-all group"
            >
              <div className="flex items-start gap-3 mb-2">
                <div className="text-2xl shrink-0">{ICON_BY_TYPE[e.deploymentType] ?? "📋"}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold text-white tracking-tight">{e.label}</p>
                  <p className="mt-0.5 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{e.deploymentType}</p>
                </div>
                <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all mt-1.5" />
              </div>
              <p className="text-[12.5px] text-zinc-400 leading-relaxed">
                {BLURB_BY_TYPE[e.deploymentType] ?? "Standard operating procedure for this deployment type."}
              </p>
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
        <BookOpenIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
        <div>
          <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// SOP contract</p>
          <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
            Every SOP ships 16 sections — purpose, scope, roles, pre-deploy + branch-validation + change-ticket + release-evidence checklists, execution, post-deploy validation, rollback, communication, go/no-go, audit, exception, emergency change, post-incident follow-up.
          </p>
        </div>
      </div>
    </div>
  );
}
