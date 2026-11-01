/**
 * P0 containment: lib/plugins/aws/disable-unused-access-key.ts is a real
 * IAM UpdateAccessKeyCommand mutation gated only by a client-supplied
 * confirmation string, with no tenant/role authorization model. Locks
 * in the default-deny kill-switch: AWS_IAM_MUTATION_ENABLED must be the
 * literal string "true" before the real AWS call can ever fire.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  getAWSCredentials: vi.fn(),
}));

vi.mock("@aws-sdk/client-iam", () => ({
  IAMClient: vi.fn().mockImplementation(function IAMClientMock() {
    return { send: mocks.send };
  }),
  UpdateAccessKeyCommand: vi.fn().mockImplementation(function UpdateAccessKeyCommandMock(this: { input: unknown }, input: unknown) {
    this.input = input;
  }),
}));

vi.mock("../../credentials", () => ({
  getCredentialProvider: () => ({ getAWSCredentials: mocks.getAWSCredentials }),
}));

vi.mock("../../executionRegistry", () => ({ registerExecutionPlugin: vi.fn() }));

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makeCtx(dryRun: boolean) {
  return {
    userId: "user-1",
    dryRun,
    entitlements: {},
    logger: makeLogger(),
    credentialsKey: "cred-key-1",
  };
}

const validInput = { accessKeyId: "AKIAABCDEFGHIJKLMNOP", userName: "alice" };

describe("aws:disable-unused-access-key kill-switch", () => {
  const ORIGINAL_ENV = process.env.AWS_IAM_MUTATION_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAWSCredentials.mockResolvedValue({ accessKeyId: "fake", secretAccessKey: "fake" });
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.AWS_IAM_MUTATION_ENABLED;
    else process.env.AWS_IAM_MUTATION_ENABLED = ORIGINAL_ENV;
  });

  it("blocks the real mutation by default (env var unset)", async () => {
    delete process.env.AWS_IAM_MUTATION_ENABLED;
    const { run } = await import("../disable-unused-access-key");
    const result = await run(validInput, makeCtx(false));

    expect(result.ok).toBe(false);
    expect(result.data?.reasonCode).toBe("legacy_iam_mutation_disabled");
    expect(result.data?.blockedByKillSwitch).toBe(true);
    expect(typeof result.data?.correlationId).toBe("string");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("blocks the real mutation for any non-'true' value", async () => {
    process.env.AWS_IAM_MUTATION_ENABLED = "yes";
    const { run } = await import("../disable-unused-access-key");
    const result = await run(validInput, makeCtx(false));

    expect(result.ok).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("never touches AWS in dry-run mode regardless of the flag", async () => {
    delete process.env.AWS_IAM_MUTATION_ENABLED;
    const { run } = await import("../disable-unused-access-key");
    const result = await run(validInput, makeCtx(true));

    expect(result.ok).toBe(true);
    expect(result.data?.dryRun).toBe(true);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("requires a trusted current guard as well as the explicit flag", async () => {
    process.env.AWS_IAM_MUTATION_ENABLED = "true";
    mocks.send.mockResolvedValue({});
    const { run } = await import("../disable-unused-access-key");
    const beforeMutation=vi.fn(async()=>{});
    const result = await run(validInput, {...makeCtx(false),beforeMutation});

    const{IAMClient}=await import("@aws-sdk/client-iam");
    expect(IAMClient).toHaveBeenCalledWith(expect.objectContaining({maxAttempts:1}));
    expect(beforeMutation).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("refuses flag-only unbound execution and guards that reject",async()=>{
    process.env.AWS_IAM_MUTATION_ENABLED="true";const{run}=await import("../disable-unused-access-key");
    expect(await run(validInput,makeCtx(false))).toMatchObject({ok:false,data:{reasonCode:'legacy_iam_authority_unavailable',providerWriteAttempted:false}});
    expect(await run(validInput,{...makeCtx(false),beforeMutation:async()=>{throw Error('private authority')}})).toMatchObject({ok:false,data:{providerWriteAttempted:false}});
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("preserves a dispatched IAM failure as unknown without resending",async()=>{
    process.env.AWS_IAM_MUTATION_ENABLED="true";mocks.send.mockRejectedValueOnce(Error('private provider response'));const{run}=await import("../disable-unused-access-key");
    const r=await run(validInput,{...makeCtx(false),beforeMutation:async()=>{}});expect(r).toMatchObject({ok:false,data:{outcomeUnconfirmed:true,providerWriteAttempted:true}});expect(JSON.stringify(r)).not.toContain('private provider response');expect(mocks.send).toHaveBeenCalledOnce();
  });
  it("rejects missing input before ever checking the kill-switch or credentials", async () => {
    const { run } = await import("../disable-unused-access-key");
    const result = await run({}, makeCtx(false));

    expect(result.ok).toBe(false);
    expect(mocks.getAWSCredentials).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
