/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: {} }));
import { EvidencePanel } from "../../../desktop/src/views/AgentChatView";
afterEach(cleanup);
const action = (toolName: string, resultJson: unknown, status = "executed", argsJson: unknown = {}) => ({ id: "evidence", toolName, status, resultJson, argsJson, riskLevel: "low" });
it("lets a reviewer inspect recorded file text without interpreting HTML", () => {
  render(createElement(EvidencePanel, { actions: [action("read_github_file", { path: "src/app.ts", sha: "recorded-sha", content: '<script>doNotRun()</script>' })] }));
  fireEvent.click(screen.getByText("Inspect recorded repository evidence"));
  expect(screen.getByText('<script>doNotRun()</script>')).toBeTruthy();
  expect(document.querySelector("script")).toBeNull();
  expect(screen.getByText(/recorded-sha/)).toBeTruthy();
  expect(screen.getByText(/not a fresh repository read/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Approve/ })).toBeNull();
});
it.each([".env.local", ".aws/credentials", "secrets/config.ts"])("does not disclose restricted file %s", path => {
  render(createElement(EvidencePanel, { actions: [action("read_github_file", { path, content: "PRIVATE_SENTINEL" })] }));
  expect(screen.queryByText(/PRIVATE_SENTINEL/)).toBeNull();
  expect(screen.queryByText("Inspect recorded repository evidence")).toBeNull();
});
it("bounds file text and labels truncation", () => {
  render(createElement(EvidencePanel, { actions: [action("read_github_file", { path: "src/large.ts", content: "x".repeat(20001) + "HIDDEN_TAIL" })] }));
  expect(screen.getByText(/Display limited/)).toBeTruthy();
  expect(screen.queryByText(/HIDDEN_TAIL/)).toBeNull();
});
it("shows bounded search matches and incomplete coverage without sensitive or malformed text", () => {
  const matches = [{ path: "src/main.ts", line: 7, text: "observed match" }, { path: ".env", line: 1, text: "PRIVATE_SENTINEL" }, { path: "src/bad.ts", line: -2, text: "BAD_SENTINEL" }, ...Array.from({length: 25}, (_, i) => ({path: `src/${i}.ts`, line: 1, text: `match-${i}`}))];
  render(createElement(EvidencePanel, { actions: [action("search_github_code", { matches, truncated: true })] }));
  expect(screen.getByText("src/main.ts:7")).toBeTruthy();
  expect(screen.getByText("observed match")).toBeTruthy();
  expect(screen.queryByText(/PRIVATE_SENTINEL|BAD_SENTINEL|match-24/)).toBeNull();
  expect(screen.getByText(/incomplete/)).toBeTruthy();
});
it("does not disclose failed or unknown tool result payloads", () => {
  render(createElement(EvidencePanel, { actions: [action("read_github_file", { path: "src/file.ts", content: "FAILED_SENTINEL" }, "failed")] }));
  expect(screen.queryByText(/FAILED_SENTINEL/)).toBeNull();
  expect(screen.queryByText("Inspect recorded repository evidence")).toBeNull();
});
it("honors a sensitive request path even if a legacy result claims a safe path", () => {
  render(createElement(EvidencePanel, { actions: [action("read_github_file", { path: "src/file.ts", content: "PRIVATE_SENTINEL" }, "executed", {path: ".env"})] }));
  expect(screen.queryByText(/PRIVATE_SENTINEL/)).toBeNull();
});
it("exposes bounded initial repository grounding files and partial-read status", () => {
  const inspectedFiles = [{path: "src/main.ts", content: "initial grounding", sha: "grounding-sha"}, {path: ".env", content: "PRIVATE_SENTINEL"}, ...Array.from({length: 5}, (_, i) => ({path: `src/file-${i}.ts`, content: "x".repeat(6001) + "HIDDEN_TAIL"}))];
  render(createElement(EvidencePanel, {actions: [action("inspect_github_repository", {inspectedFiles, readErrors: [{path: "src/missing.ts", error: "failed"}]})]}));
  expect(screen.getByText("initial grounding")).toBeTruthy();
  expect(screen.getByText("src/file-1.ts")).toBeTruthy();
  expect(screen.queryByText("src/file-2.ts")).toBeNull();
  expect(screen.queryByText(/PRIVATE_SENTINEL|HIDDEN_TAIL/)).toBeNull();
  expect(screen.getByText(/Some repository reads failed/)).toBeTruthy();
  expect(screen.getByText(/subset of the repository/)).toBeTruthy();
});
