import { describe, expect, it } from "vitest";
import { buildReleaseTagDiffResponse, type ReleaseTagDiffRepo } from "../releaseTagDiffResponder";
import {
  upsertReleaseTagRecord,
  type ReleaseTagRecordRow,
} from "../gitDiscoveryRepo";

interface Stub extends ReleaseTagDiffRepo {
  _tags: ReleaseTagRecordRow[];
}

function makeRepo(): Stub {
  const tags: ReleaseTagRecordRow[] = [];
  const prs: Array<{ id: string; title?: string; webUrl?: string }> = [
    { id: "pr_1", title: "Retry banner", webUrl: "https://github.com/.../pull/1" },
    { id: "pr_2", title: "Payment retries", webUrl: "https://github.com/.../pull/2" },
    { id: "pr_3", title: "Feature flag plumbing" },
  ];
  let counter = 0;
  const nextId = () => `id_${(counter += 1)}`;
  const clock = (offsetMin = 0) => new Date(2026, 0, 1, 0, counter + offsetMin);

  const repo: Stub = {
    _tags: tags,
    pullRequestRecord: {
      async findUnique() { return null; },
      async findMany() { return []; },
      async upsert() { throw new Error("not used"); },
      async findByIds(ids) { return prs.filter((p) => ids.includes(p.id)); },
    },
    releaseTagRecord: {
      async findUnique({ where }) {
        const row = tags.find((t) => t.repositoryId === where.repositoryId_tagName.repositoryId && t.tagName === where.repositoryId_tagName.tagName);
        return row ? { ...row } : null;
      },
      async findMany({ where, take }) {
        const f = tags.filter((t) =>
          t.organizationId === where.organizationId &&
          (where.repositoryId === undefined || t.repositoryId === where.repositoryId),
        );
        f.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return (take ? f.slice(0, take) : f).map((r) => ({ ...r }));
      },
      async upsert({ where, create, update }) {
        const ex = tags.find((t) => t.repositoryId === where.repositoryId_tagName.repositoryId && t.tagName === where.repositoryId_tagName.tagName);
        if (ex) { Object.assign(ex, update, { updatedAt: clock() }); return { ...ex }; }
        const row: ReleaseTagRecordRow = {
          id: nextId(), updatedAt: clock(), lastSyncedAt: create.lastSyncedAt ?? clock(), ...create,
        };
        tags.push(row);
        return { ...row };
      },
    },
    workflowRunRecord: {
      async findUnique() { return null; },
      async findMany() { return []; },
      async upsert() { throw new Error("not used"); },
    },
    async $transaction(fn) { return fn(repo); },
  };
  return repo;
}

async function seedTwoTags(repo: Stub) {
  await upsertReleaseTagRecord(repo, {
    organizationId: "o", repositoryId: "repo_1",
    tagName: "v2.6.0", commitSha: "aaa",
    createdAt: new Date(2026, 0, 1),
    taggerUserId: null, prListJson: ["pr_1", "pr_2"], commitListJson: ["aaa", "bbb"],
    diffAgainstPreviousProdJson: null, notes: null,
  });
  await upsertReleaseTagRecord(repo, {
    organizationId: "o", repositoryId: "repo_1",
    tagName: "v2.7.0", commitSha: "ccc",
    createdAt: new Date(2026, 0, 2),
    taggerUserId: null, prListJson: ["pr_2", "pr_3"], commitListJson: ["ccc", "ddd"],
    diffAgainstPreviousProdJson: null, notes: null,
  });
}

const NOW = new Date("2026-06-01T22:00:00Z");

describe("buildReleaseTagDiffResponse", () => {
  it("happy path: diffs against immediate previous tag, enriches PR list", async () => {
    const repo = makeRepo();
    await seedTwoTags(repo);
    const r = await buildReleaseTagDiffResponse(
      repo,
      { organizationId: "o", repositoryId: "repo_1", toTag: "v2.7.0" },
      { now: NOW },
    );
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.diff.fromTag).toBe("v2.6.0");
    expect(r.body.data.diff.toTag).toBe("v2.7.0");
    expect(r.body.data.diff.newlyIncludedPrIds).toEqual(["pr_3"]);
    expect(r.body.data.diff.droppedPrIds).toEqual(["pr_1"]);
    expect(r.body.data.newlyIncludedPrs[0].title).toBe("Feature flag plumbing");
    expect(r.body.data.droppedPrs[0].title).toBe("Retry banner");
  });

  it("fromTagOverride lets caller diff against an arbitrary previous version", async () => {
    const repo = makeRepo();
    await seedTwoTags(repo);
    await upsertReleaseTagRecord(repo, {
      organizationId: "o", repositoryId: "repo_1",
      tagName: "v2.5.0", commitSha: "zzz",
      createdAt: new Date(2025, 11, 1),
      taggerUserId: null, prListJson: ["pr_1"], commitListJson: ["zzz"],
      diffAgainstPreviousProdJson: null, notes: null,
    });
    const r = await buildReleaseTagDiffResponse(
      repo,
      { organizationId: "o", repositoryId: "repo_1", toTag: "v2.7.0", fromTagOverride: "v2.5.0" },
      { now: NOW },
    );
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.diff.fromTag).toBe("v2.5.0");
    expect(r.body.data.diff.newlyIncludedPrIds.sort()).toEqual(["pr_2", "pr_3"]);
  });

  it("to_tag_not_found → 404", async () => {
    const repo = makeRepo();
    await seedTwoTags(repo);
    const r = await buildReleaseTagDiffResponse(
      repo,
      { organizationId: "o", repositoryId: "repo_1", toTag: "v999" },
      { now: NOW },
    );
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("to_tag_not_found");
  });

  it("from_tag_not_found → 404 when no previous tag", async () => {
    const repo = makeRepo();
    await upsertReleaseTagRecord(repo, {
      organizationId: "o", repositoryId: "repo_1",
      tagName: "v1.0.0", commitSha: "aaa",
      createdAt: new Date(2026, 0, 1),
      taggerUserId: null, prListJson: [], commitListJson: [],
      diffAgainstPreviousProdJson: null, notes: null,
    });
    const r = await buildReleaseTagDiffResponse(
      repo, { organizationId: "o", repositoryId: "repo_1", toTag: "v1.0.0" }, { now: NOW },
    );
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("from_tag_not_found");
  });

  it("migration_pending degradation when discovery tables aren't migrated", async () => {
    const repo = makeRepo();
    repo.releaseTagRecord.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildReleaseTagDiffResponse(
      repo, { organizationId: "o", repositoryId: "repo_1", toTag: "v2.7.0" }, { now: NOW },
    );
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
