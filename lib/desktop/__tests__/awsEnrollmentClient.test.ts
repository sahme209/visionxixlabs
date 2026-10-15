import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopClient } from "../../../desktop/src/lib/desktopClient";
const input = { expectedAccountId: "123456789012", roleArn: "arn:aws:iam::123456789012:role/AxiomReadOnly", region: "us-east-1" };
const challenge = { ...input, attemptId: "attempt/1", externalId: "server-issued-external-id", expiresAt: "2099-01-01T00:00:00Z" };
const account = { id: "account-1", provider: "aws", accountId: input.expectedAccountId, alias: null, regions: [input.region], connected: true, status: "connected", lastValidatedAt: "2026-10-15T00:00:00Z", inventoryAvailability: "not_checked", enabled: false, agentScanAvailable: false };
function client(token = "axm.desk.session.signature") { return new DesktopClient({ apiBase: "https://service.example.test", sessionToken: token }); }
function respond(data: unknown, status = 200) { const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data }), { status })); vi.stubGlobal("fetch", fetch); return fetch; }
afterEach(() => vi.unstubAllGlobals());
describe("desktop AWS enrollment request boundary", () => {
  it("starts with only the expected account/role/region and paired bearer, never cookies", async () => {
    const fetch = respond(challenge);
    expect(await client().startAwsReadOnlyEnrollment(input)).toEqual({ ok: true, data: challenge });
    expect(fetch).toHaveBeenCalledWith("https://service.example.test/api/desktop/cloud/aws/enrollment", expect.objectContaining({ method: "POST", credentials: "omit", body: JSON.stringify(input), headers: expect.objectContaining({ Authorization: "Bearer axm.desk.session.signature" }) }));
  });
  it("completes only the encoded attempt using its server-issued external ID", async () => {
    const fetch = respond({ account });
    expect(await client().completeAwsReadOnlyEnrollment(challenge.attemptId, challenge.externalId)).toEqual({ ok: true, data: { account } });
    expect(fetch).toHaveBeenCalledWith("https://service.example.test/api/desktop/cloud/aws/enrollment/attempt%2F1/complete", expect.objectContaining({ body: JSON.stringify({ externalId: challenge.externalId }), credentials: "omit" }));
  });
  it("reads service-recorded accounts without claiming inventory availability", async () => {
    respond({ accounts: [account] }); expect(await client().desktopCloudAccounts()).toEqual({ ok: true, data: { accounts: [account] } });
  });
  it.each(["", "vxlk_test_recovery", "unsupported"])("does not use unsupported credentials or browser cookies: %s", async token => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(await client(token).startAwsReadOnlyEnrollment(input)).toMatchObject({ ok: false });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects a success-shaped payload on HTTP 503", async () => {
    respond(challenge, 503); expect(await client().startAwsReadOnlyEnrollment(input)).toMatchObject({ ok: false });
  });
  it("rejects malformed challenges rather than letting format-only input establish connection", async () => {
    respond({ ...challenge, externalId: null }); expect(await client().startAwsReadOnlyEnrollment(input)).toMatchObject({ ok: false });
  });
  it("rejects a completed account without service validation evidence", async () => {
    respond({ account: { ...account, lastValidatedAt: null } }); expect(await client().completeAwsReadOnlyEnrollment("attempt", "external")).toMatchObject({ ok: false });
  });
  it("rejects unsupported cloud/provider results instead of manufacturing availability", async () => {
    respond({ accounts: [{ ...account, provider: "gcp", inventoryAvailability: "available" }] }); expect(await client().desktopCloudAccounts()).toMatchObject({ ok: false });
  });
  it("shows safe service unavailable messages without provider exceptions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "cloud_storage_unavailable", message: "Cloud enrollment storage is unavailable." }), { status: 503 })));
    expect(await client().startAwsReadOnlyEnrollment(input)).toEqual({ ok: false, error: "Cloud enrollment storage is unavailable." });
  });
});

describe("bounded live AWS inventory client", () => {
  const inventory = { accountId: input.expectedAccountId, region: input.region, source: "live", complete: false, truncated: true, observedAt: "2026-10-15T00:00:00Z", instances: [{ instanceId: "i-one", state: "running", instanceType: "t3.micro", availabilityZone: "us-east-1a" }] };
  it("reads only the encoded enrolled account endpoint without a query or provider credential", async () => {
    const fetch = respond(inventory);
    expect(await client().desktopAwsInventory("record/1")).toEqual({ ok: true, data: inventory });
    expect(fetch).toHaveBeenCalledWith("https://service.example.test/api/desktop/cloud/accounts/record%2F1/inventory", expect.objectContaining({ method: "GET", credentials: "omit" }));
  });
  it.each([{ ...inventory, source: "fixture" }, { ...inventory, complete: true }, { ...inventory, instances: Array.from({ length: 6 }, () => inventory.instances[0]) }])("rejects unsupported or unbounded inventory responses: %j", async value => {
    respond(value); expect(await client().desktopAwsInventory("account-1")).toMatchObject({ ok: false });
  });
  it("does not convert provider denial into an empty successful inventory", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "aws_inventory_denied", message: "AWS did not permit this bounded inventory read." }), { status: 403 })));
    expect(await client().desktopAwsInventory("account-1")).toEqual({ ok: false, error: "AWS did not permit this bounded inventory read." });
  });
});
