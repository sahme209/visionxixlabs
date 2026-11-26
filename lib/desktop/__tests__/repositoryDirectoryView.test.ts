/** @vitest-environment jsdom */
import {createElement} from "react";
import {act, cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {afterEach, expect, it, vi} from "vitest";
import {RepositoryDirectoryView} from "../../../desktop/src/views/RepositoryDirectoryView";
import {desktopClient} from "../../../desktop/src/lib/desktopClient";

const row = {
  id: "fixture-registry-row", displayName: "fixture/gallery", defaultBranch: "main",
  provider: "github" as const, protectionStrength: "strong" as const,
  openPrCount: 2, recentTagCount: 0, remoteUrl: "", flavorBadge: null, lastWorkflow: null,
};
const data = {generatedAt: "2026-11-20T09:00:00.000Z", repositories: [row], summary: {total: 1, byProvider: {github: 1}, weakProtection: 0}};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("keeps refresh focus and the search term while the directory is read again", async () => {
  let complete!: (result: {ok: true; data: typeof data}) => void;
  const read = vi.spyOn(desktopClient, "listRepositories")
    .mockResolvedValueOnce({ok: false, error: "Synthetic unavailable"})
    .mockImplementationOnce(() => new Promise(resolve => {complete = resolve;}));
  render(createElement(RepositoryDirectoryView, {active: true, canRead: true, onOpenLocal: vi.fn()}));
  await screen.findByRole("alert");
  const search = screen.getByRole<HTMLInputElement>("searchbox", {name: "Search repositories"});
  fireEvent.change(search, {target: {value: "gallery"}});
  const refresh = screen.getByRole<HTMLButtonElement>("button", {name: "Refresh directory"});
  refresh.focus();
  fireEvent.click(refresh);
  expect(refresh.disabled).toBe(false);
  expect(refresh.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(refresh);
  expect(read).toHaveBeenCalledTimes(2);
  await act(async () => complete({ok: true, data}));
  expect(document.activeElement).toBe(refresh);
  expect(search.value).toBe("gallery");
  expect(screen.getByRole("button", {name: "Inspect fixture/gallery"})).toBeTruthy();
});

it("filters and inspects authorized registry rows without opening a local checkout", async () => {
  const read = vi.spyOn(desktopClient, "listRepositories").mockResolvedValue({ok: true, data});
  const openLocal = vi.fn();
  render(createElement(RepositoryDirectoryView, {active: true, canRead: true, onOpenLocal: openLocal}));
  const inspect = await screen.findByRole("button", {name: "Inspect fixture/gallery"});
  fireEvent.click(inspect);
  const dialog = screen.getByRole("dialog", {name: "Repository details for fixture/gallery"});
  const close = within(dialog).getByRole("button", {name: "Close repository details"});
  expect(document.activeElement).toBe(close);
  for (const shiftKey of [false, true]) {
    expect(fireEvent.keyDown(close, {key: "Tab", shiftKey})).toBe(false);
    expect(document.activeElement).toBe(close);
  }
  expect(inspect.closest("[inert]")).toBeTruthy();
  fireEvent.keyDown(close, {key: "Escape"});
  expect(inspect.closest("[inert]")).toBeNull();
  expect(document.activeElement).toBe(inspect);

  fireEvent.change(screen.getByRole("combobox", {name: "Provider"}), {target: {value: "gitlab"}});
  expect(screen.getByText("No matching repositories.")).toBeTruthy();
  expect(read).toHaveBeenCalledTimes(1);
  expect(openLocal).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "Open local editor"}));
  expect(openLocal).toHaveBeenCalledOnce();
});

it("does not read the directory without paired pipeline access", () => {
  const read = vi.spyOn(desktopClient, "listRepositories");
  render(createElement(RepositoryDirectoryView, {active: true, canRead: false, onOpenLocal: vi.fn()}));
  expect(screen.getByText("The current session cannot read the repository directory.")).toBeTruthy();
  expect(read).not.toHaveBeenCalled();
});

it("ignores a late response after leaving the directory and distinguishes a failed read from empty", async () => {
  let complete!: (result: {ok: true; data: typeof data}) => void;
  const read = vi.spyOn(desktopClient, "listRepositories")
    .mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }))
    .mockResolvedValue({ok: false, error: "Synthetic unavailable"});
  const props = {canRead: true, onOpenLocal: vi.fn()};
  const view = render(createElement(RepositoryDirectoryView, {...props, active: true}));
  view.rerender(createElement(RepositoryDirectoryView, {...props, active: false}));
  await act(async () => { complete({ok: true, data}); });
  expect(screen.queryByText("fixture/gallery")).toBeNull();
  view.rerender(createElement(RepositoryDirectoryView, {...props, active: true}));
  expect((await screen.findByRole("alert")).textContent).toContain("Repository directory is unavailable.");
  expect(screen.queryByText("No repositories are registered.")).toBeNull();
  expect(read).toHaveBeenCalledTimes(2);
});

it("shows recorded workflow evidence without inferring live build health or an outcome", async () => {
  const rows = [
    row,
    {...row, id: "observed", displayName: "fixture/billing", lastWorkflow: {name: "Verification", state: "completed" as const, conclusion: "success", startedAtIso: null}},
    {...row, id: "pending", displayName: "fixture/inventory", lastWorkflow: {name: "Integration checks", state: "in_progress" as const, conclusion: "success", startedAtIso: null}},
  ];
  const read = vi.spyOn(desktopClient, "listRepositories").mockResolvedValue({ok: true, data: {...data, repositories: rows}});
  render(createElement(RepositoryDirectoryView, {active: true, canRead: true, onOpenLocal: vi.fn()}));
  const table = await screen.findByRole("table");
  expect(within(table).getByRole("columnheader", {name: "Last recorded workflow"})).toBeTruthy();
  expect(within(table).getByText("Passed")).toBeTruthy();
  const running = within(table).getByRole("row", {name: /fixture\/inventory/});
  expect(within(running).getByText("In progress")).toBeTruthy();
  expect(within(running).queryByText("Passed")).toBeNull();
  expect(within(table).getByText("No workflow recorded")).toBeTruthy();
  const success = screen.getByRole("button", {name: "Successful workflow", description: "1 loaded"});
  success.focus();
  fireEvent.keyDown(success, {key: "/"});
  expect(document.activeElement).toBe(screen.getByRole("searchbox", {name: "Search repositories"}));
  fireEvent.click(success);
  expect(within(table).getByText("Passed")).toBeTruthy();
  expect(within(table).queryByText("No workflow recorded")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Failed workflow"}));
  expect(screen.getByText("No matching repositories.")).toBeTruthy();
  expect(screen.getByText("registered repositories").nextElementSibling?.textContent).toBe("3");
  expect(read).toHaveBeenCalledOnce();
});

it("shows the selected registry facts and only a verified workflow start time in the inspector", async () => {
  const startedAtIso = "2026-11-20T10:00:00.000Z";
  const syncedAtIso = "2026-11-20T10:08:00.000Z";
  const commitSha = "a".repeat(40);
  const workflow = {name: "Checks", state: "completed" as const, conclusion: "success", startedAtIso, syncedAtIso, commitSha};
  const read = vi.spyOn(desktopClient, "listRepositories").mockResolvedValue({ok: true, data: {...data, repositories: [
    {...row, lastWorkflow: workflow},
    {...row, id: "invalid-date", displayName: "fixture/camera", lastWorkflow: {...workflow, startedAtIso: "2026-02-30T10:00:00Z", syncedAtIso: "invalid", commitSha: "invalid"}},
  ]}});
  render(createElement(RepositoryDirectoryView, {active: true, canRead: true, onOpenLocal: vi.fn()}));
  expect(await screen.findByText("Showing 1–2 of 2 matching repositories")).toBeTruthy();
  const savedRow = screen.getByRole("row", {name: /fixture\/gallery/});
  expect(within(savedRow).getByText("aaaaaaa").getAttribute("title")).toBe(commitSha);
  expect(savedRow.querySelector("time")?.dateTime).toBe(syncedAtIso);
  fireEvent.click(screen.getByRole("button", {name: "Inspect fixture/gallery"}));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("Recorded protection").nextElementSibling?.textContent).toBe("strong");
  expect(within(dialog).getByText("Open PRs").nextElementSibling?.textContent).toBe("2");
  expect(within(dialog).getByText(commitSha)).toBeTruthy();
  expect(within(dialog).getByText("completed · success")).toBeTruthy();
  expect([...dialog.querySelectorAll("time")].map(time => time.dateTime)).toEqual([syncedAtIso, startedAtIso]);
  fireEvent.click(within(dialog).getByRole("button", {name: "Close repository details"}));
  fireEvent.click(screen.getByRole("button", {name: "Inspect fixture/camera"}));
  expect(within(screen.getByRole("dialog")).getByText("Time unavailable")).toBeTruthy();
  expect(screen.getByRole("dialog").querySelector("time")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Close repository details"}));
  const search = screen.getByRole("searchbox", {name: "Search repositories"});
  fireEvent.change(search, {target: {value: "AAAAAAA"}});
  expect(screen.getByRole("button", {name: "Inspect fixture/gallery"})).toBeTruthy();
  expect(screen.queryByRole("button", {name: "Inspect fixture/camera"})).toBeNull();
  fireEvent.change(search, {target: {value: commitSha}});
  expect(screen.getByRole("button", {name: "Inspect fixture/gallery"})).toBeTruthy();
  fireEvent.change(search, {target: {value: "invalid"}});
  expect(screen.getByText("No matching repositories.")).toBeTruthy();
  expect(read).toHaveBeenCalledOnce();
});

it("sorts the filtered directory by recorded sync before paging without another read", async () => {
  const repositories = Array.from({length: 10}, (_, index) => ({
    ...row, id: `fixture-${index}`, displayName: `fixture/repository-${index}`,
    lastWorkflow: {
      name: "Checks", state: "completed" as const, conclusion: "success", startedAtIso: null,
      syncedAtIso: index === 0 ? "invalid" : index === 9 ? null : `2026-11-20T10:0${index}:00.000Z`,
    },
  }));
  const read = vi.spyOn(desktopClient, "listRepositories").mockResolvedValue({ok: true, data: {...data, repositories}});
  render(createElement(RepositoryDirectoryView, {active: true, canRead: true, onOpenLocal: vi.fn()}));
  const table = within(await screen.findByRole("table"));
  const search = screen.getByRole("searchbox", {name: "Search repositories"});
  fireEvent.change(search, {target: {value: "fixture/"}});
  fireEvent.click(screen.getByRole("button", {name: "Successful workflow"}));
  fireEvent.click(screen.getByRole("button", {name: "Next"}));
  const sort = screen.getByRole("combobox", {name: "Sort by recorded workflow sync"});
  sort.focus();
  fireEvent.change(sort, {target: {value: "newest"}});
  const inspectedLabels = () => table.getAllByRole("button").map(button => button.getAttribute("aria-label"));
  expect(inspectedLabels()).toEqual([8, 7, 6, 5, 4, 3, 2, 1].map(index => `Inspect fixture/repository-${index}`));
  const synced = table.getByRole("columnheader", {name: "Workflow synced"});
  expect(synced.getAttribute("aria-sort")).toBe("descending");
  expect(document.activeElement).toBe(sort);
  expect(search).toHaveProperty("value", "fixture/");
  fireEvent.change(sort, {target: {value: "oldest"}});
  expect(inspectedLabels()).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map(index => `Inspect fixture/repository-${index}`));
  expect(synced.getAttribute("aria-sort")).toBe("ascending");
  fireEvent.click(screen.getByRole("button", {name: "Next"}));
  expect(inspectedLabels()).toEqual([0, 9].map(index => `Inspect fixture/repository-${index}`));
  fireEvent.change(sort, {target: {value: ""}});
  expect(inspectedLabels()[0]).toBe("Inspect fixture/repository-0");
  expect(synced.hasAttribute("aria-sort")).toBe(false);
  expect(read).toHaveBeenCalledOnce();
});

it("keeps pager focus and announces the displayed range at each boundary", async () => {
  const repositories = Array.from({length: 9}, (_, index) => ({
    ...row, id: `fixture-${index + 1}`, displayName: `fixture/repository-${index + 1}`,
  }));
  const read = vi.spyOn(desktopClient, "listRepositories").mockResolvedValue({ok: true, data: {...data, repositories}});
  render(createElement(RepositoryDirectoryView, {active: true, canRead: true, onOpenLocal: vi.fn()}));
  const table = await screen.findByRole("region", {name: "Loaded repository rows"});
  expect(table.getAttribute("tabindex")).toBe("0");
  const pager = within(screen.getByRole("navigation", {name: "Repository pages"}));
  const previous = pager.getByRole("button", {name: "Previous"});
  const next = pager.getByRole("button", {name: "Next"});
  expect(previous.getAttribute("aria-disabled")).toBe("true");
  next.focus();
  fireEvent.click(next);
  expect(next.getAttribute("aria-disabled")).toBe("true");
  expect(document.activeElement).toBe(next);
  const range = screen.getByText("Showing 9–9 of 9 matching repositories");
  expect(range.getAttribute("aria-live")).toBe("polite");
  expect(within(table).getByRole("button", {name: "Inspect fixture/repository-9"})).toBeTruthy();
  fireEvent.click(next);
  expect(screen.getByText("Showing 9–9 of 9 matching repositories")).toBeTruthy();
  previous.focus();
  fireEvent.click(previous);
  expect(previous.getAttribute("aria-disabled")).toBe("true");
  expect(document.activeElement).toBe(previous);
  expect(screen.getByText("Showing 1–8 of 9 matching repositories")).toBeTruthy();
  const pageTwo = pager.getByRole("button", {name: "Page 2 of 2"});
  pageTwo.focus();
  fireEvent.click(pageTwo);
  expect(document.activeElement).toBe(pageTwo);
  expect(pageTwo.getAttribute("aria-current")).toBe("page");
  expect(screen.getByText("Showing 9–9 of 9 matching repositories")).toBeTruthy();
  expect(read).toHaveBeenCalledOnce();
});

it("shows or hides supported columns without reloading rows, and restores the column control on Escape", async () => {
  const read = vi.spyOn(desktopClient, "listRepositories").mockResolvedValue({ok: true, data});
  render(createElement(RepositoryDirectoryView, {active: true, canRead: true, onOpenLocal: vi.fn()}));
  const inspect = await screen.findByRole("button", {name: "Inspect fixture/gallery"});
  const summary = screen.getByText("Columns");
  fireEvent.click(summary);
  const workflow = screen.getByRole<HTMLInputElement>("checkbox", {name: "Last recorded workflow"});
  expect(workflow.checked).toBe(true);
  fireEvent.click(workflow);
  expect(workflow.checked).toBe(false);
  expect(screen.queryByRole("columnheader", {name: "Last recorded workflow"})).toBeNull();
  expect(screen.queryByRole("cell", {name: "No workflow recorded"})).toBeNull();
  fireEvent.keyDown(workflow, {key: "Escape"});
  expect(summary.closest("details")?.open).toBe(false);
  expect(document.activeElement).toBe(summary);

  fireEvent.click(inspect);
  const dialog = screen.getByRole("dialog", {name: "Repository details for fixture/gallery"});
  expect(within(dialog).getByText("No workflow recorded")).toBeTruthy();
  fireEvent.keyDown(document.activeElement!, {key: "Escape"});
  expect(document.activeElement).toBe(inspect);

  fireEvent.click(summary);
  fireEvent.click(screen.getByRole("button", {name: "Show all columns"}));
  expect(workflow.checked).toBe(true);
  expect(screen.getByRole("columnheader", {name: "Last recorded workflow"})).toBeTruthy();
  expect(read).toHaveBeenCalledOnce();
});

it("switches between list and grid layouts with the same rows and inspector", async () => {
  vi.spyOn(desktopClient, "listRepositories").mockResolvedValue({ok: true, data});
  render(createElement(RepositoryDirectoryView, {active: true, canRead: true, onOpenLocal: vi.fn()}));
  await screen.findByRole("button", {name: "Inspect fixture/gallery"});
  const grid = screen.getByRole("button", {name: "Grid view"});
  fireEvent.click(grid);
  expect(grid.getAttribute("aria-pressed")).toBe("true");
  const cards = screen.getByRole("list", {name: "Loaded repository cards"});
  expect(screen.queryByRole("region", {name: "Loaded repository rows"})).toBeNull();
  const inspect = within(cards).getByRole("button", {name: "Inspect fixture/gallery"});
  fireEvent.click(inspect);
  expect(screen.getByRole("dialog", {name: "Repository details for fixture/gallery"})).toBeTruthy();
  fireEvent.keyDown(document.activeElement!, {key: "Escape"});
  expect(document.activeElement).toBe(inspect);
  fireEvent.click(screen.getByRole("button", {name: "List view"}));
  expect(screen.getByRole("region", {name: "Loaded repository rows"})).toBeTruthy();
});
