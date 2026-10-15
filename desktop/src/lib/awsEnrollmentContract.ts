export interface AwsEnrollmentInput { expectedAccountId: string; roleArn: string; region: string }
export interface AwsEnrollmentChallenge extends AwsEnrollmentInput { attemptId: string; externalId: string; expiresAt: string }
export interface DesktopAwsAccount {
  id: string; provider: "aws"; accountId: string; alias: string | null; regions: string[];
  connected: boolean; status: "connected" | "disconnected"; lastValidatedAt: string | null;
  inventoryAvailability: "not_checked"; enabled: false; agentScanAvailable: false;
}

export function awsEnrollmentInputError(input: AwsEnrollmentInput): string | null {
  if (!/^\d{12}$/.test(input.expectedAccountId)) return "Enter the expected 12-digit AWS account ID.";
  const role = input.roleArn.match(/^arn:(aws|aws-us-gov|aws-cn):iam::(\d{12}):role\/[A-Za-z0-9+=,.@_\/-]+$/);
  if (!role || role[2] !== input.expectedAccountId) return "Use an existing IAM role ARN in the expected AWS account.";
  if (!/^[a-z]{2}(?:-[a-z]+)+-\d$/.test(input.region)) return "Enter the AWS region for this read-only connection.";
  return null;
}

export function isAwsEnrollmentChallenge(value: unknown): value is AwsEnrollmentChallenge {
  if (!value || typeof value !== "object") return false;
  const item = value as AwsEnrollmentChallenge;
  return typeof item.attemptId === "string" && item.attemptId.length > 0
    && typeof item.externalId === "string" && item.externalId.length > 0
    && typeof item.expiresAt === "string" && Number.isFinite(Date.parse(item.expiresAt))
    && typeof item.expectedAccountId === "string" && typeof item.roleArn === "string" && typeof item.region === "string"
    && awsEnrollmentInputError(item) === null;
}

export function isDesktopAwsAccount(value: unknown): value is DesktopAwsAccount {
  if (!value || typeof value !== "object") return false;
  const item = value as DesktopAwsAccount;
  const validTime = typeof item.lastValidatedAt === "string" && Number.isFinite(Date.parse(item.lastValidatedAt));
  return typeof item.id === "string" && item.id.length > 0 && item.provider === "aws"
    && typeof item.accountId === "string" && /^\d{12}$/.test(item.accountId)
    && (item.alias === null || typeof item.alias === "string")
    && Array.isArray(item.regions) && item.regions.every(region => typeof region === "string" && region.length > 0)
    && typeof item.connected === "boolean" && (item.status === "connected" || item.status === "disconnected")
    && item.connected === (item.status === "connected")
    && (item.lastValidatedAt === null || validTime) && (!item.connected || validTime)
    && item.inventoryAvailability === "not_checked" && item.enabled === false && item.agentScanAvailable === false;
}

export interface DesktopAwsInventory {
  accountId: string; region: string; source: "live"; complete: false; truncated: boolean;
  instances: Array<{ instanceId: string; state: string; instanceType: string; availabilityZone: string }>;
  observedAt: string;
}

export function isDesktopAwsInventory(value: unknown): value is DesktopAwsInventory {
  if (!value || typeof value !== "object") return false;
  const item = value as DesktopAwsInventory;
  return typeof item.accountId === "string" && /^\d{12}$/.test(item.accountId)
    && typeof item.region === "string" && item.region.length > 0 && item.source === "live"
    && item.complete === false && typeof item.truncated === "boolean"
    && typeof item.observedAt === "string" && Number.isFinite(Date.parse(item.observedAt))
    && Array.isArray(item.instances) && item.instances.length <= 5
    && item.instances.every(instance => instance && typeof instance.instanceId === "string" && typeof instance.state === "string" && typeof instance.instanceType === "string" && typeof instance.availabilityZone === "string");
}
