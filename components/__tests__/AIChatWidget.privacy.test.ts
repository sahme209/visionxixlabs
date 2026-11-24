/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AIChatWidget from "../AIChatWidget";

vi.mock("next/navigation", () => ({ usePathname: () => "/docs" }));

const storageKey = "visionxix-ai-widget-messages";
const fixture = "password=sample-only";
const send = vi.fn();

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", send);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  send.mockReset();
  send.mockRejectedValue(new Error("offline fixture"));
  if (!HTMLElement.prototype.scrollTo) HTMLElement.prototype.scrollTo = () => {};
  vi.spyOn(HTMLElement.prototype, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("public support message privacy", () => {
  it("refuses a detected credential locally without sending or storing it", async () => {
    const writes = vi.spyOn(Storage.prototype, "setItem");
    render(createElement(AIChatWidget));
    fireEvent.click(screen.getByRole("button", { name: "Open V19 Assistant" }));
    const input = screen.getByRole("textbox", { name: "Ask V19 a question" });
    fireEvent.change(input, { target: { value: fixture } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText(/that message looks like it contains/i)).toBeDefined();
    expect(screen.queryByText(fixture)).toBeNull();
    expect(send).not.toHaveBeenCalled();
    expect(writes.mock.calls.filter(([key]) => key === storageKey).every(([,value]) => !value.includes(fixture))).toBe(true);
    expect(localStorage.getItem(storageKey)).toContain("[removed: looked like a secret]");
  });

  it("cleans legacy messages and retry questions while preserving normal chat history", async () => {
    const timestamp = "2026-11-23T00:00:00.000Z";
    localStorage.setItem(storageKey, JSON.stringify([
      { id: "1", role: "user", content: fixture, timestamp },
      { id: "2", role: "assistant", content: "Open the setup guide.", question: fixture, timestamp },
    ]));
    render(createElement(AIChatWidget));
    fireEvent.click(screen.getByRole("button", { name: "Open V19 Assistant" }));

    expect(await screen.findByText("Open the setup guide.")).toBeDefined();
    expect(screen.queryByText(fixture)).toBeNull();
    await waitFor(() => expect(localStorage.getItem(storageKey)).not.toContain(fixture));
    expect(send).not.toHaveBeenCalled();
  });

  it("still sends an ordinary documentation question to grounded support", async () => {
    render(createElement(AIChatWidget));
    fireEvent.click(screen.getByRole("button", { name: "Open V19 Assistant" }));
    const input = screen.getByRole("textbox", { name: "Ask V19 a question" });
    fireEvent.change(input, { target: { value: "How do I find the setup guide?" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0][0]).toBe("/api/support/answer");
  });
});
