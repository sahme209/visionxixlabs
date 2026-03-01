"use client";

import { useState } from "react";
import {
  CloudArrowUpIcon,
  CircleStackIcon,
  ArrowPathIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

export type CloudServiceId = "hosting" | "storage" | "cicd" | "monitoring";

export type CloudServiceOption = {
  id: CloudServiceId;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Included by default (e.g. hosting = deploy) */
  includedByDefault?: boolean;
};

const CLOUD_SERVICES: CloudServiceOption[] = [
  {
    id: "hosting",
    name: "Managed Hosting",
    description: "CDN, SSL, global edge. Your site deployed and live.",
    icon: CloudArrowUpIcon,
    includedByDefault: true,
  },
  {
    id: "storage",
    name: "Storage",
    description: "S3 / Blob / GCS for assets and uploads.",
    icon: CircleStackIcon,
  },
  {
    id: "cicd",
    name: "CI/CD Pipeline",
    description: "Automated deployments on push.",
    icon: ArrowPathIcon,
  },
  {
    id: "monitoring",
    name: "Monitoring & Logs",
    description: "Uptime, metrics, log aggregation.",
    icon: ChartBarIcon,
  },
];

export function CloudServicesAddOns({
  selectedIds = [],
  onChange,
  disabled = false,
}: {
  selectedIds?: CloudServiceId[];
  onChange?: (ids: CloudServiceId[]) => void;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<Set<CloudServiceId>>(
    new Set(selectedIds)
  );

  const toggle = (id: CloudServiceId) => {
    const opt = CLOUD_SERVICES.find((c) => c.id === id);
    if (opt?.includedByDefault) return; // cannot deselect
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    onChange?.(Array.from(next));
  };

  return (
    <div className="rounded-xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 p-5">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
        <CloudArrowUpIcon className="h-4 w-4 text-violet-500" />
        Optional cloud infrastructure
      </h3>
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
        Enable add-ons to provision resources automatically. Not text suggestions—real provisioning via cloud APIs.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {CLOUD_SERVICES.map((svc) => {
          const Icon = svc.icon;
          const isIncluded = svc.includedByDefault;
          const isChecked = isIncluded || selected.has(svc.id);
          return (
            <label
              key={svc.id}
              className={`flex gap-3 rounded-xl border-2 p-3 cursor-pointer transition ${
                isIncluded
                  ? "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-900/20"
                  : isChecked
                  ? "border-violet-500/80 dark:border-violet-500/60 bg-violet-50/50 dark:bg-violet-900/20"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
              } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(svc.id)}
                disabled={disabled || isIncluded}
                className="rounded mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {svc.name}
                    {isIncluded && (
                      <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-400">
                        (included)
                      </span>
                    )}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {svc.description}
                </p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
