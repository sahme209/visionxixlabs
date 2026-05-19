/**
 * GCP Cloud KMS extractor.
 *
 * Lists every key in every key ring across the common KMS locations
 * (global + the most-used regions) and captures the rotation posture
 * of each crypto key:
 *   - rotationPeriod          (e.g. "7776000s" → 90d)
 *   - nextRotationTime        (the next scheduled rotation)
 *   - primaryState            (current crypto key version state)
 *   - destroyScheduledDuration
 *
 * Why this matters: rotation cadence is the single biggest indicator
 * of a healthy KMS posture — keys without a rotation period or with
 * a period > 1y are the audit findings cloud security teams act on.
 *
 * Uses Cloud KMS v1 REST via google-auth-library (already a transitive
 * dep of @google-cloud/storage and @google-cloud/compute) — avoids
 * adding the heavy @google-cloud/kms gRPC client.
 *
 * Hard rules:
 *   - Only runs when GCP live mode + GCP_INVENTORY_EXTRACT_ENABLED.
 *   - 8s per HTTP call, 25s overall budget.
 *   - Per-location failures isolated.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import {
  getGcpConfig,
  resolveGcpServiceAccountJson,
  resolveGcpPrivateKey,
  resolveGcpClientEmail,
} from "./gcpConfig";

const CALL_TIMEOUT_MS = 8_000;
const OVERALL_BUDGET_MS = 25_000;

// Most-used KMS locations. We avoid /locations (full list) on purpose —
// it would multiply API cost by ~30 regions. Operators can extend this
// list per deployment by setting GCP_KMS_LOCATIONS as a comma list.
const DEFAULT_LOCATIONS = [
  "global",
  "us-central1",
  "us-east1",
  "us-west1",
  "europe-west1",
  "europe-west4",
  "asia-east1",
  "asia-southeast1",
];

export type KmsKeyState = "active" | "destroy_scheduled" | "destroyed" | "disabled" | "unknown";

export interface GcpKmsKeySummary {
  /** "projects/{p}/locations/{l}/keyRings/{r}/cryptoKeys/{k}" */
  name: string;
  keyRing: string;
  location: string;
  purpose?: string;
  /** Seconds string ("7776000s") or undefined when rotation is not scheduled. */
  rotationPeriodSeconds?: number;
  /** ISO timestamp of the next scheduled rotation. */
  nextRotationTime?: string;
  /** True when this key has no automatic rotation policy. */
  rotationDisabled: boolean;
  /** True when rotation period exceeds 365 days. */
  rotationOverdue: boolean;
  primaryState: KmsKeyState;
}

export interface GcpKmsExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  projectId?: string;
  locationsProbed: string[];
  total: number;
  rotationDisabledCount: number;
  rotationOverdueCount: number;
  destroyScheduledCount: number;
  keys: GcpKmsKeySummary[];
  durationMs: number;
  limitations: string[];
}

interface ServiceAccountKey {
  client_email?: string;
  private_key?: string;
  project_id?: string;
}

export async function extractGcpKmsKeys(): Promise<GcpKmsExtraction> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.gcpInventoryExtractEnabled) {
    return blocked(start, "GCP_INVENTORY_EXTRACT_ENABLED is not set — extractor skipped.");
  }
  const cfg = getGcpConfig();
  if (cfg.mode !== "live") {
    return preview(start, "GCP mode is not live — extractor returned honest preview.");
  }
  const projectId = env.gcpProjectId;
  if (!projectId) {
    return blocked(start, "GCP_PROJECT_ID required.");
  }

  let key: ServiceAccountKey = {};
  try {
    const json = resolveGcpServiceAccountJson();
    if (json) {
      key = JSON.parse(json) as ServiceAccountKey;
    } else {
      key = {
        client_email: resolveGcpClientEmail(),
        private_key: resolveGcpPrivateKey(),
        project_id: projectId,
      };
    }
  } catch (err) {
    return blocked(start, `GCP credentials parse failed: ${redact(errMessage(err))}`);
  }
  if (!key.client_email || !key.private_key) {
    return blocked(start, "GCP credentials missing client_email or private_key.");
  }

  let auth;
  try {
    const { GoogleAuth } = await import("google-auth-library");
    auth = new GoogleAuth({
      projectId,
      credentials: { client_email: key.client_email, private_key: key.private_key },
      scopes: ["https://www.googleapis.com/auth/cloudkms"],
    });
  } catch (err) {
    return blocked(start, `GoogleAuth init failed: ${redact(errMessage(err))}`);
  }

  let token: string | null | undefined;
  try {
    const client = await auth.getClient();
    const t = await client.getAccessToken();
    token = typeof t === "string" ? t : t?.token;
  } catch (err) {
    return blocked(start, `GoogleAuth token fetch failed: ${redact(errMessage(err))}`);
  }
  if (!token) {
    return blocked(start, "GoogleAuth produced no access token for KMS scope.");
  }

  const locations = resolveLocations();
  const limitations: string[] = [];
  const keys: GcpKmsKeySummary[] = [];

  for (const location of locations) {
    if (Date.now() - start > OVERALL_BUDGET_MS) {
      limitations.push(`Time budget reached at location=${location} — partial results.`);
      break;
    }
    try {
      const rings = await listKeyRings(token, projectId, location);
      for (const ring of rings) {
        const ringName = ring.name ?? "";
        if (!ringName) continue;
        try {
          const ks = await listCryptoKeys(token, ringName);
          for (const ck of ks) {
            keys.push(mapKey(ck, ringName, location));
            if (keys.length >= 500) break;
          }
        } catch (err) {
          limitations.push(`keys list failed for ${ringName}: ${redact(errMessage(err))}`);
        }
        if (keys.length >= 500) break;
      }
    } catch (err) {
      limitations.push(`keyRings list failed for ${location}: ${redact(errMessage(err))}`);
    }
  }

  return {
    mode: "live",
    projectId,
    locationsProbed: locations,
    total: keys.length,
    rotationDisabledCount: keys.filter((k) => k.rotationDisabled).length,
    rotationOverdueCount: keys.filter((k) => k.rotationOverdue).length,
    destroyScheduledCount: keys.filter((k) => k.primaryState === "destroy_scheduled").length,
    keys,
    durationMs: Date.now() - start,
    limitations,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveLocations(): string[] {
  const override = process.env.GCP_KMS_LOCATIONS?.trim();
  if (override) {
    return override.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_LOCATIONS;
}

interface KmsKeyRing { name?: string }
interface KmsCryptoKey {
  name?: string;
  purpose?: string;
  rotationPeriod?: string;
  nextRotationTime?: string;
  primary?: { state?: string; destroyEventTime?: string };
}

async function listKeyRings(token: string, projectId: string, location: string): Promise<KmsKeyRing[]> {
  const url = `https://cloudkms.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/keyRings?pageSize=200`;
  const json = await fetchJson<{ keyRings?: KmsKeyRing[] }>(url, token);
  return json.keyRings ?? [];
}

async function listCryptoKeys(token: string, keyRingName: string): Promise<KmsCryptoKey[]> {
  const url = `https://cloudkms.googleapis.com/v1/${keyRingName}/cryptoKeys?pageSize=200`;
  const json = await fetchJson<{ cryptoKeys?: KmsCryptoKey[] }>(url, token);
  return json.cryptoKeys ?? [];
}

function mapKey(ck: KmsCryptoKey, ringName: string, location: string): GcpKmsKeySummary {
  const rotationSec = parseDurationSeconds(ck.rotationPeriod);
  const state = mapState(ck.primary?.state);
  return {
    name: ck.name ?? "unknown",
    keyRing: ringName,
    location,
    purpose: ck.purpose,
    rotationPeriodSeconds: rotationSec,
    nextRotationTime: ck.nextRotationTime,
    rotationDisabled: rotationSec === undefined,
    rotationOverdue: rotationSec !== undefined && rotationSec > 365 * 86_400,
    primaryState: state,
  };
}

function parseDurationSeconds(s?: string): number | undefined {
  if (!s) return undefined;
  const m = s.match(/^(\d+(?:\.\d+)?)s$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function mapState(s?: string): KmsKeyState {
  switch (s) {
    case "ENABLED": return "active";
    case "DISABLED": return "disabled";
    case "DESTROY_SCHEDULED": return "destroy_scheduled";
    case "DESTROYED": return "destroyed";
    default: return "unknown";
  }
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${redact(text).slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

function preview(start: number, note: string): GcpKmsExtraction {
  return {
    mode: "preview",
    locationsProbed: [],
    total: 0,
    rotationDisabledCount: 0,
    rotationOverdueCount: 0,
    destroyScheduledCount: 0,
    keys: [],
    durationMs: Date.now() - start,
    limitations: [note],
  };
}
function blocked(start: number, note: string): GcpKmsExtraction {
  return {
    mode: "blocked",
    locationsProbed: [],
    total: 0,
    rotationDisabledCount: 0,
    rotationOverdueCount: 0,
    destroyScheduledCount: 0,
    keys: [],
    durationMs: Date.now() - start,
    limitations: [note],
  };
}
function errMessage(e: unknown): string { return e instanceof Error ? e.message : String(e); }
function redact(msg: string): string {
  return msg.replace(/[A-Za-z0-9+/=]{30,}/g, "[redacted]");
}
