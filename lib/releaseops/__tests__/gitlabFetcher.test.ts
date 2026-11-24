import {expect, it, vi} from "vitest";
import {createGitLabFetcher} from "../gitlabFetcher";

const project = {id: "9007199254740993", owner: "example/team", name: "service"};
const at = "2026-11-23T01:00:00Z";
const sha = "a".repeat(40);
const web_url = "https://gitlab.com/example/team/service/-/pipelines/17";

function reader(fetchImpl: typeof fetch, expiresAt = Date.now() + 60_000) {
  return createGitLabFetcher({project, token: "synthetic-token", expiresAt, fetchImpl});
}

it("binds the three read endpoints and the supplied token to the approved project", async () => {
  const transport = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json([{
      iid: 2, title: "Sample review", state: "opened", source_branch: "feature",
      target_branch: "main", sha, author: {username: "sample"}, web_url,
    }]))
    .mockResolvedValueOnce(Response.json([{tag_name: "v1.0.0", commit: {id: sha}, released_at: at}]))
    .mockResolvedValueOnce(Response.json([{id: 17, sha, status: "success", web_url}]));
  const client = reader(transport);
  expect(await client.listMergeRequests(project, {state: "opened"})).toMatchObject([{iid: 2, sha}]);
  expect(await client.listReleases(project, {})).toMatchObject([{tag_name: "v1.0.0", commit: {id: sha}}]);
  expect(await client.listPipelines(project, {})).toMatchObject([{id: 17, sha}]);
  const urls = transport.mock.calls.map(([url]) => new URL(String(url)));
  expect(urls.map(url => url.pathname)).toEqual(["merge_requests", "releases", "pipelines"]
    .map(endpoint => `/api/v4/projects/9007199254740993/${endpoint}`));
  expect(urls[0].searchParams.get("state")).toBe("opened");
  expect(urls.every(url => url.origin === "https://gitlab.com")).toBe(true);
  for (const [, init] of transport.mock.calls) {
    expect(init).toMatchObject({
      method: "GET", redirect: "error", credentials: "omit", cache: "no-store",
      headers: {"PRIVATE-TOKEN": "synthetic-token"},
    });
  }
});

it("refuses an expired permission or a different project before transport", async () => {
  const transport = vi.fn<typeof fetch>();
  expect(() => createGitLabFetcher({project, token: "", expiresAt: Date.now() + 10_000, fetchImpl: transport}))
    .toThrow("gitlab_read_configuration_invalid");
  expect(() => createGitLabFetcher({
    project: {...project, id: "example%2Fteam%2Fservice"},
    token: "synthetic-token", expiresAt: Date.now() + 10_000, fetchImpl: transport,
  })).toThrow("gitlab_read_configuration_invalid");
  await expect(reader(transport, Date.now()).listReleases(project, {})).rejects.toThrow("gitlab_read_not_authorized");
  await expect(reader(transport).listReleases({owner: "other", name: "service"}, {})).rejects.toThrow("gitlab_read_not_authorized");
  await expect(reader(transport).listReleases(project, {perPage: 101})).rejects.toThrow("gitlab_read_not_authorized");
  expect(transport).not.toHaveBeenCalled();
});

it.each([
  new Headers({"x-next-page": "2"}),
  new Headers({link: '<https://gitlab.com/api/v4/projects/5/releases?page=2>; rel="next"'}),
])("refuses incomplete evidence from a paginated response", async (headers) => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json([], {headers}));
  await expect(reader(transport).listReleases(project, {})).rejects.toThrow("gitlab_read_incomplete");
  expect(transport).toHaveBeenCalledTimes(1);
});

it("refuses a full page when continuation metadata is missing", async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json([{tag_name: "v1.0.0", commit: {id: sha}, released_at: at}]));
  await expect(reader(transport).listReleases(project, {perPage: 1})).rejects.toThrow("gitlab_read_incomplete");
});

it.each([
  () => new Response("synthetic provider diagnostic", {status: 403}),
  () => new Response("synthetic provider diagnostic", {status: 302}),
  () => new Response("[]", {headers: {"content-type": "application/json", "content-length": "1048577"}}),
  () => new Response(" ".repeat(1048577), {headers: {"content-type": "application/json"}}),
  () => Response.json([{tag_name: "unresolved", released_at: at}]),
])("returns a fixed error for a refused, oversized, or malformed response", async makeResponse => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(makeResponse());
  await expect(reader(transport).listReleases(project, {})).rejects.toThrow(/^gitlab_read_unavailable$/);
});

it("stops a pending response at the grant deadline", async () => {
  const transport = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
  await expect(reader(transport, Date.now() + 150).listReleases(project, {})).rejects.toThrow(/^gitlab_read_unavailable$/);
  expect(transport).toHaveBeenCalledTimes(1);
});
