"use client";

/**
 * Visio-style decision flowchart: Where to apply AI.
 * Branches from central decision to key use-case categories.
 */
export function UseCaseDecisionFlow() {
  const center = { x: 360, y: 100 };
  const branches = [
    { label: "Support & CX", x: 100, y: 40, color: "#6366f1" },
    { label: "Automation", x: 100, y: 100, color: "#10b981" },
    { label: "Analytics", x: 100, y: 160, color: "#f59e0b" },
    { label: "Internal AI", x: 620, y: 40, color: "#8b5cf6" },
    { label: "DevOps", x: 620, y: 100, color: "#0ea5e9" },
    { label: "Data Extraction", x: 620, y: 160, color: "#ec4899" },
  ];

  return (
    <div className="overflow-x-auto py-6">
      <svg
        viewBox="0 0 720 220"
        className="w-full min-w-[560px] text-zinc-300"
        role="img"
        aria-label="AI use case decision flowchart"
      >
        <defs>
          <marker id="uc-arrow" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
            <polygon points="0 0, 6 2.5, 0 5" fill="currentColor" />
          </marker>
          <filter id="uc-shadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.1" />
          </filter>
        </defs>
        {/* Connectors - diamond to branches */}
        {branches.map((b) => {
          const isLeft = b.x < center.x;
          const midX = isLeft ? 220 : 500;
          return (
            <path
              key={b.label}
              d={`M ${center.x} ${center.y} L ${midX} ${center.y} L ${midX} ${b.y} L ${b.x} ${b.y}`}
              stroke="#94a3b8"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="4 2"
              opacity="0.7"
            />
          );
        })}
        {/* Center decision diamond */}
        <g filter="url(#uc-shadow)">
          <path
            d={`M ${center.x} ${center.y - 35} L ${center.x + 50} ${center.y} L ${center.x} ${center.y + 35} L ${center.x - 50} ${center.y} Z`}
            fill="#6366f1"
            stroke="#4f46e5"
            strokeWidth="2"
          />
          <text x={center.x} y={center.y - 5} textAnchor="middle" className="fill-white font-bold text-xs" fill="white">Where to</text>
          <text x={center.x} y={center.y + 12} textAnchor="middle" className="fill-white font-bold text-xs" fill="white">apply AI?</text>
        </g>
        {/* Branch boxes */}
        {branches.map((b) => (
          <g key={b.label} filter="url(#uc-shadow)">
            <rect
              x={b.x - 50}
              y={b.y - 22}
              width="100"
              height="44"
              rx="6"
              fill="white"
              stroke={b.color}
              strokeWidth="2"
              className="fill-zinc-800"
            />
            <text x={b.x} y={b.y + 4} textAnchor="middle" className="text-xs font-semibold" fill="currentColor">{b.label}</text>
          </g>
        ))}
      </svg>
      <p className="text-center text-sm text-zinc-500 mt-2">
        Map your priority use case—we scope and deliver against clear outcomes.
      </p>
    </div>
  );
}
