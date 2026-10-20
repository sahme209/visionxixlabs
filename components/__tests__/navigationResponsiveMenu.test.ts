/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Navigation } from "../Navigation";
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
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1279 });
  fireEvent(window, new Event("resize"));
  expect(screen.getByRole("dialog", { name: "Site navigation" })).toBeDefined();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
  fireEvent(window, new Event("resize"));
  expect(screen.queryByRole("dialog", { name: "Site navigation" })).toBeNull();
  expect(document.body.style.overflow).toBe("auto");
  expect(document.documentElement.style.overflow).toBe("scroll");
});
