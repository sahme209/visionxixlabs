import { afterEach, describe, expect, it, vi } from "vitest";
import { readGithubProvenanceResource, readGithubProvenanceBundle } from "../githubWriteClient";

afterEach(() => vi.unstubAllGlobals());
const base = { owner: "owner", repo: "repo", installationToken: "scoped-fixture-token", signal: new AbortController().signal };
const json = (value: unknown, headers = {}) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json", ...headers } });

describe("bounded GET-only provenance reads on existing GitHub transport", () => {
  it("uses exact repository/run-attempt URL with no redirects, caching or cookies", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json({ id: 123 })); vi.stubGlobal("fetch", fetcher);
    expect(await readGithubProvenanceResource({ ...base, resource: { kind: "run", runId: "123", attempt: 2 } })).toEqual({ ok: true, data: { id: 123 } });
    expect(fetcher).toHaveBeenCalledWith("https://api.github.com/repos/owner/repo/actions/runs/123/attempts/2", expect.objectContaining({
      method: "GET", redirect: "error", cache: "no-store", credentials: "omit", signal: expect.any(AbortSignal),
      headers: expect.objectContaining({ Authorization: "Bearer scoped-fixture-token", "X-GitHub-Api-Version": "2026-03-10" }),
    }));
  });
  it("pins workflow contents to the commit and bounds the attestation page", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json({})); vi.stubGlobal("fetch", fetcher);
    await readGithubProvenanceResource({ ...base, resource: { kind: "workflow", workflowPath: ".github/workflows/build.yml", commitSha: "a".repeat(40) } });
    await readGithubProvenanceResource({ ...base, resource: { kind: "attestations", subjectSha256: "b".repeat(64) } });
    expect(fetcher.mock.calls.map(call => call[0])).toEqual([
      `https://api.github.com/repos/owner/repo/contents/.github/workflows/build.yml?ref=${"a".repeat(40)}`,
      `https://api.github.com/repos/owner/repo/attestations/sha256%3A${"b".repeat(64)}?per_page=5`,
    ]);
  });
  it.each([
    { kind: "run", runId: "../secrets", attempt: 1 },
    { kind: "workflow", workflowPath: ".github/workflows/../../secrets", commitSha: "a".repeat(40) },
    { kind: "attestations", subjectSha256: "latest" },
  ])("refuses malformed resource before network: %j", async resource => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await readGithubProvenanceResource({ ...base, resource: resource as Parameters<typeof readGithubProvenanceResource>[0]["resource"] })).toMatchObject({ ok: false });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects oversized streamed JSON even when Content-Length is absent", async () => {
    const cancelled = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(300_000)); }, cancel: cancelled }))));
    expect(await readGithubProvenanceResource({ ...base, resource: { kind: "repository" } })).toMatchObject({ ok: false, error: "github_provenance_read_unavailable" });
    expect(cancelled).toHaveBeenCalled();
  });
  it("never echoes provider error bodies or credentials", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("secret-provider-body", { status: 403 })));
    expect(await readGithubProvenanceResource({ ...base, resource: { kind: "repository" } })).toEqual({ ok: false, error: "github_provenance_read_unavailable" });
  });
  it("aborts a hanging body and cancels the stream", async () => {
    const cancelled = vi.fn(), controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ cancel: cancelled }))));
    const pending = readGithubProvenanceResource({ ...base, signal: controller.signal, resource: { kind: "repository" } });
    await Promise.resolve(); controller.abort();
    expect(await pending).toMatchObject({ ok: false });
  });
  it("consumes a shared response-byte budget and refuses later reads after exhaustion", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json({ larger: "than-the-eight-byte-budget" })); vi.stubGlobal("fetch", fetcher);
    const budget = { remainingBytes: 8 };
    expect(await readGithubProvenanceResource({ ...base, budget, resource: { kind: "repository" } })).toMatchObject({ ok: false });
    expect(budget.remainingBytes).toBe(0);
    expect(await readGithubProvenanceResource({ ...base, budget, resource: { kind: "repository" } })).toMatchObject({ ok: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("raw bundle download with server-reviewed transport policy", () => {
  const url = "https://reviewed.blob.core.windows.net/attestations/123/2026/1.json.sn?sig=private-fixture-query";
  const policy = [{ origin: "https://reviewed.blob.core.windows.net", pathPrefix: "/attestations/123/" }];
  it("downloads exact bytes without bearer/cookies/referrer and without following redirects", async () => {
    const bytes = Uint8Array.from([123, 13, 10, 125]);
    const fetcher = vi.fn<typeof fetch>(async () => new Response(bytes)); vi.stubGlobal("fetch", fetcher);
    const result = await readGithubProvenanceBundle({ url, policy, signal: base.signal });
    expect(result).toEqual({ ok: true, data: bytes });
    expect(fetcher).toHaveBeenCalledWith(url, expect.objectContaining({ method: "GET", credentials: "omit", redirect: "error", cache: "no-store", referrerPolicy: "no-referrer" }));
    expect(fetcher.mock.calls[0]?.[1]?.headers).not.toHaveProperty("Authorization");
  });
  it.each([
    "http://reviewed.blob.core.windows.net/attestations/123/a", "https://evil.test/attestations/123/a",
    "https://reviewed.blob.core.windows.net/attestations/456/a", "https://user:pass@reviewed.blob.core.windows.net/attestations/123/a",
    "https://reviewed.blob.core.windows.net/attestations/123/a#fragment",
  ])("refuses unreviewed URL before network: %s", async candidate => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await readGithubProvenanceBundle({ url: candidate, policy, signal: base.signal })).toMatchObject({ ok: false });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not permit absent download policy", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await readGithubProvenanceBundle({ url, policy: [], signal: base.signal })).toMatchObject({ ok: false });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
