export const motionDurations = {
  xShort: 0.15,
  short: 0.25,
  medium: 0.4,
  long: 0.6,
} as const;

export const motionEasings = {
  standard: [0.21, 0.47, 0.32, 0.98] as [number, number, number, number],
  emphasized: [0.16, 1, 0.3, 1] as [number, number, number, number],
} as const;

export const motionViewport = {
  once: true,
  amount: 0.2,
} as const;

export const motionConfig = {
  duration: motionDurations.medium,
  ease: motionEasings.standard,
};

export const prefersReducedMotionQuery = "(prefers-reduced-motion: reduce)";

