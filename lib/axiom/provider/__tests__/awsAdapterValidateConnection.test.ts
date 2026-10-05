/**
 * AWSAdapter.validateConnection() is the one piece of item 16 (AWS
 * read-only health/evidence) that had no test at all — the pure
 * health-scoring logic (lib/connectors/connectorHealth.test.ts) was
 * already covered, but nothing proved this specific function's shape:
 * `connected: true` only after both a real STS GetCallerIdentity AND a
 * real EC2 DescribeRegions call succeed, and a genuine adapterError
 * (never a fabricated success) on any credential, auth, or network
 * failure. A live AWS account is still required to prove the real HTTP
 * calls themselves work — that remains externally blocked — but the
 * code's own honesty contract (never claim connected without both real
 * calls succeeding) is fully provable with mocks.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAWSCredentials: vi.fn(),
  stsSend: vi.fn(),
  ec2Send: vi.fn(),
}));

vi.mock("@/lib/plugins/credentials", () => ({
  getCredentialProvider: () => ({ getAWSCredentials: mocks.getAWSCredentials }),
}));

vi.mock("@aws-sdk/client-sts", () => ({
  STSClient: vi.fn().mockImplementation(function STSClientMock() {
    return { send: mocks.stsSend };
  }),
  GetCallerIdentityCommand: vi.fn().mockImplementation(function GetCallerIdentityCommandMock() {}),
}));

vi.mock("@aws-sdk/client-ec2", () => ({
  EC2Client: vi.fn().mockImplementation(function EC2ClientMock() {
    return { send: mocks.ec2Send };
  }),
  DescribeRegionsCommand: vi.fn().mockImplementation(function DescribeRegionsCommandMock() {}),
}));

describe("AWSAdapter.validateConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAWSCredentials.mockResolvedValue({ accessKeyId: "fake", secretAccessKey: "fake" });
  });

  it("reports connected:true only once both STS and EC2 calls genuinely succeed", async () => {
    mocks.stsSend.mockResolvedValue({ Account: "123456789012" });
    mocks.ec2Send.mockResolvedValue({ Regions: [{ RegionName: "us-east-1" }, { RegionName: "us-west-2" }] });

    const { AWSAdapter } = await import("../awsAdapter");
    const result = await new AWSAdapter().validateConnection("user-1", "cred-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.connected).toBe(true);
      expect(result.data.accountId).toBe("123456789012");
      expect(result.data.regions).toEqual(["us-east-1", "us-west-2"]);
    }
    expect(mocks.stsSend).toHaveBeenCalledTimes(1);
    expect(mocks.ec2Send).toHaveBeenCalledTimes(1);
  });

  it("never fabricates a connection when no credential is stored in the vault", async () => {
    mocks.getAWSCredentials.mockResolvedValue(null);

    const { AWSAdapter } = await import("../awsAdapter");
    const result = await new AWSAdapter().validateConnection("user-1", "cred-missing");

    expect(result.ok).toBe(false);
    expect(mocks.stsSend).not.toHaveBeenCalled();
    expect(mocks.ec2Send).not.toHaveBeenCalled();
  });

  it("never fabricates a connection when the real STS call fails (invalid/expired credentials)", async () => {
    mocks.stsSend.mockRejectedValue(new Error("The security token included in the request is invalid"));

    const { AWSAdapter } = await import("../awsAdapter");
    const result = await new AWSAdapter().validateConnection("user-1", "cred-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("connection_failed");
    expect(mocks.ec2Send).not.toHaveBeenCalled();
  });

  it("never fabricates a connection when STS succeeds but the EC2 read-access check fails", async () => {
    mocks.stsSend.mockResolvedValue({ Account: "123456789012" });
    mocks.ec2Send.mockRejectedValue(new Error("UnauthorizedOperation"));

    const { AWSAdapter } = await import("../awsAdapter");
    const result = await new AWSAdapter().validateConnection("user-1", "cred-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("connection_failed");
  });
});
