/**
 * GET/POST /api/dashboard/deployment-target.
 *
 * One AWS deploy target (role ARN, region, ECS cluster, ECS service)
 * per Environment. Admin-gated at the route layer (isAdminOrOwner) —
 * this configures where real production traffic deploys land.
 *
 * roleArn is an ARN string, never a credential. The actual OIDC trust
 * (identity provider + the role's trust policy scoped to the tenant's
 * GitHub repo) is set up entirely on the tenant's own AWS account —
 * Axiom never holds, requests, or needs an AWS secret.
 */

import { isMissingTable } from "./releaseListResponder";

export interface EnvironmentForTargetRow {
  id: string;
  organizationId: string;
}

export interface DeploymentTargetRow {
  id: string;
  environmentId: string;
  provider: string;
  roleArn: string;
  region: string;
  ecsCluster: string;
  ecsService: string;
}

export interface DeploymentTargetRepo {
  environment: {
    findUnique(args: { where: { id: string } }): Promise<EnvironmentForTargetRow | null>;
  };
  deploymentTarget: {
    findUnique(args: { where: { environmentId: string } }): Promise<DeploymentTargetRow | null>;
    upsert(args: {
      where: { environmentId: string };
      create: {
        organizationId: string;
        environmentId: string;
        provider: "aws";
        roleArn: string;
        region: string;
        ecsCluster: string;
        ecsService: string;
      };
      update: {
        roleArn: string;
        region: string;
        ecsCluster: string;
        ecsService: string;
      };
    }): Promise<DeploymentTargetRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   GET — fetch the target for one environment.
   ────────────────────────────────────────────────────────────── */

export type GetBody =
  | { ok: true; data: { target: DeploymentTargetRow | null } }
  | { ok: false; error: string; hint?: string };

export interface GetResult { status: number; body: GetBody }

export async function buildDeploymentTargetGetResponse(
  repo: DeploymentTargetRepo,
  organizationId: string,
  environmentId: string,
): Promise<GetResult> {
  try {
    const environment = await repo.environment.findUnique({ where: { id: environmentId } });
    if (!environment) return { status: 404, body: { ok: false, error: "environment_not_found" } };
    if (environment.organizationId !== organizationId) return { status: 403, body: { ok: false, error: "cross_org_environment" } };

    const target = await repo.deploymentTarget.findUnique({ where: { environmentId } });
    return { status: 200, body: { ok: true, data: { target } } };
  } catch (err) {
    if (isMissingTable(err)) return { status: 503, body: { ok: false, error: "migration_pending" } };
    return { status: 500, body: { ok: false, error: "internal_error" } };
  }
}

/* ──────────────────────────────────────────────────────────────────
   POST — create or update the target for one environment.
   ────────────────────────────────────────────────────────────── */

export interface UpsertInput {
  organizationId: string;
  environmentId: string;
  roleArn: string;
  region: string;
  ecsCluster: string;
  ecsService: string;
}

export type UpsertError =
  | "environment_not_found"
  | "cross_org_environment"
  | "role_arn_invalid"
  | "region_invalid"
  | "cluster_invalid"
  | "service_invalid";

export type UpsertBody =
  | { ok: true; data: DeploymentTargetRow }
  | { ok: false; error: UpsertError | "migration_pending" | "internal_error"; hint?: string };

export interface UpsertResult { status: number; body: UpsertBody }

// arn:aws:iam::123456789012:role/some-role-name
const ROLE_ARN_RE = /^arn:aws:iam::\d{12}:role\/[\w+=,.@-]{1,64}$/;
const REGION_RE = /^[a-z]{2}-[a-z]+-\d$/;
const SAFE_NAME_RE = /^[A-Za-z0-9._-]{1,255}$/;

export async function buildDeploymentTargetUpsertResponse(
  repo: DeploymentTargetRepo,
  input: UpsertInput,
): Promise<UpsertResult> {
  const roleArn = input.roleArn.trim();
  if (!ROLE_ARN_RE.test(roleArn)) {
    return { status: 422, body: { ok: false, error: "role_arn_invalid", hint: "roleArn must look like arn:aws:iam::<12-digit-account-id>:role/<role-name>." } };
  }
  const region = input.region.trim();
  if (!REGION_RE.test(region)) {
    return { status: 422, body: { ok: false, error: "region_invalid", hint: "region must look like us-east-1." } };
  }
  const ecsCluster = input.ecsCluster.trim();
  if (!SAFE_NAME_RE.test(ecsCluster)) {
    return { status: 422, body: { ok: false, error: "cluster_invalid" } };
  }
  const ecsService = input.ecsService.trim();
  if (!SAFE_NAME_RE.test(ecsService)) {
    return { status: 422, body: { ok: false, error: "service_invalid" } };
  }

  try {
    const environment = await repo.environment.findUnique({ where: { id: input.environmentId } });
    if (!environment) return { status: 404, body: { ok: false, error: "environment_not_found" } };
    if (environment.organizationId !== input.organizationId) return { status: 403, body: { ok: false, error: "cross_org_environment" } };

    const row = await repo.deploymentTarget.upsert({
      where: { environmentId: input.environmentId },
      create: {
        organizationId: input.organizationId,
        environmentId: input.environmentId,
        provider: "aws",
        roleArn, region, ecsCluster, ecsService,
      },
      update: { roleArn, region, ecsCluster, ecsService },
    });
    return { status: 200, body: { ok: true, data: row } };
  } catch (err) {
    if (isMissingTable(err)) return { status: 503, body: { ok: false, error: "migration_pending" } };
    return { status: 500, body: { ok: false, error: "internal_error" } };
  }
}
