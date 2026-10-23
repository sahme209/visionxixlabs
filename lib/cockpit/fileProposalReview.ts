export interface FileProposalReview { repository: string; branch: string; message: string; files: {path: string; before: string; after: string; baseSha: string | null}[] }
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : null;
export function fileProposalReview(tool: string, args: Record<string, unknown>): FileProposalReview | null {
  if (tool !== "commit_github_file" && tool !== "commit_github_files") return null;
  const review = record(args._review);
  if (!review || typeof args.repositoryFullName !== "string" || !args.repositoryFullName || typeof args.branch !== "string" || !args.branch) return null;
  if (review.kind !== (tool === "commit_github_file" ? "github_file" : "github_files")) return null;
  const proposed = tool === "commit_github_file" ? [{path:args.path,content:args.content}] : args.files;
  const snapshots = tool === "commit_github_file" && review.kind === "github_file" ? [{...review,path:args.path}] : review.kind === "github_files" ? review.files : null;
  if (!Array.isArray(proposed) || !Array.isArray(snapshots) || !proposed.length || proposed.length > 20 || snapshots.length !== proposed.length) return null;
  const files: FileProposalReview["files"] = [];
  let total = 0;
  for (const raw of proposed) {
    const file = record(raw);
    if (!file || typeof file.path !== "string" || !file.path || typeof file.content !== "string" || files.some(prior => prior.path === file.path)) return null;
    const matches = snapshots.map(record).filter(snapshot => snapshot?.path === file.path);
    const snapshot = matches[0];
    if (matches.length !== 1 || !snapshot || typeof snapshot.baseContent !== "string" || (snapshot.baseSha !== null && typeof snapshot.baseSha !== "string")) return null;
    if (snapshot.baseSha === null && snapshot.baseContent !== "") return null;
    total += snapshot.baseContent.length + file.content.length;
    if (total > 2_000_000) return null;
    files.push({path:file.path,before:snapshot.baseContent,after:file.content,baseSha:snapshot.baseSha as string|null});
  }
  return { repository:args.repositoryFullName,branch:args.branch,message:typeof args.message === "string" ? args.message : "",files };
}
