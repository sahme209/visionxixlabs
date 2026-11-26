/**
 * Database change detection (pure). Recognizes common migration locations in a list of changed
 * files so a deployment can say "this commit changes the database since the last deployment here".
 * Advisory evidence: a miss is possible for custom layouts, so absence is never proof.
 */
const PATTERNS: RegExp[] = [
  /(^|\/)prisma\/migrations\//,
  /(^|\/)migrations?\/[^/]+\.(sql|py|js|ts|rb|go)$/,
  /(^|\/)db\/migrate\//,
  /(^|\/)alembic\/versions\//,
  /(^|\/)(flyway|db\/migration)\/.*V\d+.*__.*\.sql$/,
  /(^|\/)(liquibase|changelog)\/.*\.(xml|ya?ml|json|sql)$/,
  /(^|\/)supabase\/migrations\//,
  /(^|\/)drizzle\/.*\.sql$/,
];

export function migrationPaths(files: readonly string[]): string[] {
  return files.filter((f) => PATTERNS.some((p) => p.test(f))).sort();
}

export type DatabaseChangeEvidence =
  | { status: "detected"; since: string; paths: string[]; truncated: boolean }
  | { status: "none_detected"; since: string; truncated: boolean }
  | { status: "first_deployment" }
  | { status: "same_commit"; since: string }
  | { status: "unknown"; reason: string };
