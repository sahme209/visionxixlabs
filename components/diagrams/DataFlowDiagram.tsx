"use client";

/**
 * Visio-style data flow: Ingest → Process → Model → Deploy → Monitor.
 * Technical pipeline for production AI systems.
 */
const stages = [
  { id: "ingest", label: "Ingest", sub: "Data sources", x: 60, color: "#0ea5e9" },
  { id: "process", label: "Process", sub: "ETL, validation", x: 180, color: "#8b5cf6" },
  { id: "model", label: "Model", sub: "LLM, RAG, fine-tune", x: 300, color: "#10b981" },
  { id: "deploy", label: "Deploy", sub: "APIs, CI/CD", x: 420, color: "#f59e0b" },
  { id: "monitor", label: "Monitor", sub: "Observability, cost", x: 540, color: "#ef4444" },
];

export function DataFlowDiagram() {
  return (
    <div className="overflow-x-auto py-6">
      <svg
        viewBox="0 0 660 140"
        className="w-full min-w-[540px] text-slate-700 dark:text-slate-300"
        role="img"
        aria-label="Data flow: ingest to monitor"
      >
        <defs>
          <marker id="df-arrow" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
            <polygon points="0 0, 6 2.5, 0 5" fill="currentColor" />
          </marker>
          <filter id="df-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.08" />
          </filter>
        </defs>
        {stages.map((s, i) => (
          <g key={s.id}>
            {i > 0 && (
              <path
                d={`M ${s.x - 48} 70 L ${s.x - 24} 70`}
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                markerEnd="url(#df-arrow)"
                opacity="0.5"
              />
            )}
            <g filter="url(#df-shadow)">
              <rect x={s.x - 48} y="20" width="96" height="100" rx="6" fill="white" stroke={s.color} strokeWidth="2" className="dark:fill-slate-800" />
              <rect x={s.x - 48} y="20" width="96" height="32" rx="4" fill={s.color} />
              <text x={s.x} y="40" textAnchor="middle" className="fill-white font-bold text-sm" fill="white">{s.label}</text>
              <text x={s.x} y="68" textAnchor="middle" className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{s.sub}</text>
              <rect x={s.x - 36} y="82" width="72" height="2" rx="1" fill={s.color} opacity="0.4" />
            </g>
          </g>
        ))}
      </svg>
      <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
        End-to-end data pipeline for production AI—from ingestion to observability.
      </p>
    </div>
  );
}
