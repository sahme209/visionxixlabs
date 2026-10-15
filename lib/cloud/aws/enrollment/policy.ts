import { createHash, timingSafeEqual } from "node:crypto";

export type EnrollmentErrorCode = "invalid_input" | "enrollment_unavailable" | "enrollment_not_found" | "enrollment_expired" | "enrollment_conflict" | "connection_authority_required" | "aws_identity_unverified" | "aws_inventory_denied" | "cloud_account_limit_reached";
export class AwsEnrollmentError extends Error {
  constructor(readonly code: EnrollmentErrorCode) { super(code); this.name = "AwsEnrollmentError"; }
}
export interface AwsEnrollmentInput { expectedAccountId: string; roleArn: string; region: string }
export function parseAwsEnrollmentInput(input: unknown): AwsEnrollmentInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new AwsEnrollmentError("invalid_input");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !["expectedAccountId", "roleArn", "region"].includes(key))) throw new AwsEnrollmentError("invalid_input");
  const expectedAccountId = typeof value.expectedAccountId === "string" ? value.expectedAccountId.trim() : "";
  const roleArn = typeof value.roleArn === "string" ? value.roleArn.trim() : "";
  const region = typeof value.region === "string" ? value.region.trim() : "";
  const role = /^arn:(aws|aws-us-gov|aws-cn):iam::(\d{12}):role\/[A-Za-z0-9_+=,.@\-/]{1,512}$/.exec(roleArn);
  if (!/^\d{12}$/.test(expectedAccountId) || !role || !/^[A-Za-z0-9_+=,.@-]{1,64}$/.test(roleArn.split("/").at(-1) ?? "") || role[2] !== expectedAccountId || !/^[a-z]{2}(?:-[a-z]+)+-\d$/.test(region)) throw new AwsEnrollmentError("invalid_input");
  if ((role[1] === "aws-cn") !== region.startsWith("cn-") || (role[1] === "aws-us-gov") !== region.startsWith("us-gov-")) throw new AwsEnrollmentError("invalid_input");
  return { expectedAccountId, roleArn, region };
}
export function externalIdDigest(externalId: string): string { return createHash("sha256").update(externalId).digest("hex"); }
export function matchesExternalId(externalId: unknown, digest: string): externalId is string {
  if (typeof externalId !== "string" || !/^axiom-[a-f0-9]{32}$/.test(externalId) || !/^[a-f0-9]{64}$/.test(digest)) return false;
  return timingSafeEqual(Buffer.from(externalIdDigest(externalId), "hex"), Buffer.from(digest, "hex"));
}
export function cloudCredentialContext(input: { organizationId: string; accountId: string; version: number }): string {
  return `cloud-account-credential-v1:${input.organizationId}:aws:${input.accountId}:${input.version}`;
}
