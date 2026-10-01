import { describe, expect, it } from "vitest";
import {
  parseGithubPullRequestUrl,
  parseGithubRepositoryUrl,
  uniqueGithubRepositories,
} from "../releaseEvidence";

describe("GitHub release evidence URL parsing", () => {
  it("accepts canonical repository and PR URLs", () => {
    expect(parseGithubRepositoryUrl("https://github.com/acme/release-api.git")).toEqual({ owner: "acme", repository: "release-api" });
    expect(parseGithubPullRequestUrl("https://github.com/acme/release-api/pull/42")).toEqual({ owner: "acme", repository: "release-api", number: 42 });
  });

  it("rejects arbitrary, credentialed, and non-canonical URLs", () => {
    expect(parseGithubRepositoryUrl("https://token@github.com/acme/api")).toBeNull();
    expect(parseGithubRepositoryUrl("https://github.com/acme/api/issues/4")).toBeNull();
    expect(parseGithubRepositoryUrl("https://example.test/acme/api")).toBeNull();
    expect(parseGithubRepositoryUrl("https://github.com/acme/%ZZ")).toBeNull();
    expect(parseGithubPullRequestUrl("https://github.com/acme/api/pull/0")).toBeNull();
  });

  it("deduplicates repositories without trusting malformed input", () => {
    expect(uniqueGithubRepositories([
      "https://github.com/acme/api",
      "https://github.com/ACME/api.git",
      "https://example.test/acme/ignored",
    ])).toEqual([{ owner: "acme", repository: "api" }]);
  });
});
