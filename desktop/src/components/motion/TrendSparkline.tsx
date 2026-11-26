import { motion } from "framer-motion";
import { useId, useState, type KeyboardEvent } from "react";
import { useAllowMotion } from "./useAllowMotion";

const W = 240;
const H = 40;
const PAD = 3;

/** Day label for bucket `index` of `count` daily UTC buckets ending today. */
export function bucketDate(index: number, count: number, now = new Date()): Date {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(end - (count - 1 - index) * 86_400_000);
}

/**
 * Single-series daily trend: area, line, end marker, and a crosshair readout on hover or arrow keys.
 * The title outside names the series, so there is no legend.
 */
export function TrendSparkline({ values, unit, label, now }: { values: readonly number[]; unit: [string, string]; label: string; now?: Date }) {
  const id = useId();
  const motionOk = useAllowMotion();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? (W - PAD * 2) / (values.length - 1) : 0;
  const point = (value: number, index: number) => [PAD + index * step, H - PAD - (value / max) * (H - PAD * 2 - 4)] as const;
  const coords = values.map(point);
  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1][0].toFixed(2)} ${H - PAD} L${PAD} ${H - PAD} Z`;
  const shown = active ?? values.length - 1;
  const [cx, cy] = coords[shown];
  const day = bucketDate(shown, values.length, now).toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });
  const readout = `${day}: ${values[shown]} ${values[shown] === 1 ? unit[0] : unit[1]}`;

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const last = values.length - 1;
    const next = event.key === "ArrowLeft" ? Math.max(0, shown - 1) : event.key === "ArrowRight" ? Math.min(last, shown + 1)
      : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  }

  return (
    <div className="trend-sparkline" tabIndex={0} role="img" aria-label={`${label}. ${readout}. Use arrow keys to read each day.`}
      onKeyDown={onKey} onBlur={() => setActive(null)} onPointerLeave={() => setActive(null)}
      onPointerMove={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        if (!box.width) return;
        const x = ((event.clientX - box.left) / box.width) * W;
        setActive(Math.max(0, Math.min(values.length - 1, Math.round((x - PAD) / (step || 1)))));
      }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path d={area} fill={`url(#${id}-fill)`} initial={motionOk ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.35 }} />
        <motion.path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
          initial={motionOk ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
        {active !== null && <line className="trend-sparkline-crosshair" x1={cx} x2={cx} y1={PAD} y2={H - PAD} />}
        <circle className="trend-sparkline-dot" cx={cx} cy={cy} r="4" />
      </svg>
      {active !== null && <span className="trend-sparkline-readout" style={{ left: `${(cx / W) * 100}%` }} aria-hidden="true">{readout}</span>}
    </div>
  );
}
