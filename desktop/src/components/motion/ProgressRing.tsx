import { motion } from "framer-motion";
import type { StatusTone } from "../StatusBadge";
import { useAllowMotion } from "./useAllowMotion";

/** A share of a whole (0–100) drawn as a ring; the number beside it carries the value, the ring only its proportion. */
export function ProgressRing({ percent, tone = "neutral", size = 34 }: { percent: number; tone?: StatusTone; size?: number }) {
  const motionOk = useAllowMotion();
  const clamped = Math.max(0, Math.min(100, percent));
  const r = (size - 5) / 2;
  return (
    <svg className="progress-ring" data-tone={tone} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="progress-ring-track" cx={size / 2} cy={size / 2} r={r} />
      <motion.circle className="progress-ring-value" cx={size / 2} cy={size / 2} r={r} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        initial={motionOk ? { pathLength: 0 } : false} animate={{ pathLength: clamped / 100 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        style={motionOk ? undefined : { pathLength: clamped / 100 }} />
    </svg>
  );
}
