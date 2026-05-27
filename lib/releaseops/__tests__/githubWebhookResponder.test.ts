import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import {
  verifyGitHubSignature,
  dispatchGitHubWebhook,
  buildWebhookDeliveryListResponse,
  type GithubWebhookRepo,
  type DeliveryListRepo,
  type DeliveryRow,
  type RepoLookupRow,
} from "../githubWebhookResponder";

interface Stub extends GithubWebhookRepo, DeliveryListRepo {
  _deliveries: DeliveryRow[];
  _repos: RepoLookupRow[];
  _nextId: number;
}

function makeRepo(): Stub {
  const stub: Stub = {
    _deliveries: [],
    _repos: [],
    _nextId: 1,
    repository: {
      async findFirst({ where }) {
        return stub._repos.find(
          (r) => r.remoteOwner === where.remoteOwner && r.remoteName === where.remoteName,
        ) ?? null;
      },
    },
    webhookDelivery: {
      async findUnique({ where }) {
        const k = where.provider_deliveryId;
        return stub._deliveries.find((d) => d.provider === k.provider && d.deliveryId === k.deliveryId) ?? null;
      },
      async create({ data }) {
        const row: DeliveryRow = {
          id: `del_${stub._nextId++}`,
          organizationId: data.organizationId,
          provider: data.provider,
          deliveryId: data.deliveryId,
          eventKind: data.eventKind,
          eventAction: data.eventAction,
          outcome: data.outcome,
          summary: data.summary,
          receivedAt: new Date(Date.now() + stub._deliveries.length),
        };
        stub._deliveries.push(row);
        return row;
      },
      async findMany({ where, take }) {
        const out = stub._deliveries
          .filter((d) => d.organizationId === where.organizationId)
          .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
        return take ? out.slice(0, take) : out;
      },
    },
  };
  return stub;
}

function signed(body: string, secret: string): string {
  const h = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
  return `sha256=${h}`;
}

describe("verifyGitHubSignature", () => {
  it("ok on matching HMAC", () => {
    const body = JSON.stringify({ zen: "Anything added dilutes everything else." });
    const r = verifyGitHubSignature(body, signed(body, "s3cret"), "s3cret");
    expect(r.ok).toBe(true);
  });

  it("missing_header when null", () => {
    expect(verifyGitHubSignature("x", null, "s").reason).toBe("missing_header");
  });

  it("wrong_format when header lacks sha256= prefix", () => {
    expect(verifyGitHubSignature("x", "abcdef", "s").reason).toBe("wrong_format");
  });

  it("mismatch on wrong secret", () => {
    const body = "x";
    const r = verifyGitHubSignature(body, signed(body, "other"), "actual");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("mismatch");
  });

  it("mismatch on tampered body", () => {
    const body = JSON.stringify({ a: 1 });
    const sig = signed(body, "s");
    const r = verifyGitHubSignature(JSON.stringify({ a: 2 }), sig, "s");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("mismatch");
  });
});

describe("dispatchGitHubWebhook", () => {
  it("400 when deliveryId empty", async () => {
    const repo = makeRepo();
    const r = await dispatchGitHubWebhook(repo, { deliveryId: "", eventKind: "push", payload: {} });
    expect(r.status).toBe(400);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("delivery_id_required");
  });

  it("400 when event kind missing", async () => {
    const repo = makeRepo();
    const r = await dispatchGitHubWebhook(repo, { deliveryId: "d1", eventKind: "", payload: {} });
    expect(r.status).toBe(400);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("event_kind_required");
  });

  it("202 unsupported_event for unknown events (acknowledged, not persisted)", async () => {
    const repo = makeRepo();
    const r = await dispatchGitHubWebhook(repo, { deliveryId: "d1", eventKind: "star", payload: {} });
    expect(r.status).toBe(202);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("unsupported_event");
    expect(repo._deliveries).toHaveLength(0);
  });

  it("200 accepted for known repo · attaches to org", async () => {
    const repo = makeRepo();
    repo._repos.push({ id: "r1", organizationId: "o1", remoteOwner: "acme", remoteName: "checkout" });
    const r = await dispatchGitHubWebhook(repo, {
      deliveryId: "d1", eventKind: "pull_request",
      payload: {
        action: "opened",
        repository: { full_name: "acme/checkout" },
        pull_request: { number: 42, title: "Fix login" },
      },
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.outcome).toBe("accepted");
    expect(r.body.data.idempotent).toBe(false);
    expect(repo._deliveries).toHaveLength(1);
    expect(repo._deliveries[0].organizationId).toBe("o1");
    expect(repo._deliveries[0].summary).toContain("PR #42");
    expect(repo._deliveries[0].summary).toContain("opened");
  });

  it("200 ignored when repo not registered", async () => {
    const repo = makeRepo();
    const r = await dispatchGitHubWebhook(repo, {
      deliveryId: "d1", eventKind: "push",
      payload: { ref: "refs/heads/main", repository: { full_name: "ghost/repo" } },
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.outcome).toBe("ignored");
    expect(repo._deliveries[0].organizationId).toBe("system");
  });

  it("200 idempotent on duplicate delivery", async () => {
    const repo = makeRepo();
    repo._repos.push({ id: "r1", organizationId: "o1", remoteOwner: "acme", remoteName: "checkout" });
    await dispatchGitHubWebhook(repo, {
      deliveryId: "dup", eventKind: "release",
      payload: { action: "published", repository: { full_name: "acme/checkout" }, release: { tag_name: "v1.0.0" } },
    });
    const r2 = await dispatchGitHubWebhook(repo, {
      deliveryId: "dup", eventKind: "release",
      payload: { action: "published", repository: { full_name: "acme/checkout" }, release: { tag_name: "v1.0.0" } },
    });
    expect(r2.status).toBe(200);
    if (!r2.body.ok) throw new Error("expected ok");
    expect(r2.body.data.idempotent).toBe(true);
    expect(repo._deliveries).toHaveLength(1);
  });

  it("ping accepts globally even with no payload repo", async () => {
    const repo = makeRepo();
    const r = await dispatchGitHubWebhook(repo, { deliveryId: "ping1", eventKind: "ping", payload: {} });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.outcome).toBe("accepted");
    expect(repo._deliveries[0].organizationId).toBe("system");
  });

  it("workflow_run summary captures conclusion", async () => {
    const repo = makeRepo();
    repo._repos.push({ id: "r1", organizationId: "o1", remoteOwner: "acme", remoteName: "checkout" });
    await dispatchGitHubWebhook(repo, {
      deliveryId: "d1", eventKind: "workflow_run",
      payload: { repository: { full_name: "acme/checkout" }, workflow_run: { name: "CI", conclusion: "success" } },
    });
    expect(repo._deliveries[0].summary).toContain("CI");
    expect(repo._deliveries[0].summary).toContain("success");
  });

  it("503 migration_pending", async () => {
    const repo = makeRepo();
    repo._repos.push({ id: "r1", organizationId: "o1", remoteOwner: "acme", remoteName: "checkout" });
    repo.webhookDelivery.findUnique = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await dispatchGitHubWebhook(repo, {
      deliveryId: "d1", eventKind: "push",
      payload: { ref: "refs/heads/main", repository: { full_name: "acme/checkout" } },
    });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});

describe("buildWebhookDeliveryListResponse", () => {
  it("200 empty", async () => {
    const repo = makeRepo();
    const r = await buildWebhookDeliveryListResponse(repo, "o1");
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.deliveries).toHaveLength(0);
    expect(r.body.data.summary).toEqual({ total: 0, accepted: 0, ignored: 0, errored: 0 });
  });

  it("200 lists newest first + counts", async () => {
    const repo = makeRepo();
    repo._repos.push({ id: "r1", organizationId: "o1", remoteOwner: "acme", remoteName: "checkout" });
    await dispatchGitHubWebhook(repo, {
      deliveryId: "d1", eventKind: "pull_request",
      payload: { action: "opened", repository: { full_name: "acme/checkout" }, pull_request: { number: 1, title: "x" } },
    });
    await dispatchGitHubWebhook(repo, {
      deliveryId: "d2", eventKind: "push",
      payload: { ref: "refs/heads/main", repository: { full_name: "ghost/missing" } },
    });
    const r = await buildWebhookDeliveryListResponse(repo, "o1");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.deliveries).toHaveLength(1); // only the o1-tagged one
    expect(r.body.data.summary.accepted).toBe(1);
  });
});
