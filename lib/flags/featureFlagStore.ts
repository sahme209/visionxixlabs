/**
 * Per-tenant feature flag store.
 *
 * Reads + writes the TenantFeatureFlag row. When a row exists for
 * (tenant, key), its `enabled` wins; else the catalog default is
 * used.
 *
 * Hard rules:
 *   - Closed-union validation at the boundary — only FeatureFlagKey
 *     literals are accepted.
 *   - Best-effort reads: DB failure returns the catalog defaults so
 *     the rest of the platform keeps moving.
 *   - Audit fields (updatedBy, rationale) are always captured on
 *     write so /dashboard/flags can show "who set this and why".
 */

import "server-only";

import { prisma } from "@/lib/db";
import {
  FEATURE_FLAG_CATALOG,
  defaultFlagValue,
  isFeatureFlagKey,
  type FeatureFlagKey,
  type FeatureFlagSpec,
} from "./featureFlagCatalog";

export interface FeatureFlagRecord {
  key: FeatureFlagKey;
  spec: FeatureFlagSpec;
  enabled: boolean;
  hasOverride: boolean;
  rationale?: string;
  updatedBy?: string;
  updatedAt?: string;
}

/** Resolve a single flag value for a tenant. Total — never throws. */
export async function isFlagEnabled(opts: {
  organizationId: string;
  key: FeatureFlagKey;
}): Promise<boolean> {
  try {
    const row = await prisma.tenantFeatureFlag.findUnique({
      where: {
        organizationId_key: { organizationId: opts.organizationId, key: opts.key },
      },
    });
    if (row) return row.enabled;
  } catch {
    // Fall through to default.
  }
  return defaultFlagValue(opts.key);
}

/** Resolve every flag for a tenant (catalog × overrides). */
export async function readFeatureFlags(opts: {
  organizationId: string;
}): Promise<FeatureFlagRecord[]> {
  const overrides = new Map<FeatureFlagKey, {
    enabled: boolean;
    rationale: string | null;
    updatedBy: string | null;
    updatedAt: Date;
  }>();
  try {
    const rows = await prisma.tenantFeatureFlag.findMany({
      where: { organizationId: opts.organizationId },
    });
    for (const r of rows) {
      if (isFeatureFlagKey(r.key)) {
        overrides.set(r.key as FeatureFlagKey, {
          enabled: r.enabled,
          rationale: r.rationale,
          updatedBy: r.updatedBy,
          updatedAt: r.updatedAt,
        });
      }
    }
  } catch {
    // No overrides — fall through to catalog defaults.
  }

  return FEATURE_FLAG_CATALOG.map((spec) => {
    const o = overrides.get(spec.key);
    return {
      key: spec.key,
      spec,
      enabled: o?.enabled ?? spec.default,
      hasOverride: o !== undefined,
      rationale: o?.rationale ?? undefined,
      updatedBy: o?.updatedBy ?? undefined,
      updatedAt: o?.updatedAt.toISOString(),
    };
  });
}

export async function setFeatureFlag(opts: {
  organizationId: string;
  key: FeatureFlagKey;
  enabled: boolean;
  rationale?: string;
  updatedBy?: string;
}): Promise<FeatureFlagRecord> {
  if (!isFeatureFlagKey(opts.key)) {
    throw new Error(`Unknown feature flag key: ${opts.key}`);
  }
  const row = await prisma.tenantFeatureFlag.upsert({
    where: {
      organizationId_key: { organizationId: opts.organizationId, key: opts.key },
    },
    update: {
      enabled: opts.enabled,
      rationale: opts.rationale?.slice(0, 1000) ?? null,
      updatedBy: opts.updatedBy ?? null,
    },
    create: {
      organizationId: opts.organizationId,
      key: opts.key,
      enabled: opts.enabled,
      rationale: opts.rationale?.slice(0, 1000) ?? null,
      updatedBy: opts.updatedBy ?? null,
    },
  });
  const spec = FEATURE_FLAG_CATALOG.find((f) => f.key === opts.key)!;
  return {
    key: opts.key,
    spec,
    enabled: row.enabled,
    hasOverride: true,
    rationale: row.rationale ?? undefined,
    updatedBy: row.updatedBy ?? undefined,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function clearFeatureFlag(opts: {
  organizationId: string;
  key: FeatureFlagKey;
}): Promise<boolean> {
  try {
    await prisma.tenantFeatureFlag.delete({
      where: {
        organizationId_key: { organizationId: opts.organizationId, key: opts.key },
      },
    });
    return true;
  } catch {
    return false;
  }
}
