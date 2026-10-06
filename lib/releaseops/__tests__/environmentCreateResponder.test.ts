import { describe, expect, it } from "vitest";
import {
  buildEnvironmentCreateResponse,
  type EnvironmentCreateRepo,
  type EnvironmentCreatedRow,
} from "../environmentCreateResponder";

interface Stub extends EnvironmentCreateRepo {
  _rows: (EnvironmentCreatedRow & { organizationId: string })[];
  _nextId: number;
}

function makeRepo(): Stub {
  const stub: Stub = {
    _rows: [],
    _nextId: 1,
    environment: {
      async findUnique({ where }) {
        const k = where.organizationId_slug;
        return stub._rows.find((r) => r.organizationId === k.organizationId && r.slug === k.slug) ?? null;
      },
      async create({ data }) {
        const row = { id: `env_${stub._nextId++}`, slug: data.slug, name: data.name, tier: data.tier, displayOrder: data.displayOrder, organizationId: data.organizationId };
        stub._rows.push(row);
        return row;
      },
    },
  };
  return stub;
}

describe("buildEnvironmentCreateResponse", () => {
  it("422 slug_invalid for an uppercase/invalid slug", async () => {
    const r = await buildEnvironmentCreateResponse(makeRepo(), { organizationId: "o", slug: "Dev Env", name: "Dev", tier: "dev" });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("slug_invalid");
  });

  it("422 name_invalid for a blank name", async () => {
    const r = await buildEnvironmentCreateResponse(makeRepo(), { organizationId: "o", slug: "dev", name: "   ", tier: "dev" });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("name_invalid");
  });

  it("422 tier_invalid for an unknown tier", async () => {
    const r = await buildEnvironmentCreateResponse(makeRepo(), { organizationId: "o", slug: "dev", name: "Dev", tier: "sandbox" });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("tier_invalid");
  });

  it("201 creates a new environment", async () => {
    const repo = makeRepo();
    const r = await buildEnvironmentCreateResponse(repo, { organizationId: "o", slug: "Prod", name: "Production", tier: "prod" });
    expect(r.status).toBe(201);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.created).toBe(true);
    expect(r.body.data.slug).toBe("prod"); // normalized lowercase
    expect(repo._rows).toHaveLength(1);
  });

  it("200 idempotent on repeat slug within the same org — returns existing without creating", async () => {
    const repo = makeRepo();
    await buildEnvironmentCreateResponse(repo, { organizationId: "o", slug: "dev", name: "Development", tier: "dev" });
    const r = await buildEnvironmentCreateResponse(repo, { organizationId: "o", slug: "dev", name: "Different name", tier: "test" });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.created).toBe(false);
    expect(repo._rows).toHaveLength(1);
  });

  it("allows the same slug across two different orgs", async () => {
    const repo = makeRepo();
    await buildEnvironmentCreateResponse(repo, { organizationId: "org_a", slug: "dev", name: "Development", tier: "dev" });
    const r = await buildEnvironmentCreateResponse(repo, { organizationId: "org_b", slug: "dev", name: "Development", tier: "dev" });
    expect(r.status).toBe(201);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.created).toBe(true);
    expect(repo._rows).toHaveLength(2);
  });

  it("503 migration_pending when the table doesn't exist yet", async () => {
    const repo = makeRepo();
    repo.environment.findUnique = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildEnvironmentCreateResponse(repo, { organizationId: "o", slug: "dev", name: "Development", tier: "dev" });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
