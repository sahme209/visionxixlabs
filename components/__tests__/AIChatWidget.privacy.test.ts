/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AIChatWidget from "../AIChatWidget";
import { takeSupportContactDraft } from "@/lib/support/contactDraft";
import type { ReactNode } from "react";

vi.mock("next/link", () => ({
  default: ({ href, children, onNavigate }: { href: string; children: ReactNode; onNavigate?: () => void }) =>
    createElement("a", { href, onClick: (event: MouseEvent) => { event.preventDefault(); onNavigate?.(); } }, children),
}));

const route = vi.hoisted(() => ({pathname: "/docs", sessionStatus: "unauthenticated"}));
vi.mock("next-auth/react", () => ({ useSession: () => ({status: route.sessionStatus}) }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

const storageKey = "visionxix-ai-widget-messages";
const fixture = "password=sample-only";
const send = vi.fn();

beforeEach(() => {
  route.pathname = "/docs";
  route.sessionStatus = "unauthenticated";
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

  it.each(["unauthenticated", "loading", "authenticated"])("limits private support lookups with %s session status", async status => {
    route.sessionStatus = status;
    send.mockResolvedValueOnce({ok:true, json:async () => ({ok:true, status:"answered", answer:"Open the public setup guide."})});
    send.mockResolvedValueOnce({ok:false, status:401});
    render(createElement(AIChatWidget));
    fireEvent.click(screen.getByRole("button", { name: "Open V19 Assistant" }));
    const input = screen.getByRole("textbox", { name: "Ask V19 a question" });
    fireEvent.change(input, { target: { value: "How do I find the setup guide?" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("Open the public setup guide.")).toBeTruthy();
    expect(send.mock.calls.map(call => call[0])).toEqual(status === "unauthenticated"
      ? ["/api/support/answer"] : ["/api/support/answer", "/api/support/account-answer"]);
  });
});

it("opens a support draft without adding the question to navigation", async () => {
  const question = "How do I report a missing validation step for Example Workspace?";
  localStorage.setItem(storageKey, JSON.stringify([
    {id: "answer", role: "assistant", content: "Review the default guide.", question, unsure: true,
      mode: "grounded", timestamp: "2026-11-24T00:00:00.000Z"},
  ]));
  render(createElement(AIChatWidget));
  fireEvent.click(screen.getByRole("button", {name: "Open V19 Assistant"}));
  const link = await screen.findByRole("link", {name: "Review a support request"});
  expect(link.getAttribute("href")).toBe("/contact?topic=ask-axiom");
  expect(takeSupportContactDraft()).toBeUndefined();
  fireEvent.click(link);
  expect(takeSupportContactDraft()).toBe(question);
  expect(takeSupportContactDraft()).toBeUndefined();
  expect(send).not.toHaveBeenCalled();
});

it.each([
  ["/docs#recorded", "recorded", "Recorded evidence"],
  ["/docs#missing", undefined, "Documentation"],
  ["/security", undefined, "Security"],
])("closes the chat and focuses the best heading for %s", async (href, fragment, title) => {
  localStorage.setItem(storageKey, JSON.stringify([{
    id: "source-answer", role: "assistant", content: "Read the cited guidance.",
    sources: [{title: "Cited page", href}, {title: "Outside source", href: "//example.invalid"}],
    timestamp: "2026-11-24T00:00:00.000Z",
  }]));
  function page(heading: string) {
    return createElement("div", null,
      createElement("main", null, createElement("h1", null, heading),
        createElement("section", {id: "recorded"}, createElement("h2", null, "Recorded evidence"))),
      createElement(AIChatWidget));
  }
  const view = render(page("Documentation"));
  fireEvent.click(screen.getByRole("button", {name: "Open V19 Assistant"}));
  const link = await screen.findByRole("link", {name: "Cited page"});
  expect(screen.queryByRole("link", {name: "Outside source"})).toBeNull();
  fireEvent.click(link);
  if (href === "/security") {
    route.pathname = "/security";
    view.rerender(page("Security"));
  }
  const heading = screen.getByRole("heading", {name: title, level: fragment ? 2 : 1});
  expect(document.activeElement).toBe(heading);
  expect(screen.queryByRole("dialog", {name: "V19 Assistant"})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Open V19 Assistant"}));
  expect(screen.getByText("Read the cited guidance.")).toBeTruthy();
});
