/**
 * StartHereView — Phase 406-desktop.
 *
 * Desktop equivalent of /dashboard/start-here on the web. Walks the
 * operator through the 12-step setup journey, but with **desktop-
 * native** CTAs: each step either deep-links into another view in this
 * app, or opens the equivalent web page in a browser tab.
 */

import { DataSourceBanner, ExternalLink, ViewShell } from "../components/Primitives";
import type { View } from "../App";

interface SetupStep {
  ord: number;
  title: string;
  purpose: string;
  estimateMins: number;
  /** When set, clicking the CTA switches the desktop view. */
  desktopView?: View;
  /** When set, clicking the CTA opens this URL in a browser tab. */
  webHref?: string;
  ctaLabel: string;
}

const STEPS: SetupStep[] = [
  { ord: 1,  title: "Open the dashboard",            purpose: "See the workspace at a glance: release-gate verdict, quota, and recent runs.", estimateMins: 1, desktopView: "dashboard",   ctaLabel: "Open Dashboard"   },
  { ord: 2,  title: "Paste your API key",            purpose: "Settings → VisionXIXLabs API key → paste the vxlk_live_… string from the web admin panel.", estimateMins: 1, desktopView: "settings",   ctaLabel: "Open Settings"    },
  { ord: 3,  title: "Test the connection",           purpose: "Confirms the key works against your workspace.", estimateMins: 1, desktopView: "settings",    ctaLabel: "Test connection"  },
  { ord: 4,  title: "Connect a cloud provider",      purpose: "AWS, Azure, or GCP — read-only by default.", estimateMins: 5, desktopView: "connectors",  ctaLabel: "Open Connectors"  },
  { ord: 5,  title: "Inspect cloud overview",        purpose: "Workspace + plan tier + per-provider state from /api/v1/whoami.", estimateMins: 2, desktopView: "multi-cloud", ctaLabel: "Open Multi-cloud" },
  { ord: 6,  title: "Review security gate",          purpose: "Release-gate verdict + blockers as security findings.", estimateMins: 2, desktopView: "security",     ctaLabel: "Open Security"    },
  { ord: 7,  title: "Trigger your first pipeline",   purpose: "Workflows view → 'Trigger run' form. Idempotency-protected.", estimateMins: 3, desktopView: "workflows",   ctaLabel: "Open Workflows"   },
  { ord: 8,  title: "Watch approvals queue",         purpose: "Runs awaiting human approval surface here in real time.", estimateMins: 2, desktopView: "approvals",   ctaLabel: "Open Approvals"   },
  { ord: 9,  title: "Read recent audit rows",        purpose: "Every action emits a closed-union audit row.", estimateMins: 2, desktopView: "audit",        ctaLabel: "Open Audit log"    },
  { ord: 10, title: "Configure billing alerts",      purpose: "See plan tier + monthly v1 quota + nearLimit warnings.", estimateMins: 2, desktopView: "billing",     ctaLabel: "Open Billing"     },
  { ord: 11, title: "Read the Trust center",         purpose: "Policies, automation boundaries, and approval rules.", estimateMins: 3, desktopView: "trust",        ctaLabel: "Open Trust"       },
  { ord: 12, title: "Open the platform demo",        purpose: "Walk every scenario in the public sandbox without affecting real data.", estimateMins: 6, webHref: "https://visionxixlabs.com/demo", ctaLabel: "Open /demo (web)" },
];

export function StartHereView({ onNavigate }: { onNavigate: (view: View) => void }) {
  return (
    <ViewShell>
      <DataSourceBanner
        mode="live"
        surfaceName="setup guide"
        webPath="/dashboard/start-here"
      />

      <div>
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">start here</p>
        <h1 className="text-2xl font-bold tracking-tight">12-step setup guide</h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-2xl leading-relaxed">
          Walks you from cold start to your first audited automation. Each step is read-only or
          self-approve by default — nothing happens in your cloud without explicit go-ahead.
        </p>
      </div>

      <ol className="space-y-2">
        {STEPS.map((step) => (
          <li
            key={step.ord}
            className="rounded-xl border border-axiom-border bg-white/[0.01] p-4 hover:border-violet-500/30 transition-colors"
          >
            <div className="flex items-start gap-3">
              <span className="text-[10px] font-mono text-zinc-600 tabular-nums w-6 mt-1 shrink-0">
                {String(step.ord).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <h2 className="text-[14px] font-semibold text-white">{step.title}</h2>
                  <span className="text-[10px] font-mono text-zinc-600">~{step.estimateMins} min</span>
                </div>
                <p className="text-[12px] text-zinc-400 leading-relaxed mt-1">{step.purpose}</p>
                <div className="flex items-center gap-2 mt-3">
                  {step.desktopView && (
                    <button
                      onClick={() => onNavigate(step.desktopView!)}
                      className="px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-medium transition-colors"
                    >
                      {step.ctaLabel} →
                    </button>
                  )}
                  {step.webHref && (
                    <ExternalLink
                      href={step.webHref}
                      className="px-3 py-1.5 rounded-md bg-violet-500/[0.10] text-violet-200 text-[11px] font-medium border border-violet-500/20 hover:bg-violet-500/[0.18] transition-colors"
                    >
                      {step.ctaLabel} ↗
                    </ExternalLink>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </ViewShell>
  );
}
