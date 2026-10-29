/**
 * GitHub App authentication.
 *
 * Mints the two-stage credential GitHub Apps require:
 *
 *   1. **App JWT** — signed with the App's private key (RS256). Valid for
 *      10 minutes. Identifies "this is App #N" to GitHub.
 *   2. **Installation access token** — POST to
 *      /app/installations/{id}/access_tokens with the App JWT. Returns a
 *      short-lived (1 hour) bearer token scoped to one installation.
 *
 * The installation token is what the rest of the platform actually uses
 * to read repos / workflows / branch protection on behalf of the
 * installed organisation.
 *
 * This module caches each installation-token scope in-memory until ~5 minutes
 * before its real expiry, so we don't pay the JWT-sign + HTTP round-trip on
 * every API call. The cache is bounded and expired entries are discarded on
 * writes. A token narrowed to selected repositories never shares a cache entry
 * with an installation-wide token.
 *
 * Hard rules:
 *  - Never returns the private key or the JWT. Only the installation
 *    token is exposed to other modules.
 *  - Never logs key material — error messages strip BEGIN/END PRIVATE
 *    KEY blocks.
 *  - Server-only. Imports `node:crypto`.
 */

import "server-only";

import { createSign } from "node:crypto";
import { getGithubConfig, resolveGithubAppPrivateKey } from "./githubConfig";
import { readBoundedGithubBody, withGithubAbort } from "./boundedGithubRead";

const GITHUB_API = "https://api.github.com";
const JWT_TTL_SEC = 9 * 60;             // GitHub max is 10 min; we use 9 to allow for clock skew.
const TOKEN_REFRESH_BUFFER_MS = 5 * 60_000; // Refresh installation tokens 5 min before expiry.
const MAX_CACHED_INSTALLATION_TOKENS = 128;

// ---------------------------------------------------------------------------
// JWT signing (RS256 — GitHub requires it)
// ---------------------------------------------------------------------------

interface JwtClaims {
  iat: number;
  exp: number;
  iss: number;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function signJwt(appId: number, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims: JwtClaims = {
    iat: now - 30,           // 30s clock-skew tolerance backward.
    exp: now + JWT_TTL_SEC,
    iss: appId,
  };
  const headerB64 = base64url(JSON.stringify(header));
  const claimsB64 = base64url(JSON.stringify(claims));
  const signingInput = `${headerB64}.${claimsB64}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey);
  return `${signingInput}.${base64url(signature)}`;
}

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

function tokenIsFresh(c: CachedInstallationToken | undefined): boolean {
  if (!c) return false;
  return c.expiresAt - Date.now() > TOKEN_REFRESH_BUFFER_MS;
}

/**
 * A release request can name a distinct repository scope, so cache keys are
 * intentionally high-cardinality. Keep the process-local cache bounded and
 * remove tokens that are no longer valid before adding another one.
 */
function pruneInstallationTokenCache(now = Date.now()): void {
  for (const [key, cached] of cachedByScope) {
    if (cached.expiresAt - now <= TOKEN_REFRESH_BUFFER_MS) cachedByScope.delete(key);
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

export type InstallationTokenOutcome = InstallationTokenResult | InstallationTokenError;

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
export type GithubReadPermissionProfile = "provenance_read" | "contents_read" | "pull_requests_read";

export async function resolveGithubInstallationToken(
  input: { installationId?: number; repositories?: readonly string[]; signal?: AbortSignal; permissionProfile?: GithubReadPermissionProfile } = {},
): Promise<InstallationTokenOutcome> {
  const cancelled = (): InstallationTokenError => ({ ok: false, errorCode: "github.app_token_cancelled", message: "Installation token deadline expired." });
  if (input.signal?.aborted) return cancelled();
  const cfg = await getGithubConfig();
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
  const scopeKey = `${installationId}:${repositories.length ? repositories.join("\u0000") : "*"}${input.permissionProfile ? `:${input.permissionProfile}` : ""}`;

  const cached = cachedByScope.get(scopeKey);
  if (cached && tokenIsFresh(cached)) {
    return { ok: true, token: cached.token, installationId: cached.installationId, expiresAt: cached.expiresAt };
  }
  pruneInstallationTokenCache();

  const privateKey = await resolveGithubAppPrivateKey();
  if (input.signal?.aborted) return cancelled();
  if (!privateKey) {
    return { ok: false, errorCode: "github.app_no_key", message: "GITHUB_PRIVATE_KEY not present on the host." };
  }

  let appJwt: string;
  try {
    appJwt = signJwt(cfg.appId, privateKey);
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
    if (!body?.token || !body?.expires_at) {
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
    if (!Number.isFinite(expiresAt) || expiresAt - Date.now() <= TOKEN_REFRESH_BUFFER_MS) {
      return { ok: false, errorCode: "github.app_token_malformed", message: "GitHub returned an invalid or near-expiry installation token." };
    }
    const nextCached: CachedInstallationToken = {
      token: body.token,
      expiresAt,
      installationId,
      scopeKey,
    };
    cachedByScope.set(scopeKey, nextCached);
    return { ok: true, token: nextCached.token, installationId: nextCached.installationId, expiresAt: nextCached.expiresAt };
  } catch (err) {
    return { ok: false, errorCode: "github.app_token_network", message: `Network error: ${redact(err)}` };
  }
}

/** Test seam — drop the cache so a subsequent call re-mints. */
export function clearInstallationTokenCache(): void {
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
export function purgeInstallationTokenCache(installationId: number): void {
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

export interface GithubAppInstallationMetadata {
  installationId:string;appId:number;accountId:string;accountLogin:string;
  accountType:'User'|'Organization';repositorySelection:'all'|'selected';suspended:false;observedAt:string;
}
/** Read one existing App installation. No installation token is minted or returned. */
export async function readGithubAppInstallation(installationId:string,callerSignal:AbortSignal):Promise<GithubAppInstallationMetadata>{
  const unavailable=()=>new Error('github_installation_verification_unavailable');
  const signal=AbortSignal.any([callerSignal,AbortSignal.timeout(8000)]),deadline=Date.now()+8000;
  const guard=()=>{signal.throwIfAborted();if(Date.now()>=deadline)throw unavailable()};
  if(!/^[1-9][0-9]{0,15}$/.test(installationId)||!Number.isSafeInteger(Number(installationId)))throw unavailable();
  let received:Response|undefined;
  try{
    guard();
    const cfg=await withGithubAbort(getGithubConfig(),signal);
    guard();if(!cfg.appConfigured||!cfg.appId||!Number.isSafeInteger(cfg.appId)||cfg.appId<1)throw unavailable();
    const key=await withGithubAbort(resolveGithubAppPrivateKey(),signal);guard();if(!key)throw unavailable();
    const jwt=signJwt(cfg.appId,key);guard();
    const pending=fetch(`${GITHUB_API}/app/installations/${installationId}`,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{Authorization:`Bearer ${jwt}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'axiom-agent/1.0'}});
    void pending.then(response=>{if(signal.aborted||Date.now()>=deadline)void response.body?.cancel().catch(()=>{})},()=>{});
    const response=await withGithubAbort(pending,signal);received=response;
    guard();if(!response.ok){void response.body?.cancel().catch(()=>{});throw unavailable()}
    const bytes=await readBoundedGithubBody(response,signal,65536);
    const data:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));guard();
    if(!data||typeof data!=='object'||Array.isArray(data))throw unavailable();const v=data as Record<string,unknown>,account=v.account;
    if(String(v.id)!==installationId||v.app_id!==cfg.appId||v.suspended_at!==null||!['all','selected'].includes(v.repository_selection as string)||!account||typeof account!=='object'||Array.isArray(account))throw unavailable();
    const a=account as Record<string,unknown>;
    if(!Number.isSafeInteger(a.id)||Number(a.id)<1||typeof a.login!=='string'||!/^[A-Za-z0-9][A-Za-z0-9-]{0,99}$/.test(a.login)||!['User','Organization'].includes(a.type as string))throw unavailable();
    return {installationId,appId:cfg.appId,accountId:String(a.id),accountLogin:a.login,accountType:a.type as 'User'|'Organization',repositorySelection:v.repository_selection as 'all'|'selected',suspended:false,observedAt:new Date().toISOString()};
  }catch{throw unavailable()}finally{void received?.body?.cancel().catch(()=>{})}
}

export type ReleaseTokenPurpose = 'merge' | 'dispatch' | 'workflow_read' | 'source_policy_read' | 'merge_policy_read';
const releasePermissions = {
  merge: { contents:'write', pull_requests:'read', metadata:'read' },
  dispatch: { actions:'write', contents:'read', metadata:'read' },
  workflow_read: { actions:'read', contents:'read', metadata:'read' },
  source_policy_read: { administration:'read', contents:'read', metadata:'read' },
  merge_policy_read: { administration:'read', contents:'read', pull_requests:'read', metadata:'read' },
} as const;
/** Explicit, uncached, one-repository release token. No JWT/key is exposed, no
 * default installation or inherited permission set is accepted. Calling this
 * requires a separately installed current-actor verifier and activation gate. */
export async function resolveReleaseInstallationToken(input:{
 installationId:string;repositoryFullName:string;purpose:ReleaseTokenPurpose;
 isEnabled?:()=>boolean;assertCurrent?:()=>Promise<void>;fetch?:typeof fetch;
},callerSignal:AbortSignal):Promise<{token:string;expiresAt:number;permissions:Record<string,string>}|null>{
 if(!input.isEnabled?.()||!input.assertCurrent||!input.fetch||callerSignal.aborted)return null;
 const permissions=releasePermissions[input.purpose];
 if(!permissions||!Object.hasOwn(releasePermissions,input.purpose)||!/^[1-9]\d{0,14}$/.test(input.installationId)||!Number.isSafeInteger(Number(input.installationId))||Number(input.installationId)<1||!/^([A-Za-z0-9][A-Za-z0-9_.-]{0,99})\/([A-Za-z0-9][A-Za-z0-9_.-]{0,99})$/.test(input.repositoryFullName))return null;
 const deadline=Date.now()+8000,signal=AbortSignal.any([callerSignal,AbortSignal.timeout(8000)]);
 const guard=()=>{signal.throwIfAborted();if(!input.isEnabled?.()||Date.now()>=deadline)throw Error('release_token_unavailable')};
 const current=async()=>{guard();await withGithubAbort(input.assertCurrent!(),signal);guard()};
 let received:Response|undefined;
 try{
  await current();const cfg=await withGithubAbort(getGithubConfig(),signal);guard();
  if(!cfg.appConfigured||!cfg.appId||!Number.isSafeInteger(cfg.appId)||cfg.appId<1)return null;
  const key=await withGithubAbort(resolveGithubAppPrivateKey(),signal);guard();if(!key)return null;
  const jwt=signJwt(cfg.appId,key);await current();
  const url=`${GITHUB_API}/app/installations/${input.installationId}/access_tokens`;
  const pending=Promise.resolve().then(()=>{guard();return input.fetch!(url,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{Authorization:`Bearer ${jwt}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},body:JSON.stringify({repositories:[input.repositoryFullName.split('/')[1]],permissions})})});
  void pending.then(r=>{if(signal.aborted||Date.now()>=deadline)void r.body?.cancel().catch(()=>{})},()=>{});
  const response=await withGithubAbort(pending,signal);received=response;guard();
  if(response.status!==201||response.redirected||response.url&&response.url!==url)return null;
  const bytes=await readBoundedGithubBody(response,signal,65536);guard();
  const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const v=value as Record<string,unknown>,returned=v.permissions;
  if(typeof v.token!=='string'||!v.token||v.token.length>4096||/[\s\x00-\x1f\x7f]/.test(v.token)||typeof v.expires_at!=='string'||!returned||typeof returned!=='object'||Array.isArray(returned)||Object.keys(returned).sort().join()!==Object.keys(permissions).sort().join()||Object.entries(permissions).some(([k,p])=>(returned as Record<string,unknown>)[k]!==p)||v.repository_selection!=='selected'||!Array.isArray(v.repositories)||v.repositories.length!==1)return null;
  const repo=v.repositories[0];if(!repo||typeof repo!=='object'||repo.full_name!==input.repositoryFullName||repo.name!==input.repositoryFullName.split('/')[1]||repo.owner?.login!==input.repositoryFullName.split('/')[0])return null;
  const expiresAt=Date.parse(v.expires_at);if(!Number.isFinite(expiresAt)||expiresAt<=Date.now()+20000||expiresAt>Date.now()+65*60000)return null;
  await current();guard();return{token:v.token,expiresAt,permissions:{...permissions}};
 }catch{return null}finally{void received?.body?.cancel().catch(()=>{})}
}
