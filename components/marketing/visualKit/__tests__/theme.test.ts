import { describe, expect, it } from "vitest";
import { FRAME_GUARD_START, V4, frameGuardStep, indexLabel, type FrameGuardState } from "../theme";

function run(frames: number[]): boolean {
  let s: FrameGuardState = FRAME_GUARD_START;
  for (const f of frames) { const r = frameGuardStep(s, f); s = r.state; if (r.tooSlow) return true; }
  return false;
}

describe("v4 calm visual kit", () => {
  it("keeps the calm rules: regular-weight type, soft text, low bloom, slow pulse", () => {
    expect(V4.font.sans.startsWith("400 ")).toBe(true);
    expect(V4.font.mono.startsWith("400 ")).toBe(true);
    expect(V4.font.sans).toMatch(/Inter/);
    expect(V4.text.title.toLowerCase()).not.toBe("#ffffff");
    expect(V4.bloom.strength).toBeLessThanOrEqual(0.6);
    expect(1 / V4.motion.pulsePerSecond).toBeGreaterThanOrEqual(8);
  });

  it("numbers elements from 01", () => {
    expect(indexLabel(0)).toBe("01");
    expect(indexLabel(9)).toBe("10");
  });

  it("keeps a smooth 60 fps scene", () => {
    expect(run(Array(120).fill(1 / 60))).toBe(false);
  });

  it("ignores a slow first frame during warm-up", () => {
    expect(run([0.8, ...Array(60).fill(1 / 60)])).toBe(false);
  });

  it("hands back to 2D on a long stall after warm-up", () => {
    expect(run([...Array(70).fill(1 / 60), 0.5])).toBe(true);
  });

  it("hands back to 2D when frames stay over budget", () => {
    expect(run([...Array(61).fill(1 / 60), ...Array(30).fill(0.09)])).toBe(true);
  });
});
