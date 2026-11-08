/**
 * Visual language v4 (calm): the single set of tokens every marketing model uses.
 * Pure data, no three.js import, so it is cheap to test and safe to read in 2D fallbacks.
 * Rules (user, 2026-11-08): readable technical type that never strains the eyes, a title on
 * every element, calm motion, one accent colour, premium and futuristic but not flashy.
 */
export const V4 = {
  color: {
    void: 0x03050a,
    floor: 0x05080e,
    gridMajor: 0x132235,
    gridMinor: 0x0c1622,
    glass: 0x9cc6ec,
    glassEmissive: 0x1d4f7c,
    /** The one accent. */
    accent: 0x7cc4f5,
    passed: 0x8fe3c6,
    warning: 0xf2c27b,
    blocked: 0xf08a95,
    selected: 0xf2f6fb,
    partEdge: 0xa9bdd6,
  },
  /** Label colours are soft off-white and slate: never pure white on black. */
  text: { title: "#dde6f0", prefix: "#7f93ab" },
  font: {
    /** Regular weight only: thin weights strain the eyes on dark backgrounds. */
    sans: '400 52px Inter, "SF Pro Text", -apple-system, system-ui, sans-serif',
    /** Monospace is reserved for short numbers and codes. */
    mono: '400 40px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  /** Low bloom: luminous edges without halos. */
  bloom: { strength: 0.55, radius: 0.45, threshold: 0.4 },
  exposure: 0.85,
  environmentIntensity: 0.3,
  fogDensity: 0.03,
  glass: { opacity: 0.14, roughness: 0.2, emissiveIntensity: 0.35 },
  motion: {
    /** One full pulse pass takes about 9 s; nothing in the kit moves faster. */
    pulsePerSecond: 0.11,
    /** Layout easing per second (layers settling, explode/assemble). */
    settlePerSecond: 3,
  },
  frameGuard: {
    /** Any frame over this after warm-up hands back to 2D. */
    maxFrameSeconds: 0.4,
    /** Or a 10-frame sample averaging over this. */
    maxAverageSeconds: 0.06,
    sampleFrames: 10,
    warmupSeconds: 1,
  },
} as const;

/** Two-digit index label shared by every model, e.g. 0 → "01". */
export function indexLabel(index: number): string {
  return String(index + 1).padStart(2, "0");
}

/**
 * Frame-budget decision, kept pure so it is tested once for every model.
 * Returns the next guard state and whether the scene must hand back to 2D.
 */
export type FrameGuardState = { readonly elapsed: number; readonly sampled: number; readonly slow: number };
export const FRAME_GUARD_START: FrameGuardState = { elapsed: 0, sampled: 0, slow: 0 };
export function frameGuardStep(state: FrameGuardState, rawSeconds: number): { state: FrameGuardState; tooSlow: boolean } {
  const g = V4.frameGuard;
  const elapsed = state.elapsed + rawSeconds;
  if (rawSeconds > g.maxFrameSeconds && state.sampled > 2) return { state: { ...state, elapsed }, tooSlow: true };
  if (elapsed > g.warmupSeconds) {
    const sampled = state.sampled + 1, slow = state.slow + rawSeconds;
    return { state: { elapsed, sampled, slow }, tooSlow: sampled >= g.sampleFrames && slow / sampled > g.maxAverageSeconds };
  }
  return { state: { elapsed, sampled: state.sampled < 2 ? state.sampled + 1 : state.sampled, slow: state.slow }, tooSlow: false };
}
