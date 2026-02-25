"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CurrencyDollarIcon } from "@heroicons/react/24/outline";
import type { LeadFormData } from "@/lib/leads/leadSchema";

interface PricingBreakdown {
  label: string;
  min: number;
  max: number;
}

interface EstimateResponse {
  min: number;
  max: number;
  breakdown: PricingBreakdown[];
}

interface RequestPricingPanelProps {
  form: LeadFormData;
  className?: string;
}

export function RequestPricingPanel({ form, className = "" }: RequestPricingPanelProps) {
  const payloadKey = useMemo(
    () =>
      JSON.stringify({
        projectType: form.projectType,
        numberOfPages: form.numberOfPages,
        copywritingNeeded: form.copywritingNeeded,
        projectGoals: form.projectGoals,
        requiredSections: form.requiredSections,
        hostingDomainStatus: form.hostingDomainStatus,
      }),
    [
      form.projectType,
      form.numberOfPages,
      form.copywritingNeeded,
      form.projectGoals?.join(","),
      form.requiredSections,
      form.hostingDomainStatus,
    ]
  );

  const formRef = useRef(form);
  formRef.current = form;
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const p = { ...formRef.current };
    if (!p.projectGoals?.length) p.projectGoals = ["informational"];

    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      fetch("/api/leads/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data: EstimateResponse | null) => {
        if (!cancelled && data) setEstimate(data);
      })
      .catch(() => {
        if (!cancelled) setEstimate(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [payloadKey]);

  const formatted = estimate
    ? `$${estimate.min.toLocaleString()} – $${estimate.max.toLocaleString()}`
    : "—";

  return (
    <div
      className={`rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 ${className}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <CurrencyDollarIcon className="h-5 w-5 text-[var(--uscis-blue)]" />
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          Estimated Range
        </h3>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--uscis-blue)] border-t-transparent" />
          <span className="text-sm">Calculating…</span>
        </div>
      ) : (
        <>
          <p className="text-2xl font-bold text-[var(--uscis-blue)] mb-3">
            {formatted}
          </p>
          {estimate?.breakdown && estimate.breakdown.length > 0 && (
            <ul className="space-y-2 mb-4">
              {estimate.breakdown.map((row, i) => (
                <li
                  key={i}
                  className="flex justify-between text-sm text-[var(--text-secondary)]"
                >
                  <span>{row.label}</span>
                  <span>
                    ${row.min.toLocaleString()} – ${row.max.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-[var(--text-tertiary)]">
            Estimate only. Final quote confirmed after review.
          </p>
        </>
      )}
    </div>
  );
}
