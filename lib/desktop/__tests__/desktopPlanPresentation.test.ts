/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act,cleanup, fireEvent, render, screen,waitFor } from "@testing-library/react";
import type { VerifiedDesktopIdentity } from "../../../desktop/src/lib/desktopClient";
const mocks = vi.hoisted(() => ({ usage: vi.fn(), portal: vi.fn(), preferences: vi.fn(),context:{} as object,open:vi.fn() }));
vi.mock("@tauri-apps/plugin-shell", () => ({ open: mocks.open }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../../../desktop/src/lib/preferences", () => ({ readDesktopPreferences: mocks.preferences, writeDesktopPreferences: vi.fn() }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: { get config(){return mocks.context;},usageSummary: mocks.usage, desktopBillingPortal: mocks.portal } }));
import { SettingsView } from "../../../desktop/src/views/SettingsView";
function identity(planTier: string, billingStatus: string, allowed = true): VerifiedDesktopIdentity {
  return { kind: "desktop_session", organizationId: "synthetic-workspace", role: "owner", capabilities: [], access: { allowed, code: "active", title: "Access active", message: "This workspace has access.", planTier, billingStatus, pricingPath: "/plans", accessRequestPath: "/contact" } };
}
async function showPlan(value: VerifiedDesktopIdentity) {
  render(createElement(SettingsView, { identity: value }));
  fireEvent.click(screen.getByRole("button", { name: "Plan & usage" }));
  await screen.findByText("AI invocations");
}
beforeEach(() => { vi.resetAllMocks(); mocks.context={};mocks.open.mockResolvedValue(undefined);mocks.preferences.mockResolvedValue(null); mocks.usage.mockResolvedValue({ ok: true, data: { periodMonth: "2026-10", aiInvocationCount: 0, aiInputTokens: 0, aiOutputTokens: 0, aiCostCents: 0 } }); });
afterEach(cleanup);
describe("actual desktop billing status presentation", () => {
  it("does not turn current identity-only no-plan DTO into trial or paid approval", async () => {
    const value = identity("trial", "no_plan"); await showPlan(value);
    expect(screen.getByText("No subscription", { exact: true })).toBeTruthy();
    expect(screen.getByText("No plan", { exact: true })).toBeTruthy();
    expect(screen.getByText(/Identity sign-in is active/)).toBeTruthy();
    expect(screen.queryByText("Trial access is active")).toBeNull(); expect(screen.queryByText("No-charge trial")).toBeNull();
    expect(screen.queryByText(/This workspace has approved no-charge access/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Open billing" })).toBeNull();
    expect(value.access.allowed).toBe(true); expect(mocks.portal).not.toHaveBeenCalled();
  });
  it.each([["trial", "trialing", "Trial access is active"], ["pilot", "active", "Pilot access is active"]])("preserves explicitly supported no-charge state %s/%s", async (tier, status, label) => {
    await showPlan(identity(tier, status)); expect(screen.getByText(label)).toBeTruthy();
  });
  it.each(["active", "past_due", "canceled"])("does not manufacture trial approval from legacy tier with status %s", async status => {
    await showPlan(identity("trial", status)); expect(screen.queryByText("Trial access is active")).toBeNull(); expect(screen.queryByText("No-charge trial")).toBeNull();
  });
  it("preserves legacy paid tier without silently calling it canonical Pro", async () => {
    await showPlan(identity("growth", "active")); expect(screen.getByText("growth", { exact: true })).toBeTruthy(); expect(screen.queryByText("Pro", { exact: true })).toBeNull(); expect(screen.getByRole("button", { name: "Open billing" })).toBeTruthy();
  });
});

it("finds governance sections by capability without changing account state", async () => {
  render(createElement(SettingsView, { identity: identity("pilot", "active") }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Search settings" }), { target: { value: "motion" } });
  fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
  expect(screen.getByRole("heading", { name: "Appearance" })).toBeTruthy();
});

const modern=(label="Free",remaining=200)=>({ok:true,data:{periodMonth:"2026-10",aiInvocationCount:0,aiInputTokens:0,aiOutputTokens:0,aiCostCents:0,billingSnapshot:{version:1,canManageBilling:true,plan:{available:true,label,status:"active",publicPlanId:label==="Free"?"free":"pro",hasCustomer:false},allowance:{available:true,baseCents:200,addOnCents:0,poolCents:200,usedCents:0,heldCents:0,includedRemainingCents:remaining,overagePolicy:"hard_stop"}}}});
it("shows the current Free plan and verified $2 allowance instead of a cached Trial access tier",async()=>{
 mocks.usage.mockResolvedValue(modern());await showPlan(identity("trial","active"));
 expect(screen.getByText("Workspace plan")).toBeTruthy();expect(screen.getByText("Free",{exact:true})).toBeTruthy();expect(screen.getByText("$2.00",{exact:true})).toBeTruthy();
 expect(screen.queryByText("trial",{exact:true})).toBeNull();expect(screen.queryByRole("button",{name:"Open billing"})).toBeNull();expect(mocks.portal).not.toHaveBeenCalled();
});
it("refreshes shared billing on focus without opening a portal or granting access",async()=>{
 mocks.usage.mockResolvedValueOnce(modern()).mockResolvedValue(modern("Pro",150));await showPlan(identity("trial","active"));
 fireEvent.focus(window);await screen.findByText("Pro",{exact:true});expect(screen.getByText("$1.50",{exact:true})).toBeTruthy();expect(mocks.usage).toHaveBeenCalledTimes(2);expect(mocks.portal).not.toHaveBeenCalled();
});
it("keeps unavailable allowance distinct from an exhausted allowance",async()=>{
 const response=modern();response.data.billingSnapshot.allowance={available:false} as never;mocks.usage.mockResolvedValue(response);await showPlan(identity("trial","active"));
 expect(screen.getByText("AI allowance remaining").parentElement?.textContent).toContain("Unavailable");
 expect(screen.getByText("AI allowance remaining").parentElement?.textContent).not.toContain("$0.00");
});
it("does not publish an old account's delayed billing response after a credential change",async()=>{
 let finish!:(value:unknown)=>void;mocks.usage.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;})).mockResolvedValue(modern());
 const value=identity("trial","active"),view=render(createElement(SettingsView,{identity:value,initialSection:"plan"}));
 await waitFor(()=>expect(mocks.usage).toHaveBeenCalledOnce());mocks.context={replacement:true};view.rerender(createElement(SettingsView,{identity:value,initialSection:"plan"}));await screen.findByText("Free",{exact:true});
 await act(async()=>finish(modern("Old account private plan",9900)));expect(screen.queryByText("Old account private plan")).toBeNull();expect(screen.getByText("$2.00",{exact:true})).toBeTruthy();
});

it("does not show cached subscription claims or a portal action while current billing is unverified",async()=>{
 mocks.usage.mockReturnValue(new Promise(()=>{}));render(createElement(SettingsView,{identity:identity("trial","active"),initialSection:"plan"}));
 expect(screen.getByText("Verifying…",{exact:true})).toBeTruthy();expect(screen.queryByText("trial",{exact:true})).toBeNull();expect(screen.queryByRole("button",{name:"Open billing"})).toBeNull();
});
it("fails closed on a malformed current snapshot",async()=>{
 const response=modern();response.data.billingSnapshot.version=2;mocks.usage.mockResolvedValue(response);render(createElement(SettingsView,{identity:identity("trial","active"),initialSection:"plan"}));
 await screen.findByText("Billing verification unavailable");expect(screen.queryByText("Free",{exact:true})).toBeNull();expect(screen.queryByRole("button",{name:"Open billing"})).toBeNull();expect(mocks.portal).not.toHaveBeenCalled();
});
it.each(["operator","read_only"] as const)("does not offer the verified portal action to %s",async role=>{
 const response=modern();response.data.billingSnapshot.plan.hasCustomer=true;mocks.usage.mockResolvedValue(response);await showPlan({...identity("trial","active"),role});
 expect(screen.queryByRole("button",{name:"Open billing"})).toBeNull();expect(mocks.portal).not.toHaveBeenCalled();
});

it("opens the canonical billing cockpit without a pairing credential or portal mutation",async()=>{
 mocks.usage.mockResolvedValue(modern());await showPlan(identity("trial","active"));
 fireEvent.click(screen.getByRole("button",{name:"View billing in cockpit"}));
 await waitFor(()=>expect(mocks.open).toHaveBeenCalledWith("https://visionxixlabs.com/control/usage-billing"));expect(mocks.portal).not.toHaveBeenCalled();
});
it("shows a bounded error when opening the cockpit fails",async()=>{
 mocks.open.mockRejectedValue(new Error("private platform error"));mocks.usage.mockResolvedValue(modern());await showPlan(identity("trial","active"));
 fireEvent.click(screen.getByRole("button",{name:"View billing in cockpit"}));
 expect(await screen.findByText("The billing cockpit could not be opened.")).toBeTruthy();expect(screen.queryByText("private platform error")).toBeNull();expect(mocks.portal).not.toHaveBeenCalled();
});
