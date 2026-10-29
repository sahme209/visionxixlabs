import { createHash } from "node:crypto";
import { parseRepoRef } from "./parseRepoRef";
import { parseUnifiedDiff, type FileChangeKind } from "./parseUnifiedDiff";
import { applyDiff } from "./applyUnifiedDiff";
import { isSensitiveRepositoryEvidencePath } from "@/lib/axiom/agentRuntime/repositoryEvidencePolicy";

export interface CodingArtifactInput {
  organizationId: string;
  runId: string;
  proposalStageRunId: string;
  readStageRunId: string;
  repositoryFullName: string;
  baseBranch: string;
  baseCommitSha: string;
  patchText: string;
  baseFiles: Array<{path: string; content: string | null}>;
}
export interface CodingArtifact extends Omit<CodingArtifactInput, "baseFiles"> {
  schema: 1;
  files: Array<{path: string; kind: FileChangeKind; before: string | null; after: string | null}>;
}
export type CodingArtifactResult = {ok:true;artifact:CodingArtifact;digest:string} | {ok:false;error:"coding_artifact_invalid"};
const utf8RoundTrips = (value: string): boolean => Buffer.from(value,"utf8").toString("utf8") === value;
const invalid = (): CodingArtifactResult => ({ok:false,error:"coding_artifact_invalid"});
export function isSafeCodingArtifactPath(path: string): boolean {
  return path.length > 0 && path.length <= 1024 && utf8RoundTrips(path) && !/[\\:\x00-\x1f\x7f]/.test(path)
    && path.split("/").every(segment => segment !== "" && segment !== "." && segment !== "..")
    && !isSensitiveRepositoryEvidencePath(path);
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return "{" + Object.keys(value).sort().map(key => JSON.stringify(key)+":"+canonical((value as Record<string,unknown>)[key])).join(",") + "}";
}
function digestOf(artifact: CodingArtifact): string { return createHash("sha256").update(canonical(artifact)).digest("hex"); }
/** Content identity only. Construction or a matching digest grants no execution authority. */
export function buildCodingArtifact(input: CodingArtifactInput): CodingArtifactResult {
  try {
    const {organizationId,runId,proposalStageRunId,readStageRunId,repositoryFullName,baseBranch,baseCommitSha,patchText}=input;
    if (![organizationId,runId,proposalStageRunId,readStageRunId].every(v=>typeof v === "string" && v.length>0 && v.length<=256 && utf8RoundTrips(v))) return invalid();
    if (typeof repositoryFullName!=="string" || !parseRepoRef(repositoryFullName) || typeof baseBranch!=="string" || !baseBranch.trim() || !utf8RoundTrips(baseBranch) || baseBranch.length>256 || /[\x00-\x1f\x7f]/.test(baseBranch) || !/^[a-f0-9]{40}$/.test(baseCommitSha??"")) return invalid();
    if (typeof patchText!=="string" || !utf8RoundTrips(patchText) || Buffer.byteLength(patchText,"utf8")>262144 || !Array.isArray(input.baseFiles) || input.baseFiles.length>20) return invalid();
    const parsed=parseUnifiedDiff(patchText);if(!parsed.ok || parsed.files.length===0 || parsed.files.length>20) return invalid();
    const observations=new Map<string,string|null>();
    for(const file of input.baseFiles){
      if (!file || typeof file.path!=="string" || !isSafeCodingArtifactPath(file.path) || observations.has(file.path) || (file.content!==null && (typeof file.content!=="string" || !utf8RoundTrips(file.content)))) return invalid();
      observations.set(file.path,file.content);
    }
    if(observations.size!==parsed.files.length)return invalid();
    const files:CodingArtifact["files"]=[];const seen=new Set<string>();let bytes=0;
    for(const diff of parsed.files){
      if(!isSafeCodingArtifactPath(diff.path) || seen.has(diff.path) || !observations.has(diff.path))return invalid();seen.add(diff.path);
      const before=observations.get(diff.path)!;
      if(diff.changeKind==="added" ? before!==null : before===null)return invalid();
      const applied=applyDiff({diff,baseContent:before});if(!applied.ok)return invalid();
      const after=applied.entry.newContent;bytes+=Buffer.byteLength(before??"","utf8")+Buffer.byteLength(after??"","utf8");if(bytes>1048576)return invalid();
      files.push({path:diff.path,kind:diff.changeKind,before,after});
    }
    files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
    const artifact:CodingArtifact={schema:1,organizationId,runId,proposalStageRunId,readStageRunId,repositoryFullName,baseBranch,baseCommitSha,patchText,files};
    files.forEach(Object.freeze);Object.freeze(files);Object.freeze(artifact);
    return {ok:true,artifact,digest:digestOf(artifact)};
  }catch{return invalid();}
}
/** Rebuild derived bytes and compare the full canonical record; JSON key order is irrelevant. */
export function verifyCodingArtifact(candidate: unknown, digest: string, binding: {organizationId:string;runId:string}): boolean {
  try {
    if(!candidate || typeof candidate!=="object" || !/^[a-f0-9]{64}$/.test(digest))return false;
    const a=candidate as CodingArtifact;
    if(a.schema!==1 || a.organizationId!==binding.organizationId || a.runId!==binding.runId || !Array.isArray(a.files))return false;
    const built=buildCodingArtifact({...a,baseFiles:a.files.map(file=>({path:file.path,content:file.before}))});
    return built.ok && canonical(a)===canonical(built.artifact) && built.digest===digest;
  }catch{return false;}
}

export function codingApprovalDigest(action: unknown): string | null {
  return typeof action === "string" ? /^pipeline_stage:ai_coding:code_gate:([a-f0-9]{64})$/.exec(action)?.[1] ?? null : null;
}
export function isCodingApprovalAction(action: unknown): boolean {
  return typeof action === "string" && /^pipeline_stage:ai_coding:code_gate(?::|$)/.test(action);
}
