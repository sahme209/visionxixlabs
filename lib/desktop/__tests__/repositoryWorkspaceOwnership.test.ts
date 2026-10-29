/** @vitest-environment jsdom */
import { createElement, Profiler, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
const m = vi.hoisted(() => ({ invoke: vi.fn(), client: { config: {} as { sessionToken?: string; apiBase?: string }, listGithubRepositories: vi.fn(), mintGithubCloneToken: vi.fn(), openGithubPullRequest: vi.fn(), subscribeContext: (listener: () => void) => { void listener; return () => {}; }, getContextRevision: (): number => 0, setSession: (token: string | undefined) => { void token; } } }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: m.invoke }));
vi.mock("../../../desktop/src/lib/desktopClient", async original => {
  const actual = await original<typeof import("../../../desktop/src/lib/desktopClient")>();
  // Real DesktopClient context notifications; only provider methods are mocked.
  const contextClient = new actual.DesktopClient({ apiBase: "http://127.0.0.1:1" });
  Object.defineProperty(m.client, "config", { get: () => contextClient.config });
  m.client.getContextRevision = contextClient.getContextRevision;
  m.client.subscribeContext = contextClient.subscribeContext;
  m.client.setSession = contextClient.setSession.bind(contextClient);
  return { desktopClient: m.client };
});
import { ProposalCard } from "../../../desktop/src/views/AgentChatView";
import type { LocalEditRequest } from "../../../desktop/src/lib/localEditReview";
import { RepositoryWorkspaceView } from "../../../desktop/src/views/RepositoryWorkspaceView";
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: Error) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
const status = (path: string) => ({ rootPath: path, repositoryFullName: path === "/owned/A" ? "fixture/a" : "fixture/b", branch: "feature", ahead: 0, behind: 0, changedFiles: [] });
let reads: (path: string, file: string) => unknown;
let statuses: (path: string) => unknown;
let checks: (path: string) => unknown;
let writes: (args: Record<string, string>) => unknown;
let verification: () => unknown;
let localRepositories: string[];
beforeEach(() => {
  vi.resetAllMocks(); window.localStorage.clear(); m.client.setSession("paired");
  m.client.listGithubRepositories.mockResolvedValue({ ok: true, data: { repositories: [], truncated: false } });
  localRepositories = ["/owned/A", "/owned/B"];
  m.client.mintGithubCloneToken.mockResolvedValue({ ok: true, data: { cloneUrl: "https://example.invalid/fixture/a.git" } });
  m.client.openGithubPullRequest.mockResolvedValue({ok:true,data:{number:1,htmlUrl:"https://example.invalid/pr/1"}});
  reads = (path, file) => `${path}:${file}`; statuses = path => status(path); checks = () => []; writes = () => undefined; verification = () => ({ checkId: "a", success: true, exitCode: 0, output: "fixture output", durationMs: 1 });
  m.invoke.mockImplementation(async (command: string, args: Record<string, string> = {}) => {
    if (command === "default_repos_directory") return "/owned";
    if (command === "list_local_repositories") return [...localRepositories];
    if (command === "push_repository" || command === "pull_repository") return "fixture synchronized";
    if (command === "clone_repository") { localRepositories.push(args.destinationPath); return args.destinationPath; }
    if (command === "repository_status") return statuses(args.repositoryPath);
    if (command === "list_repository_files") return ["same.ts", "other.ts"];
    if (command === "detect_repository_checks") return checks(args.repositoryPath);
    if (command === "read_repository_file") return reads(args.repositoryPath, args.relativePath);
    if (command === "write_repository_file") return writes(args);
    if (command === "prepare_repository_check") return "owned-run";
    if (command === "cancel_repository_check") return true;
    if (command === "run_repository_check") return verification();
    throw Error(`unexpected synthetic command ${command}`);
  });
});
afterEach(cleanup);
async function start() { render(createElement(RepositoryWorkspaceView)); await screen.findByRole("button", { name: "same.ts" }); }
async function switchToB() { fireEvent.click(screen.getByRole("button", { name: "B" })); const discard = screen.queryByRole("button", { name: "Discard and switch" }); if (discard) fireEvent.click(discard); await screen.findByRole("button", { name: "same.ts" }); }
it("never allows a delayed A file to populate B or be saved into B", async () => {
  const old = deferred<string>(); reads = path => path === "/owned/A" ? old.promise : "B content";
  await start(); fireEvent.click(screen.getByRole("button", { name: "same.ts" })); await switchToB();
  await act(async () => { old.resolve("private A content"); });
  const stale = screen.queryByRole("textbox", { name: "Editing same.ts" });
  if (stale) fireEvent.keyDown(stale, { key: "s", ctrlKey: true });
  expect(m.invoke.mock.calls.filter(([name]) => name === "write_repository_file")).toEqual([]);
  expect(screen.queryByDisplayValue("private A content")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "same.ts" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Editing same.ts" }), { target: { value: "edited B" } });
  fireEvent.click(screen.getByRole("button", { name: "Save ⌘S" }));
  await waitFor(() => expect(m.invoke).toHaveBeenCalledWith("write_repository_file", { repositoryPath: "/owned/B", relativePath: "same.ts", content: "edited B", expectedContent: "B content" }));
});
it("keeps the latest file when earlier file reads finish in reverse order", async () => {
  const old = deferred<string>(); reads = (_path, file) => file === "same.ts" ? old.promise : "other content";
  await start(); fireEvent.click(screen.getByRole("button", { name: "same.ts" })); fireEvent.click(screen.getByRole("button", { name: "other.ts" }));
  await screen.findByDisplayValue("other content"); await act(async () => { old.resolve("old content"); });
  expect(screen.getByRole("textbox", { name: "Editing other.ts" })).toBeTruthy(); expect(screen.queryByDisplayValue("old content")).toBeNull();
});
it("does not restore stale repository files/status or detected checks after switching", async () => {
  const oldStatus = deferred<unknown>(), oldChecks = deferred<unknown>(); statuses = path => path === "/owned/A" ? oldStatus.promise : status(path); checks = path => path === "/owned/A" ? oldChecks.promise : [{ id: "b", label: "B check", command: "npm test", description: "fixture" }];
  render(createElement(RepositoryWorkspaceView)); fireEvent.click(await screen.findByRole("button", { name: "B" }));
  await screen.findByRole("button", { name: "B check" });
  await act(async () => { oldStatus.resolve({ ...status("/owned/A"), branch: "stale-A-branch" }); oldChecks.resolve([{ id: "a", label: "A stale check", command: "npm test", description: "fixture" }]); });
  expect(screen.queryByRole("button", { name: "A stale check" })).toBeNull(); expect(screen.queryByText(/stale-A-branch/)).toBeNull();
});
it("ignores a pending A save completion after B is opened and edited", async () => {
  const saved = deferred<void>(); writes = args => args.repositoryPath === "/owned/A" ? saved.promise : undefined;
  await start(); fireEvent.click(screen.getByRole("button", { name: "same.ts" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Editing same.ts" }), { target: { value: "edited A" } }); fireEvent.click(screen.getByRole("button", { name: "Save ⌘S" }));
  await switchToB(); fireEvent.click(screen.getByRole("button", { name: "other.ts" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Editing other.ts" }), { target: { value: "edited B" } });
  await act(async () => { saved.resolve(); });
  expect(screen.queryByText("Saved same.ts")).toBeNull(); expect(screen.getByDisplayValue("edited B")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Save ⌘S" }) as HTMLButtonElement).disabled).toBe(false);
});
it("discards previous-credential editor content and late native reads", async () => {
  const old = deferred<string>(); reads = () => old.promise;
  render(createElement(RepositoryWorkspaceView)); fireEvent.click(await screen.findByRole("button", { name: "same.ts" }));
  await act(async () => { m.client.setSession("replacement"); });
  await act(async () => { old.resolve("prior credential content"); });
  expect(screen.queryByDisplayValue("prior credential content")).toBeNull();
});

it("preserves unsaved-change confirmation and cancel before switching repositories", async () => {
  await start(); fireEvent.click(screen.getByRole("button", { name: "same.ts" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Editing same.ts" }), { target: { value: "unsaved A draft" } });
  fireEvent.click(screen.getByRole("button", { name: "B" }));
  expect(screen.getByRole("alertdialog").textContent).toContain("Switch repositories?");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByDisplayValue("unsaved A draft")).toBeTruthy();
  expect(m.invoke.mock.calls.filter(([name]) => name === "write_repository_file")).toEqual([]);
});
it("does not publish an old verification result after a repository switch", async () => {
  const pending = deferred<unknown>(); verification = () => pending.promise;
  checks = path => path === "/owned/A" ? [{ id: "a", label: "A check", command: "npm test", description: "fixture" }] : [];
  await start(); fireEvent.click(await screen.findByRole("button", { name: "A check" }));
  fireEvent.click(screen.getByRole("button", { name: "Run check" })); await switchToB();
  await act(async () => { pending.resolve({ checkId: "a", success: true, exitCode: 0, output: "private old A output", durationMs: 1 }); });
  expect(screen.queryByText(/private old A output/)).toBeNull(); expect(screen.queryByText("A check passed.")).toBeNull();
});
it("never lets a late A save release the busy state of a pending B save", async () => {
  const a = deferred<void>(), b = deferred<void>(); writes = args => args.repositoryPath === "/owned/A" ? a.promise : b.promise;
  await start(); fireEvent.click(screen.getByRole("button", { name: "same.ts" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Editing same.ts" }), { target: { value: "edited A" } }); fireEvent.click(screen.getByRole("button", { name: "Save ⌘S" }));
  await switchToB(); fireEvent.click(screen.getByRole("button", { name: "other.ts" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Editing other.ts" }), { target: { value: "edited B" } }); fireEvent.click(screen.getByRole("button", { name: "Save ⌘S" }));
  await act(async () => { a.resolve(); });
  expect((screen.getByRole("button", { name: "Save ⌘S" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { b.resolve(); }); await screen.findByText("Saved other.ts");
});
it("does not issue duplicate keyboard saves while a write is pending and preserves newer edits", async () => {
  const pending = deferred<void>(); writes = () => pending.promise;
  await start(); fireEvent.click(screen.getByRole("button", { name: "same.ts" }));
  const editor = await screen.findByRole("textbox", { name: "Editing same.ts" });
  fireEvent.change(editor, { target: { value: "first saved snapshot" } }); fireEvent.keyDown(editor, { key: "s", ctrlKey: true });
  fireEvent.change(editor, { target: { value: "newer unsaved edits" } }); fireEvent.keyDown(editor, { key: "s", ctrlKey: true });
  expect(m.invoke.mock.calls.filter(([name]) => name === "write_repository_file")).toHaveLength(1);
  await act(async () => { pending.resolve(); });
  expect(screen.getByDisplayValue("newer unsaved edits")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Save ⌘S" }) as HTMLButtonElement).disabled).toBe(false);
});

it("preserves first-clone selection and success when the refreshed list starts empty", async () => {
  localRepositories = [];
  m.client.listGithubRepositories.mockResolvedValue({ ok: true, data: { repositories: [{ id: "a", fullName: "fixture/a", defaultBranch: "main", visibility: "private" }], truncated: false } });
  render(createElement(RepositoryWorkspaceView));
  await waitFor(() => expect((screen.getByRole("button", { name: "Clone" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Clone" }));
  await screen.findByText("Cloned fixture/a without storing its access token.");
  expect(m.invoke).toHaveBeenCalledWith("clone_repository", { cloneUrl: "https://example.invalid/fixture/a.git", destinationPath: "/owned/a" });
  expect(screen.getByRole("button", { name: "a" })).toBeTruthy();
});

it("reacts to context notifications without parent rerender and refuses immediate stale editor writes", async () => {
  await start(); fireEvent.click(screen.getByRole("button", { name: "same.ts" }));
  const oldEditor = await screen.findByRole("textbox", { name: "Editing same.ts" });
  expect((oldEditor as HTMLTextAreaElement).value).toBe("/owned/A:same.ts");
  await act(async () => {
    m.client.setSession("replacement-without-parent-render");
    // Real context mutation precedes React's queued parent render. Events
    // against the old editor must not rebind its loaded file to new credentials.
    fireEvent.change(oldEditor, { target: { value: "old-context edit" } });
    fireEvent.keyDown(oldEditor, { key: "s", ctrlKey: true });
  });
  expect(m.invoke.mock.calls.filter(([name]) => name === "write_repository_file")).toEqual([]);
  expect(screen.queryByDisplayValue("old-context edit")).toBeNull();
  expect(screen.queryByDisplayValue("/owned/A:same.ts")).toBeNull();
});

it("does not bind a pending A selection effect to B ownership", async () => {
  const oldChecks = deferred<unknown>();
  checks = path => path === "/owned/A" ? oldChecks.promise : [{ id: "b", label: "B check", command: "npm test", description: "fixture" }];
  let switched = false;
  render(createElement(Profiler, { id: "selection-order", onRender: () => {
    const button = screen.queryByRole("button", { name: "B" });
    if (button && !switched) {
      switched = true;
      // A's selection has committed, but its passive effect has not run.
      // A repository click updates ownership immediately, before that effect.
      button.click();
    }
  } }, createElement(RepositoryWorkspaceView)));
  await screen.findByRole("button", { name: "B check" });
  await act(async () => { oldChecks.resolve([{ id: "a", label: "A stale check", command: "npm test", description: "fixture" }]); });
  expect(switched).toBe(true);
  expect(screen.queryByRole("button", { name: "A stale check" })).toBeNull();
  expect(screen.getByRole("button", { name: "B check" })).toBeTruthy();
});

const catalog = (name: string) => ({ ok: true, data: { repositories: [{ id: name, fullName: `fixture/${name}`, defaultBranch: "main", visibility: "private" }], truncated: false } });
it.each(["", "fixture/manual"])("retries the connected catalog preserving a local draft and manual entry %s", async manual => {
  m.client.listGithubRepositories.mockResolvedValueOnce({ ok: false, error: "unavailable" });
  await start();
  fireEvent.click(screen.getByRole("button", { name: "same.ts" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Editing same.ts" }), { target: { value: "unsaved draft" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Connected GitHub repository" }), { target: { value: "__manual__" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Repository owner and name" }), { target: { value: manual } });
  m.client.listGithubRepositories.mockResolvedValue(catalog("recovered"));
  fireEvent.click(screen.getByRole("button", { name: "Refresh connected repositories" }));
  await screen.findByRole("option", { name: "fixture/recovered · private" });
  expect(screen.getByDisplayValue("unsaved draft")).toBeTruthy();
  expect((screen.getByRole("textbox", { name: "Repository owner and name" }) as HTMLInputElement).value).toBe(manual);
  expect((screen.getByRole("button", { name: "Save ⌘S" }) as HTMLButtonElement).disabled).toBe(false);
  expect(m.client.mintGithubCloneToken).not.toHaveBeenCalled();
  expect(m.invoke.mock.calls.filter(([name]) => name === "write_repository_file")).toEqual([]);
});
it.each(["success", "error", "rejection"])("ignores a superseded catalog %s after a newer refresh", async outcome => {
  const old = deferred<unknown>();
  m.client.listGithubRepositories.mockReturnValueOnce(old.promise).mockResolvedValue(catalog("current"));
  await start();
  fireEvent.click(screen.getByRole("button", { name: "Refresh connected repositories" }));
  await screen.findByRole("option", { name: "fixture/current · private" });
  await act(async () => { if (outcome === "rejection") old.reject(new Error("stale rejection")); else old.resolve(outcome === "success" ? catalog("stale") : { ok: false, error: "stale failure" }); });
  expect(screen.queryByRole("option", { name: "fixture/stale · private" })).toBeNull();
  expect(screen.queryByText(/GitHub access is unavailable/)).toBeNull();
  expect(screen.getByRole("option", { name: "fixture/current · private" })).toBeTruthy();
});
it.each(["success", "error", "rejection"])("ignores a prior credential catalog %s", async outcome => {
  const old = deferred<unknown>();
  m.client.listGithubRepositories.mockReturnValueOnce(old.promise).mockResolvedValue(catalog("replacement"));
  await start();
  await act(async () => { m.client.setSession("replacement-catalog-context"); });
  await screen.findByRole("option", { name: "fixture/replacement · private" });
  await act(async () => { if (outcome === "rejection") old.reject(new Error("old context rejection")); else old.resolve(outcome === "success" ? catalog("private-old") : { ok: false, error: "old credential failure" }); });
  expect(screen.queryByRole("option", { name: "fixture/private-old · private" })).toBeNull();
  expect(screen.queryByText(/GitHub access is unavailable/)).toBeNull();
  expect(screen.getByRole("option", { name: "fixture/replacement · private" })).toBeTruthy();
});
it("keeps local Refresh independent of the connected GitHub catalog", async () => {
  await start();
  expect(m.client.listGithubRepositories).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await waitFor(() => expect(m.invoke.mock.calls.filter(([name]) => name === "list_local_repositories")).toHaveLength(2));
  expect(m.client.listGithubRepositories).toHaveBeenCalledTimes(1);
});
it("does not let a superseded success clear the latest catalog failure", async () => {
  const old = deferred<unknown>();
  m.client.listGithubRepositories.mockReturnValueOnce(old.promise).mockResolvedValue({ ok: false, error: "latest failure" });
  await start();
  fireEvent.click(screen.getByRole("button", { name: "Refresh connected repositories" }));
  await screen.findByText(/GitHub access is unavailable/);
  await act(async () => { old.resolve(catalog("stale")); });
  expect(screen.getByText(/GitHub access is unavailable/)).toBeTruthy();
  expect(screen.queryByRole("option", { name: "fixture/stale · private" })).toBeNull();
});
it("reconciles a removed connected selection to the visible replacement before cloning", async () => {
  m.client.listGithubRepositories.mockResolvedValueOnce(catalog("original")).mockResolvedValue(catalog("replacement"));
  await start();
  const selection = screen.getByRole("combobox", { name: "Connected GitHub repository" }) as HTMLSelectElement;
  await waitFor(() => expect(selection.value).toBe("fixture/original"));
  fireEvent.click(screen.getByRole("button", { name: "Refresh connected repositories" }));
  await screen.findByRole("option", { name: "fixture/replacement · private" });
  expect(selection.value).toBe("fixture/replacement");
  fireEvent.click(screen.getByRole("button", { name: "Clone" }));
  await waitFor(() => expect(m.client.mintGithubCloneToken).toHaveBeenCalledWith({ repositoryFullName: selection.value, purpose: "clone" }));
  expect(m.client.mintGithubCloneToken).toHaveBeenCalledWith({ repositoryFullName: "fixture/replacement", purpose: "clone" });
});
it("clears a removed connected selection and disables Clone when the refreshed catalog is empty", async () => {
  m.client.listGithubRepositories.mockResolvedValueOnce(catalog("original")).mockResolvedValue({ ok: true, data: { repositories: [], truncated: false } });
  await start();
  const selection = screen.getByRole("combobox", { name: "Connected GitHub repository" }) as HTMLSelectElement;
  await waitFor(() => expect(selection.value).toBe("fixture/original"));
  fireEvent.click(screen.getByRole("button", { name: "Refresh connected repositories" }));
  await screen.findByRole("option", { name: "No connected repositories" });
  expect(selection.value).toBe("");
  const clone = screen.getByRole("button", { name: "Clone" }) as HTMLButtonElement;
  expect(clone.disabled).toBe(true);
  fireEvent.click(clone);
  expect(m.client.mintGithubCloneToken).not.toHaveBeenCalled();
});
it("retains an explicitly selected repository that remains in the refreshed catalog", async () => {
  const repositories = [...catalog("first").data.repositories, ...catalog("kept").data.repositories];
  m.client.listGithubRepositories.mockResolvedValue({ ok: true, data: { repositories, truncated: false } });
  await start();
  const selection = screen.getByRole("combobox", { name: "Connected GitHub repository" }) as HTMLSelectElement;
  await screen.findByRole("option", { name: "fixture/kept · private" });
  fireEvent.change(selection, { target: { value: "fixture/kept" } });
  fireEvent.click(screen.getByRole("button", { name: "Refresh connected repositories" }));
  await waitFor(() => expect(m.client.listGithubRepositories).toHaveBeenCalledTimes(2));
  expect(selection.value).toBe("fixture/kept");
  fireEvent.click(screen.getByRole("button", { name: "Clone" }));
  await waitFor(() => expect(m.client.mintGithubCloneToken).toHaveBeenCalledWith({ repositoryFullName: "fixture/kept", purpose: "clone" }));
});

it("sends the last saved baseline on each native editor save", async () => {
  await start(); fireEvent.click(screen.getByRole("button", { name: "same.ts" }));
  const editor = await screen.findByRole("textbox", { name: "Editing same.ts" });
  fireEvent.change(editor, { target: { value: "first edit" } });
  fireEvent.click(screen.getByRole("button", { name: "Save ⌘S" }));
  await screen.findByText("Saved same.ts");
  expect(m.invoke).toHaveBeenCalledWith("write_repository_file", { repositoryPath: "/owned/A", relativePath: "same.ts", content: "first edit", expectedContent: "/owned/A:same.ts" });
  fireEvent.change(editor, { target: { value: "second edit" } });
  fireEvent.click(screen.getByRole("button", { name: "Save ⌘S" }));
  await waitFor(() => expect(m.invoke).toHaveBeenCalledWith("write_repository_file", { repositoryPath: "/owned/A", relativePath: "same.ts", content: "second edit", expectedContent: "first edit" }));
});
it("preserves the dirty draft and original baseline after a native external-change rejection", async () => {
  writes = () => { throw new Error("File changed outside Axiom. Reopen it to review before saving."); };
  await start(); fireEvent.click(screen.getByRole("button", { name: "same.ts" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Editing same.ts" }), { target: { value: "unsaved draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Save ⌘S" }));
  await screen.findByText(/File changed outside Axiom/);
  expect(screen.getByDisplayValue("unsaved draft")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Save ⌘S" }) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.queryByText("Saved same.ts")).toBeNull();
  expect(m.invoke).toHaveBeenCalledWith("write_repository_file", expect.objectContaining({ expectedContent: "/owned/A:same.ts" }));
});
it("uses the same conflict protection for commit's implicit save and never commits a rejected draft", async () => {
  writes = () => { throw new Error("File changed outside Axiom. Reopen it to review before saving."); };
  await start(); fireEvent.click(screen.getByRole("button", { name: "same.ts" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Editing same.ts" }), { target: { value: "uncommitted draft" } });
  fireEvent.change(screen.getByPlaceholderText("Commit message for this file"), { target: { value: "Review local change" } });
  fireEvent.click(screen.getByRole("button", { name: "Commit file" }));
  await screen.findByText(/File changed outside Axiom/);
  expect(m.invoke).toHaveBeenCalledWith("write_repository_file", expect.objectContaining({ expectedContent: "/owned/A:same.ts" }));
  expect(m.invoke.mock.calls.some(([command]) => command === "commit_repository_file")).toBe(false);
  expect(screen.getByDisplayValue("uncommitted draft")).toBeTruthy();
});

it("undoes and redoes editor changes without writing, then saves against the original baseline", async () => {
  await start(); fireEvent.click(screen.getByRole("button", {name: "same.ts"}));
  const editor = await screen.findByRole("textbox", {name: "Editing same.ts"});
  const original = (editor as HTMLTextAreaElement).value;
  fireEvent.change(editor, {target: {value: "first edit"}});
  fireEvent.change(editor, {target: {value: "second edit"}});
  fireEvent.keyDown(editor, {key: "z", metaKey: true});
  expect((editor as HTMLTextAreaElement).value).toBe("first edit");
  fireEvent.click(screen.getByRole("button", {name: "Redo edit"}));
  expect((editor as HTMLTextAreaElement).value).toBe("second edit");
  expect(m.invoke.mock.calls.filter(([name]) => name === "write_repository_file")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", {name: "Save ⌘S"}));
  await waitFor(() => expect(m.invoke).toHaveBeenCalledWith("write_repository_file", {repositoryPath: "/owned/A", relativePath: "same.ts", content: "second edit", expectedContent: original}));
});
it("clears edit history when a different file is opened", async () => {
  await start(); fireEvent.click(screen.getByRole("button", {name: "same.ts"}));
  fireEvent.change(await screen.findByRole("textbox", {name: "Editing same.ts"}), {target: {value: "discard me"}});
  fireEvent.click(screen.getByRole("button", {name: "other.ts"}));
  fireEvent.click(screen.getByRole("button", {name: "Discard and open"}));
  const editor = await screen.findByRole("textbox", {name: "Editing other.ts"});
  fireEvent.keyDown(editor, {key: "z", ctrlKey: true});
  expect((editor as HTMLTextAreaElement).value).toBe("/owned/A:other.ts");
  expect((screen.getByRole("button", {name: "Undo edit"}) as HTMLButtonElement).disabled).toBe(true);
});

it("finds literal text, wraps selection, and never writes search results", async () => {
  reads = () => "alpha beta alpha";
  await start(); fireEvent.click(screen.getByRole("button", {name: "same.ts"}));
  const editor = await screen.findByRole("textbox", {name: "Editing same.ts"}) as HTMLTextAreaElement;
  fireEvent.click(screen.getByRole("button", {name: "Find in file"}));
  fireEvent.change(await screen.findByRole("searchbox", {name: "Find literal text"}), {target: {value: "alpha"}});
  fireEvent.click(screen.getByRole("button", {name: "Next match"}));
  expect([editor.selectionStart, editor.selectionEnd]).toEqual([0, 5]);
  fireEvent.click(screen.getByRole("button", {name: "Next match"}));
  expect([editor.selectionStart, editor.selectionEnd]).toEqual([11, 16]);
  fireEvent.click(screen.getByRole("button", {name: "Next match"}));
  expect(editor.selectionStart).toBe(0);
  fireEvent.click(screen.getByRole("button", {name: "Previous match"}));
  expect(editor.selectionStart).toBe(11);
  fireEvent.change(screen.getByRole("searchbox", {name: "Find literal text"}), {target: {value: ".*"}});
  expect(screen.getByText("No matches")).toBeTruthy();
  expect((screen.getByRole("button", {name: "Next match"}) as HTMLButtonElement).disabled).toBe(true);
  expect(editor.value).toBe("alpha beta alpha");
  expect(m.invoke.mock.calls.filter(([name]) => name === "write_repository_file")).toHaveLength(0);
});

it("reviews unsaved changes against the loaded baseline without saving or approving", async () => {
  reads = () => "original line";
  await start(); fireEvent.click(screen.getByRole("button", {name: "same.ts"}));
  fireEvent.change(await screen.findByRole("textbox", {name: "Editing same.ts"}), {target: {value: "edited line"}});
  fireEvent.click(screen.getByRole("button", {name: "Review local changes"}));
  expect(screen.getByLabelText("Local unsaved file diff")).toBeTruthy();
  expect(screen.getByText("original line")).toBeTruthy();
  expect(within(screen.getByLabelText("Local unsaved file diff")).getByText("edited line")).toBeTruthy();
  expect(m.invoke.mock.calls.filter(([name]) => name === "write_repository_file")).toHaveLength(0);
  expect(screen.queryByRole("button", {name: "Approve & run"})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Undo edit"}));
  expect(screen.getByText("No unsaved content changes.")).toBeTruthy();
});

it("requires explicit consent and warns that repository checks are not sandboxed", async () => {
  checks = () => [{id: "a", label: "A check", command: "npm test", description: "fixture"}];
  await start(); fireEvent.click(await screen.findByRole("button", {name: "A check"}));
  expect(screen.getByText(/not sandboxed/)).toBeTruthy();
  expect(m.invoke.mock.calls.filter(([command]) => command === "run_repository_check")).toHaveLength(0);
});
it("requires confirmation before handing selected local code to Agent without saving", async () => {
  const onAskAgent = vi.fn(); reads = () => "const value = 1;";
  render(createElement(RepositoryWorkspaceView, {onAskAgent}));
  fireEvent.click(await screen.findByRole("button", {name: "same.ts"}));
  const editor = await screen.findByRole("textbox", {name: "Editing same.ts"}) as HTMLTextAreaElement;
  editor.setSelectionRange(0, 5); fireEvent.select(editor);
  await waitFor(() => expect((screen.getByRole("button", {name: "Ask Agent about selection"}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", {name: "Ask Agent about selection"}));
  expect(onAskAgent).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole("button", {name: "Prepare Agent draft"}));
  expect(onAskAgent).toHaveBeenCalledWith({path: "same.ts", excerpt: "const"});
  expect(m.invoke.mock.calls.filter(([command]) => command === "write_repository_file")).toHaveLength(0);
});
it("rejects a reviewed local selection when the file content changes before confirmation", async () => {
  const onAskAgent = vi.fn(); reads = () => "original code";
  render(createElement(RepositoryWorkspaceView, {onAskAgent}));
  fireEvent.click(await screen.findByRole("button", {name: "same.ts"}));
  const editor = await screen.findByRole("textbox", {name: "Editing same.ts"}) as HTMLTextAreaElement;
  editor.setSelectionRange(0, 8); fireEvent.select(editor);
  await waitFor(() => expect((screen.getByRole("button", {name: "Ask Agent about selection"}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", {name: "Ask Agent about selection"}));
  fireEvent.change(editor, {target: {value: "changed code"}});
  fireEvent.click(await screen.findByRole("button", {name: "Prepare Agent draft"}));
  expect(screen.getByText(/file changed while reviewing this selection/)).toBeTruthy();
  expect(onAskAgent).not.toHaveBeenCalled();
});
it("loads a reviewed Agent change only into the buffer, then explicitly saves and verifies", async () => {
  reads = () => "original";
  checks = () => [{id: "a", label: "A check", command: "npm test", description: "fixture"}];
  const edit = {proposalId: "proposal-1", repositoryFullName: "fixture/a", branch: "feature", path: "same.ts", baseContent: "original", content: "Agent changed"};
  render(createElement(RepositoryWorkspaceView, {editRequest: {context: m.client.config, edit}}));
  fireEvent.click(await screen.findByRole("button", {name: "same.ts"}));
  await screen.findByDisplayValue("original");
  fireEvent.click(screen.getByRole("button", {name: "Load editor draft"}));
  await screen.findByDisplayValue("Agent changed");
  expect(m.invoke.mock.calls.filter(([name]) => name === "write_repository_file" || name === "run_repository_check")).toHaveLength(0);
  expect(screen.getByLabelText("Local unsaved file diff")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name: "Save ⌘S"}));
  await waitFor(() => expect(m.invoke).toHaveBeenCalledWith("write_repository_file", {repositoryPath: "/owned/A", relativePath: "same.ts", content: "Agent changed", expectedContent: "original"}));
  fireEvent.click(screen.getByRole("button", {name: "A check"}));
  expect(m.invoke.mock.calls.filter(([name]) => name === "run_repository_check")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", {name: "Run check"}));
  await screen.findByText("fixture output");
  expect(m.invoke).toHaveBeenCalledWith("run_repository_check", {repositoryPath: "/owned/A", checkId: "a", runId: "owned-run"});
});
it("hides a previous credential's proposed code rather than only disabling its load button", async () => {
  render(createElement(RepositoryWorkspaceView, {editRequest: {context: {}, edit: {proposalId: "old", repositoryFullName: "fixture/a", branch: "feature", path: "same.ts", baseContent: "original", content: "PRIVATE OLD DRAFT"}}}));
  await screen.findByRole("button", {name: "same.ts"});
  expect(screen.queryByText("PRIVATE OLD DRAFT")).toBeNull();
  expect(screen.queryByRole("button", {name: "Load editor draft"})).toBeNull();
});
it("rechecks live branch before loading proposed code", async () => {
  reads = () => "original";
  render(createElement(RepositoryWorkspaceView, {editRequest: {context: m.client.config, edit: {proposalId: "p", repositoryFullName: "fixture/a", branch: "feature", path: "same.ts", baseContent: "original", content: "changed"}}}));
  fireEvent.click(await screen.findByRole("button", {name: "same.ts"})); await screen.findByDisplayValue("original");
  statuses = path => ({...status(path), branch: "main"});
  fireEvent.click(screen.getByRole("button", {name: "Load editor draft"}));
  await screen.findByText(/Open the proposal's repository, branch and file/);
  expect(screen.getByDisplayValue("original")).toBeTruthy();
  expect(m.invoke.mock.calls.filter(([name]) => name === "write_repository_file")).toHaveLength(0);
});
it("does not run disk verification against an unsaved editor draft", async () => {
  checks = () => [{id: "a", label: "A check", command: "npm test", description: "fixture"}];
  await start(); fireEvent.click(screen.getByRole("button", {name: "same.ts"}));
  fireEvent.change(await screen.findByRole("textbox", {name: "Editing same.ts"}), {target: {value: "unsaved"}});
  fireEvent.click(screen.getByRole("button", {name: "A check"}));
  expect(screen.getByText(/Save or discard unsaved editor changes before verification/)).toBeTruthy();
  expect(screen.queryByRole("button", {name: "Run check"})).toBeNull();
  expect(m.invoke.mock.calls.filter(([name]) => name === "run_repository_check")).toHaveLength(0);
});
it("marks an earlier check result stale after editor changes", async () => {
  checks = () => [{id: "a", label: "A check", command: "npm test", description: "fixture"}];
  await start(); fireEvent.click(screen.getByRole("button", {name: "same.ts"})); await screen.findByRole("textbox", {name: "Editing same.ts"});
  fireEvent.click(screen.getByRole("button", {name: "A check"})); fireEvent.click(screen.getByRole("button", {name: "Run check"}));
  await screen.findByText("fixture output");
  fireEvent.change(screen.getByRole("textbox", {name: "Editing same.ts"}), {target: {value: "new code"}});
  expect(screen.getByText(/Verification is stale/)).toBeTruthy();
  expect(screen.getByText("fixture output")).toBeTruthy();
});
it("marks a completed verification historical when edits occur during its run", async () => {
  const pending = deferred<unknown>(); verification = () => pending.promise;
  checks = () => [{id: "a", label: "A check", command: "npm test", description: "fixture"}];
  await start(); fireEvent.click(screen.getByRole("button", {name: "same.ts"})); await screen.findByRole("textbox", {name: "Editing same.ts"});
  fireEvent.click(screen.getByRole("button", {name: "A check"})); fireEvent.click(screen.getByRole("button", {name: "Run check"}));
  await waitFor(() => expect(m.invoke).toHaveBeenCalledWith("run_repository_check", {repositoryPath: "/owned/A", checkId: "a", runId: "owned-run"}));
  fireEvent.change(screen.getByRole("textbox", {name: "Editing same.ts"}), {target: {value: "concurrent edit"}});
  await act(async () => {pending.resolve({checkId: "a", success: true, exitCode: 0, output: "prior run", durationMs: 1});});
  await screen.findByText("prior run");
  expect(screen.getByText(/Verification is stale/)).toBeTruthy();
  expect(screen.queryByRole("button", {name: /Last check passed/})).toBeNull();
});
it("preserves a local file whose saved baseline differs from the Agent proposal", async () => {
  reads = () => "newer local content";
  render(createElement(RepositoryWorkspaceView, {editRequest: {context: m.client.config, edit: {proposalId: "p", repositoryFullName: "fixture/a", branch: "feature", path: "same.ts", baseContent: "old proposal base", content: "Agent changed"}}}));
  fireEvent.click(await screen.findByRole("button", {name: "same.ts"})); await screen.findByDisplayValue("newer local content");
  fireEvent.click(screen.getByRole("button", {name: "Load editor draft"}));
  await screen.findByText(/local saved content differs from the proposal baseline/);
  expect(screen.getByDisplayValue("newer local content")).toBeTruthy();
  expect(m.invoke.mock.calls.filter(([name]) => name === "write_repository_file")).toHaveLength(0);
});

it.each([false, true])("reviews coordinated files with explicit saves and rejects drift (drift=%s)", async drift => {
  checks = () => [{id: "a", label: "A check", command: "npm test", description: "fixture"}];
  reads = (_repository, path) => drift && path === "other.ts" ? "newer local content" : `original ${path}`;
  const edits = ["same.ts", "other.ts"].map(path => ({proposalId: "multi", repositoryFullName: "fixture/a", branch: "feature", path, baseContent: `original ${path}`, content: `changed ${path}`}));
  render(createElement(RepositoryWorkspaceView, {editRequest: {context: m.client.config, edit: edits[0], edits}}));
  for (const edit of edits) {
    expect(screen.getByLabelText(`Agent proposed diff for ${edit.path}`)).toBeTruthy();
    await screen.findByRole("button", {name: edit.path});
    fireEvent.click(screen.getByText(edit.path, {selector: "summary"}));
    const open = await screen.findByRole("button", {name: `Open ${edit.path} for local review`});
    await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(open);
    await screen.findByDisplayValue(drift && edit.path === "other.ts" ? "newer local content" : edit.baseContent);
    if (drift && edit.path === "other.ts") {
      fireEvent.click(screen.getByRole("button", {name: "Load editor draft"}));
      await screen.findByText(/local saved content differs from the proposal baseline/);
      expect(screen.getByDisplayValue("newer local content")).toBeTruthy();
      expect(m.invoke.mock.calls.filter(([name]) => name === "write_repository_file")).toHaveLength(1);
      break;
    }
    const previousWrites = m.invoke.mock.calls.filter(([name]) => name === "write_repository_file").length;
    fireEvent.click(screen.getByRole("button", {name: "Load editor draft"}));
    await screen.findByDisplayValue(edit.content);
    expect(m.invoke.mock.calls.filter(([name]) => name === "write_repository_file")).toHaveLength(previousWrites);
    fireEvent.click(screen.getByRole("button", {name: "Save ⌘S"}));
    await waitFor(() => expect(m.invoke).toHaveBeenCalledWith("write_repository_file", {repositoryPath: "/owned/A", relativePath: edit.path, content: edit.content, expectedContent: edit.baseContent}));
    await waitFor(() => expect((screen.getByRole("button", {name: "Save ⌘S"}) as HTMLButtonElement).disabled).toBe(true));
  }
  expect(screen.getByText(drift ? /1 of 2 drafts loaded during this review/ : /2 of 2 drafts loaded during this review/)).toBeTruthy();
  expect(m.invoke.mock.calls.filter(([name]) => name === "run_repository_check")).toHaveLength(0);
  if (!drift) {
    fireEvent.click(screen.getByRole("button", {name: "A check"}));
    const consent = await screen.findByRole("button", {name: "Run check"});
    expect(m.invoke.mock.calls.filter(([name]) => name === "run_repository_check")).toHaveLength(0);
    fireEvent.click(consent);
    await screen.findByText("fixture output");
    expect(m.invoke).toHaveBeenCalledWith("run_repository_check", {repositoryPath: "/owned/A", checkId: "a", runId: "owned-run"});
    fireEvent.change(screen.getByRole("textbox", {name: "Editing other.ts"}), {target: {value: "changed after check"}});
    await screen.findByRole("button", {name: /Previous check result \(stale\)/});
    expect(m.invoke.mock.calls.filter(([name]) => name === "run_repository_check")).toHaveLength(1);
  }
});
it("requires discard consent when moving between proposed files with an unsaved draft", async () => {
  reads = (_repository, path) => `original ${path}`;
  const edits = ["same.ts", "other.ts"].map(path => ({proposalId: "multi", repositoryFullName: "fixture/a", branch: "feature", path, baseContent: `original ${path}`, content: `changed ${path}`}));
  render(createElement(RepositoryWorkspaceView, {editRequest: {context: m.client.config, edit: edits[0], edits}}));
  fireEvent.click(await screen.findByRole("button", {name: "same.ts"}));
  await screen.findByDisplayValue("original same.ts");
  fireEvent.click(screen.getByRole("button", {name: "Load editor draft"}));
  await screen.findByDisplayValue("changed same.ts");
  fireEvent.click(screen.getByText("other.ts", {selector: "summary"}));
  fireEvent.click(screen.getByRole("button", {name: "Open other.ts for local review"}));
  await screen.findByRole("button", {name: "Discard and open"});
  expect(screen.getByDisplayValue("changed same.ts")).toBeTruthy();
  expect(m.invoke.mock.calls.filter(([name, args]) => name === "read_repository_file" && args.relativePath === "other.ts")).toHaveLength(0);
  expect(m.invoke.mock.calls.filter(([name]) => name === "write_repository_file" || name === "run_repository_check")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", {name: "Discard and open"}));
  await screen.findByDisplayValue("original other.ts");
  expect(screen.queryByDisplayValue("changed other.ts")).toBeNull();
});
it("requires renewed verification consent after source changes even when undone", async () => {
  checks = () => [{id: "a", label: "A check", command: "npm test", description: "fixture"}];
  await start(); fireEvent.click(screen.getByRole("button", {name: "same.ts"}));
  const editor = await screen.findByRole("textbox", {name: "Editing same.ts"});
  fireEvent.click(screen.getByRole("button", {name: "A check"}));
  await screen.findByRole("button", {name: "Run check"});
  fireEvent.change(editor, {target: {value: "temporary change"}});
  fireEvent.click(screen.getByRole("button", {name: "Undo edit"}));
  fireEvent.click(screen.getByRole("button", {name: "Run check"}));
  await screen.findByText(/source changed after check consent/);
  expect(m.invoke.mock.calls.filter(([name]) => name === "run_repository_check")).toHaveLength(0);
});
it("rejects a mismatched native receipt and retires an earlier success", async () => {
  checks = () => [{id: "a", label: "A check", command: "npm test", description: "fixture"}];
  await start();
  fireEvent.click(screen.getByRole("button", {name: "A check"}));
  fireEvent.click(await screen.findByRole("button", {name: "Run check"}));
  await screen.findByText("fixture output");
  verification = () => ({checkId: "other", success: true, exitCode: 0, output: "untrusted receipt", durationMs: 1});
  fireEvent.click(screen.getByRole("button", {name: "A check"}));
  fireEvent.click(await screen.findByRole("button", {name: "Run check"}));
  await screen.findByText(/Invalid verification receipt/);
  expect(screen.queryByText("untrusted receipt")).toBeNull();
  expect(screen.queryByRole("button", {name: /Last check passed/})).toBeNull();
  expect(screen.getByRole("button", {name: /Previous check result/})).toBeTruthy();
});
it("dispatches a consented check once while a native run is pending", async () => {
  const pending = deferred<unknown>(); verification = () => pending.promise;
  checks = () => [{id: "a", label: "A check", command: "npm test", description: "fixture"}];
  await start(); fireEvent.click(screen.getByRole("button", {name: "A check"}));
  const consent = await screen.findByRole("button", {name: "Run check"});
  act(() => { consent.click(); consent.click(); });
  await waitFor(() => expect(m.invoke.mock.calls.filter(([name]) => name === "run_repository_check")).toHaveLength(1));
  await act(async () => {pending.resolve({checkId: "a", success: true, exitCode: 0, output: "one run", durationMs: 1});});
  await screen.findByText("one run");
});
it("prepares check evidence only after output review without rerunning or saving", async () => {
  const onAskAgent = vi.fn();
  checks = () => [{id: "a", label: "A check", command: "npm test", description: "fixture"}];
  verification = () => ({checkId: "a", success: false, exitCode: 1, output: "failure output", durationMs: 1});
  render(createElement(RepositoryWorkspaceView, {onAskAgent}));
  fireEvent.click(await screen.findByRole("button", {name: "A check"}));
  fireEvent.click(await screen.findByRole("button", {name: "Run check"}));
  await screen.findByText("failure output");
  fireEvent.click(screen.getByRole("button", {name: "Prepare check output for Agent"}));
  expect(onAskAgent).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Check output excerpt to prepare").textContent).toBe("failure output");
  fireEvent.click(screen.getByRole("button", {name: "Prepare check draft"}));
  expect(onAskAgent).toHaveBeenCalledWith({kind: "verification", checkId: "a", exitCode: 1, stale: false, excerpt: "failure output"});
  expect(m.invoke.mock.calls.filter(([name]) => name === "run_repository_check")).toHaveLength(1);
  expect(m.invoke.mock.calls.filter(([name]) => name === "write_repository_file")).toHaveLength(0);
});
it("rejects check-output consent after source changes and labels bounded excerpts", async () => {
  const onAskAgent = vi.fn();
  checks = () => [{id: "a", label: "A check", command: "npm test", description: "fixture"}];
  verification = () => ({checkId: "a", success: false, exitCode: 1, output: "x".repeat(9000), durationMs: 1});
  render(createElement(RepositoryWorkspaceView, {onAskAgent}));
  fireEvent.click(await screen.findByRole("button", {name: "same.ts"}));
  const editor = await screen.findByRole("textbox", {name: "Editing same.ts"});
  fireEvent.click(screen.getByRole("button", {name: "A check"}));
  fireEvent.click(await screen.findByRole("button", {name: "Run check"}));
  fireEvent.click(await screen.findByRole("button", {name: "Prepare check output for Agent"}));
  expect(screen.getByText(/Only the first 8,000 characters/)).toBeTruthy();
  expect(screen.getByLabelText("Check output excerpt to prepare").textContent).toHaveLength(8000);
  fireEvent.change(editor, {target: {value: "changed while reviewing"}});
  fireEvent.click(screen.getByRole("button", {name: "Prepare check draft"}));
  await screen.findByText(/verification context changed/);
  expect(onAskAgent).not.toHaveBeenCalled();
});
it("replaces a selected literal match only in memory and preserves undo", async () => {
  reads = () => "alpha beta alpha";
  await start(); fireEvent.click(screen.getByRole("button", {name: "same.ts"}));
  const editor = await screen.findByRole("textbox", {name: "Editing same.ts"});
  fireEvent.click(screen.getByRole("button", {name: "Find in file"}));
  fireEvent.change(await screen.findByRole("searchbox", {name: "Find literal text"}), {target: {value: "alpha"}});
  fireEvent.change(screen.getByRole("textbox", {name: "Replacement literal text"}), {target: {value: "$&"}});
  expect((screen.getByRole("button", {name: "Replace selected match"}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", {name: "Next match"}));
  fireEvent.click(screen.getByRole("button", {name: "Replace selected match"}));
  await waitFor(() => expect((editor as HTMLTextAreaElement).value).toBe("$& beta alpha"));
  expect(m.invoke.mock.calls.filter(([command]) => command === "write_repository_file" || command === "run_repository_check")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", {name: "Undo edit"}));
  expect((editor as HTMLTextAreaElement).value).toBe("alpha beta alpha");
});
it("navigates an unsaved source line without writes or checks and rejects invalid lines", async () => {
  reads = () => "first\noriginal";
  await start(); fireEvent.click(screen.getByRole("button", {name: "same.ts"}));
  const editor = await screen.findByRole("textbox", {name: "Editing same.ts"}) as HTMLTextAreaElement;
  fireEvent.change(editor, {target: {value: "first\nchanged second\nlast"}});
  fireEvent.change(screen.getByRole("textbox", {name: "Line number"}), {target: {value: "2"}});
  fireEvent.click(screen.getByRole("button", {name: "Go to line"}));
  expect(editor.value.slice(editor.selectionStart, editor.selectionEnd)).toBe("changed second");
  fireEvent.change(screen.getByRole("textbox", {name: "Line number"}), {target: {value: "999"}});
  fireEvent.click(screen.getByRole("button", {name: "Go to line"}));
  expect(screen.getByText(/existing one-based line number/)).toBeTruthy();
  expect(editor.value).toBe("first\nchanged second\nlast");
  expect(m.invoke.mock.calls.filter(([command]) => command === "write_repository_file" || command === "run_repository_check")).toHaveLength(0);
});

it("canceled attempts discard late passing completion and use only owned identity", async () => {
  checks = () => [{id: "a", label: "A check", command: "npm test", description: "fixture"}];
  const pending = deferred<unknown>(); verification = () => pending.promise;
  await start();
  fireEvent.click(await screen.findByRole("button", {name: "A check"}));
  fireEvent.click(screen.getByRole("button", {name: "Run check"}));
  fireEvent.click(await screen.findByRole("button", {name: "Stop check (direct child only)"}));
  await waitFor(() => expect(m.invoke).toHaveBeenCalledWith("cancel_repository_check", {repositoryPath: "/owned/A", runId: "owned-run"}));
  await act(async () => pending.resolve({checkId: "a", success: true, exitCode: 0, output: "LATE PASS", durationMs: 1}));
  expect(screen.queryByText("LATE PASS")).toBeNull();
  expect(screen.queryByText(/Last check passed/)).toBeNull();
  expect(screen.getByText(/Descendants may still run/)).toBeTruthy();
});

it("retires a prepared run when the repository changes before preparation returns", async () => {
  checks = () => [{id: "a", label: "A check", command: "npm test", description: "fixture"}];
  const preparation = deferred<string>();
  const original = m.invoke.getMockImplementation()!;
  m.invoke.mockImplementation((command: string, args: Record<string, string>) => command === "prepare_repository_check" ? preparation.promise : original(command, args));
  await start();
  fireEvent.click(await screen.findByRole("button", {name: "A check"}));
  fireEvent.click(screen.getByRole("button", {name: "Run check"}));
  await waitFor(() => expect(m.invoke).toHaveBeenCalledWith("prepare_repository_check", {repositoryPath:"/owned/A",checkId:"a"}));
  await switchToB();
  await act(async () => preparation.resolve("old-preparation"));
  expect(m.invoke).toHaveBeenCalledWith("cancel_repository_check", {repositoryPath: "/owned/A", runId: "old-preparation"});
  expect(m.invoke.mock.calls.filter(([command]) => command === "run_repository_check")).toHaveLength(0);
});

it("requires explicit consent for creation and never uses the existing-file writer", async () => {
  const existing = m.invoke.getMockImplementation()!;
  m.invoke.mockImplementation(async (command: string, args: Record<string,string>) => command === "create_repository_file" ? undefined : existing(command,args));
  const edit = {kind: "create" as const, proposalId: "new", repositoryFullName: "fixture/a", branch: "feature", path: "new.ts", baseContent: "", content: "new code"};
  render(createElement(RepositoryWorkspaceView, {editRequest:{context:m.client.config,edit}}));
  await screen.findByRole("button", {name:"same.ts"});
  fireEvent.click(screen.getByRole("button", {name:"Create new.ts locally"}));
  expect(screen.getByLabelText("New file content to create").textContent).toBe("new code");
  expect(m.invoke.mock.calls.filter(([name])=>name==="create_repository_file")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", {name:"Create local file"}));
  await waitFor(()=>expect(m.invoke).toHaveBeenCalledWith("create_repository_file",{repositoryPath:"/owned/A",relativePath:"new.ts",content:"new code",repositoryFullName:"fixture/a",branch:"feature"}));
  expect(m.invoke.mock.calls.filter(([name])=>name==="write_repository_file"||name==="run_repository_check")).toHaveLength(0);
});
it.each(["cancel", "wrong-branch", "occupied"])("keeps creation fail-closed for %s", async outcome => {
  const existing = m.invoke.getMockImplementation()!;
  m.invoke.mockImplementation(async (command: string,args: Record<string,string>) => {
    if (command === "create_repository_file") throw Error("Target already exists; nothing was overwritten.");
    return existing(command,args);
  });
  if (outcome === "wrong-branch") statuses = path=>({...status(path),branch:"different"});
  const edit = {kind:"create" as const,proposalId:"p",repositoryFullName:"fixture/a",branch:"feature",path:"new.ts",baseContent:"",content:"proposed"};
  render(createElement(RepositoryWorkspaceView,{editRequest:{context:m.client.config,edit}}));
  await screen.findByRole("button",{name:"same.ts"});
  fireEvent.click(screen.getByRole("button",{name:"Create new.ts locally"}));
  fireEvent.click(screen.getByRole("button",{name:outcome === "cancel" ? "Cancel" : "Create local file"}));
  if(outcome === "wrong-branch") await screen.findByText(/proposal's repository and branch/);
  if(outcome === "occupied") await screen.findByText(/Target already exists/);
  expect(m.invoke.mock.calls.filter(([name])=>name==="create_repository_file")).toHaveLength(outcome === "occupied" ? 1 : 0);
  expect(m.invoke.mock.calls.filter(([name])=>name==="write_repository_file"||name==="run_repository_check")).toHaveLength(0);
});

it("retires a prepared check when source changes while native preparation is pending", async () => {
  checks = () => [{ id: "a", label: "A check", command: "npm test", description: "fixture" }];
  const prepared = deferred<string>();
  const original = m.invoke.getMockImplementation()!;
  m.invoke.mockImplementation((command: string, args: Record<string, string> = {}) => command === "prepare_repository_check" ? prepared.promise : original(command, args));
  await start(); fireEvent.click(screen.getByRole("button", { name: "same.ts" }));
  const editor = await screen.findByRole("textbox", { name: "Editing same.ts" });
  fireEvent.click(screen.getByRole("button", { name: "A check" }));
  fireEvent.click(await screen.findByRole("button", { name: "Run check" }));
  await waitFor(() => expect(m.invoke).toHaveBeenCalledWith("prepare_repository_check", { repositoryPath: "/owned/A", checkId: "a" }));
  fireEvent.change(editor, { target: { value: "changed after consent during preparation" } });
  await act(async () => prepared.resolve("prepared-stale"));
  await screen.findByText(/source changed while preparing/);
  expect(m.invoke).toHaveBeenCalledWith("cancel_repository_check", { repositoryPath: "/owned/A", runId: "prepared-stale" });
  expect(m.invoke.mock.calls.filter(([name]) => name === "run_repository_check")).toHaveLength(0);
});

it("never executes a stale prepared check when retirement cannot be confirmed", async () => {
  checks = () => [{ id: "a", label: "A check", command: "npm test", description: "fixture" }];
  const prepared = deferred<string>(); const original = m.invoke.getMockImplementation()!;
  m.invoke.mockImplementation((command: string, args: Record<string, string> = {}) => {
    if (command === "prepare_repository_check") return prepared.promise;
    if (command === "cancel_repository_check") throw new Error("retirement unavailable");
    return original(command, args);
  });
  await start(); fireEvent.click(screen.getByRole("button", { name: "same.ts" }));
  const editor = await screen.findByRole("textbox", { name: "Editing same.ts" });
  fireEvent.click(screen.getByRole("button", { name: "A check" })); fireEvent.click(await screen.findByRole("button", { name: "Run check" }));
  await waitFor(() => expect(m.invoke).toHaveBeenCalledWith("prepare_repository_check", { repositoryPath: "/owned/A", checkId: "a" }));
  fireEvent.change(editor, { target: { value: "new source" } }); await act(async () => prepared.resolve("prepared-stale"));
  await screen.findByText("retirement unavailable");
  expect(m.invoke.mock.calls.filter(([name]) => name === "run_repository_check")).toHaveLength(0);
});

it.each(["push", "pull"] as const)("binds %s to the reviewed repository and branch across a credential wait", async direction => {
  const credential = deferred<unknown>(); m.client.mintGithubCloneToken.mockReturnValueOnce(credential.promise);
  await start();
  fireEvent.click(screen.getByRole("button", {name: direction === "push" ? "Push" : "Pull"}));
  fireEvent.click(screen.getByRole("button", {name: direction === "push" ? "Push branch" : "Pull changes"}));
  await waitFor(() => expect(m.client.mintGithubCloneToken).toHaveBeenCalled());
  statuses = path => ({...status(path), branch:"main"});
  await act(async () => {credential.resolve({ok:true,data:{cloneUrl:"https://example.invalid/fixture/a.git"}});});
  expect(m.invoke).toHaveBeenCalledWith(`${direction}_repository`, {repositoryPath:"/owned/A",authenticatedUrl:"https://example.invalid/fixture/a.git",repositoryFullName:"fixture/a",branch:"feature"});
});
it("binds the publish-and-PR push to the reviewed repository and branch", async () => {
  await start();
  fireEvent.click(screen.getByRole("button", {name:"same.ts"}));
  await screen.findByRole("textbox", {name:"Editing same.ts"});
  fireEvent.change(screen.getByPlaceholderText("Pull request title"), {target:{value:"Reviewed update"}});
  fireEvent.click(screen.getByRole("button", {name:"Publish & open PR"}));
  fireEvent.click(screen.getByRole("button", {name:"Publish and open PR"}));
  await waitFor(() => expect(m.invoke).toHaveBeenCalledWith("push_repository", {repositoryPath:"/owned/A",authenticatedUrl:"https://example.invalid/fixture/a.git",repositoryFullName:"fixture/a",branch:"feature"}));
});

it("keeps authorized repository discovery usable when optional preference reads fail", async () => {
  m.client.listGithubRepositories.mockResolvedValue(catalog("ready"));
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Storage blocked", "SecurityError"); });
  try {
    await start();
    await screen.findByRole("option", { name: "fixture/ready · private" });
    await waitFor(() => expect((screen.getByRole("button", { name: "Clone" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByText(/GitHub access is unavailable/)).toBeNull();
    expect((screen.getByRole("combobox", { name: "Connected GitHub repository" }) as HTMLSelectElement).value).toBe("fixture/ready");
    expect(m.client.mintGithubCloneToken).not.toHaveBeenCalled();
  } finally { read.mockRestore(); }
});

it("keeps an authorized repository selection when optional preference writes fail", async () => {
  m.client.listGithubRepositories.mockResolvedValue({ok: true, data: {repositories: [
    {id: "first", fullName: "fixture/first", defaultBranch: "main", visibility: "private"},
    {id: "second", fullName: "fixture/second", defaultBranch: "main", visibility: "private"},
  ], truncated: false}});
  await start();
  await screen.findByRole("option", {name: "fixture/second · private"});
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Storage full", "QuotaExceededError"); });
  const errors: string[] = [];
  const onError = (event: ErrorEvent) => { errors.push(event.message); event.preventDefault(); };
  window.addEventListener("error", onError);
  try {
    fireEvent.change(screen.getByRole("combobox", {name: "Connected GitHub repository"}), {target: {value: "fixture/second"}});
    expect(errors).toEqual([]);
    expect((screen.getByRole("combobox", {name: "Connected GitHub repository"}) as HTMLSelectElement).value).toBe("fixture/second");
    expect((screen.getByRole("button", {name: "Clone"}) as HTMLButtonElement).disabled).toBe(false);
    expect(m.client.mintGithubCloneToken).not.toHaveBeenCalled();
  } finally { window.removeEventListener("error", onError); write.mockRestore(); }
});

it("connects a mixed Agent proposal card to consented local save, creation and verification", async () => {
  reads = () => "original";
  checks = () => [{id: "a", label: "A check", command: "npm test", description: "fixture"}];
  const original = m.invoke.getMockImplementation()!;
  m.invoke.mockImplementation(async (command: string, args: Record<string,string>) => command === "create_repository_file" ? undefined : original(command,args));
  const approve = vi.fn(), reject = vi.fn();
  const proposal = {id: "combined", toolName: "commit_github_files", riskLevel: "medium", status: "proposed",
    argsJson: {repositoryFullName: "fixture/a", branch: "feature",
      files: [{path: "same.ts", content: "reviewed update"}, {path: "new.ts", content: "reviewed new file"}],
      _review: {kind: "github_files", files: [{path: "same.ts", baseSha: "original-blob", baseContent: "original"}, {path: "new.ts", baseSha: null, baseContent: ""}]}}};
  function Journey() {
    const [request, setRequest] = useState<LocalEditRequest>();
    return request
      ? createElement(RepositoryWorkspaceView, {editRequest: request})
      : createElement(ProposalCard, {proposal, deciding: false, onApprove: approve, onReject: reject,
        onReviewLocally: (edit, edits) => setRequest({edit, edits, context: m.client.config})});
  }
  render(createElement(Journey));
  fireEvent.click(screen.getByRole("button", {name: "Review in local editor"}));
  const review = await screen.findByRole("region", {name: "Agent local draft review"});
  expect(review.textContent).toContain("2 files");
  const openReviewedFile = await screen.findByRole("button", {name: "Open same.ts for local review"});
  await waitFor(() => expect((openReviewedFile as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(openReviewedFile);
  await screen.findByDisplayValue("original");
  fireEvent.click(screen.getByRole("button", {name: "Load editor draft"}));
  await screen.findByDisplayValue("reviewed update");
  expect(m.invoke.mock.calls.filter(([name]) => ["write_repository_file", "create_repository_file", "run_repository_check"].includes(name))).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", {name: "Save ⌘S"}));
  await screen.findByText("Saved same.ts");
  expect(m.invoke).toHaveBeenCalledWith("write_repository_file", {repositoryPath: "/owned/A", relativePath: "same.ts", content: "reviewed update", expectedContent: "original"});
  fireEvent.click(screen.getByRole("button", {name: "Create new.ts locally"}));
  expect(screen.getByLabelText("New file content to create").textContent).toBe("reviewed new file");
  expect(m.invoke.mock.calls.filter(([name]) => name === "create_repository_file")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", {name: "Create local file"}));
  await screen.findByText(/Created new.ts locally/);
  expect(m.invoke).toHaveBeenCalledWith("create_repository_file", {repositoryPath: "/owned/A", relativePath: "new.ts", content: "reviewed new file", repositoryFullName: "fixture/a", branch: "feature"});
  fireEvent.click(screen.getByRole("button", {name: "A check"}));
  expect(m.invoke.mock.calls.filter(([name]) => name === "run_repository_check")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", {name: "Run check"}));
  await screen.findByText("fixture output");
  expect(m.invoke.mock.calls.filter(([name]) => name === "run_repository_check")).toHaveLength(1);
  expect(approve).not.toHaveBeenCalled(); expect(reject).not.toHaveBeenCalled();
});

async function failedRepairFixture(onAskAgent=vi.fn()) {
 checks=()=>[{id:"a",label:"A check",command:"npm test",description:"fixture"}];
 verification=()=>({checkId:"a",success:false,exitCode:1,output:"Expected 2, received 1",durationMs:1});
 render(createElement(RepositoryWorkspaceView,{onAskAgent}));fireEvent.click(await screen.findByRole("button",{name:"same.ts"}));await screen.findByRole("textbox",{name:"Editing same.ts"});
 fireEvent.click(await screen.findByRole("button",{name:"A check"}));fireEvent.click(screen.getByRole("button",{name:"Run check"}));await screen.findByRole("button",{name:"Prepare repair with Agent"});return onAskAgent;
}
it("hands an explicitly consented failed check to a target-bound unsent repair",async()=>{const callback=await failedRepairFixture();fireEvent.click(screen.getByRole("button",{name:"Prepare repair with Agent"}));expect(callback).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Prepare repair draft"}));await waitFor(()=>expect(callback).toHaveBeenCalledWith({kind:"repair",repositoryFullName:"fixture/a",branch:"feature",path:"same.ts",checkId:"a",exitCode:1,stale:false,excerpt:"Expected 2, received 1"}));expect(m.invoke.mock.calls.filter(([name])=>name==="write_repository_file")).toHaveLength(0);expect(m.invoke.mock.calls.filter(([name])=>name==="run_repository_check")).toHaveLength(1);});
it.each(["branch","origin","disk"])("refuses repair after external %s drift",async kind=>{const callback=await failedRepairFixture();fireEvent.click(screen.getByRole("button",{name:"Prepare repair with Agent"}));if(kind==="disk")reads=()=>"changed externally";else statuses=path=>({...status(path),...(kind==="branch"?{branch:"other"}:{repositoryFullName:"other/repo"})});fireEvent.click(screen.getByRole("button",{name:"Prepare repair draft"}));await screen.findByText(/repair source, target or verification context changed/);expect(callback).not.toHaveBeenCalled();});
it("disables repair after source edits while retaining read-only debug preparation",async()=>{await failedRepairFixture();fireEvent.change(screen.getByRole("textbox",{name:"Editing same.ts"}),{target:{value:"unsaved change"}});expect((screen.getByRole("button",{name:"Prepare repair with Agent"}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole("button",{name:"Prepare check output for Agent"}) as HTMLButtonElement).disabled).toBe(false);});

it("preserves verification and repair for an aliased path with a stable canonical root",async()=>{statuses=path=>({...status(path),rootPath:"/canonical"+path});const callback=await failedRepairFixture();fireEvent.click(screen.getByRole("button",{name:"Prepare repair with Agent"}));fireEvent.click(screen.getByRole("button",{name:"Prepare repair draft"}));await waitFor(()=>expect(callback).toHaveBeenCalledOnce());expect(callback.mock.calls[0][0]).not.toHaveProperty("rootPath");});


it("distinguishes the clone source from the active local editing target", async () => {
  m.client.listGithubRepositories.mockResolvedValue({ok:true,data:{repositories:[{id:"remote",fullName:"fixture/clone-source",defaultBranch:"main",visibility:"private"}],truncated:false}});
  await start();
  const target=screen.getByLabelText("Active local editor repository");
  expect(target.textContent).toContain("LocalA");
  expect(screen.getByText("Clone source · GitHub")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Connected GitHub repository"),{target:{value:"fixture/clone-source"}});
  expect(target.textContent).toContain("LocalA");
  expect(m.client.mintGithubCloneToken).not.toHaveBeenCalled();
  expect(m.invoke.mock.calls.filter(([command])=>command==="clone_repository")).toHaveLength(0);
});

it("rejects an older proposal load when a replacement arrives during repository verification",async()=>{
 reads=()=>"original";const pending=deferred<unknown>();
 const a:LocalEditRequest={context:m.client.config,edit:{proposalId:"A",repositoryFullName:"fixture/a",branch:"feature",path:"same.ts",baseContent:"original",content:"draft A"}};
 const b:LocalEditRequest={...a,edit:{...a.edit,proposalId:"B",content:"draft B"}};
 const view=render(createElement(RepositoryWorkspaceView,{editRequest:a}));fireEvent.click(await screen.findByRole("button",{name:"same.ts"}));await screen.findByDisplayValue("original");
 statuses=()=>pending.promise;fireEvent.click(screen.getByRole("button",{name:"Load editor draft"}));
 view.rerender(createElement(RepositoryWorkspaceView,{editRequest:b}));await act(async()=>pending.resolve(status("/owned/A")));
 expect((screen.getByRole("textbox",{name:"Editing same.ts"}) as HTMLTextAreaElement).value).toBe("original");
 expect(m.invoke.mock.calls.filter(([name])=>name==="write_repository_file")).toHaveLength(0);
});
it("rejects a replaced new-file proposal before dispatching creation",async()=>{
 const a:LocalEditRequest={context:m.client.config,edit:{kind:"create",proposalId:"A",repositoryFullName:"fixture/a",branch:"feature",path:"new.ts",baseContent:"",content:"draft A"}};
 const b:LocalEditRequest={...a,edit:{...a.edit,proposalId:"B",content:"draft B"}};
 const view=render(createElement(RepositoryWorkspaceView,{editRequest:a}));await screen.findByRole("button",{name:"same.ts"});
 fireEvent.click(screen.getByRole("button",{name:"Create new.ts locally"}));view.rerender(createElement(RepositoryWorkspaceView,{editRequest:b}));
 fireEvent.click(screen.getByRole("button",{name:"Create local file"}));
 await act(async()=>{});expect(m.invoke.mock.calls.filter(([name])=>name==="create_repository_file")).toHaveLength(0);
});
it("rejects replacement while new-file repository verification is pending",async()=>{
 const pending=deferred<unknown>();
 const a:LocalEditRequest={context:m.client.config,edit:{kind:"create",proposalId:"A",repositoryFullName:"fixture/a",branch:"feature",path:"new.ts",baseContent:"",content:"draft A"}};
 const b:LocalEditRequest={...a,edit:{...a.edit,proposalId:"B",content:"draft B"}};
 const view=render(createElement(RepositoryWorkspaceView,{editRequest:a}));await screen.findByRole("button",{name:"same.ts"});
 fireEvent.click(screen.getByRole("button",{name:"Create new.ts locally"}));statuses=()=>pending.promise;fireEvent.click(screen.getByRole("button",{name:"Create local file"}));
 view.rerender(createElement(RepositoryWorkspaceView,{editRequest:b}));await act(async()=>pending.resolve(status("/owned/A")));
 expect(m.invoke.mock.calls.filter(([name])=>name==="create_repository_file")).toHaveLength(0);
});
it.each(["withdrawn","A-B-A"])("does not revive pending editor consent after proposal is %s",async variant=>{
 reads=()=>"original";const pending=deferred<unknown>();
 const a:LocalEditRequest={context:m.client.config,edit:{proposalId:"A",repositoryFullName:"fixture/a",branch:"feature",path:"same.ts",baseContent:"original",content:"draft A"}};
 const b:LocalEditRequest={...a,edit:{...a.edit,proposalId:"B",content:"draft B"}};
 const view=render(createElement(RepositoryWorkspaceView,{editRequest:a}));fireEvent.click(await screen.findByRole("button",{name:"same.ts"}));await screen.findByDisplayValue("original");
 statuses=()=>pending.promise;fireEvent.click(screen.getByRole("button",{name:"Load editor draft"}));
 view.rerender(createElement(RepositoryWorkspaceView,{editRequest:variant==="withdrawn"?undefined:b}));
 if(variant==="A-B-A")view.rerender(createElement(RepositoryWorkspaceView,{editRequest:a}));
 await act(async()=>pending.resolve(status("/owned/A")));
 expect((screen.getByRole("textbox",{name:"Editing same.ts"}) as HTMLTextAreaElement).value).toBe("original");
});
it("requires fresh review after a pending old load is rejected",async()=>{
 reads=()=>"original";const pending=deferred<unknown>();
 const a:LocalEditRequest={context:m.client.config,edit:{proposalId:"A",repositoryFullName:"fixture/a",branch:"feature",path:"same.ts",baseContent:"original",content:"draft A"}};
 const b:LocalEditRequest={...a,edit:{...a.edit,proposalId:"B",content:"draft B"}};
 const view=render(createElement(RepositoryWorkspaceView,{editRequest:a}));fireEvent.click(await screen.findByRole("button",{name:"same.ts"}));await screen.findByDisplayValue("original");
 statuses=()=>pending.promise;fireEvent.click(screen.getByRole("button",{name:"Load editor draft"}));view.rerender(createElement(RepositoryWorkspaceView,{editRequest:b}));await act(async()=>pending.resolve(status("/owned/A")));
 statuses=path=>status(path);fireEvent.click(screen.getByRole("button",{name:"Load editor draft"}));await screen.findByDisplayValue("draft B");
 expect(m.invoke.mock.calls.filter(([name])=>name==="write_repository_file"||name==="create_repository_file")).toHaveLength(0);
});

it("filters changed files and opens an available change without writing or publishing", async () => {
  statuses = path => ({...status(path), changedFiles: [{path:"other.ts",status:"M"},{path:"deleted.ts",status:"D"}]});
  await start();
  fireEvent.click(screen.getByRole("button",{name:"Changes"}));
  expect(screen.queryByRole("button",{name:"same.ts"})).toBeNull();
  expect((screen.getByRole("button",{name:"D deleted.ts"}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:"M other.ts"}));
  await screen.findByRole("textbox",{name:"Editing other.ts"});
  expect(m.invoke.mock.calls.filter(([command])=>["write_repository_file","push_repository","commit_repository_file"].includes(command))).toEqual([]);
});
it("keeps draft protection when switching through changed files", async () => {
  statuses = path => ({...status(path), changedFiles:[{path:"other.ts",status:"M"}]});
  await start(); fireEvent.click(screen.getByRole("button",{name:"same.ts"}));
  fireEvent.change(await screen.findByRole("textbox",{name:"Editing same.ts"}),{target:{value:"Unsent local edit"}});
  fireEvent.click(screen.getByRole("button",{name:"Changes"}));
  fireEvent.click(screen.getByRole("button",{name:"M other.ts"}));
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
  expect(screen.getByDisplayValue("Unsent local edit")).toBeTruthy();
});
it("refreshes recorded changes without replacing the unsaved editor buffer", async () => {
  await start(); fireEvent.click(screen.getByRole("button", {name:"same.ts"}));
  fireEvent.change(await screen.findByRole("textbox", {name:"Editing same.ts"}), {target:{value:"Unsaved stays here"}});
  statuses = path => ({...status(path), changedFiles:[{path:"other.ts",status:"M"}]});
  fireEvent.click(screen.getByRole("button", {name:"Changes"}));
  fireEvent.click(screen.getByRole("button", {name:"Refresh changes"}));
  await screen.findByRole("button", {name:"M other.ts"});
  expect(screen.getByDisplayValue("Unsaved stays here")).toBeTruthy();
});
it("restores the last verified repository for the same signed-in workspace instead of the first folder",async()=>{
 const props={workspace:"org",selectionUser:"fixture-user"};
 const first=render(createElement(RepositoryWorkspaceView,props));await screen.findByRole("button",{name:"same.ts"});
 fireEvent.click(screen.getByRole("button",{name:"B"}));await waitFor(()=>expect(screen.getByLabelText("Active local editor repository").textContent).toContain("B"));first.unmount();
 const second=render(createElement(RepositoryWorkspaceView,props));await screen.findByRole("button",{name:"same.ts"});
 expect(screen.getByLabelText("Active local editor repository").textContent).toContain("B");second.unmount();
 render(createElement(RepositoryWorkspaceView,{...props,selectionUser:"other-user"}));await screen.findByRole("button",{name:"same.ts"});
 expect(screen.getByLabelText("Active local editor repository").textContent).toContain("A");
});
it("never opens an absent stored repository and ignores storage when user scope is unverified",async()=>{
 const props={workspace:"org",selectionUser:"fixture-user"};const first=render(createElement(RepositoryWorkspaceView,props));await screen.findByRole("button",{name:"same.ts"});fireEvent.click(screen.getByRole("button",{name:"B"}));first.unmount();
 localRepositories=["/owned/A"];render(createElement(RepositoryWorkspaceView,props));await screen.findByRole("button",{name:"same.ts"});
 expect(screen.getByLabelText("Active local editor repository").textContent).toContain("A");expect(m.invoke).not.toHaveBeenCalledWith("repository_status",{repositoryPath:"/foreign/private"});
});
it("restores a managed worktree only after Git's fresh inventory confirms that exact path",async()=>{
 const {localWorkspaceSelectionKey}=await import('../../../desktop/src/lib/localWorkspaceSelection');
 const key=localWorkspaceSelectionKey(m.client.config.apiBase,"org","fixture-user")!;
 const checkout='/owned/B.axiom-worktrees/axiom-native';window.localStorage.setItem(key,JSON.stringify({root:'/owned/B',checkout}));
 const original=m.invoke.getMockImplementation()!;m.invoke.mockImplementation(async(command,args)=>command==='list_repository_worktrees'?[{path:checkout,branch:'axiom/native',bytes:0}]:original(command,args));
 render(createElement(RepositoryWorkspaceView,{workspace:'org',selectionUser:'fixture-user'}));await screen.findByRole('button',{name:'same.ts'});
 expect(screen.getByLabelText('Active local editor repository').textContent).toContain('axiom-native');
 expect(m.invoke).toHaveBeenCalledWith('list_repository_worktrees',{repositoryPath:'/owned/B'});
 expect(m.invoke).toHaveBeenCalledWith('repository_status',{repositoryPath:checkout});
});
it("refuses an unrecorded saved worktree and never probes a saved root outside the local catalog",async()=>{
 const {localWorkspaceSelectionKey}=await import('../../../desktop/src/lib/localWorkspaceSelection');const key=localWorkspaceSelectionKey(m.client.config.apiBase,'org','fixture-user')!;
 window.localStorage.setItem(key,JSON.stringify({root:'/foreign/private',checkout:'/foreign/private.axiom-worktrees/axiom-hidden'}));
 render(createElement(RepositoryWorkspaceView,{workspace:'org',selectionUser:'fixture-user'}));await screen.findByRole('button',{name:'same.ts'});
 expect(m.invoke.mock.calls.some(([,args])=>args?.repositoryPath?.startsWith('/foreign'))).toBe(false);
 expect(screen.getByLabelText('Active local editor repository').textContent).toContain('A');
});
it('keeps Find open when it is clicked as the newly loaded editor commits',async()=>{
  reads=()=> 'alpha beta alpha';let clicked=false;
  render(createElement(Profiler,{id:'find-at-editor-commit',onRender:()=>{if(clicked)return;const find=screen.queryByRole('button',{name:'Find in file'});if(find){clicked=true;find.click()}}},createElement(RepositoryWorkspaceView)));
  fireEvent.click(await screen.findByRole('button',{name:'same.ts'}));
  const search=await screen.findByRole('searchbox',{name:'Find literal text'});
  expect(clicked).toBe(true);fireEvent.change(search,{target:{value:'alpha'}});
  expect(screen.getByRole('button',{name:'Next match'})).toHaveProperty('disabled',false);
  expect(m.invoke.mock.calls.filter(([command])=>command==='write_repository_file'||command==='run_repository_check')).toHaveLength(0);
});
