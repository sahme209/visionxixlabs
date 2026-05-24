/**
 * Auto-publish the CloudFormation Quick-Create template to S3.
 *
 * Why: AWS Console's CloudFormation Quick-Create deep-link rejects
 * non-S3 templateURLs. To make the 1-click button "just work" for the
 * customer with zero operator action, the platform uploads the
 * template itself on the first request using the broker credentials
 * we already have.
 *
 * Idempotent: if the bucket + object already exist with the current
 * template content, no S3 write happens. After the first successful
 * publish, the URL is cached in module memory for the function's
 * lifetime so subsequent requests skip the HeadObject probe.
 *
 * Bucket name is derived deterministically:
 *
 *   axiom-cfn-templates-<broker-account-id>
 *
 * One bucket per broker account, public-read scoped to ONLY the
 * template object key (the policy targets that specific ARN, nothing
 * else). The bucket lives in us-east-1 — CloudFormation's Quick-Create
 * accepts any S3 region but us-east-1 keeps the URL form simple.
 */

import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutPublicAccessBlockCommand,
  PutBucketPolicyCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

const REGION = "us-east-1";
const OBJECT_KEY = "axiom-agent-quick-deploy.yaml";
const TEMPLATE_RELATIVE_PATH = "public/aws/axiom-agent-quick-deploy.yaml";

export interface PublishResult {
  available: true;
  url: string;
  bucket: string;
  publishedNow: boolean;
}

export interface PublishError {
  available: false;
  reason:
    | "broker_creds_missing"
    | "broker_account_lookup_failed"
    | "template_read_failed"
    | "bucket_setup_failed"
    | "upload_failed";
  detail: string;
}

let cached: PublishResult | null = null;

/**
 * Returns the public S3 URL of the Quick-Create template, uploading
 * it first if needed. Cached after first successful publish.
 *
 * Pass `forceRefresh: true` to invalidate the cache (used during
 * deploys when the template content has changed).
 */
export async function ensureTemplatePublished(opts: { forceRefresh?: boolean } = {}): Promise<PublishResult | PublishError> {
  if (cached && !opts.forceRefresh) return cached;

  // 0. Operator override — if AWS_CFN_TEMPLATE_S3_URL is explicitly set,
  //    use it verbatim and skip the auto-publish. Lets an operator host
  //    the template on their own bucket / region / CDN.
  const override = process.env.AWS_CFN_TEMPLATE_S3_URL?.trim();
  if (override) {
    cached = { available: true, url: override, bucket: "(operator-managed)", publishedNow: false };
    return cached;
  }

  // 1. Need broker credentials. Without them the platform has nothing
  //    to upload with — operator config gap, surface honestly.
  const accessKeyId = process.env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) {
    return {
      available: false,
      reason: "broker_creds_missing",
      detail: "AWS_CONNECTOR_BROKER_ACCESS_KEY_ID + AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY must be set so the platform can publish its CFN template to S3.",
    };
  }

  // 2. Look up broker account id to derive a deterministic bucket name.
  const sts = new STSClient({ region: REGION, credentials: { accessKeyId, secretAccessKey } });
  let brokerAccountId: string;
  try {
    const ident = await sts.send(new GetCallerIdentityCommand({}));
    if (!ident.Account) throw new Error("no Account in GetCallerIdentity response");
    brokerAccountId = ident.Account;
  } catch (err) {
    return {
      available: false,
      reason: "broker_account_lookup_failed",
      detail: `sts:GetCallerIdentity failed: ${errMessage(err)}`,
    };
  }

  const bucket = `axiom-cfn-templates-${brokerAccountId}`;
  const s3 = new S3Client({ region: REGION, credentials: { accessKeyId, secretAccessKey } });

  // 3. Load the template body from the repo. Hash it so we can skip
  //    the PutObject when content hasn't changed.
  let templateBody: string;
  try {
    templateBody = await readFile(path.join(process.cwd(), TEMPLATE_RELATIVE_PATH), "utf8");
  } catch (err) {
    return {
      available: false,
      reason: "template_read_failed",
      detail: `Couldn't read ${TEMPLATE_RELATIVE_PATH}: ${errMessage(err)}`,
    };
  }
  const sha = createHash("sha256").update(templateBody).digest("hex").slice(0, 16);

  // 4. Ensure bucket exists + is public-read-able for THIS object key.
  try {
    await ensureBucket(s3, bucket);
  } catch (err) {
    return {
      available: false,
      reason: "bucket_setup_failed",
      detail: `Bucket setup failed (${bucket}): ${errMessage(err)}`,
    };
  }

  // 5. Skip the PutObject if the object already exists with our
  //    content hash in metadata. Saves an S3 write per request.
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: OBJECT_KEY }));
    if (head.Metadata && head.Metadata["axiom-template-sha"] === sha) {
      const url = `https://${bucket}.s3.amazonaws.com/${OBJECT_KEY}`;
      cached = { available: true, url, bucket, publishedNow: false };
      return cached;
    }
  } catch {
    // Object missing or HeadObject denied — fall through to upload.
  }

  // 6. Upload + cache.
  try {
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: OBJECT_KEY,
      Body: templateBody,
      ContentType: "application/x-yaml",
      Metadata: { "axiom-template-sha": sha },
    }));
  } catch (err) {
    return {
      available: false,
      reason: "upload_failed",
      detail: `s3:PutObject failed: ${errMessage(err)}`,
    };
  }

  const url = `https://${bucket}.s3.amazonaws.com/${OBJECT_KEY}`;
  cached = { available: true, url, bucket, publishedNow: true };
  return cached;
}

/**
 * Ensure the bucket exists in us-east-1 with public-access-block
 * cleared + a public-read policy scoped to ONLY the template object
 * key. Idempotent — each step soft-fails if already in the right
 * state.
 */
async function ensureBucket(s3: S3Client, bucket: string): Promise<void> {
  // HeadBucket → 200 means exists + accessible.
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    // Doesn't exist (or we lack permission to head it) — try to create.
    // us-east-1 createBucket doesn't take a LocationConstraint.
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }

  // Unblock public access — required so the public-read policy can apply.
  try {
    await s3.send(new PutPublicAccessBlockCommand({
      Bucket: bucket,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: false,
        IgnorePublicAcls: false,
        BlockPublicPolicy: false,
        RestrictPublicBuckets: false,
      },
    }));
  } catch {
    // If account-level public-access-block is on, this will be a no-op
    // and the policy step will fail downstream. Bubble up there.
  }

  const policy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [{
      Sid: "PublicReadAxiomAgentTemplate",
      Effect: "Allow",
      Principal: "*",
      Action: "s3:GetObject",
      Resource: `arn:aws:s3:::${bucket}/${OBJECT_KEY}`,
    }],
  });
  await s3.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: policy }));
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
