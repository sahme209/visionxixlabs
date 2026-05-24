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
import {
  INTEGRATIONS,
  listAllCategories,
  listIntegrationsByCategory,
  type Integration,
} from "@/lib/integrations/integrationRegistry";

export const dynamic = "force-dynamic";

export default function IntegrationsCatalog() {
  const categories = listAllCategories();
  const totals = {
    live:    INTEGRATIONS.filter((i) => i.status === "live").length,
    beta:    INTEGRATIONS.filter((i) => i.status === "beta").length,
    planned: INTEGRATIONS.filter((i) => i.status === "planned").length,
  };
  return (
    <main className="max-w-6xl mx-auto py-12 px-4 sm:px-6 space-y-10">
      <header className="space-y-3">
        <p className="text-[10px] font-mono text-violet-300 uppercase tracking-[0.22em]">
          integrations · {INTEGRATIONS.length} total
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
          Connect anything in one click.
        </h1>
        <p className="text-zinc-300 leading-relaxed max-w-3xl text-[15px]">
          Every connection here activates with a single button. No JSON copy-paste, no wizard
          navigation, no long-lived secrets pasted into our app.
        </p>
        <ul className="text-[13px] text-zinc-400 leading-relaxed space-y-1 max-w-3xl">
          <li>· <strong className="text-zinc-200">Cloud providers</strong> activate via CloudFormation (AWS), ARM templates (Azure), and Cloud Shell tutorials (GCP).</li>
          <li>· <strong className="text-zinc-200">Source control + chat + paging</strong> use OAuth — you grant scoped read access, never a long-lived token.</li>
          <li>· <strong className="text-zinc-200">Monitoring tools</strong> push inbound HMAC-SHA256 + ES256 signed alerts; we never poll their API.</li>
          <li>· <strong className="text-zinc-200">Databases</strong> get a one-line GRANT-only DDL that creates a read-only role you control.</li>
        </ul>
        <div className="flex flex-wrap gap-2 text-[11px] font-mono pt-2">
          <span className="px-2 py-0.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-200">{totals.live} live</span>
          <span className="px-2 py-0.5 rounded-full border border-amber-500/25 bg-amber-500/[0.06] text-amber-200">{totals.beta} beta</span>
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

      <footer className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-violet-500/[0.04] via-fuchsia-500/[0.02] to-transparent p-6 space-y-3">
        <p className="text-[10px] font-mono text-violet-300/90 uppercase tracking-[0.22em]">how it stays safe</p>
        <p className="text-[14px] text-zinc-200 leading-relaxed max-w-3xl">
          Auth is never freeform — clouds use assume-role / RBAC / service accounts; third-party
          tools use OAuth; databases run a single SELECT-only GRANT. You never paste a long-lived
          secret into our app. Every connection is revocable from the provider&apos;s own console
          without telling us first.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/operator/onboarding" className="text-[13px] text-violet-300/90 hover:text-violet-200 underline-offset-2 hover:underline">Cloud onboarding →</Link>
          <Link href="/demo/reference" className="text-[13px] text-violet-300/90 hover:text-violet-200 underline-offset-2 hover:underline">Platform reference →</Link>
          <Link href="/docs/permissions-model" className="text-[13px] text-zinc-300 hover:text-white underline-offset-2 hover:underline">Permissions model →</Link>
          <Link href="/docs/security-model" className="text-[13px] text-zinc-300 hover:text-white underline-offset-2 hover:underline">Security model →</Link>
        </div>
      </footer>
    </main>
  );
}

function IntegrationCard({ integration: i }: { integration: Integration }) {
  const statusTone =
    i.status === "live"    ? "border-emerald-500/25 bg-emerald-500/[0.05] text-emerald-200" :
    i.status === "beta"    ? "border-amber-500/25 bg-amber-500/[0.05] text-amber-200" :
                             "border-white/[0.06] bg-white/[0.02] text-zinc-400";
  const writeTone =
    i.writeAccess === "auto"            ? "border-violet-500/25 bg-violet-500/[0.06] text-violet-200" :
    i.writeAccess === "approval_gated"  ? "border-cyan-500/25 bg-cyan-500/[0.06] text-cyan-200" :
                                          "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-200";
  const writeLabel =
    i.writeAccess === "auto"            ? "write · auto" :
    i.writeAccess === "approval_gated"  ? "write · two-person gated" :
                                          "read-only";

  const disabled = i.status === "planned";
  const ctaCommon = "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors";
  const ctaCls = disabled
    ? `${ctaCommon} border border-white/[0.06] bg-white/[0.02] text-zinc-500 cursor-not-allowed`
    : `${ctaCommon} bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-glow-violet`;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 hover:border-white/[0.12] transition-colors">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1.5">
        <h3 className="text-[15px] font-semibold text-white">{i.name}</h3>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusTone}`}>{i.status}</span>
          <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${writeTone}`}>{writeLabel}</span>
        </div>
      </div>
      <p className="text-[12.5px] text-zinc-300 leading-relaxed mb-2">{i.blurb}</p>
      <p className="text-[10px] font-mono text-zinc-500 mb-3 truncate" title={i.permissionsSummary}>
        {i.permissionsSummary}
      </p>
      {disabled ? (
        <button disabled className={ctaCls}>{i.cta}</button>
      ) : i.startHref ? (
        <Link href={i.startHref} target={i.startHref.startsWith("http") ? "_blank" : undefined} className={ctaCls}>
          {i.cta} →
        </Link>
      ) : (
        <span className={ctaCls + " opacity-60"}>{i.cta} (coming soon)</span>
      )}
    </div>
  );
}
