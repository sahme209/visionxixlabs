import {expect, it, vi} from "vitest";
import {readGitLabProjectTokenEvidence, readGitLabTokenScopeEvidence} from "../gitlabTokenScopeEvidence";

const evidence = {
  id: 21, user_id: 14, active: true, revoked: false, scopes: ["read_api"], expires_at: "2099-01-20",
};

it("observes token scope from the fixed authenticated read and returns only minimal evidence", async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({...evidence, token: "ignored"}));
  const result = await readGitLabTokenScopeEvidence("fixture-token", {signal: new AbortController().signal, fetchImpl});
  expect(result).toEqual({tokenId: "21", userId: "14", expiresAt: Date.UTC(2099, 0, 20)});
  expect(fetchImpl).toHaveBeenCalledExactlyOnceWith("https://gitlab.com/api/v4/personal_access_tokens/self", expect.objectContaining({
    method: "GET", headers: {Accept: "application/json", "PRIVATE-TOKEN": "fixture-token"},
    credentials: "omit", cache: "no-store", redirect: "error", signal: expect.any(AbortSignal),
  }));
});

it.each([
  {scopes: ["api"]}, {scopes: ["read_api", "self_rotate"]}, {scopes: []}, {active: false}, {revoked: true},
  {expires_at: null}, {expires_at: "2000-01-20"}, {expires_at: "2099-02-29"},
  {id: 9007199254740992}, {granular_scopes: [{resource: "fixture"}]},
])("rejects inactive, expanded, expired or ambiguous token evidence %j", async (patch) => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({...evidence, ...patch}));
  await expect(readGitLabTokenScopeEvidence("fixture-token", {signal: new AbortController().signal, fetchImpl}))
    .rejects.toThrow(/^gitlab_token_scope_unavailable$/);
});

it.each([
  new Response("private provider error", {status: 403}),
  new Response(null, {status: 302, headers: {location: "https://example.test"}}),
  Response.json({...evidence, padding: "x".repeat(32_768)}),
])("rejects provider refusal, redirect or oversized metadata without exposing the body", async (response) => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);
  await expect(readGitLabTokenScopeEvidence("fixture-token", {signal: new AbortController().signal, fetchImpl}))
    .rejects.toThrow(/^gitlab_token_scope_unavailable$/);
});

it("refuses cancelled and invalid requests before transport", async () => {
  const fetchImpl = vi.fn<typeof fetch>();
  await expect(readGitLabTokenScopeEvidence("fixture-token", {signal: AbortSignal.abort(), fetchImpl}))
    .rejects.toThrow(/^gitlab_token_scope_unavailable$/);
  await expect(readGitLabTokenScopeEvidence("invalid token", {signal: new AbortController().signal, fetchImpl}))
    .rejects.toThrow(/^gitlab_token_scope_unavailable$/);
  expect(fetchImpl).not.toHaveBeenCalled();
});

it("bounds a pending transport that ignores cancellation", async () => {
  const controller = new AbortController();
  const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => {
    controller.abort();
    return new Promise<Response>(() => {});
  });
  await expect(readGitLabTokenScopeEvidence("fixture-token", {signal: controller.signal, fetchImpl}))
    .rejects.toThrow(/^gitlab_token_scope_unavailable$/);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

const projectMetadata = {id: 42, path_with_namespace: "org/team/repo"};
const projectProof = {projectId: "42", projectPath: "org/team/repo", projectToken: "fixture-project", verifierToken: "fixture-review"};

it("binds the presented token to the exact project resource and uses the verifier only for that lookup", async () => {
  const fetchImpl = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({...evidence, token: "ignored"}))
    .mockResolvedValueOnce(Response.json(projectMetadata))
    .mockResolvedValueOnce(Response.json({...evidence, access_level: 20}));
  await expect(readGitLabProjectTokenEvidence(projectProof, {signal: new AbortController().signal, fetchImpl}))
    .resolves.toEqual({projectId: "42", tokenId: "21", userId: "14", expiresAt: Date.UTC(2099, 0, 20)});
  expect(fetchImpl.mock.calls.map(([url, init]) => [url, init?.method, init?.headers])).toEqual([
    ["https://gitlab.com/api/v4/personal_access_tokens/self", "GET", {Accept: "application/json", "PRIVATE-TOKEN": "fixture-project"}],
    ["https://gitlab.com/api/v4/projects/42", "GET", {Accept: "application/json", "PRIVATE-TOKEN": "fixture-project"}],
    ["https://gitlab.com/api/v4/projects/42/access_tokens/21", "GET", {Accept: "application/json", "PRIVATE-TOKEN": "fixture-review"}],
  ]);
});

it.each([
  {id: 22}, {user_id: 15}, {expires_at: "2099-01-21"}, {scopes: ["read_api", "api"]}, {revoked: true},
])("refuses project metadata that does not match the observed credential %j", async patch => {
  const fetchImpl = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(evidence))
    .mockResolvedValueOnce(Response.json(projectMetadata))
    .mockResolvedValueOnce(Response.json({...evidence, ...patch}));
  await expect(readGitLabProjectTokenEvidence(projectProof, {signal: new AbortController().signal, fetchImpl}))
    .rejects.toThrow(/^gitlab_project_token_unavailable$/);
});

it("refuses an absent or restricted project token without substituting another lookup", async () => {
  const fetchImpl = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(evidence))
    .mockResolvedValueOnce(Response.json(projectMetadata))
    .mockResolvedValueOnce(new Response("private provider detail", {status: 404}));
  await expect(readGitLabProjectTokenEvidence(projectProof, {signal: new AbortController().signal, fetchImpl}))
    .rejects.toThrow(/^gitlab_project_token_unavailable$/);
  expect(fetchImpl).toHaveBeenCalledTimes(3);
});

it("does not use the verifier if self-information fails or the request is cancelled", async () => {
  const controller = new AbortController();
  const fetchImpl = vi.fn<typeof fetch>().mockImplementationOnce(async () => {
    controller.abort();
    return Response.json(evidence);
  });
  await expect(readGitLabProjectTokenEvidence(projectProof, {signal: controller.signal, fetchImpl}))
    .rejects.toThrow(/^gitlab_project_token_unavailable$/);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

it.each([{id: 43}, {path_with_namespace: "foreign/other"}])(
  "refuses incorrect repository identity before the privileged lookup %j", async patch => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(evidence))
      .mockResolvedValueOnce(Response.json({...projectMetadata, ...patch}));
    await expect(readGitLabProjectTokenEvidence(projectProof, {signal: new AbortController().signal, fetchImpl}))
      .rejects.toThrow(/^gitlab_project_token_unavailable$/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  },
);

it.each([{projectId: "42/group"}, {verifierToken: "fixture-project"}, {verifierToken: ""}])(
  "refuses an invalid project ID or verifier before either request %j", async patch => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(readGitLabProjectTokenEvidence({...projectProof, ...patch}, {signal: new AbortController().signal, fetchImpl}))
      .rejects.toThrow(/^gitlab_project_token_unavailable$/);
    expect(fetchImpl).not.toHaveBeenCalled();
  },
);
