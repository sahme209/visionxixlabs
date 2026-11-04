export interface RepoRef {
  owner: string;
  repo: string;
}

/** Splits "owner/repo" into its parts. Returns null for anything else. */
export function parseRepositoryFullName(fullName: string): RepoRef | null {
  const parts = fullName.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const safeName = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;
  if (!safeName.test(parts[0]) || !safeName.test(parts[1])) return null;
  return { owner: parts[0], repo: parts[1] };
}
