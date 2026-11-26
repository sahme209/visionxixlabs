import { motion } from "framer-motion";
import { useState } from "react";
import { buildReleaseRiskRadar, summarizeRadar, type RadarAxis, type RadarLevel } from "../../../lib/releaseops/releaseRiskRadar";
import type { ReleaseContextSummary } from "../../../lib/tauri/deploymentRequestSummary";
import { StatusIconChip, type StatusShape, type StatusTone } from "./StatusBadge";
import { useAllowMotion } from "./motion/useAllowMotion";

const LOOK: Record<RadarLevel, { tone: StatusTone; shape: StatusShape; label: string }> = {
  covered: { tone: "green", shape: "success", label: "Covered" },
  attention: { tone: "amber", shape: "attention", label: "Needs attention" },
  gap: { tone: "red", shape: "failure", label: "Gap" },
  unknown: { tone: "neutral", shape: "dot", label: "Not recorded" },
};
const SIZE = 300, C = SIZE / 2, R = 86;
const point = (index: number, count: number, radius: number) => {
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
  return [C + Math.cos(angle) * radius, C + Math.sin(angle) * radius] as const;
};

/** Pre-approval coverage from recorded release facts. Not a probability or an approval decision. */
export function ReleaseRiskRadar({ context, now }: { context: ReleaseContextSummary; now?: Date }) {
  const axes = buildReleaseRiskRadar(context, now);
  const counts = summarizeRadar(axes);
  const motionOk = useAllowMotion();
  const [active, setActive] = useState<RadarAxis["id"] | null>(null);
  const n = axes.length;
  const shape = axes.map((a, i) => point(i, n, R * Math.max(0.08, a.coverage)).map((v) => v.toFixed(1)).join(",")).join(" ");
  return (
    <section className="release-risk-radar" aria-labelledby="release-risk-radar-title">
      <header>
        <h3 id="release-risk-radar-title">Release risk radar</h3>
        <p>Coverage from this version’s recorded facts. Not a prediction or an approval.</p>
        <p className="release-risk-radar-counts">{(["covered", "attention", "gap", "unknown"] as const).filter((l) => counts[l]).map((l) =>
          <span key={l} data-tone={LOOK[l].tone}>{counts[l]} {LOOK[l].label.toLowerCase()}</span>)}</p>
      </header>
      <div className="release-risk-radar-body">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden="true">
          {[0.25, 0.5, 0.75, 1].map((ring) => <polygon key={ring} className="release-risk-radar-ring"
            points={axes.map((_, i) => point(i, n, R * ring).join(",")).join(" ")} />)}
          {axes.map((a, i) => { const [x, y] = point(i, n, R); return <line key={a.id} className="release-risk-radar-spoke" data-active={active === a.id || undefined} x1={C} y1={C} x2={x} y2={y} />; })}
          <motion.polygon className="release-risk-radar-shape" points={shape}
            initial={motionOk ? { opacity: 0, scale: 0.6 } : false} animate={{ opacity: 1, scale: 1 }} style={{ transformOrigin: `${C}px ${C}px` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
          {axes.map((a, i) => { const [x, y] = point(i, n, R * Math.max(0.08, a.coverage)); return <circle key={a.id} className="release-risk-radar-vertex" data-tone={LOOK[a.level].tone} data-active={active === a.id || undefined} cx={x} cy={y} r={active === a.id ? 5 : 3.5} />; })}
          {axes.map((a, i) => { const [x, y] = point(i, n, R + 16); return <text key={a.id} className="release-risk-radar-label" data-active={active === a.id || undefined}
            x={x} y={y} textAnchor={Math.abs(x - C) < 8 ? "middle" : x < C ? "end" : "start"} dominantBaseline="middle">{a.label}</text>; })}
        </svg>
        <ul aria-label="Radar axes">{axes.map((a) => <li key={a.id} data-level={a.level} data-active={active === a.id || undefined}
          tabIndex={0} onPointerEnter={() => setActive(a.id)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(a.id)} onBlur={() => setActive(null)}>
          <StatusIconChip tone={LOOK[a.level].tone} shape={LOOK[a.level].shape} size={12} />
          <span className="release-risk-radar-axis">{a.label}<span className="sr-only">: {LOOK[a.level].label}.</span></span>
          <span className="release-risk-radar-detail">{a.detail}</span>
        </li>)}</ul>
      </div>
    </section>
  );
}
