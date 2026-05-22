/**
 * /dashboard/services — native Service Catalog.
 *
 * Live auto-discovered services across the connected accounts. Backed
 * by lib/platform/native/serviceCatalogExtractor — no fabricated
 * services, no fake counts. When a connector returns empty, that
 * connector's slice is empty.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  RectangleGroupIcon,
  CloudIcon,
  CodeBracketIcon,
  ServerStackIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { extractServiceCatalog } from "@/lib/platform/native/serviceCatalogExtractor";
import type { ServiceRef } from "@/lib/platform/native/serviceCatalog";
import { TenantEmptyState } from "@/components/platform/TenantEmptyState";

export const metadata: Metadata = {
  title: "Service catalog · Axiom",
  description:
    "Auto-discovered services across your connected accounts — APIs, static assets, databases, repos.",
};

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ServicesPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return (
      <div className="p-8 text-sm text-zinc-300">Sign in required.</div>
    );
  }

  const result = await extractServiceCatalog({ organizationId: ctx.organizationId });
  const services = result.catalog.services;
  const byConnector = result.perConnector;
  const total = services.length;
  const isEmpty = total === 0;

  return (
    <div className="relative">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <RectangleGroupIcon className="h-4 w-4 text-emerald-400" />
          <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">Service catalog</p>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
          Every service in your workspace, <span className="text-gradient">auto-discovered.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-3xl leading-relaxed">
          Services discovered live across your connected AWS, GCP, and GitHub accounts. This catalog is the foundation everything else hangs off — alerts, incidents, SLOs, and dashboards all attach to a Service.
        </p>
      </div>

      {/* Per-connector status strip */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        <ConnectorStatus label="AWS"     icon={CloudIcon}      result={byConnector.aws} />
        <ConnectorStatus label="GCP"     icon={CloudIcon}      result={byConnector.gcp} />
        <ConnectorStatus label="GitHub"  icon={CodeBracketIcon} result={byConnector.github} />
      </section>

      {/* Empty state — only when nothing was discovered anywhere */}
      {isEmpty && (
        <div className="mb-8">
          <TenantEmptyState
            icon={<RectangleGroupIcon className="h-5 w-5" />}
            tone="emerald"
            eyebrow="Catalog empty"
            title="Connect a cloud or source-control account to populate the catalog."
            description="The extractor walks every connector you wire up. Each connector contributes services with honest tags showing exactly where they came from — no fabricated entries."
            agiNote="As you connect more sources (Kubernetes, databases, observability tools), this catalog grows automatically and becomes the index every alert and incident attaches to."
            actions={[
              { href: "/dashboard/connector-store", label: "Open Connector Store", variant: "primary" },
              { href: "/dashboard/observability",   label: "Observability",        variant: "ghost" },
            ]}
          />
        </div>
      )}

      {/* Service list */}
      {!isEmpty && (
        <section className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4 md:p-5">
          <header className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 className="text-[13px] font-semibold text-zinc-200">{total} services · auto-discovered</h2>
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              extracted in {result.durationMs}ms
            </span>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {services.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        </section>
      )}

      {/* What this catalog enables */}
      <section className="mt-8 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5">
        <p className="text-[10px] font-semibold text-emerald-300 uppercase tracking-widest mb-2">// what the catalog unlocks</p>
        <ul className="grid sm:grid-cols-2 gap-2 text-[12px] text-zinc-300">
          {[
            ["Attach alerts to services",      "Every alert rule scopes to a Service, not a host."],
            ["Incident clustering",            "Two alerts on the same service = one incident."],
            ["SLO + error budget tracking",    "Per-service availability + latency targets."],
            ["Service dependency map",         "Trace inference will populate edges automatically."],
            ["Owner / tier metadata",          "Tier-1 services get tighter alert thresholds."],
            ["AI recommendations",             "Agents reason over the catalog when proposing fixes."],
          ].map(([q, a]) => (
            <li key={q} className="flex items-start gap-2">
              <ArrowRightIcon className="h-3 w-3 text-emerald-400 shrink-0 mt-1" />
              <span><span className="font-semibold text-zinc-100">{q}</span> <span className="text-zinc-400">— {a}</span></span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ConnectorStatus({ label, icon: Icon, result }: { label: string; icon: typeof CloudIcon; result: { ok: boolean; count: number; reason?: string } }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-zinc-400" />
        <p className="text-[12px] font-semibold text-white">{label}</p>
        <span className={`ml-auto text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-px ${
          result.ok
            ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
            : "text-amber-300 bg-amber-500/10 border-amber-500/30"
        }`}>
          {result.ok ? "live" : "skipped"}
        </span>
      </div>
      <p className="text-[20px] font-semibold text-white tabular-nums">{result.count}</p>
      <p className="text-[11px] text-zinc-500 mt-0.5">{result.ok ? "services discovered" : (result.reason ?? "no creds")}</p>
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceRef }) {
  const sourceTone =
    service.discoveredFrom.includes("aws")    ? "border-amber-500/30 bg-amber-500/10 text-amber-300" :
    service.discoveredFrom.includes("gcp")    ? "border-blue-500/30 bg-blue-500/10 text-blue-300"   :
    service.discoveredFrom.includes("github") ? "border-violet-500/30 bg-violet-500/10 text-violet-300" :
                                                "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";
  return (
    <article className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-emerald-500/30 transition flex flex-col">
      <header className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {service.kind === "static_asset" && <ServerStackIcon className="h-4 w-4 text-zinc-400 shrink-0" />}
          {service.kind === "api" && <CodeBracketIcon className="h-4 w-4 text-zinc-400 shrink-0" />}
          <p className="text-[13px] font-semibold text-white truncate">{service.name}</p>
        </div>
        <span className={`text-[9px] font-mono uppercase tracking-wider border rounded-full px-1.5 py-px whitespace-nowrap ${sourceTone}`}>
          {service.discoveredFrom.join(",")}
        </span>
      </header>
      <p className="text-[10.5px] font-mono uppercase tracking-wider text-zinc-500">{service.kind}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {service.tags.slice(0, 3).map((t) => (
          <span key={t} className="text-[10px] font-mono text-zinc-300 bg-white/[0.04] border border-white/[0.06] rounded-full px-1.5 py-0.5">
            {t}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] font-mono text-zinc-500">{service.tier.replace(/_/g, " ")}</p>
    </article>
  );
}
