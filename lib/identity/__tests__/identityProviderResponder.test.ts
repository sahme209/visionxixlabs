import { describe, expect, it } from "vitest";
import {
  buildIdentityProviderListResponse,
  buildIdentityProviderCreateResponse,
  buildIdentityProviderRevokeResponse,
  type IdentityProviderRepo,
  type TenantIdentityProviderRow,
} from "../identityProviderResponder";

interface Stub extends IdentityProviderRepo {
  _rows: TenantIdentityProviderRow[];
  _nextId: number;
}

function makeRepo(): Stub {
  const stub: Stub = {
    _rows: [],
    _nextId: 1,
    tenantIdentityProvider: {
      async findMany({ where }) {
        return stub._rows.filter((r) => r.organizationId === where.organizationId);
      },
      async findUnique({ where }) {
        const k = where.organizationId_protocol;
        return stub._rows.find((r) => r.organizationId === k.organizationId && r.protocol === k.protocol) ?? null;
      },
      async findFirst({ where }) {
        return stub._rows.find((r) => r.id === where.id && r.organizationId === where.organizationId) ?? null;
      },
      async create({ data }) {
        const row: TenantIdentityProviderRow = {
          id: `idp_${stub._nextId++}`,
          organizationId: data.organizationId,
          protocol: data.protocol,
          status: "pending",
          issuerOrEntityId: data.issuerOrEntityId,
          managedDomains: data.managedDomains,
          roleMappingJson: data.roleMappingJson,
          requireMfaClaim: data.requireMfaClaim,
          lastTestAssertionAt: null,
          revokedAt: null,
          createdAt: new Date(),
        };
        stub._rows.push(row);
        return row;
      },
      async update({ where, data }) {
        const row = stub._rows.find((r) => r.id === where.id);
        if (!row) throw new Error("not found");
        row.status = data.status;
        row.revokedAt = data.revokedAt;
        return row;
      },
    },
  };
  return stub;
}

const VALID = {
  protocol: "oidc",
  issuerOrEntityId: "https://idp.acme.com",
  metadataDocument: "{...discovery doc...}",
  managedDomains: ["acme.com"],
  roleMapping: [{ claimKey: "groups", claimValue: "axiom-admins", role: "admin" }],
  requireMfaClaim: true,
};

describe("buildIdentityProviderCreateResponse", () => {
  it("422 protocol_invalid for an unsupported protocol", async () => {
    const r = await buildIdentityProviderCreateResponse(makeRepo(), { organizationId: "o", actorUserId: "u", ...VALID, protocol: "ldap" });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("protocol_invalid");
  });

  it("422 managed_domains_required for an invalid domain", async () => {
    const r = await buildIdentityProviderCreateResponse(makeRepo(), { organizationId: "o", actorUserId: "u", ...VALID, managedDomains: ["not a domain"] });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("managed_domains_required");
  });

  it("422 role_mapping_required when empty — never assigns a default role", async () => {
    const r = await buildIdentityProviderCreateResponse(makeRepo(), { organizationId: "o", actorUserId: "u", ...VALID, roleMapping: [] });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("role_mapping_required");
  });

  it("422 role_mapping_invalid for an unrecognized role", async () => {
    const r = await buildIdentityProviderCreateResponse(makeRepo(), {
      organizationId: "o", actorUserId: "u", ...VALID,
      roleMapping: [{ claimKey: "groups", claimValue: "x", role: "superadmin" }],
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("role_mapping_invalid");
  });

  it("creates a new provider in pending status — never fabricates active", async () => {
    const repo = makeRepo();
    const r = await buildIdentityProviderCreateResponse(repo, { organizationId: "o", actorUserId: "u", ...VALID });
    expect(r.status).toBe(201);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.status).toBe("pending");
    expect(r.body.data.managedDomains).toEqual(["acme.com"]);
  });

  it("409 already_configured when an active (non-revoked) provider for this protocol already exists", async () => {
    const repo = makeRepo();
    await buildIdentityProviderCreateResponse(repo, { organizationId: "o", actorUserId: "u", ...VALID });
    const r = await buildIdentityProviderCreateResponse(repo, { organizationId: "o", actorUserId: "u", ...VALID });
    expect(r.status).toBe(409);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("already_configured");
  });

  it("allows reconfiguring the same protocol after the prior one is revoked", async () => {
    const repo = makeRepo();
    const first = await buildIdentityProviderCreateResponse(repo, { organizationId: "o", actorUserId: "u", ...VALID });
    if (!first.body.ok) throw new Error("expected ok");
    await buildIdentityProviderRevokeResponse(repo, "o", first.body.data.id);
    const second = await buildIdentityProviderCreateResponse(repo, { organizationId: "o", actorUserId: "u", ...VALID });
    expect(second.status).toBe(201);
  });
});

describe("buildIdentityProviderListResponse", () => {
  it("scopes rows to the requesting org", async () => {
    const repo = makeRepo();
    await buildIdentityProviderCreateResponse(repo, { organizationId: "org_a", actorUserId: "u", ...VALID });
    await buildIdentityProviderCreateResponse(repo, { organizationId: "org_b", actorUserId: "u", ...VALID });
    const r = await buildIdentityProviderListResponse(repo, "org_a");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.providers).toHaveLength(1);
  });
});

describe("buildIdentityProviderRevokeResponse", () => {
  it("404 not_found for a missing or cross-org id", async () => {
    const r = await buildIdentityProviderRevokeResponse(makeRepo(), "o", "missing");
    expect(r.status).toBe(404);
  });

  it("409 already_revoked on a second revoke", async () => {
    const repo = makeRepo();
    const created = await buildIdentityProviderCreateResponse(repo, { organizationId: "o", actorUserId: "u", ...VALID });
    if (!created.body.ok) throw new Error("expected ok");
    await buildIdentityProviderRevokeResponse(repo, "o", created.body.data.id);
    const second = await buildIdentityProviderRevokeResponse(repo, "o", created.body.data.id);
    expect(second.status).toBe(409);
  });

  it("revokes successfully", async () => {
    const repo = makeRepo();
    const created = await buildIdentityProviderCreateResponse(repo, { organizationId: "o", actorUserId: "u", ...VALID });
    if (!created.body.ok) throw new Error("expected ok");
    const r = await buildIdentityProviderRevokeResponse(repo, "o", created.body.data.id);
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.status).toBe("revoked");
  });
});
