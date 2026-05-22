import { describe, it, expect } from "vitest";
import { parseRepoRef } from "../parseRepoRef";

describe("parseRepoRef", () => {
  it("owner/repo bare", () => {
    expect(parseRepoRef("sahme209/visionxixlabs")).toEqual({ owner: "sahme209", repo: "visionxixlabs" });
  });

  it("github.com prefix", () => {
    expect(parseRepoRef("github.com/owner/repo")).toEqual({ owner: "owner", repo: "repo" });
  });

  it("https URL", () => {
    expect(parseRepoRef("https://github.com/owner/repo")).toEqual({ owner: "owner", repo: "repo" });
  });

  it("https URL with .git suffix", () => {
    expect(parseRepoRef("https://github.com/owner/repo.git")).toEqual({ owner: "owner", repo: "repo" });
  });

  it("git@ SSH URL", () => {
    expect(parseRepoRef("git@github.com:owner/repo.git")).toEqual({ owner: "owner", repo: "repo" });
  });

  it("trailing slash tolerated", () => {
    expect(parseRepoRef("github.com/owner/repo/")).toEqual({ owner: "owner", repo: "repo" });
  });

  it("www. prefix tolerated", () => {
    expect(parseRepoRef("https://www.github.com/owner/repo")).toEqual({ owner: "owner", repo: "repo" });
  });

  it("rejects empty", () => {
    expect(parseRepoRef("")).toBeNull();
    expect(parseRepoRef("   ")).toBeNull();
  });

  it("rejects single segment", () => {
    expect(parseRepoRef("owner")).toBeNull();
  });

  it("rejects three or more segments", () => {
    expect(parseRepoRef("owner/repo/extra")).toBeNull();
  });

  it("rejects dot-prefix (traversal defense)", () => {
    expect(parseRepoRef(".malicious/repo")).toBeNull();
    expect(parseRepoRef("owner/.malicious")).toBeNull();
  });

  it("rejects shell metacharacters", () => {
    expect(parseRepoRef("owner;rm/repo")).toBeNull();
    expect(parseRepoRef("owner/repo$(ls)")).toBeNull();
  });

  it("rejects non-string input", () => {
    // @ts-expect-error testing runtime
    expect(parseRepoRef(null)).toBeNull();
    // @ts-expect-error testing runtime
    expect(parseRepoRef(42)).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(parseRepoRef("   owner/repo   ")).toEqual({ owner: "owner", repo: "repo" });
  });
});
