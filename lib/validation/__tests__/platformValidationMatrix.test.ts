/**
 * VALIDATION_MATRIX honesty invariants — Phase 670.
 *
 * Mirrors the Phase 669 guard on ACTION_REGISTRY. Walks every
 * ValidationRow.evidence string, extracts path-shaped tokens, and
 * asserts each resolves on disk via existsSync.
 *
 * Caught 4 stale UI-page paths on first run (dashboard pages that
 * had never been created — the matrix was claiming them as passing).
 * Those rows are now marked blocked with a nextFix pointing at the
 * live API route.
 *
 * Going forward: if a file is renamed / moved / deleted, this test
 * fails at CI before the operator sees a bogus "evidence :: X" claim
 * on /dashboard/validation.
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { VALIDATION_MATRIX, summarizeValidation } from "../platformValidationMatrix";

const PROJECT_ROOT = process.cwd();

function extractPathCandidates(raw: string): string[] {
  const re = /(?:app|lib|prisma|components|desktop)\/[\w./-]+\.(?:tsx|ts|prisma)/g;
  return Array.from(new Set(raw.match(re) ?? []));
}

describe("VALIDATION_MATRIX :: shape invariants", () => {
  it("every row has a unique id", () => {
    const seen = new Set<string>();
    for (const r of VALIDATION_MATRIX) {
      expect(seen.has(r.id), `duplicate id: ${r.id}`).toBe(false);
      seen.add(r.id);
    }
  });

  it("every row has non-empty capability + evidence text", () => {
    for (const r of VALIDATION_MATRIX) {
      expect(r.capability.trim().length, `${r.id} has empty capability`).toBeGreaterThan(0);
      expect(r.evidence.trim().length, `${r.id} has empty evidence`).toBeGreaterThan(0);
    }
  });

  it("every non-passing row has a nextFix explaining the blocker", () => {
    // partial + failing + blocked + preview should all carry a nextFix
    // (preview is honest — but readers still need to know when live lands).
    for (const r of VALIDATION_MATRIX) {
      if (r.status === "passing") continue;
      // Some rows can carry the blocker inline in evidence; accept
      // that as long as SOMETHING gives the operator a next step.
      const hasBlockerText =
        (r.nextFix && r.nextFix.trim().length > 0) ||
        /requires|not yet|blocked|missing|pending|planned/i.test(r.evidence);
      expect(
        hasBlockerText,
        `${r.id} status=${r.status} has no nextFix and no blocker language in evidence`,
      ).toBe(true);
    }
  });
});

describe("VALIDATION_MATRIX :: evidence file paths resolve (Phase 670)", () => {
  it("every path-shaped evidence token resolves on disk", () => {
    const missing: { id: string; path: string }[] = [];
    for (const r of VALIDATION_MATRIX) {
      for (const p of extractPathCandidates(r.evidence)) {
        const abs = resolvePath(PROJECT_ROOT, p);
        if (!existsSync(abs)) {
          missing.push({ id: r.id, path: p });
        }
      }
    }
    expect(
      missing,
      `stale evidence paths in VALIDATION_MATRIX: ${missing.map((m) => `${m.id}→${m.path}`).join("; ")}`,
    ).toEqual([]);
  });

  it("passing rows with path-shaped evidence have at least one resolvable path", () => {
    for (const r of VALIDATION_MATRIX) {
      if (r.status !== "passing") continue;
      const paths = extractPathCandidates(r.evidence);
      if (paths.length === 0) continue; // conceptual evidence — skip
      const anyResolves = paths.some((p) => existsSync(resolvePath(PROJECT_ROOT, p)));
      expect(
        anyResolves,
        `${r.id} claims status=passing but no evidence path resolves: ${paths.join(", ")}`,
      ).toBe(true);
    }
  });
});

describe("summarizeValidation :: pure fold", () => {
  it("all counts sum to total", () => {
    const s = summarizeValidation();
    expect(s.passing + s.partial + s.failing + s.preview + s.blocked).toBe(s.total);
    expect(s.total).toBe(VALIDATION_MATRIX.length);
  });

  it("score is in [0, 1]", () => {
    const s = summarizeValidation();
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(1);
  });

  it("empty matrix returns score 0 without dividing by zero", () => {
    const s = summarizeValidation([]);
    expect(s.total).toBe(0);
    expect(Number.isFinite(s.score)).toBe(true);
  });
});
