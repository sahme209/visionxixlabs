// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProductTour } from "../ProductTour";
import { PREVIEW_TOURS } from "@/lib/marketing/previewTours";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("ProductTour", () => {
  it("sets each clip's src once, without re-calling load(), and switches clips per tab", () => {
    const load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    const { container } = render(createElement(ProductTour));
    const first = container.querySelector("video")!;
    expect(first.getAttribute("src")).toBe(PREVIEW_TOURS[0].video);
    expect(first.querySelector("source")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: PREVIEW_TOURS[1].label }));
    expect(container.querySelector("video")!.getAttribute("src")).toBe(PREVIEW_TOURS[1].video);
    expect(load).not.toHaveBeenCalled();
  });
});
