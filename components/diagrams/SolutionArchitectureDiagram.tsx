"use client";

/**
 * Technical architecture diagram: Data → AI/ML → Integration → Production.
 * Balanced card layout with no text overlap.
 */
export function SolutionArchitectureDiagram() {
  const layers = [
    {
      id: "data",
      label: "Data & Infrastructure",
      items: ["Cloud (AWS/Azure/GCP)", "Data pipelines", "Security & governance"],
      color: "#0ea5e9",
    },
    {
      id: "ai",
      label: "AI & Models",
      items: ["LLMs & embeddings", "RAG, fine-tuning", "Automation logic"],
      color: "#8b5cf6",
    },
    {
      id: "integration",
      label: "Integration",
      items: ["APIs & webhooks", "Existing systems", "DevOps & CI/CD"],
      color: "#10b981",
    },
    {
      id: "production",
      label: "Production",
      items: ["Monitoring", "Cost controls", "Clear deliverables"],
      color: "#6366f1",
    },
  ];

  return (
    <div className="py-4">
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        role="img"
        aria-label="Solution architecture: data to production"
      >
        {layers.map((layer, i) => (
          <div
            key={layer.id}
            className="relative flex flex-col min-h-[140px] rounded-xl border-2 overflow-hidden bg-white/[0.02] shadow-sm"
            style={{ borderColor: layer.color }}
          >
            <div
              className="shrink-0 px-4 py-2.5"
              style={{ backgroundColor: layer.color }}
            >
              <h4 className="text-xs font-semibold text-white leading-tight">
                {layer.label}
              </h4>
            </div>
            <ul className="flex-1 px-4 py-3 space-y-2 text-xs text-zinc-300">
              {layer.items.map((item) => (
                <li key={item} className="leading-snug break-words">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-zinc-500 mt-4">
        End-to-end delivery: from cloud and data to production AI with observability and cost controls.
      </p>
    </div>
  );
}
