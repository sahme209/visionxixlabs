"use client";

/**
 * Visio-style data flow: Ingest → Process → Model → Deploy → Monitor.
 * Balanced card layout matching Solution Architecture, no text overlap.
 */
const stages = [
  { id: "ingest", label: "Ingest", sub: "Data sources", color: "#0ea5e9" },
  { id: "process", label: "Process", sub: "ETL, validation", color: "#8b5cf6" },
  { id: "model", label: "Model", sub: "LLM, RAG, fine-tune", color: "#10b981" },
  { id: "deploy", label: "Deploy", sub: "APIs, CI/CD", color: "#d946ef" },
  { id: "monitor", label: "Monitor", sub: "Observability, cost", color: "#ef4444" },
];

export function DataFlowDiagram() {
  return (
    <div className="py-4">
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4"
        role="img"
        aria-label="Data flow: ingest to monitor"
      >
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="relative flex flex-col min-h-[140px] rounded-xl border-2 overflow-hidden bg-white/[0.02] shadow-sm"
            style={{ borderColor: stage.color }}
          >
            <div
              className="shrink-0 px-4 py-2.5"
              style={{ backgroundColor: stage.color }}
            >
              <h4 className="text-xs font-semibold text-white leading-tight">
                {stage.label}
              </h4>
            </div>
            <p className="flex-1 px-4 py-3 text-xs text-zinc-300 leading-snug break-words">
              {stage.sub}
            </p>
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-zinc-500 mt-4">
        End-to-end data pipeline for production AI—from ingestion to observability.
      </p>
    </div>
  );
}
