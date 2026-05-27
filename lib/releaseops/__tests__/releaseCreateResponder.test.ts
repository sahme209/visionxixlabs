import { describe, expect, it } from "vitest";
import {
  buildReleaseCreateResponse,
  TAG_RE,
  type ApplicationRow,
  type ReleaseCreateRepo,
  type ReleaseCreatedRow,
} from "../releaseCreateResponder";

interface Stub extends ReleaseCreateRepo {
  _apps: ApplicationRow[];
  _releases: ReleaseCreatedRow[];
  _nextId: number;
}

function makeRepo(): Stub {
  const stub: Stub = {
    _apps: [],
    _releases: [],
    _nextId: 1,
    application: {
      async findUnique({ where }) {
        return stub._apps.find((a) => a.id === where.id) ?? null;
      },
    },
    release: {
      async findUnique({ where }) {
        const k = where.organizationId_applicationId_releaseTag;
        return stub._releases.find(
          (r) => r.applicationId === k.applicationId && r.releaseTag === k.releaseTag,
        ) ?? null;
      },
      async create({ data }) {
        const row: ReleaseCreatedRow = {
          id: `rel_${stub._nextId++}`,
          applicationId: data.applicationId,
          releaseTag: data.releaseTag,
          status: data.status,
          commitSha: data.commitSha,
          plannedWindowStart: data.plannedWindowStart,
          plannedWindowEnd: data.plannedWindowEnd,
          summary: data.summary,
        };
        stub._releases.push(row);
        return row;
      },
    },
  };
  return stub;
}

describe("TAG_RE", () => {
  it("accepts canonical semver", () => {
    expect(TAG_RE.test("v1.2.3")).toBe(true);
    expect(TAG_RE.test("1.2.3")).toBe(true);
    expect(TAG_RE.test("v1.2.3-rc.1")).toBe(true);
    expect(TAG_RE.test("1.2.3+build.99")).toBe(true);
    expect(TAG_RE.test("2026.05.26")).toBe(true);
    expect(TAG_RE.test("v0.0.1")).toBe(true);
  });
  it("rejects garbage", () => {
    expect(TAG_RE.test("")).toBe(false);
    expect(TAG_RE.test("nope")).toBe(false);
    expect(TAG_RE.test("v1")).toBe(false);
    expect(TAG_RE.test("v1.2.3 ")).toBe(false);
    expect(TAG_RE.test("release/1.2.3")).toBe(false);
  });
});

describe("buildReleaseCreateResponse", () => {
  function app(stub: Stub) {
    const a: ApplicationRow = { id: "app_1", organizationId: "o", name: "Checkout" };
    stub._apps.push(a);
    return a;
  }

  it("422 tag_invalid for missing tag", async () => {
    const repo = makeRepo();
    app(repo);
    const r = await buildReleaseCreateResponse(repo, {
      organizationId: "o", actorUserId: "u", applicationId: "app_1", releaseTag: "",
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("tag_invalid");
  });

  it("422 tag_invalid for non-semver tag", async () => {
    const repo = makeRepo();
    app(repo);
    const r = await buildReleaseCreateResponse(repo, {
      organizationId: "o", actorUserId: "u", applicationId: "app_1", releaseTag: "release-2",
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("tag_invalid");
  });

  it("422 commit_sha_invalid for bad SHA", async () => {
    const repo = makeRepo();
    app(repo);
    const r = await buildReleaseCreateResponse(repo, {
      organizationId: "o", actorUserId: "u", applicationId: "app_1", releaseTag: "v1.0.0",
      commitSha: "xyz",
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("commit_sha_invalid");
  });

  it("422 planned_window_invalid for bad ISO", async () => {
    const repo = makeRepo();
    app(repo);
    const r = await buildReleaseCreateResponse(repo, {
      organizationId: "o", actorUserId: "u", applicationId: "app_1", releaseTag: "v1.0.0",
      plannedWindowStartIso: "next thursday",
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("planned_window_invalid");
  });

  it("422 planned_window_invalid when start > end", async () => {
    const repo = makeRepo();
    app(repo);
    const r = await buildReleaseCreateResponse(repo, {
      organizationId: "o", actorUserId: "u", applicationId: "app_1", releaseTag: "v1.0.0",
      plannedWindowStartIso: "2026-05-26T20:00:00Z",
      plannedWindowEndIso:   "2026-05-26T19:00:00Z",
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("planned_window_invalid");
  });

  it("404 application_not_found", async () => {
    const repo = makeRepo();
    const r = await buildReleaseCreateResponse(repo, {
      organizationId: "o", actorUserId: "u", applicationId: "missing", releaseTag: "v1.0.0",
    });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("application_not_found");
  });

  it("403 cross_org_application", async () => {
    const repo = makeRepo();
    repo._apps.push({ id: "app_1", organizationId: "other_org", name: "X" });
    const r = await buildReleaseCreateResponse(repo, {
      organizationId: "o", actorUserId: "u", applicationId: "app_1", releaseTag: "v1.0.0",
    });
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_application");
  });

  it("201 creates a new draft release with normalized commit SHA", async () => {
    const repo = makeRepo();
    app(repo);
    const r = await buildReleaseCreateResponse(repo, {
      organizationId: "o", actorUserId: "u", applicationId: "app_1", releaseTag: "v1.2.3",
      commitSha: "ABCDEF1",
      summary: " Patch tuesday hotfix ",
    });
    expect(r.status).toBe(201);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.created).toBe(true);
    expect(r.body.data.releaseTag).toBe("v1.2.3");
    expect(r.body.data.status).toBe("draft");
    // SHA stored lowercased + summary trimmed.
    expect(repo._releases[0].commitSha).toBe("abcdef1");
    expect(repo._releases[0].summary).toBe("Patch tuesday hotfix");
  });

  it("200 idempotent on repeat — returns existing without creating", async () => {
    const repo = makeRepo();
    app(repo);
    await buildReleaseCreateResponse(repo, {
      organizationId: "o", actorUserId: "u", applicationId: "app_1", releaseTag: "v1.0.0",
    });
    const r = await buildReleaseCreateResponse(repo, {
      organizationId: "o", actorUserId: "u", applicationId: "app_1", releaseTag: "v1.0.0",
      summary: "different",
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.created).toBe(false);
    expect(repo._releases).toHaveLength(1);
    expect(repo._releases[0].summary).toBeNull(); // first write
  });

  it("503 migration_pending", async () => {
    const repo = makeRepo();
    app(repo);
    repo.release.findUnique = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildReleaseCreateResponse(repo, {
      organizationId: "o", actorUserId: "u", applicationId: "app_1", releaseTag: "v1.0.0",
    });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
