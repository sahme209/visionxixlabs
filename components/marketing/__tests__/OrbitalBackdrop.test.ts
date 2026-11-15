// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ create: vi.fn(), pause: vi.fn(), resize: vi.fn(), dispose: vi.fn() }));
vi.mock("../orbitScene/createOrbitScene", () => ({ createOrbitScene: state.create }));
import { OrbitalBackdrop } from "../OrbitalBackdrop";
let reduced = false;
let changes: Set<() => void>;
beforeEach(() => {
  vi.useFakeTimers(); reduced = false; changes = new Set();
  vi.stubGlobal("matchMedia", () => ({ get matches() { return reduced; }, addEventListener: (_: string, listener: () => void) => changes.add(listener), removeEventListener: (_: string, listener: () => void) => changes.delete(listener) }));
  state.create.mockReset(); state.pause.mockReset(); state.resize.mockReset(); state.dispose.mockReset();
  state.create.mockReturnValue({ setPaused: state.pause, resize: state.resize, dispose: state.dispose });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function settle() { await act(async () => { await Promise.resolve(); }); }
it("starts with static art without allocating WebGL when reduced motion is requested", async () => {
  reduced = true;
  const { container } = render(createElement(OrbitalBackdrop)); await settle();
  expect(state.create).not.toHaveBeenCalled();
  expect(container.querySelector(".orbit-fallback")).not.toBeNull();
  expect(screen.queryByRole("button", { name: /visual motion/ })).toBeNull();
});
it("settles the single entrance without player controls and never restarts it", async () => {
  const view = render(createElement(OrbitalBackdrop)); await settle();
  expect(state.pause).toHaveBeenLastCalledWith(false);
  expect(screen.queryByRole("button")).toBeNull();
  act(() => { vi.advanceTimersByTime(4000); });
  expect(state.pause).toHaveBeenLastCalledWith(true);
  expect(view.container.querySelector(".orbit-backdrop--active")).toBeNull();
  reduced = true; act(() => { for (const listener of changes) listener(); });
  reduced = false; act(() => { for (const listener of changes) listener(); });
  expect(state.pause).toHaveBeenLastCalledWith(true);
  expect(state.create).toHaveBeenCalledTimes(1);
  view.unmount(); expect(state.dispose).toHaveBeenCalledTimes(1); expect(changes.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});
it("keeps the fallback and hides unavailable controls when renderer creation fails", async () => {
  state.create.mockImplementation(() => { throw new Error("unavailable"); });
  const { container } = render(createElement(OrbitalBackdrop)); await settle();
  expect(container.querySelector(".orbit-fallback")).not.toBeNull();
  expect(container.querySelector(".orbit-backdrop--ready")).toBeNull();
  expect(screen.queryByRole("button", { name: /visual motion/ })).toBeNull();
});
it("returns to static art after context failure and does not allocate another scene on preference changes", async () => {
  const { container } = render(createElement(OrbitalBackdrop)); await settle();
  const unavailable = state.create.mock.calls[0][1] as () => void;
  act(unavailable);
  expect(container.querySelector(".orbit-backdrop--ready")).toBeNull();
  act(() => { for (const listener of changes) listener(); }); await settle();
  expect(state.create).toHaveBeenCalledTimes(1);
});
it("does not allocate a delayed scene after the component has unmounted", async () => {
  const view = render(createElement(OrbitalBackdrop)); view.unmount(); await settle();
  expect(state.create).not.toHaveBeenCalled();
});
