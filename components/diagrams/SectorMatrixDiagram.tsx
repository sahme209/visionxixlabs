"use client";

/**
 * Visio-style quadrant matrix: Sectors × AI needs.
 * X-axis: B2B/Services ↔ Physical/Operations
 * Y-axis: High automation ↔ Domain-specific
 */
const sectors = [
  { sector: "Digital services", x: 35, y: 45, color: "#4f46e5", needs: ["Customer support", "Sales enablement", "Internal AI"] },
  { sector: "Agriculture", x: 345, y: 45, color: "#059669", needs: ["Precision farming", "Pest detection", "Smart irrigation"] },
  { sector: "Trade & logistics", x: 35, y: 180, color: "#d97706", needs: ["Language/regulatory", "Demand forecasting", "Inventory"] },
  { sector: "Manufacturing", x: 345, y: 180, color: "#db2777", needs: ["Process automation", "Quality control", "Supply chain"] },
];

export function SectorMatrixDiagram() {
  return (
    <div className="overflow-x-auto py-6">
      <svg
        viewBox="0 0 620 320"
        className="w-full min-w-[480px] text-slate-700 dark:text-slate-300"
        role="img"
        aria-label="Sector matrix: AI needs by industry"
      >
        <defs>
          <filter id="sector-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.12" />
          </filter>
          <marker id="axis-arrow" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="currentColor" />
          </marker>
        </defs>

        {/* Background grid */}
        <rect x="0" y="0" width="620" height="320" fill="none" stroke="none" />
        <line x1="20" y1="160" x2="600" y2="160" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="6 4" />
        <line x1="310" y1="30" x2="310" y2="290" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="6 4" />

        {/* X-axis - horizontal */}
        <line x1="20" y1="260" x2="600" y2="260" stroke="currentColor" strokeWidth="1.5" markerEnd="url(#axis-arrow)" />
        <rect x="90" y="268" width="120" height="24" rx="4" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" className="dark:fill-slate-800 dark:stroke-slate-600" />
        <text x="150" y="284" textAnchor="middle" className="text-[11px] font-semibold uppercase" fill="currentColor">B2B / Services</text>
        <rect x="410" y="268" width="140" height="24" rx="4" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" className="dark:fill-slate-800 dark:stroke-slate-600" />
        <text x="480" y="284" textAnchor="middle" className="text-[11px] font-semibold uppercase" fill="currentColor">Physical / Operations</text>

        {/* Y-axis - vertical, arrow at top */}
        <line x1="50" y1="290" x2="50" y2="30" stroke="currentColor" strokeWidth="1.5" markerEnd="url(#axis-arrow)" />
        <rect x="2" y="85" width="36" height="60" rx="4" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" className="dark:fill-slate-800 dark:stroke-slate-600" />
        <text x="20" y="115" textAnchor="middle" transform="rotate(-90, 20, 115)" className="text-[10px] font-semibold uppercase" fill="currentColor">High automation</text>
        <rect x="2" y="195" width="36" height="70" rx="4" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" className="dark:fill-slate-800 dark:stroke-slate-600" />
        <text x="20" y="230" textAnchor="middle" transform="rotate(-90, 20, 230)" className="text-[10px] font-semibold uppercase" fill="currentColor">Domain-specific</text>

        {/* Quadrant labels - small annotation boxes */}
        <text x="165" y="20" textAnchor="middle" className="text-[9px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">Q1</text>
        <text x="465" y="20" textAnchor="middle" className="text-[9px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">Q2</text>
        <text x="165" y="310" textAnchor="middle" className="text-[9px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">Q3</text>
        <text x="465" y="310" textAnchor="middle" className="text-[9px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">Q4</text>

        {/* Sector cards - Visio-style process shapes */}
        {sectors.map(({ sector, x, y, color, needs }) => (
          <g key={sector} filter="url(#sector-shadow)">
            <rect
              x={x}
              y={y}
              width={240}
              height={105}
              rx="6"
              fill="white"
              stroke={color}
              strokeWidth="2"
              className="dark:fill-slate-800"
            />
            <rect x={x} y={y} width={240} height={30} rx="4" fill={color} />
            <rect x={x} y={y + 18} width={240} height={12} fill={color} />
            <text x={x + 120} y={y + 20} textAnchor="middle" className="fill-white font-semibold text-[13px]" fill="white">
              {sector}
            </text>
            {needs.map((need, i) => (
              <g key={need}>
                <rect x={x + 12} y={y + 42 + i * 18} width="6" height="6" rx="1" fill={color} opacity="0.7" />
                <text x={x + 24} y={y + 48 + i * 18} className="text-[11px]" fill="currentColor">
                  {need}
                </text>
              </g>
            ))}
          </g>
        ))}
      </svg>
      <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
        AI use cases map differently by sector—we tailor solutions to your industry and workflows.
      </p>
    </div>
  );
}
