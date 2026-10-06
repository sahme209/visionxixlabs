import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

interface DeliveryView {
  id: string;
  provider: string;
  deliveryId: string;
  eventKind: string;
  eventAction: string | null;
  outcome: "accepted" | "ignored" | "error" | "unknown";
  summary: string;
  receivedAtIso: string;
}

interface ListData {
  generatedAt: string;
  deliveries: DeliveryView[];
  summary: { total: number; accepted: number; ignored: number; errored: number };
}

type ListBody =
  | { ok: true; data: ListData }
  | { ok: false; error: string; hint?: string };

const OUTCOME_CLASS: Record<DeliveryView["outcome"], string> = {
  accepted: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  ignored:  "bg-zinc-700/40 text-zinc-300 border-zinc-700/40",
  error:    "bg-rose-500/15 text-rose-300 border-rose-500/25",
  unknown:  "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export function WebhookDeliveriesView() {
  const [resp, setResp] = useState<ListBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadList() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/webhook-delivery-list", { credentials: "include" })
      .then((r) => r.json())
      .then((j: ListBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadList(); }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Webhook deliveries</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          GitHub webhook receiver · HMAC-verified · idempotent on delivery id.
        </p>
      </div>

      {data && (
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Total" value={String(data.summary.total)} />
          <Stat label="Accepted" value={String(data.summary.accepted)} tone={data.summary.accepted > 0 ? "emerald" : "zinc"} />
          <Stat label="Ignored" value={String(data.summary.ignored)} />
          <Stat label="Errored" value={String(data.summary.errored)} tone={data.summary.errored > 0 ? "rose" : "zinc"} />
        </div>
      )}

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading deliveries…</div>}

      {!loading && networkError && (
        <div className="glass-card p-4 text-sm text-rose-300 border border-rose-500/20">{networkError}</div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div className="glass-card p-4 border border-white/30">
          <p className="text-sm font-semibold text-zinc-300 mb-1">Schema migration pending</p>
          <p className="text-xs text-zinc-400">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div className="glass-card p-4 text-sm text-zinc-300 border border-white/20">Sign in required.</div>
      )}

      {data && (
        data.deliveries.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-zinc-400">
            No webhook deliveries received yet. Configure GitHub to POST to /api/webhooks/github with your GITHUB_WEBHOOK_SECRET.
          </div>
        ) : (
          <div className="space-y-1.5">
            {data.deliveries.map((d) => (
              <div key={d.id} className="glass-card p-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${OUTCOME_CLASS[d.outcome]}`}>
                    {d.outcome}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">{d.provider}:{d.eventKind}</span>
                  {d.eventAction && (
                    <span className="text-[10px] font-mono text-zinc-500">· {d.eventAction}</span>
                  )}
                  <span className="text-[10px] font-mono text-zinc-500 ml-auto">
                    {new Date(d.receivedAtIso).toLocaleString()}
                  </span>
                </div>
                <p className="text-[12.5px] text-zinc-200">{d.summary}</p>
                <p className="text-[10px] font-mono text-zinc-600 mt-1">delivery: {d.deliveryId}</p>
              </div>
            ))}
          </div>
        )
      )}
    </ViewShell>
  );
}

function Stat({ label, value, tone = "zinc" }: { label: string; value: string; tone?: "emerald" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/20 text-emerald-200",
    rose:    "border-rose-500/20 text-rose-200",
    zinc:    "border-zinc-700/40 text-zinc-200",
  }[tone];
  return (
    <div className={`glass-card p-3 border ${cls}`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}
