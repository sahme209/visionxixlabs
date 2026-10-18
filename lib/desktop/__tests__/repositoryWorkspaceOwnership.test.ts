/** @vitest-environment jsdom */
import { createElement, Profiler } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const m = vi.hoisted(() => ({ invoke: vi.fn(), client: { config: {} as { sessionToken?: string }, listGithubRepositories: vi.fn(), mintGithubCloneToken: vi.fn(), subscribeContext: (listener: () => void) => { void listener; return () => {}; }, getContextRevision: (): number => 0, setSession: (token: string | undefined) => { void token; } } }));
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
import { RepositoryWorkspaceView } from "../../../desktop/src/views/RepositoryWorkspaceView";
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
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
  reads = (path, file) => `${path}:${file}`; statuses = path => status(path); checks = () => []; writes = () => undefined; verification = () => ({ checkId: "a", success: true, exitCode: 0, output: "fixture output", durationMs: 1 });
  m.invoke.mockImplementation(async (command: string, args: Record<string, string> = {}) => {
    if (command === "default_repos_directory") return "/owned";
    if (command === "list_local_repositories") return [...localRepositories];
    if (command === "clone_repository") { localRepositories.push(args.destinationPath); return args.destinationPath; }
    if (command === "repository_status") return statuses(args.repositoryPath);
    if (command === "list_repository_files") return ["same.ts", "other.ts"];
    if (command === "detect_repository_checks") return checks(args.repositoryPath);
    if (command === "read_repository_file") return reads(args.repositoryPath, args.relativePath);
    if (command === "write_repository_file") return writes(args);
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
  await waitFor(() => expect(m.invoke).toHaveBeenCalledWith("write_repository_file", { repositoryPath: "/owned/B", relativePath: "same.ts", content: "edited B" }));
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
