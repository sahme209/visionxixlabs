import { useEffect, useState } from "react";
import type { View } from "../App";

/**
 * Phase 503 — desktop sibling of the web OnboardingChecklist.
 * Self-fetches state; auto-hides when all items done.
 */

interface ChecklistItem {
  key: string;
  title: string;
  description: string;
  done: boolean;
  cta: { label: string; href: string };
  blockedByPredecessor: boolean;
}

interface ChecklistProjection {
  items: ChecklistItem[];
  completed: number;
  total: number;
  percent: number;
  allDone: boolean;
}

interface RespData { generatedAt: string; checklist: ChecklistProjection }
type RespBody =
  | { ok: true; data: RespData }
  | { ok: false; error: string; hint?: string };

const HREF_TO_VIEW: Record<string, View> = {
  "/dashboard/github-app":   "github-app",
  "/dashboard/applications": "applications",
  "/dashboard/repositories": "repositories",
  "/dashboard/releases":     "releases",
};

interface Props { onNavigate?: (v: View) => void }

export function OnboardingChecklist({ onNavigate }: Props) {
  const [resp, setResp] = useState<RespBody | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/onboarding-checklist", { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => { if (!cancelled) setResp(j); })
      .catch(() => { /* swallow */ });
    return () => { cancelled = true; };
  }, []);

  if (!resp?.ok) return null;
  const c = resp.data.checklist;
  if (c.allDone) return null;

  function onCtaClick(href: string) {
    // External (GitHub install) URLs open in the browser; in-app paths
    // route via the View union.
    if (href.startsWith("http")) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    const target = HREF_TO_VIEW[href];
    if (target && onNavigate) onNavigate(target);
  }

  return (
    <div className="glass-card p-4 border border-violet-500/20">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <p className="text-sm font-semibold text-violet-100">Get started</p>
        <div className="flex items-center gap-2">
          <div className="w-28 h-1.5 rounded-full bg-zinc-800/80 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all" style={{ width: `${c.percent}%` }} />
          </div>
          <p className="text-[11px] font-mono text-zinc-300">{c.completed}/{c.total} · {c.percent}%</p>
        </div>
      </div>
      <ol className="space-y-1.5">
        {c.items.map((item, idx) => {
          const icon = item.done ? "✓" : item.blockedByPredecessor ? "○" : "→";
          const iconCls = item.done
            ? "text-emerald-300"
            : item.blockedByPredecessor
              ? "text-zinc-600"
              : "text-violet-300";
          return (
            <li key={item.key} className="flex items-start gap-2.5">
              <span className={`${iconCls} font-mono text-sm w-4 shrink-0 mt-0.5`}>{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono text-zinc-500">{idx + 1}.</span>
                  <p className={`text-[12.5px] font-semibold ${item.done ? "text-zinc-400 line-through decoration-zinc-600" : item.blockedByPredecessor ? "text-zinc-500" : "text-white"}`}>
                    {item.title}
                  </p>
                </div>
                {!item.done && !item.blockedByPredecessor && (
                  <button
                    type="button"
                    onClick={() => onCtaClick(item.cta.href)}
                    className="mt-1 text-[11px] font-mono text-violet-300 hover:text-violet-200 underline-offset-2 hover:underline"
                  >
                    {item.cta.label} →
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
