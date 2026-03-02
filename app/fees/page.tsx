"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CurrencyDollarIcon, CalculatorIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/24/solid";
import { feeSchedule, feeWaiverFormId, officialFormsUrl } from "@/lib/data/feeSchedule";

const PRESETS = [
  {
    name: "Family Green Card (AOS)",
    forms: ["I-130|Petition for Alien Relative|675", "I-485|Adjustment of Status (Green Card)|1440"],
  },
  {
    name: "Fiancé(e) K-1",
    forms: ["I-129F|Fiancé(e) Visa Petition|675"],
  },
  {
    name: "Citizenship",
    forms: ["N-400|Naturalization (Citizenship)|725"],
  },
  {
    name: "Work Permit + Travel",
    forms: ["I-765|Employment Authorization (standalone)|520", "I-131|Travel Document (standalone)|660"],
  },
];

export default function FeesPage() {
  const [selectedForms, setSelectedForms] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return feeSchedule;
    return feeSchedule.filter(
      (f) =>
        f.formId.toLowerCase().includes(q) ||
        f.formName.toLowerCase().includes(q)
    );
  }, [search]);

  const total = useMemo(() => {
    let sum = 0;
    for (const key of selectedForms) {
      const parts = key.split("|");
      const fee = parseInt(parts[2] || "0", 10);
      if (!isNaN(fee)) sum += fee;
    }
    return sum;
  }, [selectedForms]);

  const toggleForm = (formId: string, formName: string, fee: number) => {
    const key = `${formId}|${formName}|${fee}`;
    setSelectedForms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyPreset = (presetForms: string[]) => {
    setSelectedForms(new Set(presetForms));
  };

  const isSelected = (e: (typeof feeSchedule)[0]) =>
    selectedForms.has(`${e.formId}|${e.formName}|${e.fee}`);

  const selectedList = useMemo(() => {
    return [...selectedForms].map((key) => {
      const [formId, formName, feeStr] = key.split("|");
      return { formId, formName, fee: parseInt(feeStr || "0", 10) };
    });
  }, [selectedForms]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <main className="max-w-7xl mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 sm:py-8 w-full min-w-0">
        <div className="mb-6">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Quick presets</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p.forms)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-primary)] hover:border-[var(--uscis-blue)]/40 hover:bg-[var(--uscis-blue)]/5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
              >
                <SparklesIcon className="w-3.5 h-3.5 text-[var(--text-primary)]" />
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] overflow-hidden mb-6">
          <div className="px-5 sm:px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-surface-alt)]/50 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Select forms</h2>
            <input
              type="search"
              placeholder="Search forms…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)]"
            />
          </div>

          <div className="divide-y divide-[var(--border-color)] max-h-[400px] overflow-y-auto">
            {filtered.map((entry, idx) => (
              <label
                key={`${entry.formId}-${entry.formName}-${entry.fee}-${idx}`}
                className={`flex items-center gap-4 px-5 sm:px-6 py-4 cursor-pointer transition-colors ${
                  isSelected(entry) ? "bg-[var(--uscis-blue)]/5" : "hover:bg-[var(--bg-surface-alt)]/30"
                }`}
                onClick={() => toggleForm(entry.formId, entry.formName, entry.fee)}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isSelected(entry)
                    ? "border-[var(--uscis-blue)] bg-[var(--uscis-blue)]"
                    : "border-[var(--border-color)]"
                }`}>
                  {isSelected(entry) && <CheckIcon className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--text-primary)]">
                    {entry.formId}: {entry.formName}
                  </p>
                  {entry.notes && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{entry.notes}</p>
                  )}
                </div>
                <span className={`font-semibold tabular-nums flex-shrink-0 ${
                  entry.fee === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--text-primary)]"
                }`}>
                  {entry.fee === 0 ? "No fee" : `$${entry.fee.toLocaleString()}`}
                </span>
              </label>
            ))}
          </div>

          {selectedForms.size > 0 && (
            <div className="px-5 sm:px-6 py-5 border-t-2 border-[var(--uscis-blue)]/20 bg-gradient-to-r from-[var(--uscis-blue)]/10 to-emerald-500/10">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                    Estimated total
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tabular-nums">
                    ${total.toLocaleString()}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {selectedList.length} form{selectedList.length !== 1 ? "s" : ""} selected
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[var(--uscis-blue)] flex items-center justify-center">
                  <CalculatorIcon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface-alt)] dark:bg-[var(--bg-surface-alt)]/50 p-5 sm:p-6 mb-6">
          <h3 className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 text-sm">?</span>
            Fee waiver
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mb-3">
            Can&apos;t afford the fees? You may qualify for a fee waiver. Form {feeWaiverFormId} is used to request one. USCIS considers income, household size, and certain benefits.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://www.uscis.gov/feewaiver"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] hover:underline"
            >
              Fee waiver info
              <span aria-hidden>→</span>
            </a>
            <a
              href={officialFormsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] hover:underline"
            >
              Official fee schedule
              <span aria-hidden>→</span>
            </a>
          </div>
        </div>

        <p className="text-xs text-[var(--text-secondary)] mb-6">
          Fees may change. Verify amounts on the official forms site before filing.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link href="/resources" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            ← All Resources
          </Link>
          <Link href="/processing-times" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            Processing Times
          </Link>
          <Link href="/status-decoder" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            Status Decoder
          </Link>
          <Link href="/official-links" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            Official Links
          </Link>
          <Link href="/guides" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            Form Guides
          </Link>
        </div>
      </main>
    </div>
  );
}
