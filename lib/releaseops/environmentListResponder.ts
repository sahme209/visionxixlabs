/**
 * GET /api/dashboard/environment-list.
 *
 * Returns the org's Environment rows (Phase 441 model), ordered for
 * dashboard display. This table has existed in the schema since Phase
 * 441 but had zero read/write code paths until this responder — no
 * environment separation was actually usable in the product before.
 */

import { isMissingTable } from "./releaseListResponder";

export interface EnvironmentRow {
  id: string;
  slug: string;
  name: string;
  tier: string;
  displayOrder: number;
  approvalPolicyId: string | null;
  createdAt: Date;
}

export interface EnvironmentListRepo {
  environment: {
    findMany(args: {
      where: { organizationId: string };
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }];
    }): Promise<EnvironmentRow[]>;
  };
}

export interface EnvironmentListItem {
  id: string;
  slug: string;
  name: string;
  tier: string;
  displayOrder: number;
  hasApprovalPolicy: boolean;
  createdAtIso: string;
}

export type ListBody =
  | { ok: true; data: { environments: EnvironmentListItem[] } }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: ListBody }

export async function buildEnvironmentListResponse(
  repo: EnvironmentListRepo,
  organizationId: string,
  opts: { correlationId?: string } = {},
): Promise<ResponderResult> {
  try {
    const rows = await repo.environment.findMany({
      where: { organizationId },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          environments: rows.map((r) => ({
            id: r.id,
            slug: r.slug,
            name: r.name,
            tier: r.tier,
            displayOrder: r.displayOrder,
            hasApprovalPolicy: Boolean(r.approvalPolicyId),
            createdAtIso: r.createdAt.toISOString(),
          })),
        },
      },
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
