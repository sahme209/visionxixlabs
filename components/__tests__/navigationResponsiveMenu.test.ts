/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Navigation } from "../Navigation";
vi.mock("@heroicons/react/24/outline", () => ({ Bars3Icon: () => null, XMarkIcon: () => null }));
const originalWidth = window.innerWidth;
afterEach(() => { cleanup(); vi.unstubAllGlobals(); Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth }); document.body.style.overflow = ""; document.documentElement.style.overflow = ""; });
it("closes the mobile dialog and releases both scroll locks when desktop navigation takes over", () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1100 });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 0; });
  document.body.style.overflow = "auto"; document.documentElement.style.overflow = "scroll";
  render(createElement(Navigation));
  fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
  expect(screen.getByRole("dialog", { name: "Site navigation" })).toBeDefined();
  expect(document.body.style.overflow).toBe("hidden");
  screen.getByRole("dialog").querySelector<HTMLAnchorElement>("a")!.focus();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1279 });
  fireEvent(window, new Event("resize"));
  expect(screen.getByRole("dialog", { name: "Site navigation" })).toBeDefined();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
  fireEvent(window, new Event("resize"));
  expect(screen.queryByRole("dialog", { name: "Site navigation" })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Vision XIX Labs home" }));
  expect(document.body.style.overflow).toBe("auto");
  expect(document.documentElement.style.overflow).toBe("scroll");
});

it("keeps the viewport menu outside the header blur containing block", () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 0; });
  render(createElement(Navigation));
  const navigation = screen.getByRole("navigation", { name: "Primary navigation" });
  expect(navigation.className).not.toContain("backdrop-blur");
  expect(navigation.firstElementChild?.className).toContain("backdrop-blur-xl");
  fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
  const dialog = screen.getByRole("dialog", { name: "Site navigation" });
  expect(dialog.parentElement).toBe(navigation);
  expect(dialog.className).toContain("overflow-y-auto");
  expect(screen.getByRole("link", { name: "Contact" })).toBeDefined();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open navigation menu" }));
});

it("preserves focus outside a menu during responsive closure", () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1100 });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 0; });
  render(createElement(Navigation));
  fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
  const external = document.createElement("button"); document.body.append(external); external.focus();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
  fireEvent(window, new Event("resize"));
  expect(document.activeElement).toBe(external); external.remove();
});
it("moves focus from the desktop More menu to the visible home link when narrowed", () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
  render(createElement(Navigation));
  fireEvent.click(screen.getByRole("button", { name: /More/ }));
  screen.getByRole("link", { name: "Get started" }).focus();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1279 });
  fireEvent(window, new Event("resize"));
  expect(screen.queryByRole("group", { name: "More destinations" })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("link", { name: "Vision XIX Labs home" }));
});
