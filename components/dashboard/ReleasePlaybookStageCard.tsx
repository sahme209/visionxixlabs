"use client";

/**
 * Release playbook stage card — renders one of the 9 stages with:
 * - Status indicator (✓ / ⚠️ / 🔴 / ⏳)
 * - Key metrics/facts
 * - Action link to details
 */

import Link from "next/link";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

export interface StageCardProps {
  stage: "request" | "readiness" | "playbook" | "risk" | "approval" | "execution" | "validation" | "evidence" | "closure";
  status: "complete" | "pending" | "warning" | "error";
  title: string;
  description: string | null;
  facts: Array<{ label: string; value: string }>;
  detailLink: string;
}

const STATUS_ICON: Record<string, React.ComponentType<{ className: string }>> = {
  complete: CheckCircleIcon,
  pending: ClockIcon,
  warning: ExclamationTriangleIcon,
  error: XCircleIcon,
};

const STATUS_COLORS: Record<string, string> = {
  complete: "text-emerald-400 bg-emerald-500/10",
  pending: "text-amber-400 bg-amber-500/10",
  warning: "text-orange-400 bg-orange-500/10",
  error: "text-rose-400 bg-rose-500/10",
};

const STATUS_BORDER: Record<string, string> = {
  complete: "border-emerald-500/25",
  pending: "border-amber-500/25",
  warning: "border-orange-500/25",
  error: "border-rose-500/25",
};

export function ReleasePlaybookStageCard({
  stage,
  status,
  title,
  description,
  facts,
  detailLink,
}: StageCardProps) {
  const Icon = STATUS_ICON[status];

  return (
    <article className={`rounded-2xl border ${STATUS_BORDER[status]} bg-white/[0.025] p-5 transition hover:bg-white/[0.04]`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[14px] font-semibold text-white">{title}</h3>
            <Icon className={`h-4 w-4 ${STATUS_COLORS[status]}`} />
          </div>
          {description && (
            <p className="text-[12px] text-zinc-400">{description}</p>
          )}
        </div>
      </div>

      {facts.length > 0 && (
        <dl className="space-y-2 mb-4 text-[11px]">
          {facts.map(({ label, value }) => (
            <div key={label} className="flex gap-3 justify-between">
              <dt className="text-zinc-500">{label}</dt>
              <dd className="text-zinc-300 font-mono">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <Link
        href={detailLink}
        className="inline-flex text-[11px] font-semibold text-violet-300 hover:text-violet-200 transition"
      >
        View {title.toLowerCase()} →
      </Link>
    </article>
  );
}
