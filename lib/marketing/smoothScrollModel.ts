/** Pure pieces of the public-site smooth scroll (same feel as the Lenis scroll in Framer's Exact template). */
export const SMOOTH_LERP = 0.1;
const LINE_PX = 16;

/** Wheel delta in pixels, honouring line and page delta modes. */
export function wheelPixels(deltaY: number, deltaMode: number, pageHeight: number): number {
  if (deltaMode === 1) return deltaY * LINE_PX;
  if (deltaMode === 2) return deltaY * pageHeight;
  return deltaY;
}

/** One animation frame: move `current` toward `target`, snapping when close so it settles. */
export function stepToward(current: number, target: number, lerp = SMOOTH_LERP): { next: number; done: boolean } {
  const gap = target - current;
  if (Math.abs(gap) < 0.5) return { next: target, done: true };
  return { next: current + gap * lerp, done: false };
}

export function clampScroll(value: number, max: number): number {
  return Math.max(0, Math.min(max, value));
}

/** Smooth scrolling only for a fine pointer that can hover, without reduced motion. */
export function smoothScrollAllowed(env: { reducedMotion: boolean; finePointer: boolean }): boolean {
  return !env.reducedMotion && env.finePointer;
}
