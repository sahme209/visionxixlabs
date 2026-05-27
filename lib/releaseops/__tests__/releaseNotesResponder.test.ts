import { describe, expect, it } from "vitest";
import {
  buildReleaseNotesUpsertResponse,
  buildReleaseNotesTransitionResponse,
  buildReleaseNotesListResponse,
  planTransition,
  type DraftRow,
  type ReleaseLookupRow,
  type ReleaseNotesRepo,
} from "../releaseNotesResponder";

interface Stub extends ReleaseNotesRepo {
  _releases: ReleaseLookupRow[];
  _drafts: DraftRow[];
  _nextId: number;
}

function makeRepo(): Stub {
  const stub: Stub = {
    _releases: [],
    _drafts: [],
    _nextId: 1,
    release: {
      async findUnique({ where }) {
        return stub._releases.find((r) => r.id === where.id) ?? null;
      },
    },
    releaseNotesDraft: {
      async findUnique({ where }) {
        return stub._drafts.find((d) => d.releaseId === where.releaseId) ?? null;
      },
      async findMany({ where, take }) {
        const out = stub._drafts.filter((d) => {
          if (d.organizationId !== where.organizationId) return false;
          if (where.status !== undefined && d.status !== where.status) return false;
          return true;
        }).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        return take ? out.slice(0, take) : out;
      },
      async upsert({ where, create, update }) {
        const idx = stub._drafts.findIndex((d) => d.releaseId === where.releaseId);
        if (idx >= 0) {
          const existing = stub._drafts[idx];
          stub._drafts[idx] = {
            ...existing,
            bulletsJson: update.bulletsJson,
            headline: update.headline,
            source: update.source,
            updatedAt: new Date(existing.updatedAt.getTime() + 1),
          };
          return stub._drafts[idx];
        }
        const now = new Date();
        const row: DraftRow = {
          id: `dr_${stub._nextId++}`,
          organizationId: create.organizationId,
          releaseId: create.releaseId,
          status: create.status,
          bulletsJson: create.bulletsJson,
          headline: create.headline,
          source: create.source,
          reviewedByUserId: null,
          reviewedAt: null,
          publishedByUserId: null,
          publishedAt: null,
          publishedUrl: null,
          createdAt: now,
          updatedAt: now,
        };
        stub._drafts.push(row);
        return row;
      },
      async update({ where, data }) {
        const idx = stub._drafts.findIndex((d) => d.id === where.id);
        if (idx < 0) throw new Error("not found");
        const existing = stub._drafts[idx];
        stub._drafts[idx] = {
          ...existing,
          status: data.status,
          reviewedByUserId: data.reviewedByUserId !== undefined ? data.reviewedByUserId : existing.reviewedByUserId,
          reviewedAt: data.reviewedAt !== undefined ? data.reviewedAt : existing.reviewedAt,
          publishedByUserId: data.publishedByUserId !== undefined ? data.publishedByUserId : existing.publishedByUserId,
          publishedAt: data.publishedAt !== undefined ? data.publishedAt : existing.publishedAt,
          publishedUrl: data.publishedUrl !== undefined ? data.publishedUrl : existing.publishedUrl,
          updatedAt: new Date(existing.updatedAt.getTime() + 1),
        };
        return stub._drafts[idx];
      },
    },
  };
  return stub;
}

describe("planTransition", () => {
  const now = new Date("2026-05-26T12:00:00Z");
  it("draft → reviewed on review", () => {
    const p = planTransition("draft", "review", { actorUserId: "u", now });
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.next).toBe("reviewed");
  });
  it("rejects review from reviewed", () => {
    const p = planTransition("reviewed", "review", { actorUserId: "u", now });
    expect(p.ok).toBe(false);
  });
  it("rejects publish from draft", () => {
    const p = planTransition("draft", "publish", { actorUserId: "u", now });
    expect(p.ok).toBe(false);
  });
  it("reviewed → published on publish", () => {
    const p = planTransition("reviewed", "publish", { actorUserId: "u", now, publishedUrl: "https://x" });
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.next).toBe("published");
      expect(p.fields.publishedUrl).toBe("https://x");
    }
  });
  it("rejects revoke on published (sealed)", () => {
    const p = planTransition("published", "revoke", { actorUserId: "u", now });
    expect(p.ok).toBe(false);
  });
  it("reviewed → draft on revoke", () => {
    const p = planTransition("reviewed", "revoke", { actorUserId: "u", now });
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.next).toBe("draft");
  });
});

describe("buildReleaseNotesUpsertResponse", () => {
  function rel(stub: Stub) {
    stub._releases.push({ id: "rel_1", organizationId: "o" });
  }

  it("422 bullets_empty", async () => {
    const stub = makeRepo();
    rel(stub);
    const r = await buildReleaseNotesUpsertResponse(stub, {
      organizationId: "o", releaseId: "rel_1", bullets: ["", "   "],
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("bullets_empty");
  });

  it("422 bullet_too_long", async () => {
    const stub = makeRepo();
    rel(stub);
    const r = await buildReleaseNotesUpsertResponse(stub, {
      organizationId: "o", releaseId: "rel_1", bullets: ["x".repeat(501)],
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("bullet_too_long");
  });

  it("404 release_not_found", async () => {
    const stub = makeRepo();
    const r = await buildReleaseNotesUpsertResponse(stub, {
      organizationId: "o", releaseId: "missing", bullets: ["x"],
    });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("release_not_found");
  });

  it("403 cross_org_release", async () => {
    const stub = makeRepo();
    stub._releases.push({ id: "rel_1", organizationId: "other" });
    const r = await buildReleaseNotesUpsertResponse(stub, {
      organizationId: "o", releaseId: "rel_1", bullets: ["x"],
    });
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_release");
  });

  it("200 creates a new draft + normalizes bullets", async () => {
    const stub = makeRepo();
    rel(stub);
    const r = await buildReleaseNotesUpsertResponse(stub, {
      organizationId: "o", releaseId: "rel_1",
      bullets: ["  Fixed login bug  ", "", "  Added new dashboard "],
      headline: "  v1.2.3 ",
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.draft.bullets).toEqual(["Fixed login bug", "Added new dashboard"]);
    expect(r.body.data.draft.headline).toBe("v1.2.3");
    expect(r.body.data.draft.status).toBe("draft");
  });

  it("409 not_draft when existing is reviewed", async () => {
    const stub = makeRepo();
    rel(stub);
    await buildReleaseNotesUpsertResponse(stub, {
      organizationId: "o", releaseId: "rel_1", bullets: ["x"],
    });
    await buildReleaseNotesTransitionResponse(stub, {
      organizationId: "o", actorUserId: "u", releaseId: "rel_1", action: "review",
    });
    const r = await buildReleaseNotesUpsertResponse(stub, {
      organizationId: "o", releaseId: "rel_1", bullets: ["y"],
    });
    expect(r.status).toBe(409);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("not_draft");
  });
});

describe("buildReleaseNotesTransitionResponse", () => {
  function seeded(): Stub {
    const stub = makeRepo();
    stub._releases.push({ id: "rel_1", organizationId: "o" });
    return stub;
  }
  async function withDraft(stub: Stub) {
    await buildReleaseNotesUpsertResponse(stub, {
      organizationId: "o", releaseId: "rel_1", bullets: ["x"],
    });
  }

  it("404 draft_not_found", async () => {
    const stub = seeded();
    const r = await buildReleaseNotesTransitionResponse(stub, {
      organizationId: "o", actorUserId: "u", releaseId: "rel_1", action: "review",
    });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("draft_not_found");
  });

  it("200 review then publish, persists URL", async () => {
    const stub = seeded();
    await withDraft(stub);
    const rev = await buildReleaseNotesTransitionResponse(stub, {
      organizationId: "o", actorUserId: "u1", releaseId: "rel_1", action: "review",
    });
    expect(rev.status).toBe(200);
    if (!rev.body.ok) throw new Error("expected ok");
    expect(rev.body.data.status).toBe("reviewed");

    const pub = await buildReleaseNotesTransitionResponse(stub, {
      organizationId: "o", actorUserId: "u2", releaseId: "rel_1", action: "publish",
      publishedUrl: "https://example.com/v1.2.3",
    });
    expect(pub.status).toBe(200);
    if (!pub.body.ok) throw new Error("expected ok");
    expect(pub.body.data.status).toBe("published");
    expect(stub._drafts[0].publishedUrl).toBe("https://example.com/v1.2.3");
    expect(stub._drafts[0].publishedByUserId).toBe("u2");
  });

  it("409 illegal_transition publish from draft", async () => {
    const stub = seeded();
    await withDraft(stub);
    const r = await buildReleaseNotesTransitionResponse(stub, {
      organizationId: "o", actorUserId: "u", releaseId: "rel_1", action: "publish",
    });
    expect(r.status).toBe(409);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("illegal_transition");
  });

  it("revoke reviewed → draft clears reviewer", async () => {
    const stub = seeded();
    await withDraft(stub);
    await buildReleaseNotesTransitionResponse(stub, {
      organizationId: "o", actorUserId: "u1", releaseId: "rel_1", action: "review",
    });
    const r = await buildReleaseNotesTransitionResponse(stub, {
      organizationId: "o", actorUserId: "u2", releaseId: "rel_1", action: "revoke",
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.status).toBe("draft");
    expect(stub._drafts[0].reviewedByUserId).toBeNull();
  });

  it("409 cannot revoke published (sealed)", async () => {
    const stub = seeded();
    await withDraft(stub);
    await buildReleaseNotesTransitionResponse(stub, { organizationId: "o", actorUserId: "u", releaseId: "rel_1", action: "review" });
    await buildReleaseNotesTransitionResponse(stub, { organizationId: "o", actorUserId: "u", releaseId: "rel_1", action: "publish" });
    const r = await buildReleaseNotesTransitionResponse(stub, {
      organizationId: "o", actorUserId: "u", releaseId: "rel_1", action: "revoke",
    });
    expect(r.status).toBe(409);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("illegal_transition");
  });
});

describe("buildReleaseNotesListResponse", () => {
  it("200 reports summary across statuses", async () => {
    const stub = makeRepo();
    stub._releases.push({ id: "rel_1", organizationId: "o" });
    stub._releases.push({ id: "rel_2", organizationId: "o" });
    stub._releases.push({ id: "rel_3", organizationId: "o" });
    await buildReleaseNotesUpsertResponse(stub, { organizationId: "o", releaseId: "rel_1", bullets: ["a"] });
    await buildReleaseNotesUpsertResponse(stub, { organizationId: "o", releaseId: "rel_2", bullets: ["b"] });
    await buildReleaseNotesTransitionResponse(stub, { organizationId: "o", actorUserId: "u", releaseId: "rel_2", action: "review" });
    await buildReleaseNotesUpsertResponse(stub, { organizationId: "o", releaseId: "rel_3", bullets: ["c"] });
    await buildReleaseNotesTransitionResponse(stub, { organizationId: "o", actorUserId: "u", releaseId: "rel_3", action: "review" });
    await buildReleaseNotesTransitionResponse(stub, { organizationId: "o", actorUserId: "u", releaseId: "rel_3", action: "publish" });

    const r = await buildReleaseNotesListResponse(stub, "o");
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.summary).toEqual({ total: 3, draft: 1, reviewed: 1, published: 1 });
  });

  it("503 migration_pending", async () => {
    const stub = makeRepo();
    stub.releaseNotesDraft.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildReleaseNotesListResponse(stub, "o");
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
