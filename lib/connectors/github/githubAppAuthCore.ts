import "server-only";
import { createHash } from "node:crypto";
import { signJwt } from "./githubAppJwt";
import { readBoundedGithubBody, withGithubAbort } from "./boundedGithubRead";
export interface InstallationTokenResult {
  ok: true;
  token: string;
  installationId: number;
  expiresAt: number;
}
export interface InstallationTokenError {
  ok: false;
  errorCode: string;
  message: string;
}
export interface GithubAppInstallationMetadata {
  installationId:string;appId:number;accountId:string;accountLogin:string;
  accountType:'User'|'Organization';repositorySelection:'all'|'selected';suspended:false;observedAt:string;
}
export type InstallationTokenOutcome = InstallationTokenResult | InstallationTokenError;
export type GithubReadPermissionProfile = "provenance_read" | "contents_read" | "pull_requests_read";
export interface GithubAppAuthDependencies {
 getGithubConfig(): Promise<{appConfigured:boolean;appId:number|null|undefined;installationId?:number|null}>;
 resolveGithubAppPrivateKey(): Promise<string|null>;
 fetch: typeof fetch;
 now: () => number;
 strict?: boolean;
 resolveSigningConfiguration?: () => Promise<{appConfigured:boolean;appId:number;privateKey:string;installationId?:number}>;
}
/** Internal implementation; trusted composition supplies dependencies once. */
export function createGithubAppAuthCore(dependencies: GithubAppAuthDependencies) {
 const { getGithubConfig, resolveGithubAppPrivateKey, fetch, now } = dependencies;
const GITHUB_API = "https://api.github.com";
const TOKEN_REFRESH_BUFFER_MS = 5 * 60_000; // Refresh installation tokens 5 min before expiry.
const MAX_CACHED_INSTALLATION_TOKENS = 128;

// ---------------------------------------------------------------------------
// JWT signing (RS256 — GitHub requires it)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Installation token caching
// ---------------------------------------------------------------------------

interface CachedInstallationToken {
  token: string;
  expiresAt: number;
  installationId: number;
  scopeKey: string;
}

const cachedByScope = new Map<string, CachedInstallationToken>();
let cacheEpoch = 0;

function tokenIsFresh(c: CachedInstallationToken | undefined): boolean {
  if (!c) return false;
  return c.expiresAt - now() > TOKEN_REFRESH_BUFFER_MS;
}

/**
 * A release request can name a distinct repository scope, so cache keys are
 * intentionally high-cardinality. Keep the process-local cache bounded and
 * remove tokens that are no longer valid before adding another one.
 */
function pruneInstallationTokenCache(at = now()): void {
  for (const [key, cached] of cachedByScope) {
    if (cached.expiresAt - at <= TOKEN_REFRESH_BUFFER_MS) cachedByScope.delete(key);
  }
  if (cachedByScope.size < MAX_CACHED_INSTALLATION_TOKENS) return;

  let oldestKey: string | undefined;
  let oldestExpiry = Number.POSITIVE_INFINITY;
  for (const [key, cached] of cachedByScope) {
    if (cached.expiresAt < oldestExpiry) {
      oldestKey = key;
      oldestExpiry = cached.expiresAt;
    }
  }
  if (oldestKey) cachedByScope.delete(oldestKey);
}

// ---------------------------------------------------------------------------
// Public entry — resolve a usable installation token
// ---------------------------------------------------------------------------







const REPOSITORY_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;

function normalizeRepositoryScope(repositories: readonly string[] | undefined): string[] | null {
  if (repositories === undefined) return [];
  const normalized = [...new Set(repositories.map((name) => name.trim().toLowerCase()))].sort();
  if (normalized.length === 0 || normalized.length > 500 || normalized.some((name) => !REPOSITORY_NAME.test(name))) return null;
  return normalized;
}

/**
 * Mints an installation token. Callers that already know the exact repository
 * scope must provide it, which asks GitHub for a token restricted to only
 * those repositories. Unscoped calls remain for legacy read paths and are
 * deliberately cached separately from every narrowed token.
 */


async function resolveGithubInstallationToken(
  input: { installationId?: number; repositories?: readonly string[]; signal?: AbortSignal; permissionProfile?: GithubReadPermissionProfile } = {},
): Promise<InstallationTokenOutcome> {
  const startedEpoch = cacheEpoch;
  const cancelled = (): InstallationTokenError => ({ ok: false, errorCode: "github.app_token_cancelled", message: "Installation token deadline expired." });
  if (input.signal?.aborted) return cancelled();
  const signing = dependencies.resolveSigningConfiguration ? await withGithubAbort(dependencies.resolveSigningConfiguration(), input.signal!) : undefined;
  const cfg = signing ?? await (dependencies.strict && input.signal ? withGithubAbort(getGithubConfig(), input.signal) : getGithubConfig());
  if (input.signal?.aborted) return cancelled();
  if (!cfg.appConfigured || !cfg.appId) {
    return { ok: false, errorCode: "github.app_not_configured", message: "GITHUB_APP_ID + GITHUB_PRIVATE_KEY required for App auth." };
  }
  const installationId = input.installationId ?? cfg.installationId;
  if (!installationId || !Number.isSafeInteger(installationId) || installationId < 1) {
    return { ok: false, errorCode: "github.app_no_installation", message: "GITHUB_INSTALLATION_ID required to mint an installation access token." };
  }
  const repositories = normalizeRepositoryScope(input.repositories);
  if (!repositories) {
    return { ok: false, errorCode: "github.app_invalid_repository_scope", message: "Repository-scoped installation tokens require 1–500 valid repository names." };
  }
  if (input.permissionProfile !== undefined && (!["provenance_read", "contents_read", "pull_requests_read"].includes(input.permissionProfile) || input.installationId === undefined || repositories.length !== 1))
    return { ok: false, errorCode: "github.app_invalid_read_profile", message: "The reader requires an explicit installation and one repository." };
  const scopeKey = `${signing ? createHash("sha256").update(`${signing.appId}:${signing.privateKey}`).digest("hex") : ""}${installationId}:${repositories.length ? repositories.join("\u0000") : "*"}${input.permissionProfile ? `:${input.permissionProfile}` : ""}`;

  const cached = cachedByScope.get(scopeKey);
  if (cached && tokenIsFresh(cached)) {
    return { ok: true, token: cached.token, installationId: cached.installationId, expiresAt: cached.expiresAt };
  }
  pruneInstallationTokenCache();

  const privateKey = signing?.privateKey ?? await (dependencies.strict && input.signal ? withGithubAbort(resolveGithubAppPrivateKey(), input.signal) : resolveGithubAppPrivateKey());
  if (input.signal?.aborted) return cancelled();
  if (!privateKey) {
    return { ok: false, errorCode: "github.app_no_key", message: "GITHUB_PRIVATE_KEY not present on the host." };
  }

  let appJwt: string;
  try {
    appJwt = signJwt(cfg.appId, privateKey, now);
  } catch (err) {
    return {
      ok: false,
      errorCode: "github.app_jwt_sign_failed",
      message: `Could not sign App JWT: ${redact(err)}`,
    };
  }

  try {
    const signal = input.signal ? AbortSignal.any([input.signal, AbortSignal.timeout(8_000)]) : input.permissionProfile ? AbortSignal.timeout(8_000) : undefined;
    const request = fetch(`${GITHUB_API}/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "axiom-agent/1.0",
      },
      body: repositories.length ? JSON.stringify({ repositories, ...(input.permissionProfile ? { permissions: input.permissionProfile === "contents_read" ? {contents:"read"} : input.permissionProfile === "pull_requests_read" ? {pull_requests:"read"} : { contents: "read", actions: "read", attestations: "read" } } : {}) }) : undefined,
      ...(signal ? { signal, redirect: "error" as const, credentials: "omit" as const, cache: "no-store" as const } : {}),
    });
    const res = signal ? await withGithubAbort(request, signal) : await request;
    if (dependencies.strict && (res.status !== 201 || res.redirected || res.url && res.url !== `${GITHUB_API}/app/installations/${installationId}/access_tokens`)) { void res.body?.cancel().catch(() => {}); return {ok:false,errorCode:"github.app_token_malformed",message:"Unexpected token response."}; }
    if (signal && !res.ok) void res.body?.cancel().catch(() => {});
    if (res.status === 401) {
      return { ok: false, errorCode: "github.app_jwt_rejected", message: "GitHub rejected the App JWT (401). Verify GITHUB_APP_ID + GITHUB_PRIVATE_KEY match." };
    }
    if (res.status === 404) {
      return { ok: false, errorCode: "github.app_installation_not_found", message: "Installation id not found for this App." };
    }
    if (!res.ok) {
      return { ok: false, errorCode: "github.app_token_failed", message: `GitHub returned HTTP ${res.status}.` };
    }
    const body = (signal
      ? JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await readBoundedGithubBody(res, signal, 64 * 1024)))
      : await res.json().catch(() => undefined)) as { token?: string; expires_at?: string; permissions?: unknown; repositories?: unknown; repository_selection?: unknown } | undefined;
    if (!body?.token || !body?.expires_at || dependencies.strict && (typeof body.token !== "string" || body.token.length > 4096 || /[\s\x00-\x1f\x7f]/.test(body.token))) {
      return { ok: false, errorCode: "github.app_token_malformed", message: "GitHub returned no token / expiry." };
    }
    if (input.permissionProfile) {
      const grants = body.permissions;
      const requiredPermissions = input.permissionProfile === "contents_read" ? ["contents"] : input.permissionProfile === "pull_requests_read" ? ["pull_requests"] : ["contents", "actions", "attestations"];
      const names = Array.isArray(body.repositories) ? body.repositories.map(value => value && typeof value === "object" && "name" in value && typeof value.name === "string" ? value.name.toLowerCase() : null) : [];
      if (!grants || typeof grants !== "object" || Array.isArray(grants)
        || !requiredPermissions.every(key => (grants as Record<string, unknown>)[key] === "read")
        || Object.entries(grants).some(([key, value]) => ![...requiredPermissions, "metadata"].includes(key) || value !== "read")
        || body.repository_selection !== "selected" || names.length !== 1 || names[0] !== repositories[0])
        return { ok: false, errorCode: "github.app_read_scope_unverified", message: "GitHub did not grant the exact repository read profile." };
    }
    const expiresAt = Date.parse(body.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt - now() <= TOKEN_REFRESH_BUFFER_MS) {
      return { ok: false, errorCode: "github.app_token_malformed", message: "GitHub returned an invalid or near-expiry installation token." };
    }
    const nextCached: CachedInstallationToken = {
      token: body.token,
      expiresAt,
      installationId,
      scopeKey,
    };
    if (dependencies.strict && (startedEpoch !== cacheEpoch || input.signal?.aborted)) return cancelled();
    cachedByScope.set(scopeKey, nextCached);
    return { ok: true, token: nextCached.token, installationId: nextCached.installationId, expiresAt: nextCached.expiresAt };
  } catch (err) {
    return { ok: false, errorCode: "github.app_token_network", message: `Network error: ${redact(err)}` };
  }
}

/** Test seam — drop the cache so a subsequent call re-mints. */
function clearInstallationTokenCache(): void {
  cacheEpoch++;
  cachedByScope.clear();
}

/**
 * Drop every cached token scope for one installation. Call this when an
 * installation is suspended or revoked — without it, a cached token stays
 * usable for up to TOKEN_REFRESH_BUFFER_MS past the status change (GitHub
 * installation tokens live up to ~1h; the cache only refreshes 5 min before
 * expiry), so a "revoked" installation could still serve live API calls
 * for most of that window.
 */
function purgeInstallationTokenCache(installationId: number): void {
  cacheEpoch++;
  for (const [key, cached] of cachedByScope) {
    if (cached.installationId === installationId) cachedByScope.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function redact(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/-----BEGIN [A-Z ]+-----[\s\S]+?-----END [A-Z ]+-----/g, "-----PRIVATE KEY REDACTED-----");
}


/** Read one existing App installation. No installation token is minted or returned. */
async function readGithubAppInstallation(installationId:string,callerSignal:AbortSignal):Promise<GithubAppInstallationMetadata>{
  const unavailable=()=>new Error('github_installation_verification_unavailable');
  const signal=AbortSignal.any([callerSignal,AbortSignal.timeout(8000)]),deadline=now()+8000;
  const guard=()=>{signal.throwIfAborted();if(now()>=deadline)throw unavailable()};
  if(!/^[1-9][0-9]{0,15}$/.test(installationId)||!Number.isSafeInteger(Number(installationId)))throw unavailable();
  let received:Response|undefined;
  try{
    guard();
    const signing=dependencies.resolveSigningConfiguration ? await withGithubAbort(dependencies.resolveSigningConfiguration(),signal) : undefined;
    const cfg=signing ?? await withGithubAbort(getGithubConfig(),signal);
    guard();if(!cfg.appConfigured||!cfg.appId||!Number.isSafeInteger(cfg.appId)||cfg.appId<1)throw unavailable();
    const key=signing?.privateKey ?? await withGithubAbort(resolveGithubAppPrivateKey(),signal);guard();if(!key)throw unavailable();
    const jwt=signJwt(cfg.appId,key,now);guard();
    const pending=fetch(`${GITHUB_API}/app/installations/${installationId}`,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{Authorization:`Bearer ${jwt}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'axiom-agent/1.0'}});
    void pending.then(response=>{if(signal.aborted||now()>=deadline)void response.body?.cancel().catch(()=>{})},()=>{});
    const response=await withGithubAbort(pending,signal);received=response;
    guard();if(!response.ok){void response.body?.cancel().catch(()=>{});throw unavailable()}
    const bytes=await readBoundedGithubBody(response,signal,65536);
    const data:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));guard();
    if(!data||typeof data!=='object'||Array.isArray(data))throw unavailable();const v=data as Record<string,unknown>,account=v.account;
    if(String(v.id)!==installationId||v.app_id!==cfg.appId||v.suspended_at!==null||!['all','selected'].includes(v.repository_selection as string)||!account||typeof account!=='object'||Array.isArray(account))throw unavailable();
    const a=account as Record<string,unknown>;
    if(!Number.isSafeInteger(a.id)||Number(a.id)<1||typeof a.login!=='string'||!/^[A-Za-z0-9][A-Za-z0-9-]{0,99}$/.test(a.login)||!['User','Organization'].includes(a.type as string))throw unavailable();
    return {installationId,appId:cfg.appId,accountId:String(a.id),accountLogin:a.login,accountType:a.type as 'User'|'Organization',repositorySelection:v.repository_selection as 'all'|'selected',suspended:false,observedAt:new Date(now()).toISOString()};
  }catch{throw unavailable()}finally{void received?.body?.cancel().catch(()=>{})}
}


return Object.freeze({resolveGithubInstallationToken,readGithubAppInstallation,clearInstallationTokenCache,purgeInstallationTokenCache});
}
