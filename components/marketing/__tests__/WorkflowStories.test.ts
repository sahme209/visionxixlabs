/** @vitest-environment jsdom */
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CinematicAxiomDemo } from "../CinematicAxiomDemo";
import ApprovalWorkflowPage from "@/app/docs/approval-workflow/page";

let intersect: (entries: { isIntersecting: boolean }[]) => void;
let motionChange: (event: { matches: boolean }) => void;
let reduced = false;
let media: { matches: boolean; addEventListener: (_: string, cb: typeof motionChange) => void; removeEventListener: ReturnType<typeof vi.fn> };
beforeEach(() => {
  vi.useFakeTimers(); reduced = false;
  vi.stubGlobal("matchMedia", () => { media = { matches: reduced, addEventListener: (_: string, cb: typeof motionChange) => { motionChange = cb; }, removeEventListener: vi.fn() }; return media; });
  vi.stubGlobal("IntersectionObserver", class { constructor(cb: typeof intersect) { intersect = cb; } observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function mount() { render(createElement(CinematicAxiomDemo)); act(() => intersect([{ isIntersecting: true }])); }
function advance(ms = 6000) { act(() => vi.advanceTimersByTime(ms)); }

it("keeps the linked approval documentation distinct from verified ECS execution and recovery", () => {
  const { container } = render(createElement(ApprovalWorkflowPage));
  const execution = container.querySelector("#execution")!;
  expect(execution.textContent).toContain("separately configured tenant-owned workflow");
  expect(execution.textContent).toContain("does not verify ECS execution, service health or rollback");
  const recovery = screen.getByText("Is every rollback universal?").parentElement!;
  expect(recovery.textContent).toContain("Automatic ECS rollback is not verified");
  expect(container.textContent).not.toContain("restores the prior definition if stabilization fails");
  expect(container.textContent).not.toContain("automatic rollback applies to the released ECS workflow");
  expect(screen.getByText(/The Agent cannot approve its own request/)).toBeDefined();
  expect(screen.getByText(/A workspace administrator must approve the persisted proposal/)).toBeDefined();
});

it("links every story to working approval documentation without promising a retired full walkthrough", () => {
  mount();
  for (const label of ["Code & review", "Agent & approval", "Terraform & cloud"]) {
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(screen.getByRole("link", { name: "Read approval workflow" }).getAttribute("href")).toBe("/docs/approval-workflow");
    expect(screen.queryByRole("link", { name: "Read the full walkthrough" })).toBeNull();
    expect(screen.getAllByRole("link").some(link => link.getAttribute("href")?.startsWith("/demo/"))).toBe(false);
  }
});

it("describes check environment and output limits without promising credential isolation", () => {
  mount(); fireEvent.click(screen.getByRole("button", { name: "Step 3: Review the bounded check." }));
  expect(screen.getByText(/local files and stored credentials can still be read with your user permissions/)).toBeDefined();
  expect(screen.getByText(/5-minute timeout and separate 1 MB limits for standard output and error output/)).toBeDefined();
  expect(screen.queryByText(/removes credentials/)).toBeNull();
});

it("pauses at human review without recording approval or contacting a service", () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); mount();
  fireEvent.click(screen.getByRole("button", { name: "Play story" })); advance(); advance();
  expect(screen.getByRole("heading", { name: "Review the bounded check." })).toBeDefined();
  advance(30000);
  expect(screen.getByRole("button", { name: "Simulate approval" })).toBeDefined();
  expect(screen.queryByText("Sample decision recorded" )).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Simulate approval" }));
  expect(screen.getByText("Sample decision recorded")).toBeDefined();
  expect(fetch).not.toHaveBeenCalled();
});

it("invalidates sample approval when selected context changes", () => {
  mount(); fireEvent.click(screen.getByRole("button", { name: "Step 3: Review the bounded check." }));
  fireEvent.click(screen.getByRole("button", { name: "Simulate approval" }));
  fireEvent.change(screen.getByLabelText("Branch"), { target: { value: "review/retry-policy" } });
  expect(screen.queryByText("Sample decision recorded")).toBeNull();
  expect(screen.getByRole("heading", { name: "Choose the working context." })).toBeDefined();
});

it("freezes playback offscreen and in a hidden document, then resumes without skipping", () => {
  mount(); fireEvent.click(screen.getByRole("button", { name: "Play story" }));
  act(() => intersect([{ isIntersecting: false }])); advance(30000);
  expect(screen.getByRole("heading", { name: "Choose the working context." })).toBeDefined();
  act(() => intersect([{ isIntersecting: true }])); advance();
  expect(screen.getByRole("heading", { name: "Make a small, reviewable edit." })).toBeDefined();
  Object.defineProperty(document, "hidden", { configurable: true, value: true }); fireEvent(document, new Event("visibilitychange")); advance(30000);
  expect(screen.getByRole("heading", { name: "Make a small, reviewable edit." })).toBeDefined();
  Object.defineProperty(document, "hidden", { configurable: true, value: false }); fireEvent(document, new Event("visibilitychange"));
});

it("honors reduced motion initially and when preferences change", () => {
  reduced = true; mount(); advance(30000);
  expect(screen.queryByRole("button", { name: "Pause story" })).toBeNull();
  expect(screen.getByText("Reduced motion · use the step controls")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  expect(screen.getByRole("heading", { name: "Make a small, reviewable edit." })).toBeDefined();
  act(() => { media.matches = false; motionChange({ matches: false }); });
  fireEvent.click(screen.getByRole("button", { name: "Play story" }));
  expect(screen.getByRole("button", { name: "Pause story" })).toBeDefined();
  act(() => { media.matches = true; motionChange({ matches: true }); }); advance(30000);
  expect(screen.getByRole("heading", { name: "Make a small, reviewable edit." })).toBeDefined();
});

it("supports keyboard navigation and replay without overriding dropdown keys", () => {
  mount(); const controls = screen.getByRole("group", { name: "Story playback" });
  fireEvent.keyDown(controls, { key: "ArrowRight" });
  expect(screen.getByRole("heading", { name: "Make a small, reviewable edit." })).toBeDefined();
  fireEvent.keyDown(screen.getByLabelText("Branch"), { key: "ArrowRight" });
  expect(screen.getByRole("heading", { name: "Make a small, reviewable edit." })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Replay story" }));
  expect(screen.getByRole("heading", { name: "Choose the working context." })).toBeDefined();
});

it("keeps Terraform authority unavailable and never offers apply or fabricated cloud success", () => {
  mount(); fireEvent.click(screen.getByRole("button", { name: "Terraform & cloud" }));
  fireEvent.click(screen.getByRole("button", { name: "Step 3: Keep the release on hold." }));
  expect(screen.getByText("Cloud end-to-end acceptance is unverified.")).toBeDefined();
  expect(screen.queryByRole("button", { name: /apply|approve|Simulate approval/i })).toBeNull();
  expect(screen.getByText("Current target authority unavailable")).toBeDefined();
});

it("preserves partial typing when paused and cleans up all timers on unmount", () => {
  const view = render(createElement(CinematicAxiomDemo)); act(() => intersect([{ isIntersecting: true }]));
  fireEvent.click(screen.getByRole("button", { name: "Play story" })); advance(720);
  fireEvent.click(screen.getByRole("button", { name: "Pause story" }));
  const visibleText = view.container.textContent;
  advance(30000); expect(view.container.textContent).toBe(visibleText);
  fireEvent.click(screen.getByRole("button", { name: "Play story" }));
  view.unmount(); advance(30000); expect(vi.getTimerCount()).toBe(0);
});

it("rejects a sample, resets when switching stories, and stops on the final scene", () => {
  mount(); fireEvent.click(screen.getByRole("button", { name: "Step 3: Review the bounded check." }));
  fireEvent.click(screen.getByRole("button", { name: "Reject sample" }));
  expect(screen.getByText("Sample rejected · no action taken")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Agent & approval" }));
  expect(screen.queryByText("Sample rejected · no action taken")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Step 4: Keep the outcome honest." }));
  fireEvent.click(screen.getByRole("button", { name: "Play story" })); advance();
  expect(screen.queryByRole("button", { name: "Pause story" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Keep the outcome honest." })).toBeDefined();
  expect((screen.getByRole("button", { name: "Next step" }) as HTMLButtonElement).disabled).toBe(true);
});


it("grounds the scripted frame in customer navigation without exposing operational controls", () => {
  mount();
  const navigation = screen.getByRole("complementary", { name: "Navigation illustrated from the desktop application" });
  expect(navigation.textContent).toContain("No connected account.");
  expect(navigation.querySelectorAll("button, a, input")).toHaveLength(0);
  expect(screen.getByText("Axiom Agent · Repositories")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Agent & approval" }));
  expect(screen.getByText("Axiom Agent · Agent")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Terraform & cloud" }));
  expect(screen.getByText("Axiom Agent · Releases")).toBeDefined();
  expect(screen.getByText("Scripted preview")).toBeDefined();
});
