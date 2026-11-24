/** @vitest-environment jsdom */
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {createElement} from "react";
import {afterEach, expect, it, vi} from "vitest";
import {GitLabConnectionPanel} from "../GitLabConnectionPanel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("explains the workspace binding and offers no credential or sync actions on the other project", async () => {
  const fetch = vi.fn(async () => Response.json({status: "bound_to_other_repository"}));
  vi.stubGlobal("fetch", fetch);
  render(createElement(GitLabConnectionPanel, {repositoryId: "other-project", children: "Sync from provider"}));

  const status = await screen.findByText("GitLab setup is bound to another repository in this workspace.");
  expect(screen.queryByText("Register project credential")).toBeNull();
  expect(screen.queryByText("Sync from provider")).toBeNull();
  expect(screen.queryByRole("button", {name: /revoke/i})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Refresh status"}));
  await screen.findByText(/Connection status refreshed/);
  expect(document.activeElement).toBe(status);
  expect(fetch.mock.calls).toHaveLength(2);
});

it.each([
  ["matching readback", 200, "2027-01-01T00:00:00.000Z", "Connection state updated."],
  ["unavailable readback", 503, "2027-01-01T00:00:00.000Z", "V19 could not confirm the update."],
  ["different revision", 200, "2027-01-02T00:00:00.000Z", "V19 could not confirm the update."],
] as const)("checks registration before showing success with %s", async (_name, status, revision, feedback) => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(Response.json({status: "not_connected"}))
    .mockResolvedValueOnce(Response.json({
      status: "pending", connectionId: "connection", revision: "2027-01-01T00:00:00.000Z",
    }))
    .mockResolvedValueOnce(Response.json({
      status: "awaiting_validation", connectionId: "connection", revision, validatedAt: null,
    }, {status}));
  vi.stubGlobal("fetch", fetch);
  render(createElement(GitLabConnectionPanel, {repositoryId: "repo", children: "Sync from provider"}));

  const token = await screen.findByLabelText("Project token with read_api") as HTMLInputElement;
  fireEvent.change(token, {target: {value: "fixture-token"}});
  fireEvent.submit(token.form!);

  expect(token.value).toBe("");
  const result = await screen.findByText(text => text.includes(feedback));
  expect(result).toBe(screen.getByRole("status"));
  expect(document.activeElement).toBe(result);
  expect(screen.queryByText("Sync from provider")).toBeNull();
  expect(fetch.mock.calls).toHaveLength(3);
});

it("uses the current status when another change supersedes successful validation", async () => {
  const revision = "2027-01-01T00:00:00.000Z";
  const fetch = vi.fn()
    .mockResolvedValueOnce(Response.json({
      status: "awaiting_validation", connectionId: "connection", revision, validatedAt: null,
    }))
    .mockResolvedValueOnce(Response.json({status: "active", connectionId: "connection", validatedAt: revision}))
    .mockResolvedValueOnce(Response.json({
      status: "revoked", connectionId: "connection", revision: "2027-01-02T00:00:00.000Z", validatedAt: null,
    }));
  vi.stubGlobal("fetch", fetch);
  render(createElement(GitLabConnectionPanel, {repositoryId: "repo", children: "Sync from provider"}));

  const token = await screen.findByLabelText("Separate verifier token") as HTMLInputElement;
  fireEvent.change(token, {target: {value: "fixture-token"}});
  fireEvent.submit(token.form!);

  const result = await screen.findByText(/Revoked in V19 · V19 could not confirm the update/);
  expect(document.activeElement).toBe(result);
  expect(screen.queryByText("Sync from provider")).toBeNull();
  expect(fetch.mock.calls).toHaveLength(3);
});
