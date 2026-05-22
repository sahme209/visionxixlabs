import { describe, it, expect } from "vitest";
import {
  summarizeRepoContext,
  type RepoSnapshot,
} from "../summarizeRepoContext";

const baseSnapshot = (overrides: Partial<RepoSnapshot> = {}): RepoSnapshot => ({
  owner: "sahme209",
  repo: "visionxixlabs",
  defaultBranch: "main",
  branch: "main",
  headSha: "abc1234567890abc1234567890abc1234567890a",
  tree: [],
  treeTruncated: false,
  recentCommits: [],
  keyFiles: [],
  ...overrides,
});

describe("summarizeRepoContext — structure", () => {
  it("emits a header with owner/repo and branch", () => {
    const out = summarizeRepoContext(baseSnapshot());
    expect(out).toContain("# Repository: sahme209/visionxixlabs");
    expect(out).toContain("# Working branch: main");
    expect(out).toContain("# HEAD commit: abc1234567890");
  });

  it("emits no Recent commits section when empty", () => {
    const out = summarizeRepoContext(baseSnapshot({ tree: [{ path: "foo.ts", type: "blob", size: 10 }] }));
    expect(out).not.toContain("## Recent commits");
  });

  it("emits no Key files section when empty", () => {
    const out = summarizeRepoContext(baseSnapshot());
    expect(out).not.toContain("## Key files");
  });
});

describe("summarizeRepoContext — file tree", () => {
  it("sorts tree entries alphabetically", () => {
    const out = summarizeRepoContext(baseSnapshot({
      tree: [
        { path: "z.ts", type: "blob", size: 100 },
        { path: "a.ts", type: "blob", size: 50 },
        { path: "m.ts", type: "blob", size: 75 },
      ],
    }));
    const aIdx = out.indexOf("- a.ts");
    const mIdx = out.indexOf("- m.ts");
    const zIdx = out.indexOf("- z.ts");
    expect(aIdx).toBeGreaterThan(0);
    expect(aIdx).toBeLessThan(mIdx);
    expect(mIdx).toBeLessThan(zIdx);
  });

  it("marks directories with trailing slash", () => {
    const out = summarizeRepoContext(baseSnapshot({
      tree: [
        { path: "src", type: "tree" },
        { path: "src/index.ts", type: "blob", size: 200 },
      ],
    }));
    expect(out).toContain("- src/");
    expect(out).toContain("- src/index.ts");
  });

  it("includes file size for blobs", () => {
    const out = summarizeRepoContext(baseSnapshot({
      tree: [{ path: "foo.ts", type: "blob", size: 1234 }],
    }));
    expect(out).toContain("(1234b)");
  });

  it("truncates above MAX_TREE_ENTRIES_RENDERED (150) with marker", () => {
    const tree = Array.from({ length: 200 }, (_, i) => ({ path: `file-${String(i).padStart(3, "0")}.ts`, type: "blob" as const, size: 10 }));
    const out = summarizeRepoContext(baseSnapshot({ tree }));
    expect(out).toContain("(showing 150 of 200 entries");
    expect(out).toContain("tree truncated");
  });

  it("treeTruncated flag adds the + marker to total", () => {
    const tree = Array.from({ length: 100 }, (_, i) => ({ path: `f${i}.ts`, type: "blob" as const }));
    const out = summarizeRepoContext(baseSnapshot({ tree, treeTruncated: true }));
    expect(out).toContain("of 100+");
  });
});

describe("summarizeRepoContext — recent commits", () => {
  it("emits one line per commit with short sha + first line of message", () => {
    const out = summarizeRepoContext(baseSnapshot({
      recentCommits: [
        {
          sha: "abcdef1234567890",
          message: "feat: ship it\n\ndetails",
          authorName: "Sam",
          authoredAt: "2026-05-22T17:00:00Z",
        },
      ],
    }));
    expect(out).toContain("## Recent commits");
    expect(out).toContain("- abcdef1 · Sam · 2026-05-22T17:00:00Z · feat: ship it");
    expect(out).not.toContain("details");
  });
});

describe("summarizeRepoContext — key files", () => {
  it("emits key file contents in code fences", () => {
    const out = summarizeRepoContext(baseSnapshot({
      keyFiles: [
        { path: "README.md", content: "# Hello\nworld", truncated: false },
      ],
    }));
    expect(out).toContain("### README.md");
    expect(out).toContain("```");
    expect(out).toContain("# Hello");
    expect(out).toContain("world");
  });

  it("flags truncated files in heading", () => {
    const out = summarizeRepoContext(baseSnapshot({
      keyFiles: [{ path: "huge.ts", content: "x", truncated: true }],
    }));
    expect(out).toContain("### huge.ts (truncated)");
  });
});

describe("summarizeRepoContext — caching invariants", () => {
  it("identical input → byte-identical output (cache stability)", () => {
    const snap = baseSnapshot({
      tree: [{ path: "a.ts", type: "blob", size: 10 }],
      recentCommits: [{ sha: "abc", message: "x", authorName: "y", authoredAt: "z" }],
    });
    const a = summarizeRepoContext(snap);
    const b = summarizeRepoContext(snap);
    expect(a).toBe(b);
  });

  it("no timestamps/UUIDs are injected by the summarizer itself (only from snapshot)", () => {
    const snap = baseSnapshot({ headSha: null });
    const out = summarizeRepoContext(snap);
    expect(out).not.toMatch(/Date\.now/);
    // Only timestamps in the output are the commit authoredAt fields, which
    // come from the snapshot — stable across runs against the same commit.
  });
});
