"use client";

/**
 * Matrix/quadrant diagram: Sectors × AI needs.
 * Technical visual for where AI delivers value by industry.
 */
const sectors = [
  { sector: "Digital services", x: 20, y: 40, color: "#6366f1" },
  { sector: "Agriculture", x: 270, y: 40, color: "#22c55e" },
  { sector: "Trade & logistics", x: 20, y: 155, color: "#f59e0b" },
  { sector: "Manufacturing", x: 270, y: 155, color: "#ec4899" },
];

const needsBySector: Record<string, string[]> = {
  "Digital services": ["Customer support", "Sales enablement", "Internal AI"],
  Agriculture: ["Precision farming", "Pest detection", "Smart irrigation"],
  "Trade & logistics": ["Language/regulatory", "Demand forecasting", "Inventory"],
  Manufacturing: ["Process automation", "Quality control", "Supply chain"],
};

export function SectorMatrixDiagram() {
  return (
    <div className="overflow-x-auto py-6">
      <svg
        viewBox="0 0 520 280"
        className="w-full min-w-[400px] text-slate-700 dark:text-slate-300"
        role="img"
        aria-label="Sector matrix: AI needs by industry"
      >
        <defs>
          <filter id="card-shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.15" />
          </filter>
        </defs>
        {/* Grid lines */}
        <line x1="260" y1="0" x2="260" y2="280" stroke="currentColor" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="4 4" />
        <line x1="0" y1="140" x2="520" y2="140" stroke="currentColor" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="4 4" />
        {/* Quadrant labels */}
        <text x="130" y="20" textAnchor="middle" className="text-xs font-semibold uppercase tracking-wide" fill="currentColor">
          B2B / Services
        </text>
        <text x="390" y="20" textAnchor="middle" className="text-xs font-semibold uppercase tracking-wide" fill="currentColor">
          Physical / Operations
        </text>
        <text x="20" y="70" textAnchor="middle" transform="rotate(-90, 20, 70)" className="text-xs font-semibold uppercase tracking-wide" fill="currentColor">
          High automation
        </text>
        <text x="20" y="210" textAnchor="middle" transform="rotate(-90, 20, 210)" className="text-xs font-semibold uppercase tracking-wide" fill="currentColor">
          Domain-specific
        </text>
        {sectors.map(({ sector, x, y, color }) => {
          const cx = x;
          const cy = y;
          const needs = needsBySector[sector] ?? [];
          return (
            <g key={sector} filter="url(#card-shadow)">
              <rect
                x={cx}
                y={cy}
                width={200}
                height={110}
                rx="10"
                fill="white"
                className="dark:fill-slate-800"
                stroke={color}
                strokeWidth="2"
              />
              <rect x={cx} y={cy} width="200" height="28" rx="8" fill={color} />
              <text x={cx + 100} y={cy + 18} textAnchor="middle" className="fill-white font-semibold text-sm" fill="white">
                {sector}
              </text>
              {needs.map((need, i) => (
                <text
                  key={need}
                  x={cx + 100}
                  y={cy + 48 + i * 18}
                  textAnchor="middle"
                  className="text-xs"
                  fill="currentColor"
                >
                  • {need}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
      <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
        AI use cases map differently by sector—we tailor solutions to your industry and workflows.
      </p>
    </div>
  );
}
