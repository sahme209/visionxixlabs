"use client";

/**
 * Visio-style delivery process: Assessment → Design → Build → Deploy → Operate.
 * How we execute AI and cloud projects.
 */
const steps = [
  { id: "assess", label: "Assess", desc: "Review, scoping", shape: "rect", x: 80 },
  { id: "design", label: "Design", desc: "Architecture", shape: "rect", x: 220 },
  { id: "build", label: "Build", desc: "Implementation", shape: "rect", x: 360 },
  { id: "deploy", label: "Deploy", desc: "CI/CD, release", shape: "rect", x: 500 },
  { id: "operate", label: "Operate", desc: "Run & optimize", shape: "rect", x: 640 },
];

export function DeliveryProcessFlowchart() {
  return (
    <div className="overflow-x-auto py-6">
      <svg
        viewBox="0 0 760 120"
        className="w-full min-w-[620px] text-slate-700 dark:text-slate-300"
        role="img"
        aria-label="Delivery process flowchart"
      >
        <defs>
          <marker id="dp-arrow" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
            <polygon points="0 0, 7 2.5, 0 5" fill="#64748b" />
          </marker>
          <linearGradient id="dp-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        {steps.map((s, i) => (
          <g key={s.id}>
            {i > 0 && (
              <line
                x1={s.x - 66}
                y1="60"
                x2={s.x - 44}
                y2="60"
                stroke="#94a3b8"
                strokeWidth="2"
                markerEnd="url(#dp-arrow)"
              />
            )}
            <rect
              x={s.x - 60}
              y="20"
              width="120"
              height="80"
              rx="8"
              fill="white"
              stroke="#6366f1"
              strokeWidth="2"
              className="dark:fill-slate-800 dark:stroke-indigo-500"
            />
            <rect x={s.x - 60} y="20" width="120" height="28" rx="6" fill="url(#dp-grad)" />
            <text x={s.x} y="38" textAnchor="middle" className="fill-white font-bold text-sm" fill="white">{s.label}</text>
            <text x={s.x} y="68" textAnchor="middle" className="text-xs text-slate-600 dark:text-slate-400">{s.desc}</text>
          </g>
        ))}
      </svg>
      <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
        Phased delivery with clear milestones—assessment to ongoing operations.
      </p>
    </div>
  );
}
