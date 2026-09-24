/**
 * /demo/reference — one comprehensive technical reference page.
 *
 * Renders every endpoint, every closed-union, every webhook event,
 * every audit action, every safety invariant, every connector, every
 * AI engineer — pulled from lib/demo/technicalReference.ts. The point
 * is one URL a prospect/engineer can read to understand the platform
 * surface in detail without grepping the codebase.
 */

import Link from "next/link";
import {
  API_ENDPOINTS,
  AUDIT_CATEGORIES,
  CLOSED_UNIONS,
  CONNECTORS,
  ENGINEERS,
  SAFETY_INVARIANTS,
  WEBHOOK_EVENTS,
} from "@/lib/demo/technicalReference";
import { SandboxNavigation } from "@/components/marketing/SandboxNavigation";

export const dynamic = "force-dynamic";

export default function ReferencePage() {
  return (
    <>
      <SandboxNavigation />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      {/* Sandbox marker for symmetry with /demo/[id] */}
      <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.04] px-3 py-2 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
        <span className="text-[10px] font-mono text-violet-200/90 uppercase tracking-[0.22em]">
          platform reference · everything in one page
        </span>
      </div>

      <header className="space-y-3">
        <Link href="/demo" className="text-[11px] font-mono text-zinc-500 hover:text-zinc-200 transition-colors">
          ← all scenarios
        </Link>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">Platform reference</h1>
        <p className="text-zinc-300 leading-relaxed max-w-3xl text-[15px]">
          One page with every endpoint, every closed-union, every webhook event, every audit action,
          every safety invariant, every connector, every AI engineer the platform exposes.
        </p>
        <p className="text-zinc-500 leading-relaxed max-w-3xl text-[13px]">
          Pulled from the same source-of-truth files the runtime uses — so the moment we add an event
          or an endpoint, this page is a PR diff away. Skim by jumping to any section below.
        </p>

        <nav className="flex flex-wrap gap-2 pt-1">
          {[
            { href: "#endpoints",  label: `API endpoints (${API_ENDPOINTS.length})` },
            { href: "#webhooks",   label: `Webhook events (${WEBHOOK_EVENTS.length})` },
            { href: "#unions",     label: `Closed-unions (${CLOSED_UNIONS.length})` },
            { href: "#audit",      label: `Audit categories (${AUDIT_CATEGORIES.length})` },
            { href: "#engineers",  label: `AI engineers (${ENGINEERS.length})` },
            { href: "#connectors", label: `Connectors (${CONNECTORS.length})` },
            { href: "#safety",     label: `Safety invariants (${SAFETY_INVARIANTS.length})` },
          ].map((j) => (
            <a key={j.href} href={j.href} className="text-[11px] font-mono px-2.5 py-1 rounded-full border border-white/[0.06] bg-white/[0.015] text-zinc-300 hover:bg-white/[0.04] hover:text-white transition-colors">
              {j.label}
            </a>
          ))}
        </nav>
      </header>

      {/* ─── API endpoints ───────────────────────────────────────── */}
      <section id="endpoints" className="space-y-4 scroll-mt-6">
        <SectionHeader title="API endpoints" subtitle={`Every public v1 surface (${API_ENDPOINTS.length}). All require Bearer vxlk_* unless marked.`} />
        <div className="space-y-3">
          {API_ENDPOINTS.map((e) => (
            <div key={`${e.method} ${e.path}`} className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 sm:p-5 space-y-3">
              <div className="flex items-baseline flex-wrap gap-2">
                <MethodPill method={e.method} />
                <code className="text-[13px] font-mono text-zinc-100">{e.path}</code>
                <span className="text-[10px] font-mono text-zinc-500 px-2 py-0.5 rounded border border-white/[0.06] bg-white/[0.02]">scope · {e.scope}</span>
              </div>
              <p className="text-[13px] text-zinc-200 leading-relaxed">{e.oneLine}</p>
              <p className="text-[12px] text-zinc-400 leading-relaxed max-w-3xl">{e.detail}</p>
              {e.reqBody && (
                <div>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">request</p>
                  <pre className="rounded-lg bg-black/50 border border-white/[0.06] p-3 text-[11px] font-mono leading-relaxed overflow-x-auto text-zinc-200">{e.reqBody}</pre>
                </div>
              )}
              <div>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">response · 200 / 202</p>
                <pre className="rounded-lg bg-black/50 border border-emerald-500/15 p-3 text-[11px] font-mono leading-relaxed overflow-x-auto text-emerald-100">{e.resBody}</pre>
              </div>
              {e.errorCodes.length > 0 && (
                <div>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1.5">errors · closed-union</p>
                  <div className="flex flex-wrap gap-1.5">
                    {e.errorCodes.map((c) => (
                      <code key={c} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-200 border border-red-500/20">{c}</code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── Webhook events ──────────────────────────────────────── */}
      <section id="webhooks" className="space-y-4 scroll-mt-6">
        <SectionHeader
          title="Webhook events"
          subtitle={`Every event the platform delivers (${WEBHOOK_EVENTS.length}). Signed HMAC-SHA256 + ES256 (JWS). Public keys at /api/v1/webhooks/jwks.`}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {WEBHOOK_EVENTS.map((w) => (
            <div key={w.kind} className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <code className="text-[12px] font-mono text-violet-200">{w.kind}</code>
              </div>
              <p className="text-[12px] text-zinc-300 leading-relaxed">{w.oneLine}</p>
              <p className="text-[10px] font-mono text-zinc-500 truncate" title={w.emittedFrom}>emitted from · {w.emittedFrom}</p>
              <pre className="rounded-lg bg-black/40 border border-white/[0.05] p-2.5 text-[10.5px] font-mono leading-relaxed overflow-x-auto text-zinc-200">{w.payload}</pre>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Closed-unions ───────────────────────────────────────── */}
      <section id="unions" className="space-y-4 scroll-mt-6">
        <SectionHeader
          title="Closed-union types"
          subtitle="The platform's safety mechanism. Members can't drift apart from runtime checks — a typo is a compile error, not a silent denial."
        />
        <div className="space-y-3">
          {CLOSED_UNIONS.map((u) => (
            <div key={u.name} className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 space-y-2.5">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <h3 className="text-[14px] font-semibold text-white tracking-tight">{u.name}</h3>
                <code className="text-[10px] font-mono text-zinc-500">{u.source}</code>
              </div>
              <ul className="space-y-1">
                {u.members.map((m) => (
                  <li key={m.value} className="grid grid-cols-[max-content_1fr] gap-2 items-baseline">
                    <code className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-200 border border-violet-500/20 whitespace-nowrap">{m.value}</code>
                    <span className="text-[12px] text-zinc-400 leading-relaxed">{m.meaning}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Audit actions ───────────────────────────────────────── */}
      <section id="audit" className="space-y-4 scroll-mt-6">
        <SectionHeader
          title="Audit actions"
          subtitle={`Every closed-union member of AuditAction, grouped by category. ${AUDIT_CATEGORIES.reduce((a, c) => a + c.actions.length, 0)} total.`}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {AUDIT_CATEGORIES.map((cat) => (
            <div key={cat.name} className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
              <p className="text-[11px] font-semibold text-zinc-200 mb-1.5">{cat.name}</p>
              <ul className="space-y-0.5">
                {cat.actions.map((a) => (
                  <li key={a}>
                    <code className="text-[10.5px] font-mono text-zinc-400">{a}</code>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ─── AI engineers ────────────────────────────────────────── */}
      <section id="engineers" className="space-y-4 scroll-mt-6">
        <SectionHeader
          title="AI engineers"
          subtitle={`${ENGINEERS.length} registered engineers. Each has a closed tool list — the runtime gate checks every call against this scope BEFORE the model can see the tool definition.`}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {ENGINEERS.map((eng) => (
            <div key={eng.name} className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 space-y-2.5">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <h3 className="text-[14px] font-semibold text-white">{eng.name}</h3>
                <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  eng.defaultApproval === "two_person" ? "bg-violet-500/15 text-violet-200" :
                  eng.defaultApproval === "self_approve" ? "bg-amber-500/15 text-amber-200" :
                  "bg-emerald-500/15 text-emerald-200"
                }`}>default · {eng.defaultApproval}</span>
              </div>
              <p className="text-[12px] text-zinc-400 leading-relaxed">{eng.scopeOneLine}</p>
              <div>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">tools · {eng.tools.length}</p>
                <div className="flex flex-wrap gap-1">
                  {eng.tools.map((t) => (
                    <code key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-200 border border-cyan-500/20">{t}</code>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Connectors ──────────────────────────────────────────── */}
      <section id="connectors" className="space-y-4 scroll-mt-6">
        <SectionHeader
          title="Connectors"
          subtitle={`${CONNECTORS.length} integrations. Auth model + scope detail for each.`}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {CONNECTORS.map((c) => (
            <div key={c.name} className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 space-y-2">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <h3 className="text-[14px] font-semibold text-white">{c.name}</h3>
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/[0.06] bg-white/[0.02] text-zinc-400">{c.category}</span>
              </div>
              <p className="text-[11.5px] text-zinc-300 leading-relaxed"><span className="text-zinc-500">auth · </span>{c.authModel}</p>
              <p className="text-[11.5px] text-zinc-300 leading-relaxed"><span className="text-zinc-500">scopes · </span>{c.scopes}</p>
              <p className="text-[11.5px] text-zinc-400 leading-relaxed"><span className="text-zinc-500">capability · </span>{c.capability}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Safety invariants ───────────────────────────────────── */}
      <section id="safety" className="space-y-4 scroll-mt-6">
        <SectionHeader
          title="Safety invariants"
          subtitle={`${SAFETY_INVARIANTS.length} platform-wide guarantees. Each lists exactly where it is enforced.`}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {SAFETY_INVARIANTS.map((s) => (
            <div key={s.label} className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.025] p-4 space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">✓</span>
                <h3 className="text-[13px] font-semibold text-white leading-tight">{s.label}</h3>
              </div>
              <p className="text-[12px] text-zinc-400 leading-relaxed">{s.detail}</p>
              <p className="text-[10px] font-mono text-zinc-600">enforced at · {s.enforcedAt}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.02] to-transparent p-5 sm:p-6 space-y-3">
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.22em]">where to go next</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/demo" className="text-[12px] text-violet-300/90 hover:text-violet-200 underline-offset-2 hover:underline">← Back to all scenarios</Link>
          <Link href="/docs/architecture" className="text-[12px] text-zinc-300 hover:text-white underline-offset-2 hover:underline">Architecture overview →</Link>
          <Link href="/docs/approval-workflow" className="text-[12px] text-zinc-300 hover:text-white underline-offset-2 hover:underline">Approval workflow →</Link>
          <Link href="/docs/audit-logs" className="text-[12px] text-zinc-300 hover:text-white underline-offset-2 hover:underline">Audit logs →</Link>
          <Link href="/download" className="text-[12px] text-zinc-300 hover:text-white underline-offset-2 hover:underline">Download Axiom Agent →</Link>
        </div>
      </footer>
      </main>
    </>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight leading-tight">{title}</h2>
      <p className="text-[13px] text-zinc-400 leading-relaxed max-w-3xl">{subtitle}</p>
    </div>
  );
}

function MethodPill({ method }: { method: "GET" | "POST" }) {
  const cls = method === "GET"
    ? "bg-cyan-500/15 text-cyan-200 border-cyan-500/30"
    : "bg-violet-500/15 text-violet-200 border-violet-500/30";
  return <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls}`}>{method}</span>;
}
