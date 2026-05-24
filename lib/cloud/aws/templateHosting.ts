/**
 * Auto-publish the CloudFormation Quick-Create template to S3.
 *
 * Why this exists: AWS Console's CFN Quick-Create deep-link rejects
 * non-S3 templateURLs, so the platform uploads the YAML to its own
 * S3 bucket and hands the customer a URL. Was using a public bucket
 * + bucket-policy + public-access-block until that ran into account-
 * level S3 BPA / read-only broker users — now uses a *presigned* GET
 * URL signed by the broker, so:
 *
 *   - The bucket stays private. No bucket policy needed.
 *   - No PutPublicAccessBlock call. No account-level BPA conflict.
 *   - Required broker IAM perms shrink to: CreateBucket, HeadBucket,
 *     PutObject, GetObject — nothing privileged.
 *
 * The presigned URL expires after 1 hour (max for SigV4 query auth
 * is 7 days, but 1h matches the customer's expected click-through
 * window). On bounce-back from CFN we don't reuse the URL — we
 * publish a fresh one if needed.
 *
 * Idempotent: if the bucket + object already exist with the same
 * content hash, we skip the upload but still re-sign the URL.
 */

import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

const REGION = "us-east-1";
const OBJECT_KEY = "axiom-agent-quick-deploy.yaml";
const TEMPLATE_RELATIVE_PATH = "public/aws/axiom-agent-quick-deploy.yaml";
const URL_TTL_SECONDS = 60 * 60; // 1 hour

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
    | "broker_s3_perms_missing"
    | "upload_failed";
  detail: string;
  /** Broker IAM user ARN parsed out of an AccessDenied — lets the UI deep-link the operator to the right IAM page. */
  brokerArn?: string;
  /** Bucket name we were trying to create when access was denied. */
  bucket?: string;
}

interface UploadCache {
  bucket: string;
  sha: string;
}
let uploadCache: UploadCache | null = null;

/**
 * Returns a presigned GET URL for the Quick-Create template, uploading
 * it first if needed. The URL is freshly signed on every call so it
 * stays within its TTL even if the cache is warm.
 */
export async function ensureTemplatePublished(opts: { forceRefresh?: boolean } = {}): Promise<PublishResult | PublishError> {
  // 0. Operator override — if AWS_CFN_TEMPLATE_S3_URL is explicitly set,
  //    use it verbatim. Lets an operator self-host on a CDN.
  const override = process.env.AWS_CFN_TEMPLATE_S3_URL?.trim();
  if (override) {
    return { available: true, url: override, bucket: "(operator-managed)", publishedNow: false };
  }

  // 1. Need broker credentials.
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

  // 3. Load + hash the template.
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

  // 4. Ensure bucket exists. No public access settings touched.
  try {
    await ensureBucket(s3, bucket);
  } catch (err) {
    const msg = errMessage(err);
    const isS3PermDenied = /s3:(CreateBucket|HeadBucket)/i.test(msg)
      || /AccessDenied|not authorized to perform/i.test(msg);
    if (isS3PermDenied) {
      const arnMatch = msg.match(/arn:aws:iam::\d{12}:(user|role)\/[A-Za-z0-9_+=,.@\-/]+/);
      return {
        available: false,
        reason: "broker_s3_perms_missing",
        detail: msg,
        brokerArn: arnMatch?.[0],
        bucket,
      };
    }
    return {
      available: false,
      reason: "bucket_setup_failed",
      detail: `Bucket setup failed (${bucket}): ${msg}`,
      bucket,
    };
  }

  // 5. Skip upload if the object is already there with our content hash.
  let publishedNow = false;
  if (!opts.forceRefresh && uploadCache?.bucket === bucket && uploadCache.sha === sha) {
    // Module-memory says we already uploaded this exact version.
  } else {
    let skipUpload = false;
    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: OBJECT_KEY }));
      if (head.Metadata && head.Metadata["axiom-template-sha"] === sha) {
        skipUpload = true;
      }
    } catch {
      // Object missing or HeadObject denied — fall through to upload.
    }

    if (!skipUpload) {
      try {
        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: OBJECT_KEY,
          Body: templateBody,
          ContentType: "application/x-yaml",
          Metadata: { "axiom-template-sha": sha },
        }));
        publishedNow = true;
      } catch (err) {
        const msg = errMessage(err);
        const arnMatch = msg.match(/arn:aws:iam::\d{12}:(user|role)\/[A-Za-z0-9_+=,.@\-/]+/);
        return {
          available: false,
          reason: "upload_failed",
          detail: `s3:PutObject failed: ${msg}`,
          brokerArn: arnMatch?.[0],
          bucket,
        };
      }
    }
    uploadCache = { bucket, sha };
  }

  // 6. Sign a GET URL the customer's browser (and AWS Console) can use.
  // Cast is needed because @aws-sdk/s3-request-presigner ships its own
  // copy of @smithy/types whose Client interface differs structurally
  // from the one client-s3 was compiled against. Runtime contract is
  // identical — the cast is purely a TS structural-typing escape.
  let url: string;
  try {
    url = await getSignedUrl(
      s3 as unknown as Parameters<typeof getSignedUrl>[0],
      new GetObjectCommand({ Bucket: bucket, Key: OBJECT_KEY }) as unknown as Parameters<typeof getSignedUrl>[1],
      { expiresIn: URL_TTL_SECONDS },
    );
  } catch (err) {
    return {
      available: false,
      reason: "upload_failed",
      detail: `s3 presign failed: ${errMessage(err)}`,
      bucket,
    };
  }

  return { available: true, url, bucket, publishedNow };
}

async function ensureBucket(s3: S3Client, bucket: string): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    return;
  } catch {
    // Falls through to CreateBucket. us-east-1 doesn't take a LocationConstraint.
  }
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
