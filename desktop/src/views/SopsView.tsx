import { useEffect, useState } from "react";
import { ViewShell } from "../components/Primitives";

/**
 * Phase 448 — desktop sibling for the web /dashboard/sops catalog +
 * detail. Single-pane: pick a type from the left, render its 16
 * sections on the right.
 */

interface CatalogEntry { deploymentType: string; label: string }
interface SopSection { id: string; title: string; bullets: string[] }
interface SopDocument {
  deploymentType: string;
  title: string;
  generatedAt: string;
  sections: SopSection[];
}

type CatalogResp =
  | { ok: true; data: { catalog: CatalogEntry[] } }
  | { ok: false; error: string };

type DetailResp =
  | { ok: true; data: SopDocument }
  | { ok: false; error: string };

const ICON_BY_TYPE: Record<string, string> = {
  application: "🚀", kubernetes_helm: "☸️", data_pipeline: "🛢️",
  connector: "🔌", database_liquibase: "🗃️", airflow_dag: "📅",
  terraform_iac: "🏗️", emergency_fix: "🚨", rollback_recovery: "⏪",
  manual_reconciliation: "🔧",
};

export function SopsView() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [doc, setDoc] = useState<SopDocument | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/sops", { credentials: "include" })
      .then((r) => r.json())
      .then((j: CatalogResp) => {
        if (cancelled) return;
        if (j.ok) {
          setCatalog(j.data.catalog);
          if (j.data.catalog.length > 0) setSelected(j.data.catalog[0].deploymentType);
        } else setCatalogError(j.error);
      })
      .catch((e) => { if (!cancelled) setCatalogError(e instanceof Error ? e.message : "Network error."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoadingDetail(true);
    setDocError(null);
    fetch(`/api/dashboard/sops/${encodeURIComponent(selected)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: DetailResp) => {
        if (cancelled) return;
        if (j.ok) setDoc(j.data);
        else setDocError(j.error);
      })
      .catch((e) => { if (!cancelled) setDocError(e instanceof Error ? e.message : "Network error."); })
      .finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [selected]);

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Standard Operating Procedures</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          16 sections per type. Pick a deployment type to read the full SOP.
        </p>
      </div>

      {catalogError && (
        <div className="glass-card p-4 text-sm text-rose-300 border border-rose-500/20">{catalogError}</div>
      )}

      <div className="flex gap-4 min-h-0 flex-1">
        {/* Left rail */}
        <aside className="w-64 shrink-0 space-y-1">
          {catalog.map((e) => (
            <button
              key={e.deploymentType}
              type="button"
              onClick={() => setSelected(e.deploymentType)}
              className={`w-full text-left rounded-lg px-3 py-2 transition-colors flex items-center gap-2 ${
                selected === e.deploymentType
                  ? "bg-violet-500/15 text-violet-100 border border-violet-500/30"
                  : "bg-zinc-800/40 hover:bg-zinc-800/60 text-zinc-300 border border-zinc-700/40"
              }`}
            >
              <span className="text-lg shrink-0">{ICON_BY_TYPE[e.deploymentType] ?? "📋"}</span>
              <span className="text-[12px] font-medium truncate">{e.label}</span>
            </button>
          ))}
        </aside>

        {/* Detail */}
        <div className="flex-1 min-w-0 overflow-y-auto space-y-3">
          {loadingDetail && (
            <div className="glass-card p-4 text-sm text-zinc-400">Loading SOP…</div>
          )}
          {docError && (
            <div className="glass-card p-4 text-sm text-rose-300 border border-rose-500/20">{docError}</div>
          )}
          {doc && !loadingDetail && doc.sections.map((sec) => (
            <section key={sec.id} className="glass-card p-4">
              <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1">// {sec.id}</p>
              <h2 className="text-[14px] font-semibold text-white mb-2">{sec.title}</h2>
              <ul className="space-y-1">
                {sec.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11.5px] text-zinc-300">
                    <span aria-hidden className="mt-1.5 w-1 h-1 rounded-full bg-white/40 flex-shrink-0" />
                    <span className="leading-relaxed">{b}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </ViewShell>
  );
}
