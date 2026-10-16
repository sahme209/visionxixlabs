/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { VerifiedDesktopIdentity } from "../../../desktop/src/lib/desktopClient";
const mock = vi.hoisted(() => ({ client: { config: {} as { sessionToken?: string }, desktopCloudAccounts: vi.fn(), startAwsReadOnlyEnrollment: vi.fn(), completeAwsReadOnlyEnrollment: vi.fn(), desktopAwsInventory: vi.fn(), disconnectDesktopAwsAccount: vi.fn() } }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: mock.client }));
import { AwsReadOnlyEnrollment } from "../../../desktop/src/components/AwsReadOnlyEnrollment";
const identity = { kind: "desktop_session", organizationId: "workspace-1", capabilities: ["workspace:read", "connections:manage"] } as VerifiedDesktopIdentity;
const input = { expectedAccountId: "123456789012", roleArn: "arn:aws:iam::123456789012:role/AxiomReadOnly", region: "us-east-1" };
const challenge = { ...input, attemptId: "attempt-1", externalId: "server-issued-external-id", expiresAt: "2099-01-01T00:00:00Z" };
const account = { id: "account-1", provider: "aws", accountId: input.expectedAccountId, alias: null, regions: [input.region], connected: true, status: "connected", lastValidatedAt: "2026-10-15T00:00:00Z", connectionVersion: 1, revokedAt: null, inventoryAvailability: "not_checked", enabled: false, agentScanAvailable: false };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function fill() {
  fireEvent.change(screen.getByLabelText("Expected AWS account ID"), { target: { value: input.expectedAccountId } });
  fireEvent.change(screen.getByLabelText("Existing IAM role ARN"), { target: { value: input.roleArn } });
}
async function prepare() {
  fill(); fireEvent.click(screen.getByRole("button", { name: "Prepare read-only enrollment" }));
  await screen.findByLabelText("Enrollment external ID");
}
function confirmTrust() { fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Verify existing AWS role" })); }
beforeEach(() => {
  vi.resetAllMocks(); mock.client.config = { sessionToken: "axm.desk.test.signature" };
  mock.client.desktopCloudAccounts.mockResolvedValue({ ok: true, data: { accounts: [] } });
  mock.client.startAwsReadOnlyEnrollment.mockResolvedValue({ ok: true, data: challenge });
  mock.client.completeAwsReadOnlyEnrollment.mockResolvedValue({ ok: true, data: { account } });
});
afterEach(() => { cleanup(); });
describe("customer-reachable AWS read-only role enrollment", () => {
  it("marks role identity verified only after server completion, with inventory still unavailable", async () => {
    render(createElement(AwsReadOnlyEnrollment, { identity })); await prepare();
    expect(mock.client.startAwsReadOnlyEnrollment).toHaveBeenCalledExactlyOnceWith(input);
    expect(screen.queryByText("Role identity verified", { exact: false })).toBeNull();
    expect((screen.getByRole("button", { name: "Verify existing AWS role" }) as HTMLButtonElement).disabled).toBe(true);
    confirmTrust();
    await screen.findByText(/AWS role identity verified by the service/);
    expect(mock.client.completeAwsReadOnlyEnrollment).toHaveBeenCalledExactlyOnceWith("attempt-1", "server-issued-external-id");
    expect(screen.getByText(/Inventory not checked/)).toBeTruthy();
  });
  it("keeps a working recorded account when replacement verification fails", async () => {
    const prior = { ...account, id: "prior", accountId: "999999999999" };
    mock.client.desktopCloudAccounts.mockResolvedValue({ ok: true, data: { accounts: [prior] } });
    mock.client.completeAwsReadOnlyEnrollment.mockResolvedValue({ ok: false, error: "Existing role could not be verified." });
    render(createElement(AwsReadOnlyEnrollment, { identity })); await screen.findByText("999999999999"); await prepare(); confirmTrust();
    expect((await screen.findByRole("alert")).textContent).toContain("could not be verified");
    expect(screen.getByText("999999999999")).toBeTruthy(); expect(screen.queryByText("123456789012")).toBeNull();
  });
  it("does not send enrollment for a different account's role ARN", async () => {
    render(createElement(AwsReadOnlyEnrollment, { identity })); fill();
    fireEvent.change(screen.getByLabelText("Expected AWS account ID"), { target: { value: "999999999999" } });
    fireEvent.click(screen.getByRole("button", { name: "Prepare read-only enrollment" }));
    expect((await screen.findByRole("alert")).textContent).toContain("expected AWS account");
    expect(mock.client.startAwsReadOnlyEnrollment).not.toHaveBeenCalled();
  });
  it("discards a challenge returned after its form inputs change", async () => {
    const pending = deferred<unknown>(); mock.client.startAwsReadOnlyEnrollment.mockReturnValue(pending.promise);
    render(createElement(AwsReadOnlyEnrollment, { identity })); fill();
    fireEvent.click(screen.getByRole("button", { name: "Prepare read-only enrollment" }));
    fireEvent.change(screen.getByLabelText("AWS region"), { target: { value: "us-west-2" } });
    pending.resolve({ ok: true, data: challenge });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(screen.queryByLabelText("Enrollment external ID")).toBeNull(); expect(mock.client.completeAwsReadOnlyEnrollment).not.toHaveBeenCalled();
  });
  it("rejects a challenge bound to a different submitted account", async () => {
    mock.client.startAwsReadOnlyEnrollment.mockResolvedValue({ ok: true, data: { ...challenge, expectedAccountId: "999999999999" } });
    render(createElement(AwsReadOnlyEnrollment, { identity })); fill(); fireEvent.click(screen.getByRole("button", { name: "Prepare read-only enrollment" }));
    expect((await screen.findByRole("alert")).textContent).toContain("did not match"); expect(screen.queryByLabelText("Enrollment external ID")).toBeNull();
  });
  it("rejects an expired challenge before exposing a completion action", async () => {
    mock.client.startAwsReadOnlyEnrollment.mockResolvedValue({ ok: true, data: { ...challenge, expiresAt: "2000-01-01T00:00:00Z" } });
    render(createElement(AwsReadOnlyEnrollment, { identity })); fill(); fireEvent.click(screen.getByRole("button", { name: "Prepare read-only enrollment" }));
    expect((await screen.findByRole("alert")).textContent).toContain("expired"); expect(mock.client.completeAwsReadOnlyEnrollment).not.toHaveBeenCalled();
  });
  it("ignores a completion after a credential replacement", async () => {
    const pending = deferred<unknown>(); mock.client.completeAwsReadOnlyEnrollment.mockReturnValue(pending.promise);
    render(createElement(AwsReadOnlyEnrollment, { identity })); await prepare(); confirmTrust();
    mock.client.config = { sessionToken: "axm.desk.replacement.signature" };
    pending.resolve({ ok: true, data: { account } });
    await new Promise(resolve => setTimeout(resolve, 0)); expect(screen.queryByText(/AWS role identity verified by the service/)).toBeNull();
  });
  it("does not let an older account-list response replace a completed verification", async () => {
    const pending = deferred<unknown>(); mock.client.desktopCloudAccounts.mockReturnValue(pending.promise);
    render(createElement(AwsReadOnlyEnrollment, { identity })); await prepare(); confirmTrust();
    await screen.findByText(/AWS role identity verified by the service/);
    pending.resolve({ ok: true, data: { accounts: [] } });
    await new Promise(resolve => setTimeout(resolve, 0)); expect(screen.getByText("123456789012")).toBeTruthy();
  });
  it("does not reuse a dismissed challenge when its completion arrives later", async () => {
    const pending = deferred<unknown>(); mock.client.completeAwsReadOnlyEnrollment.mockReturnValue(pending.promise);
    render(createElement(AwsReadOnlyEnrollment, { identity })); await prepare(); confirmTrust();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss enrollment" }));
    pending.resolve({ ok: true, data: { account } });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(screen.queryByLabelText("Enrollment external ID")).toBeNull();
    expect(screen.queryByText(/AWS role identity verified by the service/)).toBeNull();
    expect(screen.getByText(/A server verification already started may still finish/)).toBeTruthy();
  });
  it("does not display a completion after the enrollment view unmounts", async () => {
    const pending = deferred<unknown>(); mock.client.completeAwsReadOnlyEnrollment.mockReturnValue(pending.promise);
    const view = render(createElement(AwsReadOnlyEnrollment, { identity })); await prepare(); confirmTrust(); view.unmount();
    pending.resolve({ ok: true, data: { account } });
    await new Promise(resolve => setTimeout(resolve, 0)); expect(screen.queryByText(/AWS role identity verified by the service/)).toBeNull();
  });
  it("does not expose enrollment for an administrator recovery key", async () => {
    render(createElement(AwsReadOnlyEnrollment, { identity: { ...identity, kind: "api_key" } }));
    expect(screen.getByText(/Use browser pairing to manage cloud connections/)).toBeTruthy();
    expect(screen.queryByLabelText("Existing IAM role ARN")).toBeNull(); expect(mock.client.desktopCloudAccounts).not.toHaveBeenCalled();
  });
  it("permits a paired viewer to read accounts but not start enrollment", async () => {
    render(createElement(AwsReadOnlyEnrollment, { identity: { ...identity, capabilities: ["workspace:read"] } }));
    await waitFor(() => expect(mock.client.desktopCloudAccounts).toHaveBeenCalledOnce());
    expect(screen.queryByLabelText("Existing IAM role ARN")).toBeNull(); expect(mock.client.startAwsReadOnlyEnrollment).not.toHaveBeenCalled();
  });
  it("reports schema/configuration unavailability without a connected badge", async () => {
    mock.client.startAwsReadOnlyEnrollment.mockResolvedValue({ ok: false, error: "Cloud enrollment storage unavailable." });
    render(createElement(AwsReadOnlyEnrollment, { identity })); fill(); fireEvent.click(screen.getByRole("button", { name: "Prepare read-only enrollment" }));
    expect((await screen.findByRole("alert")).textContent).toContain("storage unavailable");
    expect(screen.queryByText(/AWS role identity verified by the service/)).toBeNull();
  });
});

describe("bounded inventory is separate from role identity verification", () => {
  const inventory = { accountId: input.expectedAccountId, region: input.region, source: "live", complete: false, truncated: true, observedAt: "2026-10-15T00:00:00Z", instances: [{ instanceId: "i-one", state: "running", instanceType: "t3.micro", availabilityZone: "us-east-1a" }] };
  async function showAccount() {
    mock.client.desktopCloudAccounts.mockResolvedValue({ ok: true, data: { accounts: [account] } });
    const view = render(createElement(AwsReadOnlyEnrollment, { identity })); await screen.findByRole("button", { name: "Read bounded EC2 inventory" });
    return view;
  }
  it("requires a separate real-service inventory read and labels its bounded/truncated scope", async () => {
    mock.client.desktopAwsInventory.mockResolvedValue({ ok: true, data: inventory }); await showAccount();
    expect(mock.client.desktopAwsInventory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Read bounded EC2 inventory" }));
    await screen.findByText(/i-one · running · t3.micro/);
    expect(mock.client.desktopAwsInventory).toHaveBeenCalledExactlyOnceWith("account-1");
    expect(screen.getByText(/Truncated result; more resources may exist/)).toBeTruthy();
    expect(screen.getByText(/Complete account inventory: no/)).toBeTruthy();
  });
  it("reports denied inventory separately without removing the verified account or substituting data", async () => {
    mock.client.desktopAwsInventory.mockResolvedValue({ ok: false, error: "AWS inventory permission denied." }); await showAccount();
    fireEvent.click(screen.getByRole("button", { name: "Read bounded EC2 inventory" }));
    expect((await screen.findByRole("alert")).textContent).toContain("No sample data is substituted");
    expect(screen.getByText("123456789012")).toBeTruthy(); expect(screen.queryByText(/i-one/)).toBeNull();
  });
  it("does not display an inventory result for a different AWS account", async () => {
    mock.client.desktopAwsInventory.mockResolvedValue({ ok: true, data: { ...inventory, accountId: "999999999999" } }); await showAccount();
    fireEvent.click(screen.getByRole("button", { name: "Read bounded EC2 inventory" }));
    expect((await screen.findByRole("alert")).textContent).toContain("did not match"); expect(screen.queryByText(/i-one/)).toBeNull();
  });
  it("ignores inventory returned after a credential-context change", async () => {
    const pending = deferred<unknown>(); mock.client.desktopAwsInventory.mockReturnValue(pending.promise); await showAccount();
    fireEvent.click(screen.getByRole("button", { name: "Read bounded EC2 inventory" }));
    mock.client.config = { sessionToken: "axm.desk.replacement.signature" };
    pending.resolve({ ok: true, data: inventory });
    await new Promise(resolve => setTimeout(resolve, 0)); expect(screen.queryByText(/i-one/)).toBeNull();
  });
  it("hides an already displayed inventory immediately when the credential context changes", async () => {
    mock.client.desktopAwsInventory.mockResolvedValue({ ok: true, data: inventory });
    const view = await showAccount();
    fireEvent.click(screen.getByRole("button", { name: "Read bounded EC2 inventory" }));
    await screen.findByText(/i-one · running · t3.micro/);
    mock.client.config = { sessionToken: "axm.desk.replacement.signature" };
    view.rerender(createElement(AwsReadOnlyEnrollment, { identity }));
    expect(screen.queryByText(/i-one · running/)).toBeNull();
    await screen.findByRole("button", { name: "Read bounded EC2 inventory" });
    expect(screen.queryByText(/i-one · running/)).toBeNull();
  });
  it("hides an existing inventory when the same account is revalidated", async () => {
    mock.client.desktopAwsInventory.mockResolvedValue({ ok: true, data: inventory }); await showAccount();
    fireEvent.click(screen.getByRole("button", { name: "Read bounded EC2 inventory" }));
    await screen.findByText(/i-one · running · t3.micro/);
    mock.client.desktopCloudAccounts.mockResolvedValue({ ok: true, data: { accounts: [{ ...account, lastValidatedAt: "2026-10-15T01:00:00Z" }] } });
    fireEvent.click(screen.getByRole("button", { name: "Refresh AWS account state" }));
    await screen.findByText("Last service validation: 2026-10-15T01:00:00Z");
    expect(screen.queryByText(/i-one · running/)).toBeNull();
    expect((screen.getByRole("button", { name: "Read bounded EC2 inventory" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("hides existing inventory if recorded regions change without a validation timestamp change", async () => {
    mock.client.desktopAwsInventory.mockResolvedValue({ ok: true, data: inventory }); await showAccount();
    fireEvent.click(screen.getByRole("button", { name: "Read bounded EC2 inventory" }));
    await screen.findByText(/i-one · running · t3.micro/);
    mock.client.desktopCloudAccounts.mockResolvedValue({ ok: true, data: { accounts: [{ ...account, regions: ["us-west-2"] }] } });
    fireEvent.click(screen.getByRole("button", { name: "Refresh AWS account state" }));
    await screen.findByText(/Regions: us-west-2/);
    expect(screen.queryByText(/i-one · running/)).toBeNull();
  });
  it("does not describe an empty page as a complete empty AWS account", async () => {
    mock.client.desktopAwsInventory.mockResolvedValue({ ok: true, data: { ...inventory, instances: [], truncated: false } }); await showAccount();
    fireEvent.click(screen.getByRole("button", { name: "Read bounded EC2 inventory" }));
    expect(await screen.findByText(/This is not proof that the AWS account is empty/)).toBeTruthy();
  });
});

describe("AWS disconnect confirmation and stale outcome handling", () => {
  const disconnected = { ...account, connected: false, status: "disconnected", connectionVersion: 2, revokedAt: "2026-10-15T01:00:00Z", inventoryAvailability: "unavailable" };
  const inventory = { accountId: input.expectedAccountId, region: input.region, source: "live", complete: false, truncated: false, observedAt: "2026-10-15T00:00:00Z", instances: [{ instanceId: "i-before", state: "running", instanceType: "t3.micro", availabilityZone: "us-east-1a" }] };
  async function renderConnected(viewIdentity = identity) {
    mock.client.desktopCloudAccounts.mockResolvedValue({ ok: true, data: { accounts: [account] } });
    const view = render(createElement(AwsReadOnlyEnrollment, { identity: viewIdentity }));
    await screen.findByRole("button", { name: "Read bounded EC2 inventory" }); return view;
  }
  function confirmDisconnect() {
    fireEvent.click(screen.getByRole("button", { name: "Disconnect from Axiom" }));
    fireEvent.click(screen.getByRole("button", { name: "Disconnect Axiom access" }));
  }
  it("requires explicit confirmation and explains local-only removal versus AWS revocation", async () => {
    await renderConnected(); fireEvent.click(screen.getByRole("button", { name: "Disconnect from Axiom" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText(/does not delete or modify AWS roles or trust policies/)).toBeTruthy();
    expect(mock.client.disconnectDesktopAwsAccount).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep connection" }));
    expect(screen.queryByRole("alertdialog")).toBeNull(); expect(mock.client.disconnectDesktopAwsAccount).not.toHaveBeenCalled();
  });
  it("updates only after service confirmation and removes the old inventory display", async () => {
    mock.client.desktopAwsInventory.mockResolvedValue({ ok: true, data: inventory });
    mock.client.disconnectDesktopAwsAccount.mockResolvedValue({ ok: true, data: { account: disconnected } });
    await renderConnected(); fireEvent.click(screen.getByRole("button", { name: "Read bounded EC2 inventory" })); await screen.findByText(/i-before/);
    confirmDisconnect();
    await screen.findByText(/Axiom connection disconnected/);
    expect(mock.client.disconnectDesktopAwsAccount).toHaveBeenCalledExactlyOnceWith("account-1", 1);
    expect(screen.queryByText(/i-before/)).toBeNull(); expect(screen.queryByRole("button", { name: "Read bounded EC2 inventory" })).toBeNull();
    expect(screen.getByRole("button", { name: "Prepare a fresh reconnection" })).toBeTruthy();
  });
  it("does not reuse a stale enrollment challenge for reconnection", async () => {
    mock.client.disconnectDesktopAwsAccount.mockResolvedValue({ ok: true, data: { account: disconnected } });
    await renderConnected(); await prepare(); confirmDisconnect(); await screen.findByText(/Axiom connection disconnected/);
    expect(screen.queryByLabelText("Enrollment external ID")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Prepare a fresh reconnection" }));
    expect((screen.getByLabelText("Expected AWS account ID") as HTMLInputElement).value).toBe(input.expectedAccountId);
    expect((screen.getByLabelText("Existing IAM role ARN") as HTMLInputElement).value).toBe("");
    expect(mock.client.startAwsReadOnlyEnrollment).toHaveBeenCalledTimes(1); expect(mock.client.completeAwsReadOnlyEnrollment).not.toHaveBeenCalled();
  });
  it("does not claim success on ambiguous failure and hides inventory until a fresh read", async () => {
    mock.client.disconnectDesktopAwsAccount.mockResolvedValue({ ok: false, error: "The service could not be reached." });
    await renderConnected(); confirmDisconnect();
    expect((await screen.findByRole("alert")).textContent).toContain("outcome is unconfirmed");
    expect(screen.queryByText(/Axiom connection disconnected/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Read bounded EC2 inventory" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Refresh AWS account state" }));
    await screen.findByRole("button", { name: "Read bounded EC2 inventory" });
  });
  it("does not apply an old disconnect result after credentials change", async () => {
    const pending = deferred<unknown>(); mock.client.disconnectDesktopAwsAccount.mockReturnValue(pending.promise);
    await renderConnected(); confirmDisconnect(); mock.client.config = { sessionToken: "axm.desk.replacement.signature" };
    pending.resolve({ ok: true, data: { account: disconnected } });
    await new Promise(resolve => setTimeout(resolve, 0)); expect(screen.queryByText(/Axiom connection disconnected/)).toBeNull();
  });
  it("does not expose disconnect to a read-only paired viewer", async () => {
    await renderConnected({ ...identity, capabilities: ["workspace:read"] });
    expect(screen.queryByRole("button", { name: "Disconnect from Axiom" })).toBeNull();
  });
  it("does not let an older list refresh resurrect a confirmed disconnected account", async () => {
    const stale = deferred<unknown>(); await renderConnected();
    mock.client.desktopCloudAccounts.mockReturnValue(stale.promise);
    fireEvent.click(screen.getByRole("button", { name: "Refresh AWS account state" }));
    mock.client.disconnectDesktopAwsAccount.mockResolvedValue({ ok: true, data: { account: disconnected } }); confirmDisconnect();
    await screen.findByText(/Axiom connection disconnected/); stale.resolve({ ok: true, data: { accounts: [account] } });
    await new Promise(resolve => setTimeout(resolve, 0)); expect(screen.queryByRole("button", { name: "Read bounded EC2 inventory" })).toBeNull();
  });
  it("cannot display an inventory request that finishes after disconnect started", async () => {
    const inventoryRead = deferred<unknown>(); mock.client.desktopAwsInventory.mockReturnValue(inventoryRead.promise);
    const disconnect = deferred<unknown>(); mock.client.disconnectDesktopAwsAccount.mockReturnValue(disconnect.promise);
    await renderConnected(); fireEvent.click(screen.getByRole("button", { name: "Read bounded EC2 inventory" }));
    confirmDisconnect(); inventoryRead.resolve({ ok: true, data: inventory });
    await new Promise(resolve => setTimeout(resolve, 0)); expect(screen.queryByText(/i-before/)).toBeNull();
  });
  it("does not overwrite a newly refreshed connection with an older disconnect completion", async () => {
    const pending = deferred<unknown>(); mock.client.disconnectDesktopAwsAccount.mockReturnValue(pending.promise);
    await renderConnected(); confirmDisconnect();
    mock.client.desktopCloudAccounts.mockResolvedValue({ ok: true, data: { accounts: [{ ...account, connectionVersion: 3, lastValidatedAt: "2026-10-15T02:00:00Z" }] } });
    fireEvent.click(screen.getByRole("button", { name: "Refresh AWS account state" }));
    await screen.findByText("Last service validation: 2026-10-15T02:00:00Z");
    pending.resolve({ ok: true, data: { account: disconnected } });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(screen.queryByText(/Axiom connection disconnected/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Read bounded EC2 inventory" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Refresh AWS account state" }));
    await screen.findByRole("button", { name: "Read bounded EC2 inventory" });
  });
  it("rejects stale disconnect state and notice when a newer list resolves in the same React batch", async () => {
    const command = deferred<unknown>(); mock.client.disconnectDesktopAwsAccount.mockReturnValue(command.promise);
    await renderConnected(); confirmDisconnect();
    const refreshed = deferred<unknown>(); mock.client.desktopCloudAccounts.mockReturnValueOnce(refreshed.promise);
    fireEvent.click(screen.getByRole("button", { name: "Refresh AWS account state" }));
    await act(async () => {
      refreshed.resolve({ ok: true, data: { accounts: [{ ...account, connectionVersion: 3, lastValidatedAt: "2026-10-15T02:00:00Z" }] } });
      // The authoritative read finishes before the old command, but React has
      // not committed replacement/unmount passive cleanup within this batch.
      await Promise.resolve();
      command.resolve({ ok: true, data: { account: disconnected } });
      await Promise.resolve();
    });
    expect(screen.queryByText(/Axiom connection disconnected/)).toBeNull();
    expect(screen.getByText("Last service validation: 2026-10-15T02:00:00Z")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Read bounded EC2 inventory" })).toBeNull();
    mock.client.desktopCloudAccounts.mockResolvedValue({ ok: true, data: { accounts: [{ ...account, connectionVersion: 3 }] } });
    fireEvent.click(screen.getByRole("button", { name: "Refresh AWS account state" }));
    await screen.findByRole("button", { name: "Read bounded EC2 inventory" });
  });
  it("keeps inventory hidden when a newer list returns precommit state during disconnect", async () => {
    const pending = deferred<unknown>(); mock.client.disconnectDesktopAwsAccount.mockReturnValue(pending.promise);
    await renderConnected(); confirmDisconnect();
    fireEvent.click(screen.getByRole("button", { name: "Refresh AWS account state" }));
    await waitFor(() => expect(mock.client.desktopCloudAccounts).toHaveBeenCalledTimes(2));
    await waitFor(() => expect((screen.getByRole("button", { name: "Refresh AWS account state" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole("button", { name: "Read bounded EC2 inventory" })).toBeNull();
    expect(screen.getByRole("button", { name: "Disconnecting Axiom access…" })).toBeTruthy();
    pending.resolve({ ok: true, data: { account: disconnected } });
    await screen.findByText(/Axiom connection disconnected/);
    expect(screen.queryByRole("button", { name: "Read bounded EC2 inventory" })).toBeNull();
  });
  it("requires a post-settlement list instead of a delayed precommit list to release suspension", async () => {
    const command = deferred<unknown>(); mock.client.disconnectDesktopAwsAccount.mockReturnValue(command.promise);
    await renderConnected(); confirmDisconnect();
    const precommit = deferred<unknown>(); mock.client.desktopCloudAccounts.mockReturnValueOnce(precommit.promise);
    fireEvent.click(screen.getByRole("button", { name: "Refresh AWS account state" }));
    command.resolve({ ok: false, error: "Connection result unavailable." });
    await screen.findByRole("alert");
    precommit.resolve({ ok: true, data: { accounts: [account] } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Refresh AWS account state" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole("button", { name: "Read bounded EC2 inventory" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Refresh AWS account state" }));
    await screen.findByRole("button", { name: "Read bounded EC2 inventory" });
  });
  it("invalidates a displayed inventory when connection version changes with the same timestamp", async () => {
    mock.client.desktopAwsInventory.mockResolvedValue({ ok: true, data: inventory }); await renderConnected();
    fireEvent.click(screen.getByRole("button", { name: "Read bounded EC2 inventory" })); await screen.findByText(/i-before/);
    mock.client.desktopCloudAccounts.mockResolvedValue({ ok: true, data: { accounts: [{ ...account, connectionVersion: 3 }] } });
    fireEvent.click(screen.getByRole("button", { name: "Refresh AWS account state" }));
    await waitFor(() => expect(screen.queryByText(/i-before/)).toBeNull());
  });
});
