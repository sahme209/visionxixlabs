"use client";

/**
 * Technical flowchart: AI adoption journey from pilots to production.
 * Shows the common gap (many stop at pilots) and the path to value.
 */
export function AIAdoptionFlowDiagram() {
  return (
    <div className="overflow-x-auto py-6">
      <svg
        viewBox="0 0 720 200"
        className="w-full min-w-[600px] text-zinc-300"
        role="img"
        aria-label="AI adoption flow from pilots to production"
      >
        <defs>
          <linearGradient id="flow-start" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
          <linearGradient id="flow-gap" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id="flow-end" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="currentColor" className="text-zinc-500" />
          </marker>
        </defs>
        {/* Stage boxes */}
        <g>
          <rect
            x="20"
            y="60"
            width="100"
            height="80"
            rx="8"
            fill="url(#flow-start)"
            className="opacity-90"
          />
          <text x="70" y="98" textAnchor="middle" className="fill-white font-semibold text-sm" fill="white">
            Intent
          </text>
          <text x="70" y="118" textAnchor="middle" className="fill-white/90 text-xs" fill="rgba(255,255,255,0.9)">
            Strategy
          </text>
        </g>
        <line
          x1="120"
          y1="100"
          x2="175"
          y2="100"
          stroke="currentColor"
          strokeWidth="1.5"
          markerEnd="url(#arrowhead)"
        />
        <g>
          <rect
            x="185"
            y="60"
            width="110"
            height="80"
            rx="8"
            fill="url(#flow-start)"
            className="opacity-90"
          />
          <text x="240" y="98" textAnchor="middle" className="fill-white font-semibold text-sm" fill="white">
            Pilots
          </text>
          <text x="240" y="118" textAnchor="middle" className="fill-white/90 text-xs" fill="rgba(255,255,255,0.9)">
            POCs, demos
          </text>
        </g>
        {/* Gap indicator */}
        <line
          x1="295"
          y1="100"
          x2="345"
          y2="100"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="6 4"
          markerEnd="url(#arrowhead)"
        />
        <rect x="325" y="75" width="80" height="50" rx="6" fill="rgb(254 249 195)" className="fill-amber-900/40" stroke="rgb(245 158 11)" strokeWidth="1" />
        <text x="365" y="102" textAnchor="middle" className="text-xs font-semibold" fill="rgb(146 64 14)">
          GAP
        </text>
        <text x="365" y="116" textAnchor="middle" className="text-[10px]" fill="rgb(146 64 14)">
          Many stop here
        </text>
        <line
          x1="405"
          y1="100"
          x2="455"
          y2="100"
          stroke="currentColor"
          strokeWidth="1.5"
          markerEnd="url(#arrowhead)"
        />
        <g>
          <rect
            x="465"
            y="60"
            width="110"
            height="80"
            rx="8"
            fill="url(#flow-end)"
            className="opacity-90"
          />
          <text x="520" y="98" textAnchor="middle" className="fill-white font-semibold text-sm" fill="white">
            Integration
          </text>
          <text x="520" y="118" textAnchor="middle" className="fill-white/90 text-xs" fill="rgba(255,255,255,0.9)">
            Workflows, APIs
          </text>
        </g>
        <line
          x1="575"
          y1="100"
          x2="625"
          y2="100"
          stroke="currentColor"
          strokeWidth="1.5"
          markerEnd="url(#arrowhead)"
        />
        <g>
          <rect
            x="635"
            y="60"
            width="85"
            height="80"
            rx="8"
            fill="url(#flow-end)"
            className="opacity-90"
          />
          <text x="677" y="98" textAnchor="middle" className="fill-white font-semibold text-sm" fill="white">
            Production
          </text>
          <text x="677" y="118" textAnchor="middle" className="fill-white/90 text-xs" fill="rgba(255,255,255,0.9)">
            Value
          </text>
        </g>
      </svg>
      <p className="text-center text-sm text-zinc-500 mt-2">
        Most companies stall at pilots—we help you cross the gap to integration and production.
      </p>
    </div>
  );
}
