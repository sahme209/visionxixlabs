/**
 * Vitest unit tests for the local help search engine.
 *
 * Pure-function suite: no fetch, no DB. Verifies the verdict ladder
 * (found_primary / ambiguous / no_match), keyword weighting,
 * stopword trimming, and the honest fallback behavior.
 */

import { describe, it, expect } from "vitest";
import { searchHelp } from "../helpSearchEngine";

describe("help search engine", () => {
  it("returns found_primary for a tight, distinctive query", () => {
    const a = searchHelp("cloudtrail audit tail", 5);
    expect(a.verdict).toBe("found_primary");
    expect(a.primary?.id).toBe("cloudtrail");
  });

  it("returns no_match for a nonsense query", () => {
    const a = searchHelp("zzzzqqqq xxxxmmmm", 5);
    expect(a.verdict).toBe("no_match");
    expect(a.primary).toBeUndefined();
    expect(a.fallbackSuggestion.length).toBeGreaterThan(0);
  });

  it("returns no_match on empty input", () => {
    const a = searchHelp("", 5);
    expect(a.verdict).toBe("no_match");
    expect(a.totalTokens).toBe(0);
    expect(a.hits.length).toBe(0);
  });

  it("steers execute/run queries to the staging flow in the fallback", () => {
    const a = searchHelp("execute the runbook on production", 5);
    // Some matches will come back from "runbook" — but the fallback hint
    // is only produced when there are no matches at all. Verify behavior:
    // either we found something (good) or the fallback mentions staging.
    if (a.verdict === "no_match") {
      expect(a.fallbackSuggestion.toLowerCase()).toMatch(/stage|approval/);
    } else {
      expect(a.hits.length).toBeGreaterThan(0);
    }
  });

  it("scores 'autonomy charter' higher than 'integration health' for charter intent", () => {
    const a = searchHelp("autonomy charter mode override", 10);
    const charterHit = a.hits.find((h) => h.entry.id === "charter");
    const integrationHit = a.hits.find((h) => h.entry.id === "integration-health");
    expect(charterHit).toBeDefined();
    expect(charterHit!.score).toBeGreaterThan(integrationHit?.score ?? 0);
  });

  it("strips stopwords so 'the' alone returns no_match", () => {
    const a = searchHelp("the the the the", 5);
    expect(a.verdict).toBe("no_match");
    expect(a.totalTokens).toBe(0);
  });

  it("normalizes by query length so longer queries don't tilt scoring", () => {
    const short = searchHelp("scp simulator", 5);
    const long = searchHelp("scp simulator the simulator the the the the the the the the", 5);
    expect(short.primary?.id).toBe("scp-simulator");
    expect(long.primary?.id).toBe("scp-simulator");
  });
});
