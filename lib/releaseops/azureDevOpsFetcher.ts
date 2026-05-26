/**
 * Phase 474 — minimal Azure DevOps REST fetcher.
 *
 * Authenticates with a PAT via Basic auth: base64(":{pat}") — the
 * username is intentionally empty, that's the ADO convention.
 *
 * ADO's REST API is rooted at dev.azure.com/{org}/{project}/_apis/...
 * The orchestrator passes a parsed AzureDevOpsRepoLocator so each
 * fetch is a single, deterministic HTTP call.
 */

import type {
  AdoPullRequestPayload,
  AdoReleaseTagPayload,
  AdoPipelineRunPayload,
} from "./providers/azureDevOpsProjectors";
import type {
  AzureDevOpsFetcher,
  AzureDevOpsRepoLocator,
} from "./repositorySyncResponder";

const API_VERSION = "7.1";

export interface CreateAzureDevOpsFetcherOptions {
  /** Personal access token. Falls back to process.env.AZURE_DEVOPS_PAT. */
  pat?: string;
  /** Base URL override for on-prem Azure DevOps Server. Defaults to
   *  https://dev.azure.com. */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function createAzureDevOpsFetcher(opts: CreateAzureDevOpsFetcherOptions = {}): AzureDevOpsFetcher {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  async function adoGet<T>(path: string): Promise<T> {
    const pat = opts.pat ?? process.env.AZURE_DEVOPS_PAT;
    if (!pat) throw new Error("AZURE_DEVOPS_PAT not configured");
    const base = (opts.baseUrl ?? "https://dev.azure.com").replace(/\/$/, "");
    const auth = base64(`:${pat}`);
    const url = `${base}${path}${path.includes("?") ? "&" : "?"}api-version=${API_VERSION}`;
    const r = await fetchImpl(url, {
      headers: {
        "Accept": "application/json",
        "Authorization": `Basic ${auth}`,
      },
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Azure DevOps ${r.status} ${path}: ${text.slice(0, 200)}`);
    }
    return (await r.json()) as T;
  }

  function projectPath(locator: AzureDevOpsRepoLocator): string {
    return `/${encodeURIComponent(locator.org)}/${encodeURIComponent(locator.project)}`;
  }

  return {
    async listPullRequests(locator, listOpts) {
      const top = listOpts.top ?? 100;
      const status = listOpts.status ?? "all";
      const resp = await adoGet<{ value?: RawAdoPr[] }>(
        `${projectPath(locator)}/_apis/git/repositories/${encodeURIComponent(locator.repo)}/pullrequests?$top=${top}&searchCriteria.status=${status}`,
      );
      const base = `https://dev.azure.com/${encodeURIComponent(locator.org)}/${encodeURIComponent(locator.project)}/_git/${encodeURIComponent(locator.repo)}/pullrequest`;
      return (resp.value ?? []).map((r) => mapRawAdoPr(r, base));
    },
    async listReleases(locator, listOpts) {
      // ADO has no first-class "release" entity for the git-tag use case.
      // We approximate by listing annotated tag refs under refs/tags/*.
      const top = listOpts.top ?? 100;
      const resp = await adoGet<{ value?: RawTagRef[] }>(
        `${projectPath(locator)}/_apis/git/repositories/${encodeURIComponent(locator.repo)}/refs?filter=tags/&$top=${top}`,
      );
      return (resp.value ?? []).map(mapRawTagRef);
    },
    async listPipelineRuns(locator, listOpts) {
      const top = listOpts.top ?? 100;
      // Pipelines API isn't list-runs across-pipelines in one call —
      // use Builds API which is the union of all pipeline runs.
      const resp = await adoGet<{ value?: RawAdoBuild[] }>(
        `${projectPath(locator)}/_apis/build/builds?$top=${top}&queryOrder=finishTimeDescending&repositoryType=TfsGit&repositoryId=${encodeURIComponent(locator.repo)}`,
      );
      return (resp.value ?? []).map(mapRawAdoBuild);
    },
  };
}

/* ──────────────────────────────────────────────────────────────────
   Raw row shapes.
   ────────────────────────────────────────────────────────────── */

interface RawAdoPr {
  pullRequestId: number;
  title: string;
  description: string | null;
  status: "active" | "abandoned" | "completed";
  isDraft?: boolean;
  sourceRefName: string;
  targetRefName: string;
  lastMergeSourceCommit?: { commitId: string } | null;
  lastMergeCommit?: { commitId: string } | null;
  closedDate?: string | null;
  closedBy?: { uniqueName?: string; displayName?: string } | null;
  createdBy: { uniqueName?: string; displayName?: string };
  labels?: ReadonlyArray<{ name: string }>;
}

function mapRawAdoPr(r: RawAdoPr, webBaseUrl: string): AdoPullRequestPayload {
  return {
    pullRequestId: r.pullRequestId,
    title: r.title,
    description: r.description,
    status: r.status,
    ...(r.isDraft !== undefined ? { isDraft: r.isDraft } : {}),
    sourceRefName: r.sourceRefName,
    targetRefName: r.targetRefName,
    // Some abandoned PRs don't carry lastMergeSourceCommit — fall back
    // to lastMergeCommit so the upsert still has a sha (the row column
    // is required by the schema).
    lastMergeSourceCommit: { commitId: r.lastMergeSourceCommit?.commitId ?? r.lastMergeCommit?.commitId ?? "" },
    closedDate: r.closedDate,
    closedBy: r.closedBy,
    createdBy: r.createdBy,
    labels: r.labels ?? [],
    webUrl: `${webBaseUrl}/${r.pullRequestId}`,
  };
}

interface RawTagRef {
  /** refs/tags/{tag} */
  name: string;
  objectId: string;
  /** Object that this ref points at — for annotated tags it's the tag
   *  object, for lightweight tags it's the commit directly. We use
   *  objectId as the resolved sha; for annotated tags this would need
   *  a second /annotatedTags/{id} round-trip but the projector
   *  tolerates the approximation. */
  peeledObjectId?: string;
}

function mapRawTagRef(r: RawTagRef): AdoReleaseTagPayload {
  const tagName = r.name.replace(/^refs\/tags\//, "");
  return {
    tagName,
    resolvedCommitSha: r.peeledObjectId ?? r.objectId,
  };
}

interface RawAdoBuild {
  id: number;
  buildNumber?: string;
  definition?: { name?: string | null; path?: string | null; yamlFilename?: string | null };
  status: AdoPipelineRunPayload["state"];
  result?: AdoPipelineRunPayload["result"];
  sourceBranch?: string | null;
  sourceVersion?: string | null;
  startTime?: string | null;
  finishTime?: string | null;
  _links?: { web?: { href?: string } };
}

function mapRawAdoBuild(r: RawAdoBuild): AdoPipelineRunPayload {
  const yamlPath = r.definition?.yamlFilename ?? r.definition?.path ?? undefined;
  return {
    id: r.id,
    ...(r.definition?.name !== undefined ? { name: r.definition.name } : {}),
    ...(yamlPath ? { yamlPath } : {}),
    state: r.status,
    result: r.result ?? null,
    sourceBranch: r.sourceBranch ?? null,
    sourceSha: r.sourceVersion ?? null,
    ...(r.startTime ? { createdDate: r.startTime } : {}),
    finishedDate: r.finishTime ?? null,
    webUrl: r._links?.web?.href ?? "",
  };
}

function base64(input: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(input, "utf8").toString("base64");
  // eslint-disable-next-line no-undef
  return btoa(unescape(encodeURIComponent(input)));
}
