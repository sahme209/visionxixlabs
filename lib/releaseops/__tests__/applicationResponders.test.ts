import { describe, expect, it } from "vitest";
import {
  buildApplicationListResponse,
  type ApplicationListRepo,
  type ApplicationRow,
} from "../applicationListResponder";
import {
  buildApplicationCreateResponse,
  type ApplicationCreateRepo,
  type ApplicationCreatedRow,
} from "../applicationCreateResponder";

/* ──────────────────────────────────────────────────────────────────
   List responder
   ────────────────────────────────────────────────────────────── */

function makeListRepo(): ApplicationListRepo & {
  _apps: ApplicationRow[];
  _componentCounts: Map<string, number>;
  _releaseCounts: Map<string, number>;
  _releaseDeployedCounts: Map<string, number>;
} {
  const apps: ApplicationRow[] = [];
  const componentCounts = new Map<string, number>();
  const releaseCounts = new Map<string, number>();
  const releaseDeployedCounts = new Map<string, number>();
  return {
    _apps: apps, _componentCounts: componentCounts,
    _releaseCounts: releaseCounts, _releaseDeployedCounts: releaseDeployedCounts,
    application: {
      async findMany({ where }) {
        return apps.filter((a) => a.organizationId === where.organizationId).slice().sort((a, b) => a.name.localeCompare(b.name));
      },
    },
    component: { async count({ where }) { return componentCounts.get(where.applicationId) ?? 0; } },
    release: {
      async count({ where }) {
        if (where.status === "deployed") return releaseDeployedCounts.get(where.applicationId) ?? 0;
        return releaseCounts.get(where.applicationId) ?? 0;
      },
    },
  };
}

function makeApp(over: Partial<ApplicationRow> = {}): ApplicationRow {
  return {
    id: "app_1", organizationId: "o", slug: "checkout", name: "Checkout",
    ownerTeamLabel: "payments", businessTier: "tier_1", description: "Cart + checkout.",
    createdAt: new Date("2026-05-20"), updatedAt: new Date("2026-05-25"),
    ...over,
  };
}

describe("buildApplicationListResponse", () => {
  it("empty org → 200 ok, zeros", async () => {
    const repo = makeListRepo();
    const r = await buildApplicationListResponse(repo, "o");
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.applications).toEqual([]);
    expect(r.body.data.summary).toEqual({ total: 0, withReleases: 0, totalComponents: 0 });
  });

  it("populated → joins component + release counts", async () => {
    const repo = makeListRepo();
    repo._apps.push(makeApp({ id: "a", name: "alpha" }));
    repo._apps.push(makeApp({ id: "b", name: "beta" }));
    repo._componentCounts.set("a", 3);
    repo._componentCounts.set("b", 5);
    repo._releaseCounts.set("a", 4);
    repo._releaseDeployedCounts.set("a", 2);
    const r = await buildApplicationListResponse(repo, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.applications).toHaveLength(2);
    expect(r.body.data.applications[0].componentCount).toBe(3);
    expect(r.body.data.applications[0].releaseCount).toBe(4);
    expect(r.body.data.applications[0].releasesDeployed).toBe(2);
    expect(r.body.data.summary).toEqual({ total: 2, withReleases: 1, totalComponents: 8 });
  });

  it("503 migration_pending", async () => {
    const repo = makeListRepo();
    repo.application.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildApplicationListResponse(repo, "o");
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});

/* ──────────────────────────────────────────────────────────────────
   Create responder
   ────────────────────────────────────────────────────────────── */

function makeCreateRepo(): ApplicationCreateRepo & { _byKey: Map<string, ApplicationCreatedRow> } {
  const byKey = new Map<string, ApplicationCreatedRow>();
  let nextId = 1;
  return {
    _byKey: byKey,
    application: {
      async findUnique({ where }) {
        return byKey.get(`${where.organizationId_slug.organizationId}|${where.organizationId_slug.slug}`) ?? null;
      },
      async create({ data }) {
        const row: ApplicationCreatedRow = { id: `app_${nextId++}`, slug: data.slug, name: data.name };
        byKey.set(`${data.organizationId}|${data.slug}`, row);
        return row;
      },
    },
  };
}

describe("buildApplicationCreateResponse", () => {
  it("422 slug_invalid for bad characters", async () => {
    const repo = makeCreateRepo();
    const r = await buildApplicationCreateResponse(repo, { organizationId: "o", slug: "Bad Slug!", name: "x" });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("slug_invalid");
  });

  it("422 name_required for empty name", async () => {
    const repo = makeCreateRepo();
    const r = await buildApplicationCreateResponse(repo, { organizationId: "o", slug: "ok", name: "  " });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("name_required");
  });

  it("201 on first create", async () => {
    const repo = makeCreateRepo();
    const r = await buildApplicationCreateResponse(repo, {
      organizationId: "o", slug: "checkout", name: "Checkout",
      ownerTeamLabel: "payments", businessTier: "tier_1", description: "Cart.",
    });
    expect(r.status).toBe(201);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.created).toBe(true);
    expect(r.body.data.slug).toBe("checkout");
  });

  it("200 idempotent — second call returns existing without creating", async () => {
    const repo = makeCreateRepo();
    await buildApplicationCreateResponse(repo, { organizationId: "o", slug: "checkout", name: "Checkout" });
    const r = await buildApplicationCreateResponse(repo, { organizationId: "o", slug: "checkout", name: "Checkout updated" });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.created).toBe(false);
    // Name in the response is the existing row's name — we don't auto-update.
    expect(r.body.data.name).toBe("Checkout");
  });

  it("503 migration_pending", async () => {
    const repo = makeCreateRepo();
    repo.application.findUnique = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildApplicationCreateResponse(repo, { organizationId: "o", slug: "checkout", name: "Checkout" });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
