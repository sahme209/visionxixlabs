/**
 * TrustView — Phase 406-desktop.
 *
 * Read-only summary of the workspace's approval boundaries and the
 * platform's built-in safety guarantees. Authoritative source remains
 * the web /dashboard/trust + /dashboard/policies pages.
 */

import { Card, DataSourceBanner, ExternalLink, ViewShell } from "../components/Primitives";
import { desktopClient } from "../lib/desktopClient";

const GUARANTEES = [
  {
    title: "Read-only by default",
    body: "Every AI engineer starts in read-only mode. Granting write access is a separate, explicit, audited step.",
  },
  {
    title: "Two-person approval for production change",
    body: "By default, no remediation, DDL, IAM change, or CI modification runs without two distinct human approvers.",
  },
  {
    title: "Closed-union audit actions",
    body: "Every action emits an audit row from a closed-union AuditAction list. Typos are compile-time errors.",
  },
  {
    title: "Demo data never leaks into real workspace",
    body: "assertNotDemoLeak() throws at the boundary if a real workspace ever tries to render sandbox content.",
  },
  {
    title: "HMAC + ES256 webhook signing",
    body: "Outbound webhooks signed with HMAC-SHA256 (default) or ES256 (opt-in). Public JWKS at /api/v1/webhooks/jwks.",
  },
  {
    title: "Idempotent v1 trigger",
    body: "POST /api/v1/pipelines/runs accepts Idempotency-Key. CI retries don't double-fire.",
  },
  {
    title: "Per-stage cost halt",
    body: "Every pipeline run has a hard cumulative-cost cap. AI can't blow the budget mid-run.",
  },
  {
    title: "Per-org quotas",
    body: "Plan-tier-aware monthly v1 API quota. 429 + Retry-After + audit on exhaustion.",
  },
];

export function TrustView() {
  return (
    <ViewShell>
      <DataSourceBanner
        mode={desktopClient.hasAuth() ? "live" : "preview"}
        surfaceName="trust center"
        webPath="/dashboard/trust"
      />

      <div>
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">business · trust center</p>
        <h1 className="text-2xl font-bold tracking-tight">Trust &amp; safety guarantees</h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-2xl leading-relaxed">
          Security guarantees and automation boundaries enforced by the installed application and workspace services.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {GUARANTEES.map((g) => (
          <Card key={g.title} className="p-4">
            <h2 className="text-[13px] font-semibold text-white mb-1">{g.title}</h2>
            <p className="text-[12px] text-zinc-400 leading-relaxed">{g.body}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">audit trail</p>
        <p className="text-[12px] text-zinc-300 leading-relaxed">
          Audited service actions use a closed-union <code className="font-mono text-zinc-200">AuditAction</code>. Read the security model at{" "}
          <ExternalLink
            href="https://visionxixlabs.com/docs/security-model"
            className="text-violet-300 hover:text-violet-200 underline-offset-2 hover:underline"
          >
            documentation ↗
          </ExternalLink>
          .
        </p>
      </Card>
    </ViewShell>
  );
}
