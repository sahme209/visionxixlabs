import { describe, expect, it } from "vitest";
import {
  buildRepositoryCreateResponse,
  defaultRemoteUrl,
  type RepositoryCreateRepo,
  type RepositoryCreatedRow,
} from "../repositoryCreateResponder";

function makeRepo(): RepositoryCreateRepo & { _byKey: Map<string, RepositoryCreatedRow> } {
  const byKey = new Map<string, RepositoryCreatedRow>();
  let nextId = 1;
  return {
    _byKey: byKey,
    repository: {
      async findUnique({ where }) {
        const k = `${where.organizationId_provider_remoteOwner_remoteName.organizationId}|${where.organizationId_provider_remoteOwner_remoteName.provider}|${where.organizationId_provider_remoteOwner_remoteName.remoteOwner}|${where.organizationId_provider_remoteOwner_remoteName.remoteName}`;
        return byKey.get(k) ?? null;
      },
      async create({ data }) {
        const k = `o|${data.provider}|${data.remoteOwner}|${data.remoteName}`;
        const row: RepositoryCreatedRow = {
          id: `repo_${nextId++}`,
          provider: data.provider,
          remoteOwner: data.remoteOwner,
          remoteName: data.remoteName,
          remoteUrl: data.remoteUrl,
          defaultBranch: data.defaultBranch,
        };
        byKey.set(k, row);
        return row;
      },
    },
  };
}

describe("defaultRemoteUrl", () => {
  it("builds GitHub URL", () => expect(defaultRemoteUrl("github", "acme", "checkout")).toBe("https://github.com/acme/checkout"));
  it("builds GitLab URL", () => expect(defaultRemoteUrl("gitlab", "acme", "checkout")).toBe("https://gitlab.com/acme/checkout"));
  it("builds ADO URL", () => expect(defaultRemoteUrl("azuredevops", "acme", "checkout")).toBe("https://dev.azure.com/acme/checkout/_git/checkout"));
});

describe("buildRepositoryCreateResponse", () => {
  it("422 provider_invalid", async () => {
    const repo = makeRepo();
    const r = await buildRepositoryCreateResponse(repo, {
      organizationId: "o", provider: "bitbucket", remoteOwner: "x", remoteName: "y",
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("provider_invalid");
  });

  it("422 owner_invalid for bad chars", async () => {
    const repo = makeRepo();
    const r = await buildRepositoryCreateResponse(repo, {
      organizationId: "o", provider: "github", remoteOwner: "bad/owner", remoteName: "y",
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("owner_invalid");
  });

  it("422 name_invalid for empty name", async () => {
    const repo = makeRepo();
    const r = await buildRepositoryCreateResponse(repo, {
      organizationId: "o", provider: "github", remoteOwner: "acme", remoteName: "",
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("name_invalid");
  });

  it("422 remote_url_invalid for non-http URL", async () => {
    const repo = makeRepo();
    const r = await buildRepositoryCreateResponse(repo, {
      organizationId: "o", provider: "github", remoteOwner: "acme", remoteName: "checkout",
      remoteUrl: "git@github.com:acme/checkout.git",
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("remote_url_invalid");
  });

  it("201 on first registration with derived URL", async () => {
    const repo = makeRepo();
    const r = await buildRepositoryCreateResponse(repo, {
      organizationId: "o", provider: "github", remoteOwner: "acme", remoteName: "checkout",
    });
    expect(r.status).toBe(201);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.created).toBe(true);
    expect(r.body.data.remoteUrl).toBe("https://github.com/acme/checkout");
    expect(r.body.data.defaultBranch).toBe("main");
    expect(r.body.data.displayName).toBe("acme/checkout");
  });

  it("200 idempotent repeat — returns existing without creating", async () => {
    const repo = makeRepo();
    await buildRepositoryCreateResponse(repo, {
      organizationId: "o", provider: "github", remoteOwner: "acme", remoteName: "checkout",
    });
    const r = await buildRepositoryCreateResponse(repo, {
      organizationId: "o", provider: "github", remoteOwner: "acme", remoteName: "checkout",
      defaultBranch: "different",
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.created).toBe(false);
    expect(r.body.data.defaultBranch).toBe("main");  // existing value, not updated
  });

  it("503 migration_pending", async () => {
    const repo = makeRepo();
    repo.repository.findUnique = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildRepositoryCreateResponse(repo, {
      organizationId: "o", provider: "github", remoteOwner: "acme", remoteName: "checkout",
    });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
