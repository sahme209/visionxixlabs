import "server-only";
import {z} from "zod";
import {readBoundedGithubBody, withGithubAbort} from "@/lib/connectors/github/boundedGithubRead";

const GITLAB_API = "https://gitlab.com/api/v4";
const TOKEN_SELF_URL = `${GITLAB_API}/personal_access_tokens/self`;
const MAX_TOKEN_METADATA_BYTES = 32_768;
const MAX_TOKEN_METADATA_MS = 5_000;

const tokenMetadata = z.object({
  id: z.number().int().positive().safe(),
  user_id: z.number().int().positive().safe(),
  active: z.literal(true),
  revoked: z.literal(false),
  scopes: z.tuple([z.literal("read_api")]),
  expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  granular_scopes: z.tuple([]).nullish(),
});

interface ReadOptions {
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
}

function validToken(token: string): boolean {
  return typeof token === "string" && /^[!-~]{1,4096}$/.test(token);
}

async function readGitLabJson(url: string, token: string, signal: AbortSignal, fetchImpl: typeof fetch) {
  signal.throwIfAborted();
  const response = await withGithubAbort(fetchImpl(url, {
    method: "GET",
    headers: {Accept: "application/json", "PRIVATE-TOKEN": token},
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
    signal,
  }).then(result => {
    if (signal.aborted) void result.body?.cancel().catch(() => {});
    return result;
  }), signal);
  if (response.status !== 200 || response.redirected || (response.url && response.url !== url)
    || response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    void response.body?.cancel().catch(() => {});
    throw new Error();
  }

  const bytes = await readBoundedGithubBody(response, signal, MAX_TOKEN_METADATA_BYTES);
  return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes)) as unknown;
}

async function readTokenMetadata(url: string, token: string, signal: AbortSignal, fetchImpl: typeof fetch) {
  const metadata = tokenMetadata.parse(await readGitLabJson(url, token, signal, fetchImpl));
  const expiry = new Date(metadata.expires_at + "T00:00:00Z");
  const expiresAt = expiry.getTime();
  if (!Number.isFinite(expiresAt) || expiry.toISOString().slice(0, 10) !== metadata.expires_at || expiresAt <= Date.now()) {
    throw new Error();
  }
  signal.throwIfAborted();
  return Object.freeze({tokenId: String(metadata.id), userId: String(metadata.user_id), expiresAt});
}

/** Self-information can establish scope and expiry for the presented token. */
export async function readGitLabTokenScopeEvidence(
  token: string,
  {signal: parent, fetchImpl = globalThis.fetch}: ReadOptions,
): Promise<Readonly<{tokenId: string; userId: string; expiresAt: number}>> {
  const signal = AbortSignal.any([parent, AbortSignal.timeout(MAX_TOKEN_METADATA_MS)]);
  try {
    if (!validToken(token)) throw new Error();
    return await readTokenMetadata(TOKEN_SELF_URL, token, signal, fetchImpl);
  } catch {
    throw new Error("gitlab_token_scope_unavailable");
  }
}

/** Staged setup check. The authenticated caller must bind the numeric project
 * and authorize a one-time metadata lookup. The verifier credential is only
 * used for that lookup and never returned or persisted by this reader. */
export async function readGitLabProjectTokenEvidence(
  input: {projectId: string; projectPath: string; projectToken: string; verifierToken: string},
  {signal: parent, fetchImpl = globalThis.fetch}: ReadOptions,
): Promise<Readonly<{projectId: string; tokenId: string; userId: string; expiresAt: number}>> {
  const {projectId, projectPath, projectToken, verifierToken} = input;
  const signal = AbortSignal.any([parent, AbortSignal.timeout(MAX_TOKEN_METADATA_MS)]);
  try {
    if (typeof projectId !== "string" || !/^[1-9][0-9]{0,19}$/.test(projectId)
      || typeof projectPath !== "string" || projectPath.length > 768 || !projectPath.includes("/")
      || !projectPath.split("/").every(segment => /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(segment))
      || !validToken(projectToken) || !validToken(verifierToken) || projectToken === verifierToken) throw new Error();

    const self = await readTokenMetadata(TOKEN_SELF_URL, projectToken, signal, fetchImpl);
    const project = z.object({id: z.number().int().positive().safe(), path_with_namespace: z.string()})
      .parse(await readGitLabJson(`${GITLAB_API}/projects/${projectId}`, projectToken, signal, fetchImpl));
    if (String(project.id) !== projectId || project.path_with_namespace !== projectPath) throw new Error();
    const resource = await readTokenMetadata(
      `${GITLAB_API}/projects/${projectId}/access_tokens/${self.tokenId}`, verifierToken, signal, fetchImpl,
    );
    if (resource.tokenId !== self.tokenId || resource.userId !== self.userId || resource.expiresAt !== self.expiresAt) {
      throw new Error();
    }
    return Object.freeze({projectId, ...self});
  } catch {
    throw new Error("gitlab_project_token_unavailable");
  }
}
