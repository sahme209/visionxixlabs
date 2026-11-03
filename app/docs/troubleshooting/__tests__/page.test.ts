/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import TroubleshootingPage from "../page";

// A redirect is deliberately rendered as an empty page, never accepted as article content.
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
afterEach(cleanup);

it("renders a public article with five problem sections instead of redirecting", () => {
  render(createElement(TroubleshootingPage));
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Troubleshooting");
  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
    "Install or sign in", "A connection is not ready", "A review is stale, expired, or unavailable",
    "The original operation is uncertain or consumed", "Get help safely",
  ]);
});

it("puts no-resend guidance before all recovery sections and preserves uncertainty", () => {
  const { container } = render(createElement(TroubleshootingPage));
  const text = container.textContent ?? "";
  expect(text).toContain("Do not resend the action, create a replacement to repeat it, or assume a timeout means failure.");
  expect(text.indexOf("Do not resend")).toBeLessThan(text.indexOf("Install or sign in"));
  expect(text).toContain("not confirmed success or confirmed failure");
  expect(text).toContain("Read the original saved operation");
  expect(text).toContain("only after checking whether an original operation already exists");
});

it("provides exact public destinations and clearly distinguishes account help and supporters", () => {
  render(createElement(TroubleshootingPage));
  for (const [name, href] of [
    ["Check downloads", "/download"], ["Install and sign in", "/docs/desktop-install"],
    ["Understand connection states", "/docs/integration-setup#states"], ["Operator setup", "/docs/integration-setup"],
    ["Approval and execution boundaries", "/docs/approval-workflow"], ["Readiness guidance", "/docs/releaseops/readiness"],
    ["Execution and recovery", "/docs/approval-workflow#execution"], ["Audit evidence guide", "/docs/audit-logs"],
    ["Account help (sign-in required)", "/account/help"], ["Service status", "/status"],
    ["Contact", "/contact"], ["Founding Supporters", "/support"],
  ]) expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(href);
  expect(screen.getByRole("link", { name: "Founding Supporters" }).parentElement?.textContent).toContain("funds development; it is separate from technical support");
});

it("scopes controls and authority while keeping escalation secrets and identifiers private", () => {
  const { container } = render(createElement(TroubleshootingPage));
  const text = container.textContent ?? "";
  expect(text).toContain("For the registered Agent proposal workflow described in the approval guide, separate requester execution remains a local preview and is not production-activated.");
  for (const phrase of ["local preview and is not production-activated", "may not include an Execute control", "installed version and surface", "consent alone is incomplete", "does not establish authority for every write", "does not prove execution or success", "browser-approved pairing", "Follow your organization’s software policy", "Omit passwords, tokens, client secrets, authorization codes, callback state, tenant secrets, and sensitive repository or customer content", "Keep original operation IDs private", "only through an approved support channel", "do not put them in public posts or URLs"]) expect(text).toContain(phrase);
  expect(container.querySelector("form, input, button")).toBeNull();
  expect([...container.querySelectorAll("a")].some((a) => /^\/api|^\/help$/.test(a.getAttribute("href") ?? ""))).toBe(false);
});
