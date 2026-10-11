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
  ArrowRightIcon,
  BoltIcon,
  CircleStackIcon,
  CloudIcon,
  CodeBracketIcon,
  CommandLineIcon,
  LinkIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
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
  github: { label: "available", detail: "Repository-scoped GitHub App access supports file reads, branches, commits, pull requests, workflow dispatch, and local clone in the desktop app.", href: "/docs/oauth-setup", enabled: true },
  gitlab: { label: "planned", detail: "No customer-ready activation path is published.", href: "/docs", enabled: false },
  cloudwatch: { label: "implementation review", detail: "Inbound event code exists; a released customer setup and end-to-end delivery path have not been verified.", href: "/docs", enabled: true },
  grafana: { label: "implementation review", detail: "Inbound event code exists; a released customer setup and end-to-end delivery path have not been verified.", href: "/docs", enabled: true },
  dynatrace: { label: "planned", detail: "No verified customer activation path is published.", href: "/docs", enabled: false },
  slack: { label: "implementation review", detail: "Notification code must not be confused with workflow synchronization. Customer OAuth and message delivery are not release-verified.", href: "/docs", enabled: true },
  linear: { label: "planned", detail: "Issue creation/update is not advertised as available until OAuth and write behavior are release-verified.", href: "/docs", enabled: false },
  airflow: { label: "available", detail: "Validated Airflow connections support visual DAG selection, run monitoring, schedules, dependency conditions, approval-gated triggers, retries, notifications, and audit history.", href: "/docs", enabled: true },
  pagerduty: { label: "planned", detail: "No released paging connection is available.", href: "/docs", enabled: false },
  vscode: { label: "preview", detail: "Extension code is tracked separately; marketplace installation and the shared authentication path require release verification.", href: "/docs", enabled: true },
  postgres: { label: "implementation review", detail: "DDL generation exists. A released connection, permissions test, and revocation journey are not end-to-end verified.", href: "/docs", enabled: true },
  mysql: { label: "implementation review", detail: "DDL generation exists. A released connection, permissions test, and revocation journey are not end-to-end verified.", href: "/docs", enabled: true },
};

export default function IntegrationsCatalog() {
  const categories = listAllCategories();
  const totals = {
    available: Object.values(PUBLIC_AVAILABILITY).filter((item) => item.label === "available").length,
    configured: Object.values(PUBLIC_AVAILABILITY).filter((item) => item.label === "configuration required").length,
    preview: Object.values(PUBLIC_AVAILABILITY).filter((item) => item.label === "preview" || item.label === "implementation review").length,
    planned: Object.values(PUBLIC_AVAILABILITY).filter((item) => item.label === "planned").length,
  };
  return (
    <div className="min-h-screen bg-[#141414] text-zinc-100">
      <Navigation />
      <main className="mx-auto max-w-[1400px] space-y-14 px-5 pb-24 pt-36 sm:px-8 lg:px-12 lg:pt-44">
      <header className="max-w-4xl space-y-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-orange-400">Integrations · {INTEGRATIONS.length} systems</p>
        <h1 className="text-5xl font-medium tracking-[-0.055em] text-zinc-50 sm:text-7xl">Connect the tools that already run your delivery.</h1>
        <p className="max-w-2xl text-lg leading-8 text-zinc-400">Click-first setup in the desktop app, explicit authority, and a verified status before Axiom relies on a connection.</p>
        <ul className="text-[13px] text-zinc-400 leading-relaxed space-y-1 max-w-3xl">
          <li>· <strong className="text-zinc-200">Configuration required</strong> means connector code exists but customer and service credentials are still required.</li>
          <li>· <strong className="text-zinc-200">Preview</strong> means deterministic analysis or adapter behavior exists without a verified live customer journey.</li>
          <li>· <strong className="text-zinc-200">Implementation review</strong> means code exists but activation, permissions, delivery, and recovery have not all been release-verified.</li>
          <li>· <strong className="text-zinc-200">Planned</strong> means it is not available to customers today.</li>
        </ul>
        <div className="flex flex-wrap gap-2 pt-2 text-[11px] font-medium">
          <span className="rounded-full border border-orange-400/20 bg-orange-400/[0.06] px-2 py-0.5 text-orange-200">{totals.available} available</span>
          <span className="px-2 py-0.5 rounded-full border border-white/25 bg-white/[0.06] text-zinc-200">{totals.configured} configuration required</span>
          <span className="rounded-full border border-white/[0.1] bg-white/[0.03] px-2 py-0.5 text-zinc-300">{totals.preview} preview / review</span>
          <span className="px-2 py-0.5 rounded-full border border-white/[0.08] bg-white/[0.02] text-zinc-400">{totals.planned} planned</span>
        </div>
      </header>

      {categories.map((cat) => {
        const rows = listIntegrationsByCategory(cat.id);
        if (rows.length === 0) return null;
        return (
          <section key={cat.id} className="space-y-3">
            <h2 className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.22em]">{cat.label}</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {rows.map((i) => <IntegrationCard key={i.id} integration={i} />)}
            </div>
          </section>
        );
      })}

      <footer className="space-y-3 rounded-2xl border border-white/[0.08] bg-[#1A1A1A] p-6 sm:p-8">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-zinc-100"><ShieldCheckIcon className="h-5 w-5 text-orange-400" /> How it stays safe</p>
        <p className="text-[14px] text-zinc-200 leading-relaxed max-w-3xl">
          Cloud providers use scoped roles or service accounts; supported third-party tools use OAuth; database telemetry uses read-only grants. Airflow credentials are encrypted with tenant-scoped context. Connections remain revocable and write actions keep their approval boundary.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/download" className="text-[13px] text-orange-300/90 hover:text-orange-200 underline-offset-2 hover:underline">Desktop setup →</Link>
          <Link href="/demo/reference" className="text-[13px] text-orange-300/90 hover:text-orange-200 underline-offset-2 hover:underline">Platform reference →</Link>
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
    ? "border-white/25 bg-white/[0.05] text-zinc-200"
    : "border-white/[0.06] bg-white/[0.02] text-zinc-400";
  const writeTone = "border-white/[0.08] bg-white/[0.02] text-zinc-400";
  const writeLabel = i.writeAccess === "none" ? "read only" : i.writeAccess === "approval_gated" ? "approval gated" : "limited write";

  const disabled = !availability.enabled;
  const ctaCommon = "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold tracking-tight transition-all";
  const ctaCls = disabled
    ? `${ctaCommon} border border-white/[0.06] bg-white/[0.02] text-zinc-500 cursor-not-allowed`
    : `btn-press ${ctaCommon}`;

  return (
    <div className="group rounded-xl border border-white/[0.08] bg-[#1A1A1A] p-5 transition hover:border-orange-400/25">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-black/20 text-zinc-400">
        <IntegrationIcon category={i.category} />
      </div>
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
          View setup <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function IntegrationIcon({ category }: { category: Integration["category"] }) {
  const className = "h-5 w-5";
  if (category === "cloud") return <CloudIcon className={className} />;
  if (category === "vcs") return <CodeBracketIcon className={className} />;
  if (category === "db") return <CircleStackIcon className={className} />;
  if (category === "orchestration") return <BoltIcon className={className} />;
  if (category === "ide") return <CommandLineIcon className={className} />;
  return <LinkIcon className={className} />;
}
