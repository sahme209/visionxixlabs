"use client";

import React from "react";

interface TimelinePhase {
  label: string;
  dateRange: string;
  description: string;
}

interface LawsuitTimelineRow {
  name: string;
  subtitle: string;
  color: "red" | "yellow";
  phases: TimelinePhase[];
}

const LAWSUIT_TIMELINE: LawsuitTimelineRow[] = [
  {
    name: "Red Eagle: Storie v. Trump",
    subtitle: "Emergency challenge filed in D.C.",
    color: "red",
    phases: [
      {
        label: "Complaint filed",
        dateRange: "Feb 19",
        description: "Case formally opened in federal court.",
      },
      {
        label: "Judge assigned + summons",
        dateRange: "Feb 21 – Feb 27",
        description: "Judge, summons, and basic case logistics completed.",
      },
      {
        label: "Motion for preliminary injunction",
        dateRange: "Feb 27 – Mar 6",
        description: "Plaintiffs ask the court to freeze the policy while the case proceeds.",
      },
      {
        label: "Briefing schedule + opposition",
        dateRange: "Mar 6 – Apr 10",
        description: "Court sets a schedule; government files its opposition.",
      },
      {
        label: "Reply + hearing (if scheduled)",
        dateRange: "Apr 10 – Apr 24",
        description: "Plaintiffs reply and the court may hold an oral argument.",
      },
      {
        label: "Decision + PI window",
        dateRange: "Apr 24 – Jun 24",
        description: "Judge issues a decision; if PI is granted, a window opens where the pause could be blocked.",
      },
    ],
  },
  {
    name: "CLINIC v. Rubio",
    subtitle: "Nationwide challenge for affected families",
    color: "yellow",
    phases: [
      {
        label: "Complaint filed",
        dateRange: "Feb 2",
        description: "Lead class action filed on behalf of families and organizations.",
      },
      {
        label: "Judge assigned + summons complete",
        dateRange: "Feb 4 – Feb 23",
        description: "Judge assignment and service of the complaint.",
      },
      {
        label: "Pre‑trial conference + PI motion",
        dateRange: "Mar 24 – Apr 14",
        description: "Conference with the court followed by a motion for preliminary injunction.",
      },
      {
        label: "Government opposition",
        dateRange: "Apr 15 – May 15",
        description: "Government files its response opposing emergency relief.",
      },
      {
        label: "Reply, hearing, and decision",
        dateRange: "May 18 – Jun 30",
        description: "Plaintiffs reply; court may schedule a hearing and then issue a decision.",
      },
      {
        label: "PI window",
        dateRange: "Jul 1 – Jul 31 (est.)",
        description: "If the court grants a PI, the visa pause could be halted during this period.",
      },
    ],
  },
];

export default function LawsuitTimeline() {
  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[var(--border-color)] bg-[var(--bg-surface-alt)]">
        <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
          Possible timeline for current lawsuits
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)]">
          Approximate schedule for emergency lawsuits challenging the visa pause. Exact dates depend on the
          court&apos;s calendar and how quickly motions are filed.
        </p>
      </div>

      <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-6">
        {LAWSUIT_TIMELINE.map((row) => (
          <section key={row.name} className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-semibold text-white ${
                  row.color === "red"
                    ? "bg-red-600"
                    : "bg-amber-500"
                }`}
              >
                {row.name.split(" ")[0].slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">
                  {row.name}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">{row.subtitle}</p>
              </div>
            </div>

            <ol className="relative border-l border-[var(--border-color)] pl-4 space-y-3 sm:space-y-4">
              {row.phases.map((phase, idx) => (
                <li key={phase.label} className="relative pl-2">
                  <span
                    className={`absolute -left-2 top-1.5 h-3 w-3 rounded-full border-2 ${
                      row.color === "red" ? "bg-red-600 border-red-300" : "bg-amber-500 border-amber-200"
                    }`}
                  />
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="text-[11px] sm:text-xs font-semibold text-[var(--text-primary)]">
                      {phase.label}
                    </p>
                    <p className="text-[10px] sm:text-xs font-mono text-[var(--text-tertiary)]">
                      {phase.dateRange}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[11px] sm:text-xs text-[var(--text-secondary)] leading-relaxed">
                    {phase.description}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        ))}

        <p className="text-[10px] sm:text-xs text-[var(--text-tertiary)]">
          Timelines are estimates based on typical federal civil procedure. Courts can move faster or slower,
          and emergency motions may change the schedule.
        </p>
      </div>
    </div>
  );
}

