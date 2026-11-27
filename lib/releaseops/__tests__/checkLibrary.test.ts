import { describe, expect, it } from "vitest";
import { CHECK_LIBRARY, LIBRARY_CATEGORIES, invalidLibraryEntries, libraryFor } from "../checkLibrary";

describe("check library", () => {
  it("every entry passes the same validation as a hand-written check", () => {
    expect(invalidLibraryEntries()).toEqual([]);
  });

  it("ids and check keys are unique, and categories are known", () => {
    expect(new Set(CHECK_LIBRARY.map((e) => e.id)).size).toBe(CHECK_LIBRARY.length);
    expect(new Set(CHECK_LIBRARY.map((e) => e.check.key)).size).toBe(CHECK_LIBRARY.length);
    for (const e of CHECK_LIBRARY) expect(LIBRARY_CATEGORIES).toContain(e.category);
  });

  it("every GitHub Action is pinned to a full commit and names its release", () => {
    for (const e of CHECK_LIBRARY.filter((x) => x.check.kind === "marketplace_action")) {
      expect(e.check.spec.commit).toMatch(/^[0-9a-f]{40}$/);
      expect(e.source?.url).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/tag\//);
      expect(e.source?.url).toContain(String(e.check.spec.action));
    }
  });

  it("entries holding example hosts say which field must be changed", () => {
    for (const e of CHECK_LIBRARY) {
      if (JSON.stringify(e.check.spec).includes("example.com")) expect(e.edit?.length).toBeGreaterThan(0);
    }
  });

  it("an entry that fails validation is reported", () => {
    const bad = { ...CHECK_LIBRARY[0], id: "bad", check: { ...CHECK_LIBRARY[0].check, spec: { action: "a/b", commit: "abc", inputs: [] } } };
    expect(invalidLibraryEntries([bad])).toEqual(["bad"]);
  });

  it("hides entries whose key the workspace already uses", () => {
    const left = libraryFor(new Set(["trivy-fs", "lighthouse"]));
    expect(left.map((e) => e.check.key)).not.toContain("trivy-fs");
    expect(left).toHaveLength(CHECK_LIBRARY.length - 2);
  });
});
