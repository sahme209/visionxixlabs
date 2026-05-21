/**
 * GET /api/admin/aws-read-test — admin only.
 *
 * Proves the full read chain works for the configured AWS broker:
 *  1. Resolve credentials via awsCredentialResolver (respects
 *     AWS_USE_DIRECT_CREDS=true for single-account direct-creds setup).
 *  2. Call S3 ListBuckets — the most universal AWS read API. Works on
 *     every account, requires only s3:ListAllMyBuckets, returns clean
 *     metadata (no secret data ever).
 *
 * Returns the bucket count + names + creation dates. Never lists
 * objects, never reads bytes. Sanity check only.
 */

import { NextRequest, NextResponse } from "next/server";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { requireAdmin } from "@/lib/admin/auth";
import { resolveAwsCredentials } from "@/lib/cloud/aws/awsCredentialResolver";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const resolved = await resolveAwsCredentials({ sessionLabel: "admin-read-test" });
  if (resolved.mode === "blocked") {
    return NextResponse.json({
      ok: false,
      stage: "credential_resolve",
      reason: resolved.reason,
    });
  }

  try {
    const s3 = new S3Client({
      region: resolved.region,
      credentials: resolved.credentials,
    });
    const out = await s3.send(new ListBucketsCommand({}));
    const buckets = (out.Buckets ?? []).map((b) => ({
      name: b.Name ?? null,
      createdAt: b.CreationDate?.toISOString() ?? null,
    }));
    return NextResponse.json({
      ok: true,
      stage: "s3_list_buckets",
      via: resolved.via,
      region: resolved.region,
      bucketCount: buckets.length,
      buckets,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      stage: "s3_list_buckets",
      reason: msg,
    });
  }
}
