/**
 * TenantIdentityProvider config management — docs/ENTERPRISE_IDENTITY_DESIGN.md.
 *
 * This is configuration storage. lib/identity/ssoSignInGate.ts now reads
 * this table at sign-in time for role-mapping + MFA-claim enforcement —
 * but only for the one real IdP connection that exists (a fixed Cognito
 * pool, lib/auth.ts), not yet the full per-tenant domain-routed flow this
 * design doc describes. A connection is created in "pending" status and
 * stays there — activating it still requires a real metadata exchange +
 * test assertion round-trip that doesn't exist yet; this responder never
 * fabricates "active" on save alone.
 *
 * Admin-gated at the route layer — this is tenant-wide security
 * configuration, not per-user state.
 */

import { isMissingTable } from "@/lib/releaseops/releaseListResponder";
import type { RoleMappingRule } from "./enterpriseIdentityContract";

export const ALL_ORG_ROLES = ["owner", "admin", "operator", "security_reviewer", "finance_viewer", "read_only"] as const;
export type OrgRoleName = (typeof ALL_ORG_ROLES)[number];

export const ALL_IDENTITY_PROVIDER_PROTOCOLS = ["oidc", "saml"] as const;
export type IdentityProviderProtocolName = (typeof ALL_IDENTITY_PROVIDER_PROTOCOLS)[number];

export interface TenantIdentityProviderRow {
  id: string;
  organizationId: string;
  protocol: string;
  status: string;
  issuerOrEntityId: string;
  managedDomains: string[];
  roleMappingJson: unknown;
  requireMfaClaim: boolean;
  lastTestAssertionAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface IdentityProviderRepo {
  tenantIdentityProvider: {
    findMany(args: { where: { organizationId: string }; orderBy: { createdAt: "asc" } }): Promise<TenantIdentityProviderRow[]>;
    findUnique(args: { where: { organizationId_protocol: { organizationId: string; protocol: IdentityProviderProtocolName } } }): Promise<TenantIdentityProviderRow | null>;
    findFirst(args: { where: { id: string; organizationId: string } }): Promise<TenantIdentityProviderRow | null>;
    create(args: {
      data: {
        organizationId: string;
        protocol: IdentityProviderProtocolName;
        issuerOrEntityId: string;
        metadataDocument: string;
        managedDomains: string[];
        roleMappingJson: RoleMappingRule[];
        requireMfaClaim: boolean;
        configuredByUserId: string;
      };
    }): Promise<TenantIdentityProviderRow>;
    update(args: { where: { id: string }; data: { status: "revoked"; revokedAt: Date } }): Promise<TenantIdentityProviderRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   List.
   ────────────────────────────────────────────────────────────── */

export type ListBody =
  | { ok: true; data: { providers: TenantIdentityProviderRow[] } }
  | { ok: false; error: string };

export async function buildIdentityProviderListResponse(
  repo: IdentityProviderRepo,
  organizationId: string,
): Promise<{ status: number; body: ListBody }> {
  try {
    const providers = await repo.tenantIdentityProvider.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" } });
    return { status: 200, body: { ok: true, data: { providers } } };
  } catch (err) {
    if (isMissingTable(err)) return { status: 503, body: { ok: false, error: "migration_pending" } };
    return { status: 500, body: { ok: false, error: "internal_error" } };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Create.
   ────────────────────────────────────────────────────────────── */

export interface CreateInput {
  organizationId: string;
  actorUserId: string;
  protocol: string;
  issuerOrEntityId: string;
  metadataDocument: string;
  managedDomains: string[];
  roleMapping: RoleMappingRule[];
  requireMfaClaim: boolean;
}

export type CreateError =
  | "protocol_invalid"
  | "issuer_required"
  | "metadata_document_required"
  | "managed_domains_required"
  | "role_mapping_required"
  | "role_mapping_invalid"
  | "already_configured";

export type CreateBody =
  | { ok: true; data: TenantIdentityProviderRow }
  | { ok: false; error: CreateError | "migration_pending" | "internal_error"; hint?: string };

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export async function buildIdentityProviderCreateResponse(
  repo: IdentityProviderRepo,
  input: CreateInput,
): Promise<{ status: number; body: CreateBody }> {
  if (!(ALL_IDENTITY_PROVIDER_PROTOCOLS as readonly string[]).includes(input.protocol)) {
    return { status: 422, body: { ok: false, error: "protocol_invalid", hint: `protocol must be one of ${ALL_IDENTITY_PROVIDER_PROTOCOLS.join(", ")}.` } };
  }
  const protocol = input.protocol as IdentityProviderProtocolName;

  if (!input.issuerOrEntityId.trim()) return { status: 422, body: { ok: false, error: "issuer_required" } };
  if (!input.metadataDocument.trim()) return { status: 422, body: { ok: false, error: "metadata_document_required" } };

  const domains = input.managedDomains.map((d) => d.trim().toLowerCase()).filter(Boolean);
  if (domains.length === 0 || !domains.every((d) => DOMAIN_RE.test(d))) {
    return { status: 422, body: { ok: false, error: "managed_domains_required", hint: "managedDomains must be 1+ valid domain names, e.g. acme.com." } };
  }

  if (!Array.isArray(input.roleMapping) || input.roleMapping.length === 0) {
    return { status: 422, body: { ok: false, error: "role_mapping_required", hint: "At least one claim-to-role mapping rule is required. No default role is ever assigned." } };
  }
  for (const rule of input.roleMapping) {
    if (!rule.claimKey?.trim() || !rule.claimValue?.trim() || !(ALL_ORG_ROLES as readonly string[]).includes(rule.role)) {
      return { status: 422, body: { ok: false, error: "role_mapping_invalid", hint: `Each rule needs claimKey, claimValue, and role in ${ALL_ORG_ROLES.join(", ")}.` } };
    }
  }

  try {
    const existing = await repo.tenantIdentityProvider.findUnique({
      where: { organizationId_protocol: { organizationId: input.organizationId, protocol } },
    });
    if (existing && !existing.revokedAt) {
      return { status: 409, body: { ok: false, error: "already_configured", hint: `A ${protocol} provider is already configured for this org. Revoke it first to reconfigure.` } };
    }

    const row = await repo.tenantIdentityProvider.create({
      data: {
        organizationId: input.organizationId,
        protocol,
        issuerOrEntityId: input.issuerOrEntityId.trim(),
        metadataDocument: input.metadataDocument,
        managedDomains: domains,
        roleMappingJson: input.roleMapping,
        requireMfaClaim: input.requireMfaClaim,
        configuredByUserId: input.actorUserId,
      },
    });
    return { status: 201, body: { ok: true, data: row } };
  } catch (err) {
    if (isMissingTable(err)) return { status: 503, body: { ok: false, error: "migration_pending" } };
    return { status: 500, body: { ok: false, error: "internal_error" } };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Revoke.
   ────────────────────────────────────────────────────────────── */

export type RevokeBody =
  | { ok: true; data: { id: string; status: string } }
  | { ok: false; error: "not_found" | "already_revoked" | "migration_pending" | "internal_error" };

export async function buildIdentityProviderRevokeResponse(
  repo: IdentityProviderRepo,
  organizationId: string,
  id: string,
  opts: { now?: Date } = {},
): Promise<{ status: number; body: RevokeBody }> {
  try {
    const existing = await repo.tenantIdentityProvider.findFirst({ where: { id, organizationId } });
    if (!existing) return { status: 404, body: { ok: false, error: "not_found" } };
    if (existing.revokedAt) return { status: 409, body: { ok: false, error: "already_revoked" } };

    const row = await repo.tenantIdentityProvider.update({ where: { id }, data: { status: "revoked", revokedAt: opts.now ?? new Date() } });
    return { status: 200, body: { ok: true, data: { id: row.id, status: row.status } } };
  } catch (err) {
    if (isMissingTable(err)) return { status: 503, body: { ok: false, error: "migration_pending" } };
    return { status: 500, body: { ok: false, error: "internal_error" } };
  }
}
