/**
 * ConnectorHealthView — Phase 408.
 *
 * Renders the Phase 407 /api/v1/connectors/health endpoint as a per-
 * connector dashboard. Reads from the shared snapshot in
 * connectorHealthStore.ts so it doesn't double-poll the App-level
 * ambient watcher. The first paint always shows real data because the
 * App boots the ambient hook before any view mounts.
 */

import { Badge, Card, DataSourceBanner, LoadingState, ViewShell } from "../components/Primitives";
import { desktopClient } from "../lib/desktopClient";
import {
  useConnectorHealthSnapshot,
  type ConnectorHealthEntry,
  type ConnectorHealthStatus,
} from "../lib/connectorHealthStore";

const STATUS_TONE: Record<ConnectorHealthStatus, { tone: "success" | "warning" | "danger" | "neutral"; label: string }> = {
  healthy:      { tone: "success",  label: "healthy"      },
  degraded:     { tone: "warning",  label: "degraded"     },
  stale:        { tone: "warning",  label: "stale"        },
  auth_failed:  { tone: "danger",   label: "auth failed"  },
  rate_limited: { tone: "warning",  label: "rate limited" },
};

const STATUS_DOT: Record<ConnectorHealthStatus, string> = {
  healthy:      "bg-emerald-400",
  degraded:     "bg-zinc-400",
  stale:        "bg-zinc-400",
  auth_failed:  "bg-red-400",
  rate_limited: "bg-zinc-400",
};

export function ConnectorHealthView() {
  const snap = useConnectorHealthSnapshot();
  const isLive = desktopClient.hasAuth() && snap.connectors.length > 0;

  return (
    <ViewShell>
      <DataSourceBanner
        mode={!desktopClient.hasAuth() ? "preview" : isLive ? "live" : "authenticated_no_data"}
        surfaceName="connector health"
        webPath="/dashboard/connectors"
      />

      <div>
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">integrations · connector health</p>
        <h1 className="text-2xl font-bold tracking-tight">Connector health</h1>
        <p className="text-sm text-zinc-500 mt-1 max-w-2xl leading-relaxed">
          Closed-union status for every connector: healthy · degraded · stale · auth_failed ·
          rate_limited. Computed by a pure kernel (priority: auth_failed &gt; rate_limited &gt;
          stale &gt; degraded &gt; healthy). Refreshed by an ambient poll every 30 seconds.
        </p>
      </div>

      <SummaryStrip summary={snap.summary} generatedAt={snap.generatedAt} />

      {!snap.hasPolled && desktopClient.hasAuth() && <LoadingState label="Polling connector health…" />}

      {snap.connectors.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-axiom-border flex items-center justify-between">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-300">Per-connector detail</p>
            <span className="text-[10px] font-mono text-zinc-500">{snap.connectors.length} connectors</span>
          </div>
          <ul className="divide-y divide-axiom-border">
            {snap.connectors.map((c) => <ConnectorRow key={c.name} c={c} />)}
          </ul>
        </Card>
      )}
    </ViewShell>
  );
}

function SummaryStrip({
  summary, generatedAt,
}: {
  summary: { healthy: number; degraded: number; stale: number; auth_failed: number; rate_limited: number };
  generatedAt: string | null;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      <Stat label="Healthy"      value={summary.healthy}      tone={summary.healthy > 0 ? "emerald" : "neutral"} />
      <Stat label="Degraded"     value={summary.degraded}     tone={summary.degraded > 0 ? "amber"   : "neutral"} />
      <Stat label="Stale"        value={summary.stale}        tone={summary.stale > 0 ? "amber"     : "neutral"} />
      <Stat label="Auth failed"  value={summary.auth_failed}  tone={summary.auth_failed > 0 ? "red" : "neutral"} />
      <Stat label="Rate limited" value={summary.rate_limited} tone={summary.rate_limited > 0 ? "amber" : "neutral"} />
      {generatedAt && (
        <div className="col-span-2 sm:col-span-5 text-right text-[10px] font-mono text-zinc-600">
          generated · {new Date(generatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

function Stat({
  label, value, tone,
}: { label: string; value: number; tone: "neutral" | "emerald" | "amber" | "red" }) {
  const cls =
    tone === "emerald" ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-100" :
    tone === "amber"   ? "border-white/30 bg-white/[0.06] text-zinc-100" :
    tone === "red"     ? "border-red-500/30 bg-red-500/[0.06] text-red-100" :
                         "border-axiom-border bg-white/[0.02] text-zinc-300";
  return (
    <div className={`rounded-lg border ${cls} px-3 py-2`}>
      <div className="text-[10px] font-mono uppercase tracking-[0.16em] opacity-70">{label}</div>
      <div className="text-lg font-semibold mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function ConnectorRow({ c }: { c: ConnectorHealthEntry }) {
  const tone = STATUS_TONE[c.status];
  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${STATUS_DOT[c.status]}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[13px] font-semibold text-zinc-100">{c.name}</span>
          <span className="text-[10px] font-mono text-zinc-500 px-1.5 py-0.5 rounded border border-axiom-border bg-white/[0.02]">{c.category}</span>
          <Badge tone={tone.tone}>{tone.label}</Badge>
          {c.stage !== "ok" && (
            <span className="text-[10px] font-mono text-zinc-500">stage · {c.stage}</span>
          )}
        </div>
        <p className="text-[12px] text-zinc-300 leading-relaxed">{c.reason}</p>
        <div className="flex items-center gap-3 flex-wrap mt-1.5 text-[10px] font-mono text-zinc-500">
          {c.ageMs !== null && <span>age · {formatAge(c.ageMs)}</span>}
          {c.successRatio !== null && <span>success ratio · {(c.successRatio * 100).toFixed(1)}%</span>}
          <span>recent · {c.recentSuccessCount} ok / {c.recentErrorCount} err</span>
        </div>
      </div>
    </li>
  );
}

function formatAge(ms: number): string {
  if (ms < 60_000)     return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000)  return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`;
  return `${Math.round(ms / 86_400_000)}d`;
}
