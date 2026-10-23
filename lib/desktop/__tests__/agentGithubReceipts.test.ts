/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: { config: {} } }));
import { AgentGithubReceipts } from "../../../desktop/src/components/AgentGithubReceipts";
afterEach(cleanup);
const sha = "a".repeat(40);
const action = { id: "p1", toolName: "commit_github_files", status: "executed", argsJson: { repositoryFullName: "owner/repo", branch: "feature", files: [{ path: "a.ts" }, { path: "b.ts" }] }, resultJson: { sha, htmlUrl: `https://github.com/owner/repo/commit/${sha}`, fileCount: 2, secret: "private-never-render" } };
it("shows a recorded commit link without claiming tests or recovery passed", () => {
  render(createElement(AgentGithubReceipts, { actions: [action] }));
  expect(screen.getByRole("link", { name: "View recorded commit" }).getAttribute("href")).toBe(action.resultJson.htmlUrl);
  expect(screen.getByText(/2 files/)).toBeTruthy();
  expect(screen.getByText(/Tests, merge and recovery are not verified by this receipt/)).toBeTruthy();
  expect(screen.queryByText(/private-never-render/)).toBeNull();
});
it.each(["https://evil.example/commit/" + sha, `https://github.com/foreign/repo/commit/${sha}`, `https://github.com/owner/repo/commit/${sha}?token=secret`, `https://github.com/owner/repo/commit/${"b".repeat(40)}`])("refuses an unbound result URL %s", htmlUrl => {
  render(createElement(AgentGithubReceipts, { actions: [{ ...action, resultJson: { ...action.resultJson, htmlUrl } }] }));
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.getByText(/Recorded GitHub result unavailable/)).toBeTruthy();
});
it("does not interpret a single-file blob SHA as a commit", () => {
  render(createElement(AgentGithubReceipts, { actions: [{ ...action, toolName: "commit_github_file" }] }));
  expect(screen.queryByRole("link", { name: "View recorded commit" })).toBeNull();
});
it("withholds links for unexecuted and mismatched file-count results", () => {
  render(createElement(AgentGithubReceipts, { actions: [{ ...action, status: "proposed" }, { ...action, id: "p2", resultJson: { ...action.resultJson, fileCount: 3 } }] }));
  expect(screen.queryByRole("link")).toBeNull();
});
it("shows a bound recorded pull request without claiming merge or test success", () => {
  render(createElement(AgentGithubReceipts, { actions: [{ ...action, toolName: "open_github_pull_request", argsJson: { repositoryFullName: "owner/repo", head: "feature", base: "main" }, resultJson: { number: 12, htmlUrl: "https://github.com/owner/repo/pull/12" } }] }));
  expect(screen.getByRole("link", { name: "View recorded pull request" }).getAttribute("href")).toBe("https://github.com/owner/repo/pull/12");
});
