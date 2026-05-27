/**
 * Phase 493 — application registration.
 *
 * POST /api/dashboard/application-create. Idempotent on the
 * (organizationId, slug) unique pair — repeat calls return the
 * existing row rather than 409'ing.
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface ApplicationCreatedRow {
  id: string;
  slug: string;
  name: string;
}

export interface ApplicationCreateRepo {
  application: {
    findUnique(args: {
      where: { organizationId_slug: { organizationId: string; slug: string } };
    }): Promise<ApplicationCreatedRow | null>;
    create(args: {
      data: {
        organizationId: string;
        slug: string;
        name: string;
        ownerTeamLabel: string | null;
        businessTier: string | null;
        description: string | null;
      };
    }): Promise<ApplicationCreatedRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Input + output.
   ────────────────────────────────────────────────────────────── */

export interface BuildApplicationCreateInput {
  organizationId: string;
  slug: string;
  name: string;
  ownerTeamLabel?: string;
  businessTier?: string;
  description?: string;
}

export type CreateError = "slug_invalid" | "name_required";

export type ApplicationCreateBody =
  | { ok: true; data: { id: string; slug: string; name: string; created: boolean } }
  | { ok: false; error: CreateError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: ApplicationCreateBody }

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,40}[a-z0-9])?$/;

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildApplicationCreateResponse(
  repo: ApplicationCreateRepo,
  input: BuildApplicationCreateInput,
  opts: { correlationId?: string } = {},
): Promise<ResponderResult> {
  if (!input.slug || !SLUG_RE.test(input.slug)) {
    return {
      status: 422,
      body: { ok: false, error: "slug_invalid", hint: "slug must be 1-42 chars, [a-z0-9-], start + end alphanumeric." },
    };
  }
  if (!input.name || input.name.trim().length === 0) {
    return { status: 422, body: { ok: false, error: "name_required" } };
  }

  try {
    const existing = await repo.application.findUnique({
      where: { organizationId_slug: { organizationId: input.organizationId, slug: input.slug } },
    });
    if (existing) {
      return {
        status: 200,
        body: { ok: true, data: { id: existing.id, slug: existing.slug, name: existing.name, created: false } },
      };
    }
    const row = await repo.application.create({
      data: {
        organizationId: input.organizationId,
        slug: input.slug,
        name: input.name.trim(),
        ownerTeamLabel: input.ownerTeamLabel?.trim() || null,
        businessTier: input.businessTier?.trim() || null,
        description: input.description?.trim() || null,
      },
    });
    return {
      status: 201,
      body: { ok: true, data: { id: row.id, slug: row.slug, name: row.name, created: true } },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Application table needs Phase 466 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
