/**
 * Vitest unit tests for the operating loop model helpers.
 *
 * Verifies the canonical 16-stage list and the status / source-mode rollups.
 */

import { describe, it, expect } from "vitest";
import {
  CANONICAL_STAGES,
  STAGE_LABELS,
  isHaltingStatus,
  isPassingStatus,
  rollupSourceMode,
} from "../operatingLoopModel";

describe("operating loop model", () => {
  it("CANONICAL_STAGES contains exactly 16 stages in order", () => {
    expect(CANONICAL_STAGES.length).toBe(16);
    expect(CANONICAL_STAGES[0]).toBe("setup");
    expect(CANONICAL_STAGES[CANONICAL_STAGES.length - 1]).toBe("next_action");
  });

  it("STAGE_LABELS has a label for every canonical stage", () => {
    for (const id of CANONICAL_STAGES) {
      expect(STAGE_LABELS[id]).toBeDefined();
      expect(typeof STAGE_LABELS[id]).toBe("string");
    }
  });

  it("isPassingStatus is true for passing/completed/preview/partial", () => {
    expect(isPassingStatus("passing")).toBe(true);
    expect(isPassingStatus("completed")).toBe(true);
    expect(isPassingStatus("preview")).toBe(true);
    expect(isPassingStatus("partial")).toBe(true);
    expect(isPassingStatus("failed")).toBe(false);
  });

  it("isHaltingStatus is true for blocked/failed/requires_input/requires_approval", () => {
    expect(isHaltingStatus("blocked")).toBe(true);
    expect(isHaltingStatus("failed")).toBe(true);
    expect(isHaltingStatus("requires_input")).toBe(true);
    expect(isHaltingStatus("requires_approval")).toBe(true);
    expect(isHaltingStatus("passing")).toBe(false);
  });

  describe("rollupSourceMode honestly picks the most-conservative mode", () => {
    it("returns disabled when any stage is disabled", () => {
      expect(rollupSourceMode(["live", "preview", "disabled"])).toBe("disabled");
    });

    it("returns preview when no disabled but preview present", () => {
      expect(rollupSourceMode(["live", "partial", "preview"])).toBe("preview");
    });

    it("returns partial when only live + partial present", () => {
      expect(rollupSourceMode(["live", "partial"])).toBe("partial");
    });

    it("returns live when every stage is live", () => {
      expect(rollupSourceMode(["live", "live"])).toBe("live");
    });

    it("returns unknown for empty input", () => {
      expect(rollupSourceMode([])).toBe("unknown");
    });
  });
});
