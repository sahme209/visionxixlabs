/**
 * GET /api/admin/gcp-test — admin only.
 *
 * Proves the GCP service account works by:
 *   1. Parsing GCP_SERVICE_ACCOUNT_JSON (verifies it's valid JSON).
 *   2. Calling Cloud Storage list-buckets via the SA. Tests auth + read.
 *
 * Returns project metadata + bucket count. Never echoes the private key.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { Storage } from "@google-cloud/storage";

export const dynamic = "force-dynamic";

interface SaJson {
  client_email?: string;
  project_id?: string;
  private_key?: string;
  type?: string;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const projectId = process.env.GCP_PROJECT_ID?.trim();
  const rawJson = process.env.GCP_SERVICE_ACCOUNT_JSON?.trim();

  const envDebug = {
    projectIdSet: !!projectId,
    saJsonSet: !!rawJson,
    saJsonLength: rawJson?.length ?? 0,
  };

  if (!projectId || !rawJson) {
    return NextResponse.json({
      ok: false,
      stage: "env_check",
      reason: "Missing GCP_PROJECT_ID and/or GCP_SERVICE_ACCOUNT_JSON.",
      envDebug,
    });
  }

  let sa: SaJson;
  try {
    sa = JSON.parse(rawJson) as SaJson;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      stage: "json_parse",
      reason: `GCP_SERVICE_ACCOUNT_JSON is not valid JSON: ${msg}`,
      envDebug,
    });
  }

  const saShape = {
    type: sa.type ?? "",
    clientEmail: sa.client_email ?? "",
    projectIdInJson: sa.project_id ?? "",
    hasPrivateKey: !!sa.private_key,
    privateKeyStartsCorrectly: sa.private_key?.startsWith("-----BEGIN PRIVATE KEY-----") ?? false,
  };

  try {
    const storage = new Storage({
      projectId,
      credentials: {
        client_email: sa.client_email,
        private_key: sa.private_key,
      },
    });
    const [buckets] = await storage.getBuckets();

    return NextResponse.json({
      ok: true,
      stage: "gcs_list_buckets",
      projectId,
      saShape,
      bucketCount: buckets.length,
      bucketSample: buckets.slice(0, 5).map((b) => ({
        name: b.name,
        created: b.metadata?.timeCreated ?? null,
      })),
      envDebug,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      stage: "gcs_call",
      reason: msg.slice(0, 500),
      saShape,
      envDebug,
    });
  }
}
