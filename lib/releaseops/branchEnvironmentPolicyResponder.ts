/**
 * BranchEnvironmentPolicy config management.
 *
 * Config only, same posture as TenantIdentityProvider's phase 1: the
 * (repository, environment, branch pattern) rule and its requirements
 * (requireReleaseTag/requireCodeowners/requirePrLink/requireChangeTicket)
 * are real and persisted, but nothing in the deploy-trigger path reads
 * or enforces them yet — the AWS deploy dispatch
 * (lib/axiom/agentRuntime/actionApprovalResponder.ts) has no concept of
 * "which branch" today, it always deploys whatever `main` currently is.
 * Wiring real enforcement needs that restructured first — a bigger,
 * separate decision, not something to half-build here.
 */

import { isMissingTable } from "./releaseListResponder";

export interface BranchEnvironmentPolicyRow {
  id: string;
  organizationId: string;
  repositoryId: string;
  environmentId: string;
  branchPattern: string;
  requireReleaseTag: boolean;
  requireCodeowners: boolean;
  requirePrLink: boolean;
  requireChangeTicket: boolean;
  priority: number;
  enabled: boolean;
  createdAt: Date;
}

export interface BranchEnvironmentPolicyRepo {
  branchEnvironmentPolicy: {
    findMany(args: { where: { organizationId: string }; orderBy: [{ priority: "asc" }] }): Promise<BranchEnvironmentPolicyRow[]>;
    create(args: {
      data: {
        organizationId: string;
        repositoryId: string;
        environmentId: string;
        branchPattern: string;
        requireReleaseTag: boolean;
        requireCodeowners: boolean;
        requirePrLink: boolean;
        requireChangeTicket: boolean;
        priority: number;
      };
    }): Promise<BranchEnvironmentPolicyRow>;
  };
  repository: { findUnique(args: { where: { id: string } }): Promise<{ id: string; organizationId: string } | null> };
  environment: { findUnique(args: { where: { id: string } }): Promise<{ id: string; organizationId: string } | null> };
}

export type ListBody =
  | { ok: true; data: { policies: BranchEnvironmentPolicyRow[] } }
  | { ok: false; error: string };

export async function buildBranchEnvironmentPolicyListResponse(
  repo: BranchEnvironmentPolicyRepo,
  organizationId: string,
): Promise<{ status: number; body: ListBody }> {
  try {
    const policies = await repo.branchEnvironmentPolicy.findMany({ where: { organizationId }, orderBy: [{ priority: "asc" }] });
    return { status: 200, body: { ok: true, data: { policies } } };
  } catch (err) {
    if (isMissingTable(err)) return { status: 503, body: { ok: false, error: "migration_pending" } };
    return { status: 500, body: { ok: false, error: "internal_error" } };
  }
}

export interface CreateInput {
  organizationId: string;
  repositoryId: string;
  environmentId: string;
  branchPattern: string;
  requireReleaseTag: boolean;
  requireCodeowners: boolean;
  requirePrLink: boolean;
  requireChangeTicket: boolean;
  priority?: number;
}

export type CreateError = "repository_not_found" | "cross_org_repository" | "environment_not_found" | "cross_org_environment" | "branch_pattern_required";
export type CreateBody =
  | { ok: true; data: BranchEnvironmentPolicyRow }
  | { ok: false; error: CreateError | "migration_pending" | "internal_error" };

export async function buildBranchEnvironmentPolicyCreateResponse(
  repo: BranchEnvironmentPolicyRepo,
  input: CreateInput,
): Promise<{ status: number; body: CreateBody }> {
  if (!input.branchPattern.trim()) return { status: 422, body: { ok: false, error: "branch_pattern_required" } };

  try {
    const repository = await repo.repository.findUnique({ where: { id: input.repositoryId } });
    if (!repository) return { status: 404, body: { ok: false, error: "repository_not_found" } };
    if (repository.organizationId !== input.organizationId) return { status: 403, body: { ok: false, error: "cross_org_repository" } };

    const environment = await repo.environment.findUnique({ where: { id: input.environmentId } });
    if (!environment) return { status: 404, body: { ok: false, error: "environment_not_found" } };
    if (environment.organizationId !== input.organizationId) return { status: 403, body: { ok: false, error: "cross_org_environment" } };

    const row = await repo.branchEnvironmentPolicy.create({
      data: {
        organizationId: input.organizationId,
        repositoryId: input.repositoryId,
        environmentId: input.environmentId,
        branchPattern: input.branchPattern.trim(),
        requireReleaseTag: input.requireReleaseTag,
        requireCodeowners: input.requireCodeowners,
        requirePrLink: input.requirePrLink,
        requireChangeTicket: input.requireChangeTicket,
        priority: input.priority ?? 100,
      },
    });
    return { status: 201, body: { ok: true, data: row } };
  } catch (err) {
    if (isMissingTable(err)) return { status: 503, body: { ok: false, error: "migration_pending" } };
    return { status: 500, body: { ok: false, error: "internal_error" } };
  }
}
