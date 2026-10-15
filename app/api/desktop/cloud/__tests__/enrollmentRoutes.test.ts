import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ repo: {} as Record<string, unknown>, resolve: vi.fn(), validate: vi.fn(), configured: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: new Proxy({}, { get: (_target, key) => mocks.repo[String(key)] }) }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolve }));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: vi.fn(async () => true) }));
vi.mock("@/lib/cloud/aws/enrollment/stsValidation", () => ({ assertAwsEnrollmentConfigured: mocks.configured, validateEnrollmentRole: mocks.validate, readEnrollmentInventory: mocks.read }));
import { POST as start } from "../aws/enrollment/route";
import { POST as complete } from "../aws/enrollment/[id]/complete/route";
import { GET as list } from "../accounts/route";
import { GET as inventory } from "../accounts/[id]/inventory/route";
import { isAwsEnrollmentChallenge, isDesktopAwsAccount, isDesktopAwsInventory } from "@/desktop/src/lib/awsEnrollmentContract";
import { fixture, principal, input } from "@/lib/cloud/aws/enrollment/__tests__/fixture";
let f: ReturnType<typeof fixture>;
const request = (path: string, method = "GET", body?: unknown) => new NextRequest(`https://example.test/api/desktop/cloud/${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
beforeEach(() => {
  vi.clearAllMocks(); f = fixture(); mocks.repo = f.repo;
  // Runtime service uses its actual clock, so this device must remain active.
  f.state.device.expiresAt = new Date("2099-01-01");
  mocks.resolve.mockResolvedValue({ id: principal.sessionId, userId: principal.userId, organizationId: principal.organizationId, credentialKind: "desktop_session" });
  mocks.validate.mockResolvedValue({ accountId: input.expectedAccountId, assumedRoleArn: "verified-session" });
  mocks.read.mockResolvedValue({ accountId: input.expectedAccountId, region: input.region, source: "live", complete: false, truncated: false, instances: [], observedAt: "2026-10-16T00:00:00Z" });
  vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "fixture-only-credential-key-32-characters");
});
afterEach(() => vi.unstubAllEnvs());
it.each(["missing", "api_key"])("denies all routes for %s paired authority before lookup/provider IO", async (kind) => {
  mocks.resolve.mockResolvedValue(kind === "missing" ? undefined : { id: principal.sessionId, userId: principal.userId, organizationId: principal.organizationId, credentialKind: "api_key" });
  expect((await start(request("aws/enrollment", "POST", input))).status).toBe(401);
  expect((await complete(request("aws/enrollment/x/complete", "POST", { externalId: "x" }), { params: Promise.resolve({ id: "x" }) })).status).toBe(401);
  expect((await list(request("accounts"))).status).toBe(401);
  expect((await inventory(request("accounts/x/inventory"), { params: Promise.resolve({ id: "x" }) })).status).toBe(401);
  expect(f.repo.cloudAccount.findMany).not.toHaveBeenCalled(); expect(mocks.validate).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.resolve.mock.calls.every(([, options]) => options.allowApiKey === false)).toBe(true);
});
it("composes authorized challenge→completion→safe list→one-page inventory through scoped vault", async () => {
  const started = await start(request("aws/enrollment", "POST", input)); expect(started.status).toBe(200);
  const challenge = (await started.json()).data; expect(isAwsEnrollmentChallenge(challenge)).toBe(true);
  const completed = await complete(request(`aws/enrollment/${challenge.attemptId}/complete`, "POST", { externalId: challenge.externalId }), { params: Promise.resolve({ id: challenge.attemptId }) });
  expect(completed.status).toBe(200); const account = (await completed.json()).data.account;
  expect(isDesktopAwsAccount(account)).toBe(true);
  expect(account).toMatchObject({ accountId: input.expectedAccountId, enabled: false, agentScanAvailable: false });
  const listed = await list(request("accounts")); const listedAccounts = (await listed.json()).data.accounts; expect(listedAccounts).toHaveLength(1); expect(listedAccounts.every(isDesktopAwsAccount)).toBe(true);
  const observed = await inventory(request(`accounts/${account.id}/inventory`), { params: Promise.resolve({ id: account.id }) });
  expect(observed.status).toBe(200); const observedData = (await observed.json()).data; expect(observedData).toMatchObject({ source: "live", complete: false, instances: [] }); expect(isDesktopAwsInventory(observedData)).toBe(true);
  expect(mocks.read).toHaveBeenCalledWith(expect.objectContaining({ ...input, externalId: challenge.externalId }));
  expect(mocks.resolve.mock.calls[0][1]).toMatchObject({ requiredCapability: "connections:manage", allowApiKey: false });
  expect(mocks.resolve.mock.calls.at(-1)![1]).toMatchObject({ requiredCapability: "workspace:read", allowApiKey: false });
});
it("fails storage-unavailable before SDK and returns no database error or configuration", async () => {
  f.repo.cloudAccountCredential.findMany.mockRejectedValue({ code: "P2021", message: "private connection details" });
  const response = await start(request("aws/enrollment", "POST", input)); expect(response.status).toBe(503);
  const body = await response.json(); expect(body.error).toBe("enrollment_unavailable"); expect(JSON.stringify(body)).not.toContain("private"); expect(mocks.validate).not.toHaveBeenCalled();
});
it("rejects tenant overrides in challenge input and region overrides in inventory", async () => {
  const response = await start(request("aws/enrollment", "POST", { ...input, organizationId: "foreign" })); expect(response.status).toBe(400);
  const result = await inventory(request("accounts/id/inventory?region=elsewhere"), { params: Promise.resolve({ id: "id" }) });
  expect(result.status).toBe(400); expect(mocks.read).not.toHaveBeenCalled();
});

it("reports canonical account allowance denial without granting or charging a subscription", async () => {
  f.state.additionalAccountCount = 1;
  const response = await start(request("aws/enrollment", "POST", input));
  expect(response.status).toBe(403); expect((await response.json()).error).toBe("cloud_account_limit_reached");
  expect(mocks.validate).not.toHaveBeenCalled(); expect(f.repo.cloudAccountEnrollmentAttempt.create).not.toHaveBeenCalled();
});

it("returns a retryable conflict without retained writes after a simulated serialization abort", async () => {
  const challenge = (await (await start(request("aws/enrollment", "POST", input))).json()).data;
  f.state.serializationAbort = true;
  const response = await complete(request(`aws/enrollment/${challenge.attemptId}/complete`, "POST", { externalId: challenge.externalId }), { params: Promise.resolve({ id: challenge.attemptId }) });
  expect(response.status).toBe(409); expect((await response.json()).error).toBe("enrollment_conflict");
  expect(f.state.account).toBeNull(); expect(f.state.credential).toBeNull(); expect(f.state.attempt?.consumedAt).toBeNull();
});
