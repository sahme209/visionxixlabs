"use client";

/**
 * Technical architecture diagram: Data → AI/ML → Integration → Production.
 * Shows our delivery stack in a clean, enterprise-style flowchart.
 */
export function SolutionArchitectureDiagram() {
  const layers = [
    {
      id: "data",
      label: "Data & Infrastructure",
      items: ["Cloud (AWS/Azure/GCP)", "Data pipelines", "Security & governance"],
      x: 80,
      color: "#0ea5e9",
    },
    {
      id: "ai",
      label: "AI & Models",
      items: ["LLMs & embeddings", "RAG, fine-tuning", "Automation logic"],
      x: 240,
      color: "#8b5cf6",
    },
    {
      id: "integration",
      label: "Integration",
      items: ["APIs & webhooks", "Existing systems", "DevOps & CI/CD"],
      x: 400,
      color: "#10b981",
    },
    {
      id: "production",
      label: "Production",
      items: ["Monitoring", "Cost controls", "Clear deliverables"],
      x: 560,
      color: "#6366f1",
    },
  ];

  return (
    <div className="overflow-x-auto py-6">
      <svg
        viewBox="0 0 720 180"
        className="w-full min-w-[600px] text-slate-700 dark:text-slate-300"
        role="img"
        aria-label="Solution architecture: data to production"
      >
        <defs>
          <marker
            id="arch-arrow"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="currentColor" className="text-slate-400 dark:text-slate-500" />
          </marker>
        </defs>
        {layers.map((layer, i) => (
          <g key={layer.id}>
            {i > 0 && (
              <line
                x1={layer.x - 55}
                y1="90"
                x2={layer.x - 25}
                y2="90"
                stroke="currentColor"
                strokeWidth="1.5"
                markerEnd="url(#arch-arrow)"
                opacity="0.6"
              />
            )}
            <rect
              x={layer.x - 75}
              y="20"
              width="150"
              height="140"
              rx="10"
              fill="white"
              className="dark:fill-slate-800"
              stroke={layer.color}
              strokeWidth="2"
            />
            <rect
              x={layer.x - 75}
              y="20"
              width="150"
              height="36"
              rx="8"
              fill={layer.color}
            />
            <text
              x={layer.x}
              y="42"
              textAnchor="middle"
              className="fill-white font-semibold text-xs"
              fill="white"
            >
              {layer.label}
            </text>
            {layer.items.map((item, j) => (
              <text
                key={item}
                x={layer.x}
                y={72 + j * 22}
                textAnchor="middle"
                className="text-[11px]"
                fill="currentColor"
              >
                {item}
              </text>
            ))}
          </g>
        ))}
      </svg>
      <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
        End-to-end delivery: from cloud and data to production AI with observability and cost controls.
      </p>
    </div>
  );
}
