import { describe, it, expect } from "vitest";
import {
  draftReleaseNotes,
  parseCommit,
  type Commit,
} from "../githubReleaseNotesDrafter";

const COMMITS: readonly Commit[] = [
  { sha: "aaaaaaa1234567", subject: "feat(api): add /v2/forecast endpoint",     author: "Alice" },
  { sha: "bbbbbbb1234567", subject: "fix(billing): correct VAT on annual plans", author: "Bob" },
  { sha: "ccccccc1234567", subject: "perf(query): cache /v2/forecast for 60s",   author: "Carol" },
  { sha: "ddddddd1234567", subject: "refactor: rename internal HelperX to Helper", author: "Dave" },
  { sha: "eeeeeee1234567", subject: "docs: bump README contribution guide",      author: "Eve" },
  { sha: "fffffff1234567", subject: "chore: bump @types/node to 20.12.0",         author: "Mallory" },
  { sha: "1111111abcdef0", subject: "feat(auth)!: SSO becomes the default",       author: "Sam" }, // breaking via !
  { sha: "2222222abcdef0", subject: "fix(security): patch IDOR in /admin/leads",  author: "Renee", body: "BREAKING_CHANGE: admin/leads path moved." },
  { sha: "3333333abcdef0", subject: "totally non-conforming subject line",        author: "Wat" }, // unknown
];

describe("parseCommit", () => {
  it("parses type + scope + cleaned subject", () => {
    const p = parseCommit({ sha: "x", subject: "feat(api): hello world", author: "A" });
    expect(p.type).toBe("feat");
    expect(p.scope).toBe("api");
    expect(p.cleanedSubject).toBe("hello world");
    expect(p.breaking).toBe(false);
  });

  it("detects breaking via ! marker", () => {
    const p = parseCommit({ sha: "x", subject: "feat!: rip out old auth", author: "A" });
    expect(p.breaking).toBe(true);
  });

  it("detects breaking via BREAKING CHANGE footer", () => {
    const p = parseCommit({ sha: "x", subject: "feat: ok", author: "A", body: "BREAKING CHANGE: foo" });
    expect(p.breaking).toBe(true);
  });

  it("falls back to unknown for non-conforming commits", () => {
    const p = parseCommit({ sha: "x", subject: "some message here", author: "A" });
    expect(p.type).toBe("unknown");
    expect(p.scope).toBeNull();
  });
});

describe("draftReleaseNotes", () => {
  it("renders all known sections in order", () => {
    const r = draftReleaseNotes({
      newVersion: "v1.7.0",
      previousVersion: "v1.6.0",
      repo: "visionxixlabs/visionxixlabs",
      commits: COMMITS,
    });
    // Sections appear in canonical order:
    const featIdx     = r.markdown.indexOf("🚀 Features");
    const fixIdx      = r.markdown.indexOf("🐛 Bug fixes");
    const perfIdx     = r.markdown.indexOf("⚡ Performance");
    const refactorIdx = r.markdown.indexOf("🧹 Refactoring");
    expect(featIdx).toBeGreaterThan(-1);
    expect(featIdx).toBeLessThan(fixIdx);
    expect(fixIdx).toBeLessThan(perfIdx);
    expect(perfIdx).toBeLessThan(refactorIdx);
  });

  it("computes correct counts", () => {
    const r = draftReleaseNotes({
      newVersion: "v1.7.0",
      repo: "owner/repo",
      commits: COMMITS,
    });
    expect(r.counts.feat).toBe(2);
    expect(r.counts.fix).toBe(2);
    expect(r.counts.perf).toBe(1);
    expect(r.counts.refactor).toBe(1);
    expect(r.counts.docs).toBe(1);
    expect(r.counts.chore).toBe(1);
    expect(r.counts.unknown).toBe(1);
  });

  it("recommends major bump on breaking change", () => {
    const r = draftReleaseNotes({
      newVersion: "v2.0.0",
      repo: "owner/repo",
      commits: COMMITS,
    });
    expect(r.hasBreakingChanges).toBe(true);
    expect(r.recommendedBump).toBe("major");
  });

  it("recommends minor when only feat", () => {
    const r = draftReleaseNotes({
      newVersion: "v1.7.0",
      repo: "owner/repo",
      commits: [{ sha: "a", subject: "feat: new thing", author: "A" }],
    });
    expect(r.recommendedBump).toBe("minor");
  });

  it("recommends patch when only fix", () => {
    const r = draftReleaseNotes({
      newVersion: "v1.6.1",
      repo: "owner/repo",
      commits: [{ sha: "a", subject: "fix: bug", author: "A" }],
    });
    expect(r.recommendedBump).toBe("patch");
  });

  it("breaking changes get a callout banner", () => {
    const r = draftReleaseNotes({
      newVersion: "v2.0.0",
      repo: "owner/repo",
      commits: COMMITS,
    });
    expect(r.markdown).toMatch(/breaking changes/i);
  });

  it("compare link is rendered when previousVersion is set", () => {
    const r = draftReleaseNotes({
      newVersion: "v1.7.0",
      previousVersion: "v1.6.0",
      repo: "owner/repo",
      commits: COMMITS,
    });
    expect(r.markdown).toContain("compare/v1.6.0...v1.7.0");
  });

  it("empty commit list still produces valid markdown", () => {
    const r = draftReleaseNotes({
      newVersion: "v0.0.1",
      repo: "owner/repo",
      commits: [],
    });
    expect(r.markdown).toMatch(/No commits/);
    expect(r.recommendedBump).toBe("patch");
    expect(r.hasBreakingChanges).toBe(false);
  });

  it("rejects missing repo", () => {
    expect(() =>
      draftReleaseNotes({
        newVersion: "v1.0",
        repo: "",
        commits: [],
      }),
    ).toThrow();
  });

  it("rejects malformed repo", () => {
    expect(() =>
      draftReleaseNotes({
        newVersion: "v1.0",
        repo: "owner",
        commits: [],
      }),
    ).toThrow();
  });

  it("each rendered commit line includes short sha + author", () => {
    const r = draftReleaseNotes({
      newVersion: "v1",
      repo: "owner/repo",
      commits: [{ sha: "abcdef1234567890", subject: "feat: nice thing", author: "Alice" }],
    });
    expect(r.markdown).toContain("abcdef1");
    expect(r.markdown).toContain("Alice");
  });
});
