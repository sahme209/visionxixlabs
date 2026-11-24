import "server-only";
import {z} from "zod";
import { readBoundedGithubBody as readBoundedBody, withGithubAbort as withReadAbort } from "@/lib/connectors/github/boundedGithubRead";
import type {
  GitlabMergeRequestPayload,
  GitlabReleaseTagPayload,
  GitlabPipelinePayload,
} from "./providers/gitlabProjectors";
import type { GitLabFetcher } from "./repositorySyncResponder";

const GITLAB_ORIGIN = "https://gitlab.com";
const MAX_BODY_BYTES = 1024 * 1024;
const READ_DEADLINE_MS = 10_000;
const projectSegment = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

interface GitLabProject {
  owner: string;
  name: string;
}

export interface CreateGitLabFetcherOptions {
  /** The caller must obtain this token from a current, verified workspace grant. */
  token: string;
  expiresAt: number;
  project: GitLabProject & {id: string};
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

/** Offline-qualified single-page reader. Wiring requires separate workspace consent checks. */
export function createGitLabFetcher(options: CreateGitLabFetcherOptions): GitLabFetcher {
  const {token, expiresAt, project, fetchImpl = globalThis.fetch} = options;
  const {id: projectId, owner, name} = project;
  if (
    typeof token !== "string" || !/^[!-~]{1,4096}$/.test(token)
    || !Number.isSafeInteger(expiresAt)
    || typeof projectId !== "string" || !/^[1-9][0-9]{0,19}$/.test(projectId)
    || typeof owner !== "string" || owner.length > 512
    || !owner.split("/").every(segment => projectSegment.test(segment))
    || typeof name !== "string" || name.length > 255 || !projectSegment.test(name)
  ) throw new Error("gitlab_read_configuration_invalid");

  const incomplete = new Error("gitlab_read_incomplete");
  const cancel = (response: Response) => { void response.body?.cancel().catch(() => {}); };

  async function glGet<T>(repo: GitLabProject, endpoint: string, perPage: number, query: URLSearchParams, schema: z.ZodType<T>): Promise<T[]> {
    const remaining = expiresAt - Date.now();
    if (repo.owner !== owner || repo.name !== name || remaining <= 0
      || !Number.isSafeInteger(perPage) || perPage < 1 || perPage > 100) {
      throw new Error("gitlab_read_not_authorized");
    }
    const deadline = AbortSignal.timeout(Math.min(remaining, READ_DEADLINE_MS));
    const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
    const url = new URL(`/api/v4/projects/${projectId}/${endpoint}`, GITLAB_ORIGIN);
    query.set("per_page", String(perPage));
    url.search = query.toString();

    try {
      signal.throwIfAborted();
      const response = await withReadAbort(fetchImpl(url, {
        method: "GET",
        headers: { Accept: "application/json", "PRIVATE-TOKEN": token },
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal,
      }).then(result => {
        if (signal.aborted) cancel(result);
        return result;
      }), signal);

      if (response.status !== 200 || response.redirected
        || response.headers.get("content-type")?.split(";")[0]?.toLowerCase() !== "application/json") {
        cancel(response);
        throw new Error("gitlab_read_unavailable");
      }
      if (response.headers.get("x-next-page")?.trim()
        || /rel\s*=\s*"?next\b/i.test(response.headers.get("link") ?? "")) {
        cancel(response);
        throw incomplete;
      }

      const bytes = await readBoundedBody(response, signal, MAX_BODY_BYTES);
      if (expiresAt <= Date.now()) throw new Error("gitlab_read_not_authorized");
      const items: unknown = JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes));
      if (!Array.isArray(items) || items.length > perPage) {
        throw new Error("gitlab_read_unavailable");
      }
      // GitLab.com can omit pagination headers. A full page without an explicit
      // terminal indicator cannot establish that the result is complete.
      if (items.length === perPage && !response.headers.has("x-next-page")) {
        throw incomplete;
      }
      return items.map(item => schema.parse(item));
    } catch (error) {
      // Provider bodies, transport errors and parser diagnostics stay private.
      if (error === incomplete) throw error;
      throw new Error("gitlab_read_unavailable");
    }
  }

  return {
    async listMergeRequests(repo, {perPage = 100, state = "all"}) {
      if (!["opened", "closed", "merged", "all"].includes(state)) {
        throw new Error("gitlab_read_not_authorized");
      }
      const items = await glGet<RawMrRow>(repo, "merge_requests", perPage,
        new URLSearchParams({state, order_by: "updated_at", sort: "desc"}), mrRow);
      return items.map(mapRawMr);
    },
    async listReleases(repo, {perPage = 100}) {
      const items = await glGet<RawReleaseRow>(repo, "releases", perPage, new URLSearchParams(), releaseRow);
      return items.map(mapRawRelease);
    },
    async listPipelines(repo, {perPage = 100}) {
      const items = await glGet<RawPipelineRow>(repo, "pipelines", perPage,
        new URLSearchParams({order_by: "updated_at", sort: "desc"}), pipelineRow);
      return items.map(mapRawPipeline);
    },
  };
}

/* ──────────────────────────────────────────────────────────────────
   Raw row shapes — narrow projections of the GitLab REST responses.
   ────────────────────────────────────────────────────────────── */

const pipelineStatus = z.enum([
  "created", "waiting_for_resource", "preparing", "pending", "running",
  "success", "failed", "canceled", "skipped", "manual", "scheduled",
]);
const providerUser = z.object({username: z.string().min(1)});
const commitSha = z.string().regex(/^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/);
const timestamp = z.string().refine(value => Number.isFinite(Date.parse(value)));
const projectWebUrl = z.string().url().refine(value => {
  const url = new URL(value);
  return url.origin === GITLAB_ORIGIN && !url.username && !url.password;
});
const mrRow = z.object({
  iid: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().nullish(),
  state: z.enum(["opened", "closed", "merged", "locked"]),
  source_branch: z.string().min(1),
  target_branch: z.string().min(1),
  sha: commitSha,
  merged_at: timestamp.nullish(),
  merged_by: providerUser.nullish(),
  author: providerUser,
  web_url: projectWebUrl,
  labels: z.array(z.string()).optional(),
  head_pipeline: z.object({status: pipelineStatus}).nullish(),
});
type RawMrRow = z.infer<typeof mrRow>;

function mapRawMr(r: RawMrRow): GitlabMergeRequestPayload {
  return {
    iid: r.iid,
    title: r.title,
    description: r.description,
    state: r.state,
    source_branch: r.source_branch,
    target_branch: r.target_branch,
    sha: r.sha,
    merged_at: r.merged_at,
    merged_by: r.merged_by,
    author: r.author,
    web_url: r.web_url,
    labels: r.labels ?? [],
    headPipelineStatus: r.head_pipeline?.status ?? null,
    // approvalsRequiredCount / approvalsObservedCount / codeownersApproved
    // need /approvals or /approval_rules round-trips — left as defaults
    // for now (the projector falls back gracefully).
  };
}

const releaseRow = z.object({
  tag_name: z.string().min(1),
  commit: z.object({id: commitSha}),
  released_at: timestamp.nullish(),
  created_at: timestamp.optional(),
  description: z.string().nullish(),
  author: providerUser.nullish(),
}).refine(row => Boolean(row.released_at ?? row.created_at));
type RawReleaseRow = z.infer<typeof releaseRow>;

function mapRawRelease(r: RawReleaseRow): GitlabReleaseTagPayload {
  return {
    tag_name: r.tag_name,
    commit: r.commit,
    released_at: r.released_at ?? null,
    ...(r.created_at !== undefined ? { created_at: r.created_at } : {}),
    description: r.description ?? null,
    author: r.author ?? null,
  };
}

const pipelineRow = z.object({
  id: z.number().int().positive(),
  ref: z.string().nullish(),
  sha: commitSha,
  status: pipelineStatus,
  name: z.string().nullish(),
  created_at: timestamp.nullish(),
  started_at: timestamp.nullish(),
  finished_at: timestamp.nullish(),
  web_url: projectWebUrl,
});
type RawPipelineRow = z.infer<typeof pipelineRow>;

function mapRawPipeline(r: RawPipelineRow): GitlabPipelinePayload {
  return {
    id: r.id,
    ref: r.ref,
    sha: r.sha,
    status: r.status,
    ...(typeof r.name === "string" ? { pipelineName: r.name } : {}),
    ...(typeof r.created_at === "string" ? { created_at: r.created_at } : {}),
    started_at: r.started_at,
    finished_at: r.finished_at ?? null,
    web_url: r.web_url,
  };
}
