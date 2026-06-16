/**
 * /dashboard/workforce/on-prem-connectors/[slug] — Phase 642.
 *
 * Per-connector detail page. Shows the connector metadata, the list
 * of agent scans pushed against it, and the "mint agent token"
 * flow with a sample agent snippet the operator copies.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon, KeyIcon, ServerStackIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  listOnPremConnectors,
  PLATFORM_LABEL,
} from "@/lib/workforce/domains/onPremConnectors";
import { CONNECTOR_SCAN_TARGET_KIND } from "@/lib/workforce/domains/agentInbound";
import { AgentTokenMintForm } from "@/components/workforce/AgentTokenMintForm";

export const dynamic = "force-dynamic";

interface ScanRow {
  targetId: string;
  scanType: string;
  itemCount: number;
  narrative: string;
  updatedAt: Date;
}

function pickStr(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export default async function OnPremConnectorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect(`/auth/signin?callbackUrl=/dashboard/workforce/on-prem-connectors`);
  }
  const { slug } = await params;
  const sp = searchParams ? await searchParams : {};
  const mintedTokenRaw = pickStr(sp.token);

  const connectors = await listOnPremConnectors(String(ctx.organizationId));
  const connector = connectors.find((c) => c.slug === slug);
  if (!connector) notFound();

  // Recent scan batches for this connector.
  let scans: ScanRow[] = [];
  try {
    const rows = await prisma.aiRationaleEnrichment.findMany({
      where: {
        organizationId: String(ctx.organizationId),
        targetKind: CONNECTOR_SCAN_TARGET_KIND,
        targetId: { startsWith: `${slug}:` },
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { targetId: true, narrative: true, nextActionsJson: true, updatedAt: true },
    });
    scans = rows.map((r) => {
      let scanType = "";
      let itemCount = 0;
      if (Array.isArray(r.nextActionsJson)) {
        for (const e of r.nextActionsJson as unknown[]) {
          if (typeof e !== "string") continue;
          if (e.startsWith("scan_type|")) scanType = e.slice("scan_type|".length);
          else if (e.startsWith("item_count|")) {
            const v = Number(e.slice("item_count|".length));
            if (Number.isFinite(v)) itemCount = v;
          }
        }
      }
      return { targetId: r.targetId, scanType, itemCount, narrative: r.narrative, updatedAt: r.updatedAt };
    });
  } catch {
    scans = [];
  }

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce/on-prem-connectors" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        on-prem connectors
      </Link>

      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">connector-detail</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-500">{connector.platform}</span>
        </p>
        <h1 className="text-[28px] sm:text-[32px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <ServerStackIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          {connector.displayName}
        </h1>
        <p className="text-[12.5px] text-zinc-400 font-mono">{PLATFORM_LABEL[connector.platform].tagline}</p>
      </header>

      {/* Metadata */}
      <section className="mb-8 rounded-md border border-white/[0.06] bg-white/[0.012] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">metadata</span>
        </p>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-[12px] font-mono">
          <div className="flex gap-2"><dt className="text-zinc-500 shrink-0 min-w-[70px]">endpoint</dt><dd className="text-zinc-200 truncate">{connector.endpoint}</dd></div>
          <div className="flex gap-2"><dt className="text-zinc-500 shrink-0 min-w-[70px]">env</dt><dd className="text-zinc-200">{connector.environment}</dd></div>
          <div className="flex gap-2 sm:col-span-2"><dt className="text-zinc-500 shrink-0 min-w-[70px]">secret</dt><dd className="text-zinc-400 truncate">{connector.secretReference}</dd></div>
          <div className="flex gap-2"><dt className="text-zinc-500 shrink-0 min-w-[70px]">slug</dt><dd className="text-zinc-200">{connector.slug}</dd></div>
          <div className="flex gap-2"><dt className="text-zinc-500 shrink-0 min-w-[70px]">added</dt><dd className="text-zinc-400">{connector.registeredAt.toISOString().slice(0, 19).replace("T", " ")}</dd></div>
        </dl>
      </section>

      {/* Newly minted token banner */}
      {mintedTokenRaw && (
        <section className="mb-8 rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300 mb-2 inline-flex items-center gap-2">
            <KeyIcon className="h-3 w-3" />
            agent-token :: minted
          </p>
          <p className="text-[12px] text-zinc-200 leading-relaxed mb-3 font-mono">
            <span className="text-emerald-300">copy this token now</span> — it cannot be retrieved later. Set it as the X-Agent-Token header on your agent.
          </p>
          <div className="p-3 rounded border border-emerald-500/20 bg-black/40 break-all">
            <p className="text-[11px] font-mono text-emerald-200 select-all">{mintedTokenRaw}</p>
          </div>
          <p className="text-[10.5px] text-zinc-500 mt-3 font-mono">expires in 365 days · re-key annually · audit-logged</p>
        </section>
      )}

      {/* Token mint form */}
      <section className="mb-8 rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300 mb-3 inline-flex items-center gap-2">
          <KeyIcon className="h-3 w-3" />
          mint-agent-token
        </p>
        <p className="text-[12.5px] text-zinc-300 leading-relaxed mb-3 font-mono">
          Label and mint a token. Your agent uses it as the <span className="text-emerald-300">X-Agent-Token</span> header when it posts scan results.
        </p>
        <AgentTokenMintForm connectorSlug={connector.slug} />
      </section>

      {/* Agent shape spec */}
      <section className="mb-8 rounded-md border border-white/[0.06] bg-white/[0.012] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">agent-spec</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-500">post one batch per scan</span>
        </p>
        <pre className="text-[11px] leading-relaxed text-zinc-200 font-mono bg-black/40 p-3 rounded border border-white/[0.06] overflow-x-auto whitespace-pre">{`POST https://visionxixlabs.com/api/agents/inbound
X-Agent-Token: vxl_agent_...your_token_here...
Content-Type: application/json

{
  "scanId": "vmware-prod-2026-06-15T14:00:00Z",
  "scanType": "inventory",
  "items": [
    { "itemId": "vm-1234", "itemKind": "vmware.vm",
      "summary": "web-01 · ubuntu 22.04 · 4cpu/16gb · running" },
    { "itemId": "vm-1235", "itemKind": "vmware.vm",
      "summary": "web-02 · ubuntu 22.04 · 4cpu/16gb · running" }
  ],
  "agentMeta": { "agent_version": "0.1.0", "host": "scanner-01" }
}

// scanType options: inventory | compliance_findings | performance_metrics
// items[].severity is required when scanType=compliance_findings
//   (info | low | medium | high | critical)
// items array capped at 500 per batch — split larger scans
//
// 200 → { ok: true, slug, itemsPersisted }
// 401 → { error: "token_..." | "connector_no_longer_exists" }
// 400 → { error: "invalid_json" | "items_too_many" | ... }
// 500 → { error: "persist_failed" }`}</pre>
        <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed font-mono">
          Write the agent in any language. ~50 lines Python with the vSphere SDK or PowerShell with VMM cmdlets. Run it on a cron inside your network. Outbound HTTPS only — no inbound firewall hole required.
        </p>
      </section>

      {/* Scan history */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">recent-scans</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-400 tabular-nums">{scans.length}</span>
        </p>
        {scans.length === 0 ? (
          <div className="rounded-md border border-white/[0.06] bg-white/[0.012] px-6 py-10 text-center">
            <p className="text-[13px] text-zinc-400">No agent scans yet.</p>
            <p className="text-[11px] text-zinc-500 mt-1 font-mono">mint a token + run your agent — first scan will appear here</p>
          </div>
        ) : (
          <ul className="rounded-md border border-white/[0.06] bg-white/[0.012] divide-y divide-white/[0.04] overflow-hidden">
            {scans.map((sc) => (
              <li key={sc.targetId}>
                <Link
                  href={`/dashboard/agi-memory/${encodeURIComponent(`${CONNECTOR_SCAN_TARGET_KIND}:${sc.targetId}`)}`}
                  className="block px-5 py-3.5 hover:bg-emerald-500/[0.04] transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                    <span className="text-emerald-300">{sc.scanType}</span>
                    <span className="text-zinc-700">::</span>
                    <span className="text-zinc-400 tabular-nums">{sc.itemCount} item{sc.itemCount === 1 ? "" : "s"}</span>
                    <span className="text-zinc-500 ml-auto">{sc.updatedAt.toISOString().slice(0, 19).replace("T", " ")}</span>
                  </div>
                  <p className="text-[12.5px] text-zinc-300 leading-relaxed font-mono">{sc.narrative}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
