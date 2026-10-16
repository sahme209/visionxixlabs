/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
const io = vi.hoisted(() => ({ push: vi.fn(), fetch: vi.fn(), context: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: io.push }) }));
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
  it("restores desktop, mobile and footer Pricing links to one canonical route while preserving support", () => {
    const nav = render(createElement(Navigation));
    expect(screen.getByRole("link", { name: "Pricing" }).getAttribute("href")).toBe("/plans");
    expect(screen.getByRole("link", { name: "Support Axiom" }).getAttribute("href")).toBe("/support");
    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const mobile = within(screen.getByRole("dialog", { name: "Site navigation" }));
    expect(mobile.getAllByRole("link", { name: "Pricing" })).toHaveLength(1);
    expect(mobile.getByRole("link", { name: "Pricing" }).getAttribute("href")).toBe("/plans");
    nav.unmount(); render(createElement(Footer));
    expect(screen.getByRole("link", { name: "Pricing" }).getAttribute("href")).toBe("/plans");
    expect(screen.getByRole("link", { name: "Founding Supporters" }).getAttribute("href")).toBe("/support");
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
  it("restores validated selection after authentication and requires a fresh explicit purchase with rendered workspace binding", async () => {
    vi.stubEnv("AXIOM_SELF_SERVICE_BILLING_ENABLED", "true");
    io.context.mockResolvedValue({isAuthenticated:true,organizationId:"org_1",workspaceLabel:"Engineering workspace",roles:["owner"]});
    render(await PlansPage({searchParams:Promise.resolve({plan:"enterprise",interval:"annual"})}));
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
  it("keeps the public pricing page usable but prevents checkout when workspace lookup fails", async () => {
    vi.stubEnv("AXIOM_SELF_SERVICE_BILLING_ENABLED","true"); io.context.mockRejectedValue(new Error("context unavailable"));
    render(await PlansPage());
    expect(screen.getByRole("button",{name:"Choose Pro"}).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("Workspace verification unavailable");
    expect(io.fetch).not.toHaveBeenCalled();
  });
  it("does not read authority or enable billing when the existing preview gate is closed", async () => {
    vi.stubEnv("AXIOM_SELF_SERVICE_BILLING_ENABLED","false"); render(await PlansPage());
    expect(io.context).not.toHaveBeenCalled(); expect(io.fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("link",{name:"Start free"}).getAttribute("href")).toBe("/download");
    expect(screen.queryByRole("button",{name:"Choose Pro"})).toBeNull();
  });
});
