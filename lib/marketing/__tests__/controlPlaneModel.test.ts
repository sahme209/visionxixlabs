import { describe, expect, it } from "vitest";
import { CONTROL_PLANE_DEFAULT_LAYER, CONTROL_PLANE_LAYERS, clampLayer, layerNumber, pulseLayer } from "../controlPlaneModel";

describe("control-plane model", () => {
  it("has five layers in request order, each with a title and three titled parts", () => {
    expect(CONTROL_PLANE_LAYERS.map((l) => l.id)).toEqual(["interfaces", "identity_policy", "governance_core", "intelligence", "execution_evidence"]);
    for (const l of CONTROL_PLANE_LAYERS) {
      expect(l.title.length).toBeGreaterThan(0);
      expect(l.parts).toHaveLength(3);
      for (const p of l.parts) { expect(p.title.length).toBeGreaterThan(0); expect(p.detail.length).toBeGreaterThan(0); }
      expect(l.guarantee.length).toBeGreaterThan(0);
      expect(l.onFailure.length).toBeGreaterThan(0);
    }
  });

  it("keeps titles short enough to stay readable on the 3D layers", () => {
    for (const l of CONTROL_PLANE_LAYERS) {
      expect(l.title.length).toBeLessThanOrEqual(24);
      for (const p of l.parts) expect(p.title.length).toBeLessThanOrEqual(20);
    }
  });

  it("states the governance and prepaid rules honestly", () => {
    const core = CONTROL_PLANE_LAYERS.find((l) => l.id === "governance_core")!;
    expect(core.guarantee).toMatch(/no one approves their own request/);
    const ai = CONTROL_PLANE_LAYERS.find((l) => l.id === "intelligence")!;
    expect(ai.guarantee).toMatch(/never charged beyond prepaid/);
  });

  it("numbers, clamps and tracks the pulse safely", () => {
    expect(layerNumber(0)).toBe("01");
    expect(clampLayer(-3)).toBe(0);
    expect(clampLayer(99)).toBe(4);
    expect(clampLayer(Number.NaN)).toBe(CONTROL_PLANE_DEFAULT_LAYER);
    expect(pulseLayer(0)).toBe(0);
    expect(pulseLayer(0.5)).toBe(2);
    expect(pulseLayer(1)).toBe(4);
    expect(pulseLayer(2)).toBe(4);
  });
});
