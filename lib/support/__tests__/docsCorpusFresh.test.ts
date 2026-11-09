import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import corpus from "../docsCorpus.json";

describe("Ask Axiom docs corpus", () => {
  it("matches the current docs source; run node scripts/support/build-docs-corpus.mjs after editing docs", () => {
    const stale = new Set<string>();
    for (const s of corpus.sections) {
      const sha = createHash("sha256").update(readFileSync(s.source, "utf8")).digest("hex");
      if (sha !== s.sourceSha256) stale.add(s.source);
    }
    expect([...stale]).toEqual([]);
  });

  it("holds only public docs paths and bounded plain text", () => {
    for (const s of corpus.sections) {
      expect(s.href).toMatch(/^\/docs\/[a-z0-9-]+#[a-z0-9-]+$/);
      expect(s.text.length).toBeLessThanOrEqual(1500);
      expect(s.text).not.toMatch(/className=|<\/?[A-Za-z]/);
    }
  });
});
