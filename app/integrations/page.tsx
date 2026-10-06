/**
 * /integrations — Phase 412. Public integration catalog.
 *
 * Unified surface that shows EVERY connection the platform supports
 * with a single CTA per integration. Auth is never freeform: clouds
 * use CloudFormation / ARM / Cloud Shell, source control + chat +
 * paging use OAuth, monitoring tools accept inbound HMAC webhooks,
 * IDE extensions install from their marketplace.
 *
 * The closed-union `IntegrationActivationKind` (see
 * lib/integrations/integrationRegistry.ts) determines the CTA per row.
 */

import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";
import {
  INTEGRATIONS,
  listAllCategories,
  listIntegrationsByCategory,
  type Integration,
} from "@/lib/integrations/integrationRegistry";

export const dynamic = "force-dynamic";

const PUBLIC_AVAILABILITY: Record<string, { label: string; detail: string; href: string; enabled: boolean }> = {
  aws: { label: "configuration required", detail: "Assume-role connection code is implemented. Live validation requires broker credentials and customer IAM setup; inventory/security analysis remains preview-grade and write execution is not released.", href: "/docs/aws-setup", enabled: true },
  azure: { label: "preview", detail: "Credential-format validation and preview inventory are implemented. Live Azure SDK validation and provider-specific execution are not released.", href: "/cloud-solutions/azure", enabled: true },
  gcp: { label: "preview", detail: "Credential-format validation and preview inventory are implemented. Live Asset Inventory validation and provider-specific execution are not released.", href: "/cloud-solutions/gcp", enabled: true },
  github: { label: "preview", detail: "Repository and workflow inventory adapters are preview-grade. An organization-scoped live installation and dispatch path are not verified.", href: "/docs", enabled: true },
  gitlab: { label: "planned", detail: "No customer-ready activation path is published.", href: "/docs", enabled: false },
  cloudwatch: { label: "implementation review", detail: "Inbound event code exists; a released customer setup and end-to-end delivery path have not been verified.", href: "/docs", enabled: true },
  grafana: { label: "implementation review", detail: "Inbound event code exists; a released customer setup and end-to-end delivery path have not been verified.", href: "/docs", enabled: true },
  dynatrace: { label: "planned", detail: "No verified customer activation path is published.", href: "/docs", enabled: false },
  slack: { label: "implementation review", detail: "Notification code must not be confused with workflow synchronization. Customer OAuth and message delivery are not release-verified.", href: "/docs", enabled: true },
  linear: { label: "planned", detail: "Issue creation/update is not advertised as available until OAuth and write behavior are release-verified.", href: "/docs", enabled: false },
  pagerduty: { label: "planned", detail: "No released paging connection is available.", href: "/docs", enabled: false },
  vscode: { label: "preview", detail: "Extension code is tracked separately; marketplace installation and the shared authentication path require release verification.", href: "/docs", enabled: true },
  postgres: { label: "implementation review", detail: "DDL generation exists. A released connection, permissions test, and revocation journey are not end-to-end verified.", href: "/docs", enabled: true },
  mysql: { label: "implementation review", detail: "DDL generation exists. A released connection, permissions test, and revocation journey are not end-to-end verified.", href: "/docs", enabled: true },
};

export default function IntegrationsCatalog() {
  const categories = listAllCategories();
  const totals = {
    configured: Object.values(PUBLIC_AVAILABILITY).filter((item) => item.label === "configuration required").length,
    preview: Object.values(PUBLIC_AVAILABILITY).filter((item) => item.label === "preview" || item.label === "implementation review").length,
    planned: Object.values(PUBLIC_AVAILABILITY).filter((item) => item.label === "planned").length,
  };
  return (
    <div className="axiom-canvas axiom-product-canvas min-h-screen text-zinc-100">
      <Navigation />
      <main className="relative mx-auto max-w-[1400px] space-y-10 px-4 pb-16 pt-28 sm:px-6">
      {/* Coral × violet aurora — Huly-style warm wash behind the hero */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-8 h-[480px] -z-10 overflow-hidden">
        <div className="ambient-drift absolute -top-24 left-1/2 -translate-x-1/2 w-[820px] h-[420px] rounded-full bg-brand-violet/[0.07] blur-[140px]" />
        <div className="ambient-drift absolute top-12 right-[5%] w-[440px] h-[320px] rounded-full bg-brand-coral/[0.06] blur-[130px]" style={{ animationDelay: "-8s" }} />
        <div className="ambient-drift absolute top-20 left-[5%] w-[360px] h-[280px] rounded-full bg-cyan-500/[0.035] blur-[120px]" style={{ animationDelay: "-14s" }} />
      </div>

      <header className="space-y-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 inline-flex items-center gap-3">
          <span className="text-brand-coral/90 tabular-nums">08</span>
          <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
          Integrations · {INTEGRATIONS.length} total
        </p>
        <h1 className="text-3xl md:text-5xl font-bold text-white tracking-[-0.04em] leading-[1.04]">
          Connector availability,{" "}
          <span className="relative inline-block">
            stated precisely.
            <span aria-hidden className="absolute left-0 -bottom-1 h-[3px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400 to-transparent opacity-90" />
          </span>
        </h1>
        <p className="text-zinc-300 leading-relaxed max-w-3xl text-[15px]">
          This is an implementation inventory—not a promise that every provider is live. Connections are configured in the installed application; the website does not become a browser control plane.
        </p>
        <ul className="text-[13px] text-zinc-400 leading-relaxed space-y-1 max-w-3xl">
          <li>· <strong className="text-zinc-200">Configuration required</strong> means connector code exists but customer and service credentials are still required.</li>
          <li>· <strong className="text-zinc-200">Preview</strong> means deterministic analysis or adapter behavior exists without a verified live customer journey.</li>
          <li>· <strong className="text-zinc-200">Implementation review</strong> means code exists but activation, permissions, delivery, and recovery have not all been release-verified.</li>
          <li>· <strong className="text-zinc-200">Planned</strong> means it is not available to customers today.</li>
        </ul>
        <div className="flex flex-wrap gap-2 text-[11px] font-mono pt-2">
          <span className="px-2 py-0.5 rounded-full border border-amber-500/25 bg-amber-500/[0.06] text-amber-200">{totals.configured} configuration required</span>
          <span className="px-2 py-0.5 rounded-full border border-cyan-500/25 bg-cyan-500/[0.06] text-cyan-200">{totals.preview} preview / review</span>
          <span className="px-2 py-0.5 rounded-full border border-white/[0.08] bg-white/[0.02] text-zinc-400">{totals.planned} planned</span>
        </div>
      </header>

      {categories.map((cat) => {
        const rows = listIntegrationsByCategory(cat.id);
        if (rows.length === 0) return null;
        return (
          <section key={cat.id} className="space-y-3">
            <h2 className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.22em]">{cat.label}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rows.map((i) => <IntegrationCard key={i.id} integration={i} />)}
            </div>
          </section>
        );
      })}

      <footer className="surface-frost rounded-2xl p-6 space-y-3">
        <p className="mono-label inline-flex items-center gap-3 text-brand-coral/85">
          <span aria-hidden className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
          How it stays safe
        </p>
        <p className="text-[14px] text-zinc-200 leading-relaxed max-w-3xl">
          Auth is never freeform — clouds use assume-role / RBAC / service accounts; third-party
          tools use OAuth; databases run a single SELECT-only GRANT. You never paste a long-lived
          secret into our app. Every connection is revocable from the provider&apos;s own console
          without telling us first.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/download" className="text-[13px] text-violet-300/90 hover:text-violet-200 underline-offset-2 hover:underline">Desktop setup →</Link>
          <Link href="/demo/reference" className="text-[13px] text-violet-300/90 hover:text-violet-200 underline-offset-2 hover:underline">Platform reference →</Link>
          <Link href="/docs/permissions-model" className="text-[13px] text-zinc-300 hover:text-white underline-offset-2 hover:underline">Permissions model →</Link>
          <Link href="/docs/security-model" className="text-[13px] text-zinc-300 hover:text-white underline-offset-2 hover:underline">Security model →</Link>
        </div>
      </footer>
      </main>
      <Footer />
    </div>
  );
}

function IntegrationCard({ integration: i }: { integration: Integration }) {
  const availability = PUBLIC_AVAILABILITY[i.id] ?? { label: "planned", detail: "No verified customer path is published.", href: "/docs", enabled: false };
  const statusTone = availability.enabled
    ? "border-amber-500/25 bg-amber-500/[0.05] text-amber-200"
    : "border-white/[0.06] bg-white/[0.02] text-zinc-400";
  const writeTone = "border-white/[0.08] bg-white/[0.02] text-zinc-400";
  const writeLabel = i.writeAccess === "none" ? "no write path" : "write not release-verified";

  const disabled = !availability.enabled;
  const ctaCommon = "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold tracking-tight transition-all";
  const ctaCls = disabled
    ? `${ctaCommon} border border-white/[0.06] bg-white/[0.02] text-zinc-500 cursor-not-allowed`
    : `btn-press ${ctaCommon}`;

  return (
    <div className="surface-glass rounded-xl p-5 hover:border-brand-coral/20 transition-all group">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1.5">
        <h3 className="text-[15px] font-semibold text-white tracking-tight group-hover:text-white transition-colors">{i.name}</h3>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusTone}`}>{availability.label}</span>
          <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${writeTone}`}>{writeLabel}</span>
        </div>
      </div>
      <p className="text-[12.5px] text-zinc-300 leading-relaxed mb-2">{availability.detail}</p>
      <p className="text-[10px] font-mono text-zinc-500 mb-3 truncate" title={i.permissionsSummary}>
        {i.permissionsSummary}
      </p>
      {disabled ? (
        <button disabled className={ctaCls}>Not available</button>
      ) : (
        <Link href={availability.href} className={ctaCls}>
          View setup status →
        </Link>
      )}
    </div>
  );
}
