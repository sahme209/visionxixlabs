/**
 * Public /status page — server-rendered. No auth required.
 *
 * Renders the typed PublicStatusReport with per-component verdict
 * + overall rollup. Same source the JSON endpoint exposes so probes
 * and humans see identical state.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { buildPublicStatus, type StatusVerdict } from "@/lib/status/publicStatusBuilder";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  MinusCircleIcon,
} from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Status — V19 | Vision XIX Labs",
  description: "Public uptime + autonomy-loop health for the V19 cross-cloud AGI ops platform.",
};

const TONE: Record<StatusVerdict, string> = {
  operational: "border-emerald-500/30 bg-emerald-500/5 text-emerald-200",
  degraded:    "border-white/30 bg-white/5 text-zinc-200",
  down:        "border-rose-500/30 bg-rose-500/6 text-rose-200",
  unknown:     "border-zinc-500/30 bg-zinc-500/4 text-zinc-300",
};

const ICON: Record<StatusVerdict, typeof CheckCircleIcon> = {
  operational: CheckCircleIcon,
  degraded:    ExclamationTriangleIcon,
  down:        XCircleIcon,
  unknown:     MinusCircleIcon,
};

const LABEL: Record<StatusVerdict, string> = {
  operational: "All systems operational",
  degraded:    "Partial degradation",
  down:        "Major outage",
  unknown:     "Status unknown",
};

export default async function StatusPage() {
  const report = await buildPublicStatus();
  const OverallIcon = ICON[report.overall];

  return (
    <div className="axiom-canvas public-status-page min-h-screen text-zinc-200">
      <Navigation />
      <main className="public-status-main">
        <p className="public-feature-eyebrow">V19 · Live status</p>
        <div className="public-status-summary">
          <div className={`shrink-0 w-14 h-14 rounded-2xl border flex items-center justify-center ${TONE[report.overall]}`}>
            <OverallIcon className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <p className="mono-label mb-1">Overall</p>
            <h1 className="text-3xl md:text-4xl font-medium text-white leading-tight tracking-tight">
              {LABEL[report.overall]}
            </h1>
            <p className="text-xs text-zinc-400 mt-3 tabular-nums">
              Last checked <time dateTime={report.generatedAt}>{new Date(report.generatedAt).toLocaleString()}</time>
            </p>
          </div>
        </div>

        <section aria-labelledby="status-components">
        <h2 id="status-components" className="text-xl font-medium mb-6">Components · {report.components.length}</h2>
        <div className="public-status-components">
          {report.components.map((c) => {
            const CIcon = ICON[c.verdict];
            return (
              <article
                key={c.id}
                className="public-status-component"
              >
                <div className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center ${TONE[c.verdict]}`}>
                  <CIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <h3 className="text-[15px] font-medium text-white tracking-tight">{c.label}</h3>
                    <span className={`text-[11px] border rounded-md px-2 py-0.5 ${TONE[c.verdict]}`}>
                      {c.verdict}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 leading-7">{c.detail}</p>
                </div>
              </article>
            );
          })}
        </div>
        </section>

        <div className="public-status-links">
          <p>
            JSON probe:{" "}
            <Link href="/api/status" className="underline underline-offset-4 hover:text-white">/api/status</Link>
          </p>
          <div className="flex items-center gap-4">
            <Link href="/docs/surfaces" className="hover:text-white transition-colors">Docs</Link>
            <Link href="/plans" className="hover:text-white transition-colors">Pricing</Link>
            <a href="https://github.com/sahme209/visionxixlabs/releases" className="hover:text-white transition-colors">Release notes</a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
