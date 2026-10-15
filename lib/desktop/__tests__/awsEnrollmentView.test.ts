/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { VerifiedDesktopIdentity } from "../../../desktop/src/lib/desktopClient";
const mock = vi.hoisted(() => ({ client: { config: {} as { sessionToken?: string }, desktopCloudAccounts: vi.fn(), startAwsReadOnlyEnrollment: vi.fn(), completeAwsReadOnlyEnrollment: vi.fn(), desktopAwsInventory: vi.fn() } }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: mock.client }));
import { AwsReadOnlyEnrollment } from "../../../desktop/src/components/AwsReadOnlyEnrollment";
const identity = { kind: "desktop_session", organizationId: "workspace-1", capabilities: ["workspace:read", "connections:manage"] } as VerifiedDesktopIdentity;
const input = { expectedAccountId: "123456789012", roleArn: "arn:aws:iam::123456789012:role/AxiomReadOnly", region: "us-east-1" };
const challenge = { ...input, attemptId: "attempt-1", externalId: "server-issued-external-id", expiresAt: "2099-01-01T00:00:00Z" };
const account = { id: "account-1", provider: "aws", accountId: input.expectedAccountId, alias: null, regions: [input.region], connected: true, status: "connected", lastValidatedAt: "2026-10-15T00:00:00Z", inventoryAvailability: "not_checked", enabled: false, agentScanAvailable: false };
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
