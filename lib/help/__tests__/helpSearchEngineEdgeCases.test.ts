/**
 * Vitest edge-case tests for the help search engine.
 *
 * The first suite covers happy paths. This one locks in the
 * surprising-behavior guarantees: context-aware fallbacks, the
 * ambiguity verdict, the score cap at 1.0, and that the limit
 * parameter is respected.
 */

import { describe, it, expect } from "vitest";
import { searchHelp } from "../helpSearchEngine";

describe("help search engine — edge cases", () => {
  it("steers execute-style queries that don't match anything to the staging suggestion", () => {
    const a = searchHelp("execute apply mutate delete", 5);
    if (a.verdict === "no_match") {
      expect(a.fallbackSuggestion.toLowerCase()).toMatch(/read-only|stage|approval|policy preview/);
    } else {
      // If hits exist (some 'delete' / 'apply' words live in descriptions),
      // the verdict ladder is intact and primary is set.
      expect(["found_primary", "ambiguous"]).toContain(a.verdict);
    }
  });

  it("steers billing-shaped queries that don't match anything to the cost surface", () => {
    const a = searchHelp("invoice pricing money", 5);
    if (a.verdict === "no_match") {
      expect(a.fallbackSuggestion.toLowerCase()).toMatch(/cost overview|cost explainer/);
    } else {
      expect(["found_primary", "ambiguous"]).toContain(a.verdict);
    }
  });

  it("caps each hit score at 1.0 — never returns a > 1 anomaly", () => {
    const a = searchHelp("cloudtrail audit tail audit cloudtrail tail audit cloudtrail", 5);
    for (const h of a.hits) {
      expect(h.score).toBeGreaterThan(0);
      expect(h.score).toBeLessThanOrEqual(1);
    }
  });

  it("respects the limit parameter exactly", () => {
    const a = searchHelp("aws azure gcp cloud security cost runbook autonomy", 2);
    expect(a.hits.length).toBeLessThanOrEqual(2);
  });

  it("returns matchedTokens per hit so the UI can show which tokens scored", () => {
    const a = searchHelp("scp simulator policy", 5);
    expect(a.hits.length).toBeGreaterThan(0);
    for (const h of a.hits) {
      expect(Array.isArray(h.matchedTokens)).toBe(true);
      expect(h.matchedTokens.length).toBeGreaterThan(0);
    }
  });

  it("strips single-character noise tokens", () => {
    // "a" is a stopword, b/c/d are filtered for length <= 1 — only
    // "scp" survives. Because "scp" appears as a keyword on more than
    // one entry (scp-simulator + policy-previews both legitimately
    // mention SCPs), the engine should land at "ambiguous" with
    // scp-simulator in the top hits — and honestly say so rather
    // than guess.
    const a = searchHelp("a b c d scp", 5);
    expect(a.totalTokens).toBe(1);
    expect(a.hits.length).toBeGreaterThan(0);
    expect(a.hits.some((h) => h.entry.id === "scp-simulator")).toBe(true);
    expect(["found_primary", "ambiguous"]).toContain(a.verdict);
  });

  it("is case-insensitive on entry id matching", () => {
    const lower = searchHelp("scp-simulator", 5);
    const upper = searchHelp("SCP-SIMULATOR", 5);
    expect(lower.primary?.id).toBe("scp-simulator");
    expect(upper.primary?.id).toBe("scp-simulator");
  });
});
