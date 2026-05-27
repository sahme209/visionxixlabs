"use client";

/**
 * Phase 503 — reusable first-run checklist widget.
 *
 * Drop into any dashboard page. Self-fetches state; auto-hides when
 * all 4 items are done so the dashboard reverts to its normal layout.
 * Compact prop trims chrome for in-page embedding (vs a full hero).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircleIcon,
  ArrowRightCircleIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";

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

interface RespData {
  generatedAt: string;
  checklist: ChecklistProjection;
}

type RespBody =
  | { ok: true; data: RespData }
  | { ok: false; error: string; hint?: string };

interface Props {
  /** When true, hides description text and renders a tighter card. */
  compact?: boolean;
  /** When true, keep showing the widget even when all items done. */
  alwaysShow?: boolean;
}

export function OnboardingChecklist({ compact = false, alwaysShow = false }: Props) {
  const [resp, setResp] = useState<RespBody | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/onboarding-checklist", { credentials: "include" })
      .then((r) => r.json())
      .then((j: RespBody) => { if (!cancelled) setResp(j); })
      .catch(() => { /* swallow — widget self-hides on error */ });
    return () => { cancelled = true; };
  }, []);

  if (!resp?.ok) return null;
  const c = resp.data.checklist;
  if (c.allDone && !alwaysShow) return null;

  return (
    <div className="mb-6 rounded-2xl border border-violet-500/[0.18] bg-violet-500/[0.03] p-5">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <p className="text-[13px] font-semibold text-violet-100">
          {c.allDone ? "You're all set — zero-touch onboarding complete." : "Get started"}
        </p>
        <div className="flex items-center gap-2">
          <div className="w-32 h-1.5 rounded-full bg-zinc-800/80 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all" style={{ width: `${c.percent}%` }} />
          </div>
          <p className="text-[11px] font-mono text-zinc-300">{c.completed}/{c.total} · {c.percent}%</p>
        </div>
      </div>

      <ol className={compact ? "space-y-1.5" : "space-y-2"}>
        {c.items.map((item, idx) => {
          const Icon = item.done ? CheckCircleIcon : (item.blockedByPredecessor ? LockClosedIcon : ArrowRightCircleIcon);
          const iconCls = item.done
            ? "text-emerald-300"
            : item.blockedByPredecessor
              ? "text-zinc-600"
              : "text-violet-300";
          return (
            <li key={item.key} className="flex items-start gap-3">
              <Icon className={`h-5 w-5 ${iconCls} shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono text-zinc-500">{idx + 1}.</span>
                  <p className={`text-[12.5px] font-semibold ${item.done ? "text-zinc-400 line-through decoration-zinc-600" : item.blockedByPredecessor ? "text-zinc-500" : "text-white"}`}>
                    {item.title}
                  </p>
                </div>
                {!compact && !item.done && (
                  <p className={`text-[11.5px] mt-0.5 ${item.blockedByPredecessor ? "text-zinc-600" : "text-zinc-400"}`}>
                    {item.description}
                  </p>
                )}
                {!item.done && !item.blockedByPredecessor && (
                  item.cta.href.startsWith("http") ? (
                    <a
                      href={item.cta.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-1.5 text-[11px] font-mono text-violet-300 hover:text-violet-200 underline-offset-2 hover:underline"
                    >
                      {item.cta.label} →
                    </a>
                  ) : (
                    <Link
                      href={item.cta.href}
                      className="inline-block mt-1.5 text-[11px] font-mono text-violet-300 hover:text-violet-200 underline-offset-2 hover:underline"
                    >
                      {item.cta.label} →
                    </Link>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
