import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import corpus from "../docsCorpus.json";
import index from "../../docs/guide-heading-index.json";

describe("Ask Axiom docs corpus", () => {
  it("matches the current docs source; run node scripts/support/build-docs-corpus.mjs after editing docs", () => {
    expect(() => execFileSync(process.execPath, ["scripts/support/build-docs-corpus.mjs", "--check"], { stdio: "pipe" })).not.toThrow();
  });

  it("holds only public docs paths and bounded plain text", () => {
    for (const s of corpus.sections) {
      expect(s.href).toMatch(/^\/docs(?:\/[a-z0-9-]+)*#[a-z0-9-]+$/);
      const guide = index.guides.find(entry => entry.href === s.href.split("#")[0]);
      expect(guide).toMatchObject({ source: s.source, sourceSha256: s.sourceSha256 });
      expect(s.text.length).toBeLessThanOrEqual(1500);
      expect(s.text).not.toMatch(/className=|<\/?[A-Za-z]/);
    }
  });
});
