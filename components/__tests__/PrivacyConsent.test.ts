/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"https://visionxixlabs.com"}
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const captured = vi.hoisted(() => ({ filters: [] as unknown[] }));
vi.mock("@vercel/analytics/next", async () => {
  const { createElement } = await import("react");
  return {
    Analytics: ({ beforeSend }: { beforeSend?: unknown }) => {
      captured.filters.push(beforeSend);
      return createElement("span", { "data-testid": "measurement-active" });
    },
  };
});

import { PrivacyConsent } from "../PrivacyConsent";

const key = "axiom_privacy_consent_v1";
beforeEach(() => {
  captured.filters.length = 0;
  window.localStorage.clear();
  document.cookie = `${key}=; Max-Age=0; Path=/; Secure`;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("website privacy choices", () => {
  it("keeps optional measurement absent until an explicit choice", async () => {
    render(createElement(PrivacyConsent));
    await screen.findByRole("dialog", { name: "Your privacy choices" });
    expect(screen.queryByTestId("measurement-active")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Accept optional" }));
    expect(await screen.findByTestId("measurement-active")).not.toBeNull();
  });

  it("still offers a privacy choice when access to local storage is denied", async () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    render(createElement(PrivacyConsent));
    expect(await screen.findByRole("dialog", { name: "Your privacy choices" })).not.toBeNull();
    expect(screen.queryByTestId("measurement-active")).toBeNull();
  });

  it("applies essential-only consent in this tab when neither persistence channel can save it", async () => {
    render(createElement(PrivacyConsent));
    await screen.findByRole("dialog", { name: "Your privacy choices" });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    vi.spyOn(document, "cookie", "set").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    fireEvent.click(screen.getByRole("button", { name: "Essential only" }));
    expect(await screen.findByText(/could not save this preference/)).not.toBeNull();
    expect(screen.queryByTestId("measurement-active")).toBeNull();
  });

  it("withdraws measurement when another tab changes consent to essential-only", async () => {
    window.localStorage.setItem(key, "accepted");
    render(createElement(PrivacyConsent));
    await screen.findByTestId("measurement-active");
    window.localStorage.setItem(key, "essential");
    fireEvent(window, new StorageEvent("storage", { key, newValue: "essential" }));
    await waitFor(() => expect(screen.queryByTestId("measurement-active")).toBeNull());
  });

  it("blocks a previously captured SDK event callback after consent is withdrawn", async () => {
    window.localStorage.setItem(key, "accepted");
    render(createElement(PrivacyConsent));
    await screen.findByTestId("measurement-active");
    const filter = captured.filters.at(-1);
    expect(typeof filter).toBe("function");
    const send = filter as (event: unknown) => unknown;
    const event = { type: "pageview", url: "https://visionxixlabs.com/docs" };
    expect(send(event)).toBe(event);
    fireEvent.click(screen.getByRole("button", { name: "Privacy choices" }));
    fireEvent.click(screen.getByRole("button", { name: "Essential only" }));
    expect(send(event)).toBeNull();
  });

  it("preserves the existing control for reopening privacy choices", async () => {
    window.localStorage.setItem(key, "essential");
    render(createElement(PrivacyConsent));
    fireEvent.click(await screen.findByRole("button", { name: "Privacy choices" }));
    expect(screen.getByRole("dialog", { name: "Your privacy choices" })).not.toBeNull();
  });

  it("honors an essential-only cookie when an older storage grant remains", async () => {
    window.localStorage.setItem(key, "accepted");
    document.cookie = `${key}=essential; Path=/; Secure`;
    render(createElement(PrivacyConsent));
    await screen.findByRole("button", { name: "Privacy choices" });
    expect(screen.queryByTestId("measurement-active")).toBeNull();
  });

  it("uses a previously saved cookie choice when local storage cannot be read", async () => {
    document.cookie = `${key}=accepted; Path=/; Secure`;
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    render(createElement(PrivacyConsent));
    expect(await screen.findByTestId("measurement-active")).not.toBeNull();
  });

  it("requires a real consent value instead of a truthy stored string", async () => {
    window.localStorage.setItem(key, "true");
    document.cookie = `${key}=unknown; Path=/; Secure`;
    render(createElement(PrivacyConsent));
    await screen.findByRole("dialog", { name: "Your privacy choices" });
    expect(screen.queryByTestId("measurement-active")).toBeNull();
  });

  it("lets a user continue with an unsaved tab choice and asks again on a new mount", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    vi.spyOn(document, "cookie", "set").mockImplementation(() => undefined);
    render(createElement(PrivacyConsent));
    await screen.findByRole("dialog", { name: "Your privacy choices" });
    fireEvent.click(screen.getByRole("button", { name: "Accept optional" }));
    await screen.findByText(/could not save this preference/);
    expect(screen.getByTestId("measurement-active")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continue in this tab" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    cleanup();
    render(createElement(PrivacyConsent));
    await screen.findByRole("dialog", { name: "Your privacy choices" });
    expect(screen.queryByTestId("measurement-active")).toBeNull();
  });

  it("persists withdrawal through the cookie when the older local grant cannot be replaced", async () => {
    window.localStorage.setItem(key, "accepted");
    render(createElement(PrivacyConsent));
    await screen.findByTestId("measurement-active");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    fireEvent.click(screen.getByRole("button", { name: "Privacy choices" }));
    fireEvent.click(screen.getByRole("button", { name: "Essential only" }));
    expect(window.localStorage.getItem(key)).toBe("accepted");
    expect(document.cookie).toContain(`${key}=essential`);
    cleanup();
    render(createElement(PrivacyConsent));
    await screen.findByRole("button", { name: "Privacy choices" });
    expect(screen.queryByTestId("measurement-active")).toBeNull();
  });

  it("blocks retained SDK callbacks after the privacy governor unmounts", async () => {
    window.localStorage.setItem(key, "accepted");
    render(createElement(PrivacyConsent));
    await screen.findByTestId("measurement-active");
    const send = captured.filters.at(-1) as (event: unknown) => unknown;
    expect(typeof send).toBe("function");
    cleanup();
    expect(send({ type: "pageview", url: "https://visionxixlabs.com/docs" })).toBeNull();
  });


  it("honors cookie-only withdrawal in another tab before a pending SDK event", async () => {
    window.localStorage.setItem(key, "accepted");
    render(createElement(PrivacyConsent));
    await screen.findByTestId("measurement-active");
    const send = captured.filters.at(-1) as (event: unknown) => unknown;
    const event = { type: "pageview", url: "https://visionxixlabs.com/docs" };
    expect(send(event)).toBe(event);
    // A failed local-storage write in another tab emits no storage event.
    document.cookie = `${key}=essential; Path=/; Secure`;
    expect(send(event)).toBeNull();
  });

});
