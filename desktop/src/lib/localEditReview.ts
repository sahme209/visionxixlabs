import { isSensitiveRepositoryEvidencePath } from "../../../lib/axiom/agentRuntime/repositoryEvidencePolicy";
export interface LocalEditProposal { proposalId: string; repositoryFullName: string; branch: string; path: string; baseContent: string; content: string }
export function localEditProposal(proposal: {id: string; toolName: string; argsJson: unknown}): LocalEditProposal | null {
  if (proposal.toolName !== "commit_github_file" || !proposal.argsJson || typeof proposal.argsJson !== "object") return null;
  const args = proposal.argsJson as Record<string, unknown>, review = args._review as Record<string, unknown> | undefined;
  if (!review || review.kind !== "github_file" || typeof review.baseSha !== "string" || !review.baseSha
    || typeof args.repositoryFullName !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(args.repositoryFullName)
    || typeof args.branch !== "string" || !args.branch || args.branch.length > 240
    || typeof args.path !== "string" || !args.path || args.path.length > 1024 || args.path.includes("\\") || args.path.startsWith("/") || /^[A-Za-z]:/.test(args.path)
    || /[\0\r\n]/.test(args.path) || args.path.split("/").some(part => !part || part === "." || part === "..") || isSensitiveRepositoryEvidencePath(args.path)
    || typeof args.content !== "string" || args.content.length > 100000 || typeof review.baseContent !== "string" || review.baseContent.length > 100000) return null;
  return {proposalId: proposal.id, repositoryFullName: args.repositoryFullName, branch: args.branch, path: args.path, baseContent: review.baseContent, content: args.content};
}
export function localEditBlocker(proposal: LocalEditProposal, file: {repositoryFullName: string | null; branch: string; path: string; saved: string; content: string}): string | null {
  if (file.repositoryFullName?.toLowerCase() !== proposal.repositoryFullName.toLowerCase() || file.branch !== proposal.branch || file.path !== proposal.path) return "Open the proposal's repository, branch and file before reviewing this draft.";
  if (file.content !== file.saved) return "Save or discard your existing local edits before loading an Agent draft.";
  if (file.saved !== proposal.baseContent) return "The local saved content differs from the proposal baseline. Refresh the proposal and review the difference first.";
  return null;
}
export interface LocalEditRequest { edits?: LocalEditProposal[]; edit: LocalEditProposal; context: object; workspace?: string }

/** Validate every file before exposing any part of a coordinated local review. */
export function localEditProposals(proposal: {id: string; toolName: string; argsJson: unknown}): LocalEditProposal[] {
  if (proposal.toolName === "commit_github_file") { const single = localEditProposal(proposal); return single ? [single] : []; }
  if (proposal.toolName !== "commit_github_files" || !proposal.argsJson || typeof proposal.argsJson !== "object") return [];
  const args = proposal.argsJson as Record<string, unknown>, review = args._review as Record<string, unknown> | undefined;
  if (!Array.isArray(args.files) || !args.files.length || args.files.length > 10 || !review || review.kind !== "github_files" || !Array.isArray(review.files) || review.files.length !== args.files.length) return [];
  const edits: LocalEditProposal[] = [], paths = new Set<string>();
  let proposedSize = 0, baseSize = 0;
  for (let index = 0; index < args.files.length; index++) {
    const file = args.files[index], snapshot = review.files[index];
    if (!file || typeof file !== "object" || !snapshot || typeof snapshot !== "object") return [];
    const next = file as Record<string, unknown>, base = snapshot as Record<string, unknown>;
    if (next.path !== base.path) return [];
    const edit = localEditProposal({id: proposal.id, toolName: "commit_github_file", argsJson: {repositoryFullName: args.repositoryFullName, branch: args.branch, path: next.path, content: next.content, _review: {kind: "github_file", baseSha: base.baseSha, baseContent: base.baseContent}}});
    if (!edit || paths.has(edit.path.toLowerCase())) return [];
    proposedSize += edit.content.length; baseSize += edit.baseContent.length;
    if (proposedSize > 200000 || baseSize > 200000) return [];
    paths.add(edit.path.toLowerCase()); edits.push(edit);
  }
  return edits;
}
