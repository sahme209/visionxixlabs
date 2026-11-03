/**
 * GitHub write client — Phase 388.
 *
 * Uses the GitHub Git Data API to:
 *   1. Fetch the base commit's tree (so we can layer changes on top).
 *   2. For each changed file, fetch the existing blob content (so the
 *      patch applier has a base to work against).
 *   3. PUT blobs for each new file content.
 *   4. POST a tree referencing the new blobs.
 *   5. POST a commit pointing at the tree, with the base commit as
 *      its parent.
 *   6. PATCH a new branch ref to point at the commit (creates the
 *      branch on GitHub).
 *   7. POST a pull request from the new branch to the base branch.
 *
 * Requires an explicit tenant installation token with contents/PR write
 * scope on the target repo. Missing token → returns
 * `no_token` and makes no network request.
 *
 * Closed-union failure reasons. Never throws out of the module.
 */

import "server-only";
import { readBoundedGithubBody, withGithubAbort } from "@/lib/connectors/github/boundedGithubRead";

const GH_API = "https://api.github.com";
const FETCH_TIMEOUT_MS = 15_000;

interface GhHeaders {
  Accept: string;
  "User-Agent": string;
  Authorization?: string;
  "X-GitHub-Api-Version": string;
  "Content-Type"?: string;
}

function buildHeaders(installationToken: string, json = false): GhHeaders {
  const h: GhHeaders = {
    Accept: "application/vnd.github+json",
    "User-Agent": "visionxixlabs-ai-coding-loop",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  h.Authorization = `Bearer ${installationToken}`;
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function githubFetch(installationToken: string, path: string, init?: { method?: string; body?: unknown;beforeFetch?:()=>void;signal?:AbortSignal }): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const finalSignal=init?.signal?AbortSignal.any([init.signal,controller.signal]):controller.signal;
    const url=`${GH_API}${path}`,requestInit:RequestInit={
      method: init?.method ?? "GET",
      headers: buildHeaders(installationToken, init?.body !== undefined) as unknown as Record<string, string>,
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: finalSignal,
      redirect: "error",
      credentials: "omit",
    };
    finalSignal.throwIfAborted();init?.beforeFetch?.();finalSignal.throwIfAborted();
    const response=await withGithubAbort(fetch(url,requestInit),finalSignal);
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      return new Response(null, {status: response.status});
    }
    const bytes = await readBoundedGithubBody(response, finalSignal, 1048576);
    return new Response(new Uint8Array(bytes).buffer, {status: response.status, headers: {"content-type":"application/json"}});
  } finally {
    clearTimeout(t);
  }
}

export interface FileChange {
  path: string;
  /** New content. null = file deleted. */
  content: string | null;
}

export type OpenPRFailReason =
  | "file_mode_unavailable"
  | "authority_changed"
  | "base_identity_required"
  | "base_changed"
  | "no_token"
  | "branch_not_found"
  | "blob_fetch_failed"
  | "blob_write_failed"
  | "tree_write_failed"
  | "commit_write_failed"
  | "branch_create_failed"
  | "pull_request_create_failed"
  | "network_error";

export interface OpenPRInput {
  lifecycle?:import("./codingOutboundDrain").CodingOutboundLifecycle;
  resolveReadToken?:()=>Promise<{ok:boolean;token?:string}>;
  /** Server-resolved workspace/repository-scoped installation authority. */
  resolveToken: () => Promise<{ok:true;token:string}|{ok:false;error:string}>;
  owner: string;
  repo: string;
  baseBranch: string;
  /** Immutable commit used for patch application; moving branches cannot substitute it. */
  expectedBaseSha: string;
  newBranch: string;
  files: ReadonlyArray<FileChange>;
  commitMessage: string;
  prTitle: string;
  prBody: string;
}

export type OpenPRResult =
  | { ok: true; prUrl: string; prNumber: number; headSha: string }
  | { ok: false; reason: OpenPRFailReason; detail: string; writeMayHaveOccurred: boolean };

/**
 * Fetch the raw text content of a file at the given ref. Returns null
 * when the file doesn't exist (404). Returns "<binary>" when the file
 * is not UTF-8 — the patch applier can't handle binaries today; the
 * executor refuses such patches upstream.
 */
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string,
  installationToken?: string,
): Promise<{ ok: true; content: string | null } | { ok: false; reason: "fetch_failed" | "binary"; detail: string }> {
  if (!installationToken) return { ok: false, reason: "fetch_failed", detail: "Scoped GitHub connection required." };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await withGithubAbort(fetch(`${GH_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`, {
      headers: buildHeaders(installationToken) as unknown as Record<string,string>, signal: controller.signal, redirect: "error", credentials: "omit",
    }), controller.signal);
    if (!r.ok || r.redirected) {
      void r.body?.cancel().catch(() => {});
      if(r.status===404 && !r.redirected)return {ok:true,content:null};
      return {ok:false,reason:"fetch_failed",detail:"contents unavailable"};
    }
    const bytes=await readBoundedGithubBody(r,controller.signal,786432);
    const body=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)) as {content?:unknown;encoding?:unknown};
    if(body.encoding!=="base64" || typeof body.content!=="string")return {ok:false,reason:"binary",detail:"non-base64 encoding"};
    const encoded=body.content.replace(/[\r\n]/g,"");
    if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))return {ok:false,reason:"binary",detail:"invalid base64"};
    const decoded=Buffer.from(encoded,"base64");
    if(decoded.length>524288 || decoded.toString("base64")!==encoded)return {ok:false,reason:"binary",detail:"file bytes unavailable"};
    const content=new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(decoded);
    if(content.includes("\0"))return {ok:false,reason:"binary",detail:"binary file"};
    return {ok:true,content};
  } catch {
    return {ok:false,reason:"fetch_failed",detail:"file read unavailable"};
  } finally { clearTimeout(timer); }
}

export async function openPullRequest(input: OpenPRInput): Promise<OpenPRResult> {
  let writeMayHaveOccurred = false, authorityChanged = false;
  const failed = (reason: OpenPRFailReason, detail: string): OpenPRResult => ({ok:false,reason:authorityChanged?"authority_changed":reason,detail:authorityChanged?"Captured GitHub connection is no longer available.":detail,writeMayHaveOccurred});
  if (typeof input.resolveToken !== "function") {
    return failed("no_token", "Scoped GitHub connection required.");
  }
  if (!/^[a-f0-9]{40}$/.test(input.expectedBaseSha ?? "")) return failed("base_identity_required", "A verified base commit is required.");
  let effectIndex=0;
  const ghFetch = async (path: string, init?: Parameters<typeof githubFetch>[2]) => {
    const write=Boolean(init?.method&&init.method!=='GET');
    let authority:{ok:boolean;token?:string};
    try{authority=input.lifecycle?(write?await input.lifecycle.credential(input.resolveToken):await input.resolveReadToken!()):await input.resolveToken()}catch{authorityChanged=true;throw Error('authority_changed')}
    if(!authority.ok||!authority.token){authorityChanged=true;throw Error('authority_changed')}
    if(!input.lifecycle){if(write)writeMayHaveOccurred=true;return githubFetch(authority.token,path,init)}
    if(!write)return githubFetch(authority.token,path,{...init,signal:input.lifecycle.signal});
    const hooks=await input.lifecycle.beforeEffect({index:effectIndex++,method:'POST',path,body:init?.body});
    const response=await githubFetch(authority.token,path,{...init,signal:input.lifecycle.signal,beforeFetch:()=>{hooks.beforeFetch();writeMayHaveOccurred=true}});
    if(response.ok)await hooks.recordReceipt(await response.clone().json());return response;
  };

  // 1. Resolve base branch HEAD.
  let baseSha: string;
  try {
    const r = await ghFetch(`/repos/${input.owner}/${input.repo}/git/ref/heads/${encodeURIComponent(input.baseBranch)}`);
    if (r.status === 404) return failed("branch_not_found", `base branch ${input.baseBranch} not found`);
    if (!r.ok) return failed("branch_not_found", `base ref GET ${r.status}`);
    const body = await r.json() as { object?: { sha?: string } };
    if (typeof body.object?.sha !== "string") return failed("branch_not_found", "no sha on base ref");
    if (body.object.sha !== input.expectedBaseSha) return failed("base_changed", "The base branch moved after repository review. Re-read and review before retrying.");
    baseSha = input.expectedBaseSha;
  } catch {
    return failed("network_error", "could not resolve base branch");
  }

  // 2. Resolve base tree sha.
  let baseTreeSha: string;
  try {
    const r = await ghFetch(`/repos/${input.owner}/${input.repo}/git/commits/${baseSha}`);
    if (!r.ok) return failed("branch_not_found", `base commit GET ${r.status}`);
    const body = await r.json() as { tree?: { sha?: string } };
    if (typeof body.tree?.sha !== "string") return failed("branch_not_found", "no tree sha on base commit");
    baseTreeSha = body.tree.sha;
  } catch {
    return failed("network_error", "could not resolve base tree");
  }

  // The reviewed commit binds modes as well as bytes. Traverse only its
  // immutable, non-recursive trees; never infer absence from truncated data.
  type GitEntry = {path:string;mode:string;type:string;sha:string};
  const trees = new Map<string, GitEntry[]>();
  const modes = new Map<string, "100644" | "100755">();
  try {
    for (const file of input.files) {
      const segments=file.path.split("/");
      if(segments.length>32 || segments.some(segment=>!segment || segment==="." || segment===".." || /[\\\x00-\x1f\x7f]/.test(segment)) || modes.has(file.path))return failed("file_mode_unavailable","Unsafe or duplicate file path.");
      let treeSha=baseTreeSha, existing:GitEntry|undefined;
      for(let index=0;index<segments.length;index++){
        let entries=trees.get(treeSha);
        if(!entries){
          const response=await ghFetch(`/repos/${input.owner}/${input.repo}/git/trees/${encodeURIComponent(treeSha)}`);
          if(!response.ok)return failed("file_mode_unavailable","Reviewed file metadata is unavailable.");
          const body=await response.json() as {truncated?:unknown;tree?:unknown};
          if(body.truncated!==false || !Array.isArray(body.tree))return failed("file_mode_unavailable","Complete reviewed tree metadata required.");
          entries=body.tree as GitEntry[];
          if(entries.some(entry=>!entry || typeof entry.path!=="string" || typeof entry.mode!=="string" || typeof entry.type!=="string" || typeof entry.sha!=="string") || new Set(entries.map(entry=>entry.path)).size!==entries.length)return failed("file_mode_unavailable","Invalid reviewed tree metadata.");
          trees.set(treeSha,entries);
        }
        existing=entries.find(entry=>entry.path===segments[index]);
        if(!existing)break;
        if(index<segments.length-1){
          if(existing.type!=="tree" || existing.mode!=="040000")return failed("file_mode_unavailable","A parent path is not a regular directory.");
          treeSha=existing.sha;
        }
      }
      if(existing && (existing.type!=="blob" || !["100644","100755"].includes(existing.mode)))return failed("file_mode_unavailable","Symlinks, submodules and non-regular files require a separate reviewed workflow.");
      if(!existing && file.content===null)return failed("file_mode_unavailable","A deleted file is absent from the reviewed tree.");
      modes.set(file.path,existing?.mode==="100755"?"100755":"100644");
    }
  }catch{return failed("file_mode_unavailable","Could not verify reviewed file modes.");}

  await input.lifecycle?.initialize({commitSha:baseSha,treeSha:baseTreeSha,modes:input.files.map(f=>({path:f.path,mode:modes.get(f.path)!}))});

  // 3. Build tree entries — POST blobs for each non-null content; for
  //    deleted files use { sha: null } in the tree entry which tells
  //    GitHub to remove the path.
  type TreeEntry =
    | { path: string; mode: "100644" | "100755"; type: "blob"; sha: string }
    | { path: string; mode: "100644" | "100755"; type: "blob"; sha: null };
  const treeEntries: TreeEntry[] = [];

  for (const f of input.files) {
    if (f.content === null) {
      treeEntries.push({ path: f.path, mode: modes.get(f.path)!, type: "blob", sha: null });
      continue;
    }
    try {
      const r = await ghFetch(`/repos/${input.owner}/${input.repo}/git/blobs`, {
        method: "POST",
        body: {
          content: Buffer.from(f.content, "utf-8").toString("base64"),
          encoding: "base64",
        },
      });
      if (!r.ok) return failed("blob_write_failed", `blob POST ${r.status} for ${f.path}`);
      const body = await r.json() as { sha?: string };
      if (typeof body.sha !== "string") return failed("blob_write_failed", `no sha on blob response for ${f.path}`);
      treeEntries.push({ path: f.path, mode: modes.get(f.path)!, type: "blob", sha: body.sha });
    } catch {
      return failed("network_error", `blob POST network for ${f.path}`);
    }
  }

  // 4. POST tree referencing the new blobs on top of the base tree.
  let newTreeSha: string;
  try {
    const r = await ghFetch(`/repos/${input.owner}/${input.repo}/git/trees`, {
      method: "POST",
      body: {
        base_tree: baseTreeSha,
        tree: treeEntries,
      },
    });
    if (!r.ok) return failed("tree_write_failed", `tree POST ${r.status}`);
    const body = await r.json() as { sha?: string };
    if (typeof body.sha !== "string") return failed("tree_write_failed", "no sha on tree response");
    newTreeSha = body.sha;
  } catch {
    return failed("network_error", "tree POST network");
  }

  // 5. POST commit pointing at the new tree.
  let newCommitSha: string;
  try {
    const r = await ghFetch(`/repos/${input.owner}/${input.repo}/git/commits`, {
      method: "POST",
      body: {
        message: input.commitMessage,
        tree: newTreeSha,
        parents: [baseSha],
      },
    });
    if (!r.ok) return failed("commit_write_failed", `commit POST ${r.status}`);
    const body = await r.json() as { sha?: string };
    if (typeof body.sha !== "string") return failed("commit_write_failed", "no sha on commit response");
    newCommitSha = body.sha;
  } catch {
    return failed("network_error", "commit POST network");
  }

  // 6. POST new branch ref pointing at the commit.
  try {
    const r = await ghFetch(`/repos/${input.owner}/${input.repo}/git/refs`, {
      method: "POST",
      body: {
        ref: `refs/heads/${input.newBranch}`,
        sha: newCommitSha,
      },
    });
    if (!r.ok) return failed("branch_create_failed", `ref POST ${r.status}`);
  } catch {
    return failed("network_error", "branch ref POST network");
  }

  // 7. POST pull request.
  try {
    const r = await ghFetch(`/repos/${input.owner}/${input.repo}/pulls`, {
      method: "POST",
      body: {
        title: input.prTitle,
        body: input.prBody,
        head: input.newBranch,
        base: input.baseBranch,
      },
    });
    if (!r.ok) return failed("pull_request_create_failed", `pulls POST ${r.status}`);
    const body = await r.json() as { html_url?: string; number?: number };
    if (typeof body.html_url !== "string" || typeof body.number !== "number") {
      return failed("pull_request_create_failed", "no html_url or number on PR response");
    }
    await input.lifecycle?.complete();
    return { ok: true, prUrl: body.html_url, prNumber: body.number, headSha: newCommitSha };
  } catch {
    return failed("network_error", "pulls POST network");
  }
}
