/** @vitest-environment jsdom */
import { createElement, StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ desktop: { config: {} }, client: { list: vi.fn(), enroll: vi.fn(), inventory: vi.fn(), disconnect: vi.fn() } }));
vi.mock("@/desktop/src/lib/desktopClient", () => ({ desktopClient: mocks.desktop }));
vi.mock("@/desktop/src/lib/azureEnrollmentClient", () => ({ azureEnrollmentClient: mocks.client }));
import { AzureReadOnlyEnrollment } from "@/desktop/src/components/AzureReadOnlyEnrollment";
import type { VerifiedDesktopIdentity } from "@/desktop/src/lib/desktopClient";
const identity = { kind: "desktop_session", organizationId: "ws_azure", capabilities: ["workspace:read", "connections:manage"] } as VerifiedDesktopIdentity;
const account = { id: "azure-account", provider: "azure", subscriptionId: "22222222-2222-4222-8222-222222222222", connected: true, status: "connected", connectionVersion: 1, lastValidatedAt: "2026-10-16T12:00:00Z", revokedAt: null, enabled: false, agentScanAvailable: false, inventoryAvailability: "not_checked" };
const page = { accountId: account.id, subscriptionId: account.subscriptionId, connectionVersion: 1, complete: false, scope: "first_resource_groups_page", resourceGroups: [{ id: `/subscriptions/${account.subscriptionId}/resourceGroups/group`, name: "group", location: "eastus" }], limit: 100, observedAt: "2026-10-16T12:00:00Z", limitations: [] };
beforeEach(() => { vi.clearAllMocks(); mocks.desktop.config = {}; mocks.client.list.mockResolvedValue({ ok: true, data: { accounts: [] } }); mocks.client.enroll.mockResolvedValue({ ok: true, data: { account } }); mocks.client.inventory.mockResolvedValue({ ok: true, data: page }); mocks.client.disconnect.mockResolvedValue({ ok: true, data: { account: { ...account, connected: false, status: "disconnected", connectionVersion: 2, revokedAt: "2026-10-16T12:00:00Z", inventoryAvailability: "unavailable" } } }); });
afterEach(cleanup);
async function fill() { fireEvent.change(screen.getByLabelText("Azure tenant ID"), { target: { value: "11111111-1111-4111-8111-111111111111" } }); fireEvent.change(screen.getByLabelText("Azure subscription ID"), { target: { value: account.subscriptionId } }); fireEvent.change(screen.getByLabelText("Azure client ID"), { target: { value: "33333333-3333-4333-8333-333333333333" } }); fireEvent.change(screen.getByLabelText("Azure client secret"), { target: { value: "fixture-secret" } }); }
it("connects, explicitly reads one page, disconnects, and clears secret at submission", async () => { render(createElement(AzureReadOnlyEnrollment, { identity })); await fill(); fireEvent.click(screen.getByRole("button", { name: "Validate & connect Azure" })); expect((screen.getByLabelText("Azure client secret") as HTMLInputElement).value).toBe(""); await screen.findByRole("button", { name: "Read first resource-group page" }); fireEvent.click(screen.getByRole("button", { name: "Read first resource-group page" })); await screen.findByText("group"); fireEvent.click(screen.getByRole("button", { name: "Disconnect Azure" })); await screen.findByText("disconnected"); expect(screen.queryByText("group")).toBeNull(); expect(mocks.client.enroll).toHaveBeenCalledWith(expect.objectContaining({ clientSecret: "fixture-secret", expectedVersion: null })); });
it("removes secret fields and results synchronously on workspace/capability change", async () => { const view = render(createElement(AzureReadOnlyEnrollment, { identity })); await fill(); view.rerender(createElement(AzureReadOnlyEnrollment, { identity: { ...identity, organizationId: "foreign", capabilities: ["workspace:read"] } })); expect(screen.queryByLabelText("Azure client secret")).toBeNull(); expect(screen.queryByText(account.subscriptionId)).toBeNull(); });
it("withholds inventory that resolves after disconnect starts", async () => { mocks.client.list.mockResolvedValue({ ok: true, data: { accounts: [account] } }); let resolveRead: (value: unknown) => void = () => { }; mocks.client.inventory.mockReturnValue(new Promise(resolve => { resolveRead = resolve; })); render(createElement(AzureReadOnlyEnrollment, { identity })); fireEvent.click(await screen.findByRole("button", { name: "Read first resource-group page" })); fireEvent.click(screen.getByRole("button", { name: "Disconnect Azure" })); await screen.findByText("disconnected"); await act(async () => { resolveRead({ ok: true, data: page }); }); expect(screen.queryByText("group")).toBeNull(); });
it("a stale list response cannot undo a freshly enrolled version", async () => { let resolveList: (value: unknown) => void = () => { }; mocks.client.list.mockReturnValueOnce(new Promise(resolve => { resolveList = resolve; })); render(createElement(AzureReadOnlyEnrollment, { identity })); await fill(); fireEvent.click(screen.getByRole("button", { name: "Validate & connect Azure" })); await screen.findByRole("button", { name: "Read first resource-group page" }); await act(async () => { resolveList({ ok: true, data: { accounts: [] } }); }); expect(screen.getByRole("button", { name: "Read first resource-group page" })).toBeDefined(); });
it("uncertain POST does not retry and releases busy state", async () => { mocks.client.enroll.mockResolvedValue({ ok: false, error: "Refresh connection state before trying again." }); render(createElement(AzureReadOnlyEnrollment, { identity })); await fill(); fireEvent.click(screen.getByRole("button", { name: "Validate & connect Azure" })); await waitFor(() => expect((screen.getByRole("button", { name: "Validate & connect Azure" }) as HTMLButtonElement).disabled).toBe(false)); expect(mocks.client.enroll).toHaveBeenCalledTimes(1); expect((screen.getByLabelText("Azure client secret") as HTMLInputElement).value).toBe(""); });
it("preserves newer catalog authority when an older inventory completes after refresh", async () => {
    mocks.client.list.mockResolvedValueOnce({ok:true,data:{accounts:[account]}}).mockResolvedValueOnce({ok:true,data:{accounts:[{...account,connectionVersion:3}]}});
    let resolveRead:(value:unknown)=>void=()=>{};
    mocks.client.inventory.mockReturnValueOnce(new Promise(resolve=>{resolveRead=resolve;}));
    render(createElement(AzureReadOnlyEnrollment,{identity}));
    fireEvent.click(await screen.findByRole("button",{name:"Read first resource-group page"}));
    fireEvent.click(screen.getByRole("button",{name:"Refresh Azure connections"}));
    await screen.findByText(/Connection version 3/);
    await act(async()=>{resolveRead({ok:true,data:page});});
    expect(screen.queryByText("group")).toBeNull();
    expect(screen.getByText(/Connection version 3/)).toBeDefined();
});
it("drops a delayed enrollment after workspace replacement without publishing its notice",async()=>{
    let resolveEnroll:(value:unknown)=>void=()=>{};
    mocks.client.enroll.mockReturnValueOnce(new Promise(resolve=>{resolveEnroll=resolve;}));
    const view=render(createElement(AzureReadOnlyEnrollment,{identity}));await fill();
    fireEvent.click(screen.getByRole("button",{name:"Validate & connect Azure"}));
    view.rerender(createElement(AzureReadOnlyEnrollment,{identity:{...identity,organizationId:"new-workspace"}}));
    await act(async()=>{resolveEnroll({ok:true,data:{account}});});
    expect(screen.queryByRole("button",{name:"Read first resource-group page"})).toBeNull();
    expect(screen.queryByText(/Azure subscription read access verified/)).toBeNull();
    expect((screen.getByLabelText("Azure client secret") as HTMLInputElement).value).toBe("");
});
it("does not restart initial catalog reads while the credential form changes",async()=>{
    render(createElement(AzureReadOnlyEnrollment,{identity}));
    await waitFor(()=>expect(mocks.client.list).toHaveBeenCalledTimes(1));await fill();
    expect(mocks.client.list).toHaveBeenCalledTimes(1);
});
it("ignores the first effect's catalog completion after StrictMode cleanup and restart", async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    mocks.client.list.mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve; }))
        .mockResolvedValueOnce({ ok: true, data: { accounts: [{ ...account, connectionVersion: 3 }] } });
    render(createElement(StrictMode, null, createElement(AzureReadOnlyEnrollment, { identity })));
    await screen.findByText(/Connection version 3/);
    await act(async () => { resolveFirst({ ok: true, data: { accounts: [account] } }); });
    expect(mocks.client.list).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Connection version 3/)).toBeDefined();
    expect(screen.queryByText(/Connection version 1/)).toBeNull();
});
it('shows a pending Azure catalog and a verified empty result instead of silence',async()=>{
 let finish:(value:unknown)=>void=()=>{};mocks.client.list.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));render(createElement(AzureReadOnlyEnrollment,{identity}));
 expect(screen.getByText('Checking Azure connections…')).toBeTruthy();expect((screen.getByRole('button',{name:'Refresh Azure connections'})as HTMLButtonElement).disabled).toBe(true);
 expect(screen.queryByText('No service-recorded Azure connections were returned.')).toBeNull();
 await act(async()=>{finish({ok:true,data:{accounts:[]}});});expect(await screen.findByText('No service-recorded Azure connections were returned.')).toBeTruthy();expect((screen.getByRole('button',{name:'Refresh Azure connections'})as HTMLButtonElement).disabled).toBe(false);
});
it('does not present an unavailable Azure catalog as a verified empty list and allows retry',async()=>{
 mocks.client.list.mockResolvedValueOnce({ok:false,error:'Owned service unavailable'});render(createElement(AzureReadOnlyEnrollment,{identity}));await screen.findByRole('alert');expect(screen.queryByText('No service-recorded Azure connections were returned.')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Refresh Azure connections'}));await screen.findByText('No service-recorded Azure connections were returned.');expect(screen.queryByRole('alert')).toBeNull();
});
it('handles an unexpected catalog rejection without exposing its underlying exception',async()=>{
 mocks.client.list.mockRejectedValueOnce(Error('PRIVATE_EXCEPTION_SENTINEL'));render(createElement(AzureReadOnlyEnrollment,{identity}));expect((await screen.findByRole('alert')).textContent).toMatch(/could not be refreshed/i);expect(screen.queryByText(/PRIVATE_EXCEPTION_SENTINEL/)).toBeNull();expect((screen.getByRole('button',{name:'Refresh Azure connections'})as HTMLButtonElement).disabled).toBe(false);
});
it('does not leave catalog refresh disabled when enrollment supersedes a pending initial read',async()=>{
 mocks.client.list.mockReturnValueOnce(new Promise(()=>{}));render(createElement(AzureReadOnlyEnrollment,{identity}));await fill();fireEvent.click(screen.getByRole('button',{name:'Validate & connect Azure'}));await screen.findByRole('button',{name:'Read first resource-group page'});expect((screen.getByRole('button',{name:'Refresh Azure connections'})as HTMLButtonElement).disabled).toBe(false);expect(screen.queryByText('Checking Azure connections…')).toBeNull();
});
