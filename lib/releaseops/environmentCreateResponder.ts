/**
 * POST /api/dashboard/environment-create.
 *
 * Creates an Environment row. Idempotent on the schema-level unique
 * (organizationId, slug). Admin-gated at the route layer (isAdminOrOwner) —
 * environments are tenant-wide configuration, not per-user state.
 */

import { isMissingTable } from "./releaseListResponder";

export const ALL_ENVIRONMENT_TIERS = ["dev", "test", "qa", "uat", "stage", "preprod", "prod"] as const;
export type EnvironmentTier = (typeof ALL_ENVIRONMENT_TIERS)[number];

export interface EnvironmentCreatedRow {
  id: string;
  slug: string;
  name: string;
  tier: string;
  displayOrder: number;
}

export interface EnvironmentCreateRepo {
  environment: {
    findUnique(args: {
      where: { organizationId_slug: { organizationId: string; slug: string } };
    }): Promise<EnvironmentCreatedRow | null>;
    create(args: {
      data: {
        organizationId: string;
        slug: string;
        name: string;
        tier: EnvironmentTier;
        displayOrder: number;
      };
    }): Promise<EnvironmentCreatedRow>;
  };
}

export interface BuildEnvironmentCreateInput {
  organizationId: string;
  slug: string;
  name: string;
  tier: string;
  displayOrder?: number;
}

export type EnvironmentCreateError = "slug_invalid" | "name_invalid" | "tier_invalid";

export type EnvironmentCreateBody =
  | { ok: true; data: { id: string; slug: string; name: string; tier: string; created: boolean } }
  | { ok: false; error: EnvironmentCreateError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: EnvironmentCreateBody }

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

export async function buildEnvironmentCreateResponse(
  repo: EnvironmentCreateRepo,
  input: BuildEnvironmentCreateInput,
  opts: { correlationId?: string } = {},
): Promise<ResponderResult> {
  const slug = input.slug.trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return { status: 422, body: { ok: false, error: "slug_invalid", hint: "slug must be lowercase alphanumeric/hyphen, 1-32 chars, starting with a letter or digit." } };
  }
  const name = input.name.trim();
  if (!name) {
    return { status: 422, body: { ok: false, error: "name_invalid" } };
  }
  if (!(ALL_ENVIRONMENT_TIERS as readonly string[]).includes(input.tier)) {
    return { status: 422, body: { ok: false, error: "tier_invalid", hint: `tier must be one of ${ALL_ENVIRONMENT_TIERS.join(", ")}.` } };
  }
  const tier = input.tier as EnvironmentTier;

  try {
    const existing = await repo.environment.findUnique({
      where: { organizationId_slug: { organizationId: input.organizationId, slug } },
    });
    if (existing) {
      return {
        status: 200,
        body: { ok: true, data: { id: existing.id, slug: existing.slug, name: existing.name, tier: existing.tier, created: false } },
      };
    }
    const row = await repo.environment.create({
      data: {
        organizationId: input.organizationId,
        slug,
        name,
        tier,
        displayOrder: input.displayOrder ?? ALL_ENVIRONMENT_TIERS.indexOf(tier),
      },
    });
    return {
      status: 201,
      body: { ok: true, data: { id: row.id, slug: row.slug, name: row.name, tier: row.tier, created: true } },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return { status: 503, body: { ok: false, error: "migration_pending" } };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
