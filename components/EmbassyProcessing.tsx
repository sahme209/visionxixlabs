"use client";

import Link from "next/link";

interface EmbassyStage {
  id: string;
  name: string;
  status: "completed" | "current" | "upcoming";
  date?: string;
}

interface EmbassyProcessingProps {
  stages?: EmbassyStage[];
}

const defaultStages: EmbassyStage[] = [
  {
    id: "dq",
    name: "Documentarily Qualified (DQ)",
    status: "completed",
  },
  {
    id: "interview-scheduled",
    name: "Interview Scheduled",
    status: "current",
  },
  {
    id: "interview",
    name: "Embassy Interview",
    status: "upcoming",
  },
  {
    id: "visa-issued",
    name: "Visa Issued",
    status: "upcoming",
  },
];

export default function EmbassyProcessing({ stages = defaultStages }: EmbassyProcessingProps) {
  const displayStages = stages.length > 0 ? stages : defaultStages;

  return (
    <div className="uscis-card">
      <div className="uscis-card-header flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Embassy Processing</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Final steps at your local embassy/consulate
          </p>
        </div>
        <div className="text-xs bg-[var(--bg-surface-alt)] text-purple-800 dark:text-purple-300 px-2 py-1 rounded">
          Premium
        </div>
      </div>
      <div className="p-6">
        <div className="space-y-3">
          {displayStages.map((stage, index) => {
            const isCompleted = stage.status === "completed";
            const isCurrent = stage.status === "current";
            const isUpcoming = stage.status === "upcoming";

            return (
              <div key={stage.id} className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {isCompleted ? (
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  ) : isCurrent ? (
                    <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center animate-pulse">
                      <div className="w-3 h-3 bg-white rounded-full"></div>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                      <div className="w-3 h-3 bg-white dark:bg-gray-800 rounded-full"></div>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium ${
                      isCompleted || isCurrent
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {stage.name}
                  </p>
                  {stage.date && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {new Date(stage.date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <Link
          href="/timeline"
          className="block text-center mt-6 uscis-link text-sm font-semibold"
        >
          View Full Embassy Timeline →
        </Link>
      </div>
    </div>
  );
}

