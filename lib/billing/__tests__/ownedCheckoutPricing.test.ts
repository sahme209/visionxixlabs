/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const port = vi.hoisted(() => ({ fetch: vi.fn(), push: vi.fn(), context: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: port.context }));
vi.mock("../ownedCheckoutBridge/http", () => ({ ownedPlansReady: async () => true, ownedPlansBinding: async () => ({ organizationId: "org" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: port.push }) }));
import { PublicPlansCatalog } from "@/components/billing/PublicPlansCatalog";
afterEach(() => { cleanup(); window.sessionStorage.clear(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });
describe("actual pricing component owned intent selection", () => {
  it("retains the original client key across explicit network retry and remount, without automatic purchase", async () => {
    vi.stubGlobal("fetch", port.fetch); port.fetch.mockResolvedValue(new Response(JSON.stringify({ error: { userMessage: "Reconciliation required" } }), { status: 409 }));
    const props = { checkoutEnabled: true, ownedTestCheckout: true, workspace: { status: "ready" as const, organizationId: "org", label: "Owned workspace" } };
    const view = render(createElement(PublicPlansCatalog, props)); expect(port.fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Choose Pro" })); await screen.findByRole("alert");
    const first = JSON.parse(port.fetch.mock.calls[0][1].body); expect(first.clientIntentKey).toMatch(/^[a-f0-9]{32}$/);
    view.unmount(); render(createElement(PublicPlansCatalog, props)); expect(port.fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Choose Pro" })); await screen.findByRole("alert"); expect(JSON.parse(port.fetch.mock.calls[1][1].body)).toEqual(first);
  });
  it("keeps the legacy/public POST body unchanged and prevents duplicate inflight clicks", async () => {
    vi.stubGlobal("fetch", port.fetch); let done!: (value: Response) => void; port.fetch.mockImplementation(() => new Promise<Response>(resolve => { done = resolve; }));
    render(createElement(PublicPlansCatalog, { checkoutEnabled: true, workspace: { status: "ready", organizationId: "org", label: "Workspace" } }));
    fireEvent.click(screen.getByRole("button", { name: "Choose Pro" })); fireEvent.click(screen.getByRole("button", { name: "Opening secure checkout…" })); expect(port.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(port.fetch.mock.calls[0][1].body)).toEqual({ planId: "pro", billingInterval: "monthly", expectedOrganizationId: "org" });
    done(new Response(JSON.stringify({ data: { ok: false, reason: "Unavailable" } }))); await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Unavailable"));
  });
  it("does not offer an owned purchase for an authenticated foreign workspace", async () => {
    vi.stubEnv("AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME", "true"); port.context.mockResolvedValue({ isAuthenticated: true, organizationId: "foreign", roles: ["owner"] });
    const PlansPage = (await import("@/app/(marketing)/plans/page")).default; render(await PlansPage({}));
    expect(screen.getByRole("button", { name: "Choose Pro" }).hasAttribute("disabled")).toBe(true); expect(port.fetch).not.toHaveBeenCalled();
  });

});
