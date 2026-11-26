import { animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { allowMotionNow } from "./useAllowMotion";

/** Counts up to a recorded value. The final value is always the rendered text, so readers and tests see it. */
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString(), duration = 0.9 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = shown.current ?? 0;
    shown.current = value;
    if (!allowMotionNow() || from === value) { node.textContent = format(value); return; }
    const controls = animate(from, value, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: (latest) => { node.textContent = format(latest); } });
    return () => { controls.stop(); node.textContent = format(value); };
  }, [value, format, duration]);
  return <span ref={ref} className="animated-number">{format(value)}</span>;
}
