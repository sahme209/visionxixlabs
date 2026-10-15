import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sts: vi.fn(), ec2: vi.fn(), configurations: [] as unknown[], destroyed: vi.fn() }));
vi.mock("@aws-sdk/client-sts", () => ({
  STSClient: class { constructor(configuration: unknown) { mocks.configurations.push(configuration); } send(command: unknown, options: unknown) { return mocks.sts(command, options); } destroy() { mocks.destroyed(); } },
  AssumeRoleCommand: class { constructor(readonly input: unknown) {} }, GetCallerIdentityCommand: class { constructor(readonly input: unknown) {} },
}));
vi.mock("@aws-sdk/client-ec2", () => ({
  EC2Client: class { constructor(configuration: unknown) { mocks.configurations.push(configuration); } send(command: unknown, options: unknown) { return mocks.ec2(command, options); } destroy() { mocks.destroyed(); } },
  DescribeInstancesCommand: class { constructor(readonly input: unknown) {} },
}));
import { __resetEnvCacheForTest } from "@/lib/config/env";
import { validateEnrollmentRole, readEnrollmentInventory } from "../stsValidation";
import { input, externalId } from "./fixture";
const request = { ...input, externalId, sessionName: "axiom-enroll-fixture" };
const roleArn = "arn:aws:sts::123456789012:assumed-role/ReadOnly/axiom-enroll-fixture";
beforeEach(() => {
  vi.clearAllMocks(); __resetEnvCacheForTest(); mocks.configurations.length = 0;
  vi.stubEnv("AWS_CONNECTOR_BROKER_ACCESS_KEY_ID", "fixture-broker-key"); vi.stubEnv("AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY", "fixture-broker-secret"); vi.stubEnv("AWS_SCAN_MODE", "live"); vi.stubEnv("ENABLE_CLOUD_CONNECTORS_AWS", "true");
  mocks.sts.mockImplementation(async (command: { input: Record<string, unknown> }) => command.input.RoleArn
    ? { AssumedRoleUser: { Arn: roleArn }, Credentials: { AccessKeyId: "fixture-temporary-key", SecretAccessKey: "fixture-temporary-secret", SessionToken: "fixture-temporary-token" } }
    : { Account: input.expectedAccountId, Arn: roleArn });
  mocks.ec2.mockResolvedValue({ Reservations: [] });
});
afterEach(() => { vi.unstubAllEnvs(); __resetEnvCacheForTest(); });
it("uses only broker AssumeRole and exact assumed identity with bounded calls; never returns temporary credentials", async () => {
  const result = await validateEnrollmentRole(request);
  expect(result).toEqual({ accountId: input.expectedAccountId, assumedRoleArn: roleArn });
  expect(mocks.sts.mock.calls.map(([command]) => command.input)).toEqual([{ RoleArn: input.roleArn, ExternalId: externalId, RoleSessionName: request.sessionName, DurationSeconds: 900 }, {}]);
  expect(mocks.configurations).toEqual([
    expect.objectContaining({ credentials: { accessKeyId: "fixture-broker-key", secretAccessKey: "fixture-broker-secret" }, maxAttempts: 2 }),
    expect.objectContaining({ credentials: { accessKeyId: "fixture-temporary-key", secretAccessKey: "fixture-temporary-secret", sessionToken: "fixture-temporary-token" }, maxAttempts: 2 }),
  ]);
  expect(mocks.sts.mock.calls.every(([, options]) => options.abortSignal instanceof AbortSignal)).toBe(true);
  expect(mocks.destroyed).toHaveBeenCalledTimes(2); expect(JSON.stringify(result)).not.toContain("fixture-temporary");
});
it.each(["wrong_account", "wrong_role", "wrong_session", "missing_identity", "missing_credentials"])("rejects %s without claiming verification", async (mode) => {
  mocks.sts.mockImplementation(async (command: { input: Record<string, unknown> }) => {
    if (command.input.RoleArn) return { AssumedRoleUser: { Arn: mode === "wrong_role" ? roleArn.replace("ReadOnly", "Other") : mode === "wrong_session" ? roleArn.replace("fixture", "other") : roleArn }, Credentials: mode === "missing_credentials" ? {} : { AccessKeyId: "temporary", SecretAccessKey: "temporary", SessionToken: "temporary" } };
    return { Account: mode === "wrong_account" ? "999999999999" : input.expectedAccountId, Arn: mode === "missing_identity" ? undefined : roleArn };
  });
  await expect(validateEnrollmentRole(request)).rejects.toMatchObject({ code: "aws_identity_unverified" });
});
it.each(["missing_broker", "preview", "disabled"])("fails unavailable for %s, never using ambient credentials", async (mode) => {
  vi.stubEnv("AWS_ACCESS_KEY_ID", "ambient-must-not-be-used"); vi.stubEnv("AWS_SECRET_ACCESS_KEY", "ambient-must-not-be-used");
  if (mode === "missing_broker") vi.stubEnv("AWS_CONNECTOR_BROKER_ACCESS_KEY_ID", "");
  if (mode === "preview") vi.stubEnv("AWS_SCAN_MODE", "preview");
  if (mode === "disabled") vi.stubEnv("ENABLE_CLOUD_CONNECTORS_AWS", "false");
  __resetEnvCacheForTest();
  await expect(validateEnrollmentRole(request)).rejects.toMatchObject({ code: "enrollment_unavailable" }); expect(mocks.sts).not.toHaveBeenCalled();
});
it("returns only one bounded live EC2 page without tags, tokens or account totals", async () => {
  mocks.ec2.mockResolvedValue({ NextToken: "provider-private-token", Reservations: [{ Instances: Array.from({ length: 7 }, (_, index) => ({ InstanceId: `i-${index}`, State: { Name: "running" }, InstanceType: "t3.micro", Placement: { AvailabilityZone: "us-east-1a" }, Tags: [{ Key: "secret", Value: "do-not-return" }] })) }] });
  const result = await readEnrollmentInventory(request);
  expect(mocks.ec2.mock.calls[0][0].input).toEqual({ MaxResults: 5 }); expect(mocks.ec2).toHaveBeenCalledTimes(1);
  expect(result).toMatchObject({ accountId: input.expectedAccountId, source: "live", complete: false, truncated: true }); expect(result.instances).toHaveLength(5);
  expect(JSON.stringify(result)).not.toMatch(/do-not-return|provider-private-token|Tags/);
});
it("reports inventory permission denial distinctly from identity verification", async () => {
  mocks.ec2.mockRejectedValue(Object.assign(new Error("private provider text"), { name: "UnauthorizedOperation" }));
  await expect(readEnrollmentInventory(request)).rejects.toMatchObject({ code: "aws_inventory_denied" });
});
