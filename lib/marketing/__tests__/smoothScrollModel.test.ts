import { expect, it } from "vitest";
import { clampScroll, smoothScrollAllowed, stepToward, wheelPixels } from "../smoothScrollModel";
it("eases toward the target and settles exactly", () => {
  let c = 0, frames = 0, done = false;
  while (!done && frames < 200) { ({ next: c, done } = stepToward(c, 400)); frames++; }
  expect(c).toBe(400);
  expect(frames).toBeGreaterThan(20);
  expect(frames).toBeLessThan(120);
});
it("converts wheel modes to pixels and clamps to the page", () => {
  expect(wheelPixels(3, 1, 800)).toBe(48);
  expect(wheelPixels(1, 2, 800)).toBe(800);
  expect(wheelPixels(120, 0, 800)).toBe(120);
  expect(clampScroll(-10, 500)).toBe(0);
  expect(clampScroll(900, 500)).toBe(500);
});
it("stays off for reduced motion and touch", () => {
  expect(smoothScrollAllowed({ reducedMotion: true, finePointer: true })).toBe(false);
  expect(smoothScrollAllowed({ reducedMotion: false, finePointer: false })).toBe(false);
  expect(smoothScrollAllowed({ reducedMotion: false, finePointer: true })).toBe(true);
});
