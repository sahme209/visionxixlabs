import { describe, expect, it } from "vitest";
import {
  buildDriftPersistResponse,
  type DriftPersistRepo,
  type DriftPersistExistingRow,
} from "../driftPersistResponder";
import type { DeclaredResource, ObservedResource } from "../driftDetector";

type RepoStub = DriftPersistRepo & {
  _existing: Map<string, DriftPersistExistingRow>;
  _upserts: Array<{ key: string; severity: string }>;
  _resolves: Array<{ id: string }>;
};

function makeRepo(): RepoStub {
  let nextId = 1;
  const stub: RepoStub = {
    _existing: new Map(),
    _upserts: [],
    _resolves: [],
    driftFinding: {
      async findMany() { return Array.from(stub._existing.values()); },
      async upsert({ where, create }) {
        const k = `${where.organizationId_resourceKind_resourceId.resourceKind}::${where.organizationId_resourceKind_resourceId.resourceId}`;
        const id = `dr_${nextId++}`;
        stub._existing.set(id, { id, resourceKind: create.resourceKind, resourceId: create.resourceId, status: "open" });
        stub._upserts.push({ key: k, severity: create.severity });
        return { id };
      },
      async update({ where, data }) {
        const ex = stub._existing.get(where.id);
        if (ex) stub._existing.set(where.id, { ...ex, status: data.status });
        stub._resolves.push({ id: where.id });
        return { id: where.id };
      },
    },
  };
  return stub;
}

function decl(over: Partial<DeclaredResource> = {}): DeclaredResource {
  return {
    resourceKind: "aws_resource", resourceId: "i-abc", displayName: "web-1",
    applicationId: "app", environmentTier: "prod",
    attributes: { instance_type: "t3.medium" },
    ...over,
  };
}
function obs(over: Partial<ObservedResource> = {}): ObservedResource {
  return {
    resourceKind: "aws_resource", resourceId: "i-abc",
    displayName: "web-1",
    attributes: { instance_type: "t3.medium" },
    ...over,
  };
}

const NOW = new Date("2026-05-25T12:00:00Z");

describe("buildDriftPersistResponse", () => {
  it("empty inputs → 200 ok with zeros", async () => {
    const repo = makeRepo();
    const r = await buildDriftPersistResponse(repo, { organizationId: "o", declared: [], observed: [] }, { now: NOW });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data).toMatchObject({ upserted: 0, autoResolved: 0, missingFromRuntime: 0, unmanagedDiscovered: 0 });
  });

  it("clean match → no upserts", async () => {
    const repo = makeRepo();
    const r = await buildDriftPersistResponse(repo, { organizationId: "o", declared: [decl()], observed: [obs()] }, { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.upserted).toBe(0);
    expect(repo._upserts).toEqual([]);
  });

  it("attribute drift → upserts a finding", async () => {
    const repo = makeRepo();
    const r = await buildDriftPersistResponse(repo, {
      organizationId: "o",
      declared: [decl()],
      observed: [obs({ attributes: { instance_type: "t3.large" } })],
    }, { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.upserted).toBe(1);
    expect(repo._upserts).toHaveLength(1);
    expect(repo._upserts[0].key).toBe("aws_resource::i-abc");
  });

  it("auto-resolves open findings the detector no longer reports", async () => {
    const repo = makeRepo();
    repo._existing.set("old_1", { id: "old_1", resourceKind: "aws_resource", resourceId: "i-gone", status: "open" });
    repo._existing.set("old_2", { id: "old_2", resourceKind: "aws_resource", resourceId: "i-still-drifted", status: "open" });

    // Only i-still-drifted appears in this detection (with drift).
    const r = await buildDriftPersistResponse(repo, {
      organizationId: "o",
      declared: [decl({ resourceId: "i-still-drifted" })],
      observed: [obs({ resourceId: "i-still-drifted", attributes: { instance_type: "t3.large" } })],
    }, { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.upserted).toBe(1);
    expect(r.body.data.autoResolved).toBe(1);
    expect(repo._resolves.map((x) => x.id)).toEqual(["old_1"]);
  });

  it("bySeverity counts come from the detector", async () => {
    const repo = makeRepo();
    const r = await buildDriftPersistResponse(repo, {
      organizationId: "o",
      declared: [
        decl({ resourceId: "r1", sensitiveAttributeKeys: ["x"], attributes: { x: 1 } }),
        decl({ resourceId: "r2", attributes: { a: 1 } }),
      ],
      observed: [
        obs({ resourceId: "r1", attributes: { x: 2 } }),
        obs({ resourceId: "r2", attributes: { a: 99 } }),
      ],
    }, { now: NOW });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.bySeverity.critical).toBe(1);
  });

  it("503 migration_pending when DriftFinding table missing", async () => {
    const repo = makeRepo();
    repo.driftFinding.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildDriftPersistResponse(repo, { organizationId: "o", declared: [], observed: [] });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
