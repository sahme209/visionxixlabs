/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
const io = vi.hoisted(() => ({ push: vi.fn(), fetch: vi.fn(), context: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: io.push }), usePathname: () => "/" }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: io.context }));
import { PublicPlansCatalog } from "@/components/billing/PublicPlansCatalog";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import PlansPage from "@/app/(marketing)/plans/page";
import { parsePublicPlanSelection, publicPlanSignInPath } from "../planSelection";
const ready = { status: "ready" as const, organizationId: "org_1", label: "Engineering workspace" };
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status }); }
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("fetch", io.fetch); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("pricing navigation and explicit plan selection", () => {
  // Current layout: "Get started" (formerly "Pricing") lives in the desktop "More" menu; the public support page is "Founding Supporters" (mobile + footer).
  it("labels desktop, mobile and footer links Get started on the one canonical /plans route while preserving support", () => {
    const nav = render(createElement(Navigation));
    expect(screen.queryByRole("link", { name: "Get started" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Pricing" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^More/ }));
    const more = within(screen.getByRole("group", { name: "More destinations" }));
    expect(more.getAllByRole("link", { name: "Get started" })).toHaveLength(1);
    expect(more.getByRole("link", { name: "Get started" }).getAttribute("href")).toBe("/plans");
    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const mobile = within(screen.getByRole("dialog", { name: "Site navigation" }));
    expect(mobile.getAllByRole("link", { name: "Get started" })).toHaveLength(1);
    expect(mobile.getByRole("link", { name: "Get started" }).getAttribute("href")).toBe("/plans");
    expect(mobile.getByRole("link", { name: "Founding Supporters" }).getAttribute("href")).toBe("/support");
    nav.unmount(); render(createElement(Footer));
    expect(screen.getByRole("link", { name: "Get started" }).getAttribute("href")).toBe("/plans");
    const supporters = screen.getAllByRole("link", { name: /Founding Supporters/ });
    expect(supporters.length).toBeGreaterThan(0);
    for (const link of supporters) expect(link.getAttribute("href")).toBe("/support");
  });
  it.each([{plan:"other",interval:"annual"},{plan:"pro",interval:"weekly"},{plan:["pro"],interval:"annual"},{plan:"enterprise",interval:["annual"]},{plan:"https://evil.test",interval:"monthly"},{}])("rejects unsupported query selection %j", (query) => {
    expect(parsePublicPlanSelection(query)).toBeNull();
  });
  it("retains paid plan and selected interval through a sign-in callback without starting checkout", () => {
    render(createElement(PublicPlansCatalog, { checkoutEnabled: true, workspace: {status:"signed_out"} }));
    fireEvent.click(screen.getByRole("button", { name: "Annual · save 20%" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose Pro" }));
    expect(io.push).toHaveBeenCalledWith(publicPlanSignInPath({planId:"pro",billingInterval:"annual"}));
    expect(io.fetch).not.toHaveBeenCalled();
  });
  it("restores validated selection in the workspace plan catalog and requires a fresh explicit purchase with rendered workspace binding", async () => {
    // Seat plans are no longer offered on the public page; the component remains for the signed-in test-mode workspace route.
    render(createElement(PublicPlansCatalog,{checkoutEnabled:true,workspace:ready,initialSelection:{planId:"enterprise",billingInterval:"annual"}}));
    expect(screen.getByRole("button", {name:"Annual · save 20%"}).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/Restored Enterprise selection/)).toBeTruthy();
    expect(screen.getByText(/Billing workspace: Engineering workspace/)).toBeTruthy();
    expect(io.fetch).not.toHaveBeenCalled();
    io.fetch.mockResolvedValue(response({data:{ok:false,reason:"Test checkout unavailable"}}));
    fireEvent.click(screen.getByRole("button", {name:"Choose Enterprise"}));
    await screen.findByRole("alert");
    expect(io.fetch).toHaveBeenCalledWith("/api/billing/checkout-session",expect.objectContaining({method:"POST",credentials:"same-origin",body:JSON.stringify({planId:"enterprise",billingInterval:"annual",expectedOrganizationId:"org_1"})}));
  });
  it("retains selection when the actual checkout request finds an expired session", async () => {
    io.fetch.mockResolvedValue(response({},401));
    render(createElement(PublicPlansCatalog,{checkoutEnabled:true,workspace:ready,initialSelection:{planId:"pro",billingInterval:"annual"}}));
    fireEvent.click(screen.getByRole("button",{name:"Choose Pro"}));
    await waitFor(()=>expect(io.push).toHaveBeenCalledWith(publicPlanSignInPath({planId:"pro",billingInterval:"annual"})));
  });
  it("reports a server workspace mismatch without retrying under another organization", async () => {
    io.fetch.mockResolvedValue(response({error:{userMessage:"Workspace changed. Refresh and confirm again."}},403));
    render(createElement(PublicPlansCatalog,{checkoutEnabled:true,workspace:ready,initialSelection:{planId:"pro",billingInterval:"annual"}}));
    fireEvent.click(screen.getByRole("button",{name:"Choose Pro"}));
    expect((await screen.findByRole("alert")).textContent).toContain("Workspace changed");
    expect(io.fetch).toHaveBeenCalledTimes(1); expect(io.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button",{name:"Annual · save 20%"}).getAttribute("aria-pressed")).toBe("true");
  });
  it("never follows stale checkout responses after workspace changes", async () => {
    let resolve!: (response: Response) => void;
    io.fetch.mockImplementation(()=>new Promise<Response>(done=>{resolve=done;}));
    const view=render(createElement(PublicPlansCatalog,{checkoutEnabled:true,workspace:ready}));
    fireEvent.click(screen.getByRole("button",{name:"Choose Pro"}));
    view.rerender(createElement(PublicPlansCatalog,{checkoutEnabled:true,workspace:{...ready,organizationId:"org_2",label:"Other workspace"}}));
    resolve(response({},401));
    await waitFor(()=>expect(screen.getByRole("button",{name:"Choose Pro"}).hasAttribute("disabled")).toBe(false));
    expect(io.push).not.toHaveBeenCalled(); expect(io.fetch).toHaveBeenCalledTimes(1);
  });
  it("prevents seat checkout when the workspace cannot be verified", async () => {
    render(createElement(PublicPlansCatalog,{checkoutEnabled:true,workspace:{status:"unavailable"}}));
    expect(screen.getByRole("button",{name:"Choose Pro"}).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("Workspace verification unavailable");
    expect(io.fetch).not.toHaveBeenCalled();
  });
  it("does not read authority or enable billing when the existing preview gate is closed", async () => {
    vi.stubEnv("AXIOM_SELF_SERVICE_BILLING_ENABLED","false"); render(await PlansPage({}));
    expect(io.context).not.toHaveBeenCalled(); expect(io.fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("link",{name:"Create workspace"}).getAttribute("href")).toBe("/auth/signin?callbackUrl=%2Fcontrol");
    expect(screen.getByText(/Credit purchases are not open yet/)).toBeTruthy();
    expect(screen.queryByRole("link",{name:"Buy prepaid credits"})).toBeNull();
    expect(screen.queryByRole("button",{name:"Choose Pro"})).toBeNull();
  });
  it("never offers seat-plan checkout or reads workspace authority on the public page, even when self-service billing is on", async () => {
    vi.stubEnv("AXIOM_SELF_SERVICE_BILLING_ENABLED","true"); render(await PlansPage({searchParams:Promise.resolve({plan:"pro",interval:"annual"})}));
    expect(io.context).not.toHaveBeenCalled(); expect(io.fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("button",{name:/Choose (Pro|Enterprise)/})).toBeNull();
    expect(screen.queryByText(/Restored .* selection/)).toBeNull();
  });
});

it("explains cancellation return context without asserting a payment or subscription outcome", async () => {
  vi.stubEnv("AXIOM_SELF_SERVICE_BILLING_ENABLED", "false");
  render(await PlansPage({ searchParams: Promise.resolve({ checkout: "canceled" }) }));
  expect(screen.getByRole("status").textContent).toContain("This page makes no billing changes");
  expect(screen.getByRole("link", { name: "Review workspace billing" }).getAttribute("href")).toBe("/control/usage-billing");
  expect(io.fetch).not.toHaveBeenCalled();
});
it.each([undefined, "success", ["canceled"]])("ignores unrecognized checkout return context %j", async checkout => {
  vi.stubEnv("AXIOM_SELF_SERVICE_BILLING_ENABLED", "false");
  render(await PlansPage({ searchParams: Promise.resolve({ checkout }) }));
  expect(screen.queryByText(/This page makes no billing changes/)).toBeNull();
  expect(io.fetch).not.toHaveBeenCalled();
});

it.each([true, false])("keeps prepaid-credit purchase copy consistent with the existing checkout gate (%s)", async enabled => {
  vi.stubEnv("AXIOM_SELF_SERVICE_BILLING_ENABLED", String(enabled));
  render(await PlansPage({}));
  if (enabled) {
    expect(screen.getByRole("link", {name: "Buy prepaid credits"}).getAttribute("href")).toBe("/auth/signin?callbackUrl=%2Fcontrol%2Fusage-billing");
    expect(screen.queryByText(/Credit purchases are not open yet/)).toBeNull();
  } else {
    expect(screen.getByText(/Credit purchases are not open yet. No charge can be started from this page./)).toBeTruthy();
    expect(screen.queryByRole("link", {name: "Buy prepaid credits"})).toBeNull();
  }
  expect(screen.queryByRole("button", {name: "Choose Pro"})).toBeNull();
  expect(io.fetch).not.toHaveBeenCalled();
});

it("routes every signed-out preview plan to sign-in while checkout is disabled", () => {
  render(createElement(PublicPlansCatalog, { checkoutEnabled: false, workspace: {status:"signed_out"} }));
  fireEvent.click(screen.getByRole("button", {name:"Annual · save 20%"}));
  expect(screen.getByRole("link", {name:"Review Pro"}).getAttribute("href")).toBe(publicPlanSignInPath({planId:"pro",billingInterval:"annual"}));
  expect(screen.getByRole("link", {name:"Review Enterprise"}).getAttribute("href")).toBe(publicPlanSignInPath({planId:"enterprise",billingInterval:"annual"}));
  expect(screen.getByRole("link", {name:"Start free"}).getAttribute("href")).toContain("%2Fcontrol%3Fplan%3Dfree%26interval%3Dannual");
  expect(io.fetch).not.toHaveBeenCalled();
});
