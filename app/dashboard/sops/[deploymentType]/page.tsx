"use client";

/**
 * /dashboard/sops/[deploymentType] — Phase 448. Full SOP renderer.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

interface SopSection { id: string; title: string; bullets: string[] }
interface SopDocument {
  deploymentType: string;
  title: string;
  generatedAt: string;
  purposeOverride?: string;
  sections: SopSection[];
}
type RespBody =
  | { ok: true; data: SopDocument }
  | { ok: false; error: string };

export default function SopDetailPage() {
  const params = useParams();
  const deploymentType = String(params.deploymentType);
  const [resp, setResp] = useState<RespBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/sops/${encodeURIComponent(deploymentType)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => { if (!cancelled) setResp(j); })
      .catch((e) => { if (!cancelled) setNetworkError(e instanceof Error ? e.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [deploymentType]);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <div className="relative">
      <div className="mb-4">
        <Link
          href="/dashboard/sops"
          className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          All SOPs
        </Link>
      </div>

      {data && (
        <PageIntro
          kicker={`SOP · ${data.deploymentType}`}
          title={<>{data.title}</>}
          description="Standardized procedure with 16 required sections. Use it before any change touches production for this deployment type."
          helps="Step through every section before declaring go/no-go."
          connectFirst="Already wired — generated from the Phase 446 catalog."
          engineers={["Release Captain", "DevOps", "L1/L2 Support"]}
          requiresApproval="Exception + emergency-change pathways are inside this SOP."
          actions={[
            { label: "Back to catalog", href: "/dashboard/sops" },
            { label: "ReleaseOps", href: "/dashboard/releaseops" },
          ]}
          safetyNote="Read-only · 16 sections enforced · matches Phase 446 catalog"
        />
      )}

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading SOP…
        </div>
      )}

      {!loading && networkError && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {networkError}
        </div>
      )}

      {!loading && errorBody?.error === "unknown_deployment_type" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-zinc-300" />
            <span className="text-[13px] text-zinc-300">Unknown deployment type. <Link href="/dashboard/sops" className="text-white underline underline-offset-4">Back to catalog</Link>.</span>
          </div>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Sign in required to view SOPs.
        </div>
      )}

      {data && (
        <div className="space-y-3 mb-8">
          {data.sections.map((sec) => (
            <section key={sec.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1">// {sec.id}</p>
              <h2 className="text-[15px] font-semibold text-white mb-3">{sec.title}</h2>
              <ul className="space-y-1.5">
                {sec.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[12.5px] text-zinc-300">
                    <span aria-hidden className="mt-1.5 w-1 h-1 rounded-full bg-white/40 flex-shrink-0" />
                    <span className="leading-relaxed">{b}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
