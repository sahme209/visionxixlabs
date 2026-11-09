/**
 * Change impact preview kernel (A13). Pure and deterministic.
 *
 * Given the file paths a change touches (from a PR, an agent's plan or the
 * gateway), classify the areas it affects, estimate its blast radius, and say
 * what a reviewer should check and whether a clean rollback is likely. This is
 * a path-based heuristic, not program analysis: it reads names, never content,
 * and says so in every result.
 */

export const IMPACT_AREAS = ["database_migration", "ci_cd", "auth_security", "infrastructure", "dependencies", "secrets_config", "api_contract", "frontend", "tests", "docs", "application"] as const;
export type ImpactArea = (typeof IMPACT_AREAS)[number];
export type BlastRadius = "contained" | "moderate" | "wide";

interface Rule { area: ImpactArea; test: (p: string) => boolean; weight: number; check: string; rollbackRisk: boolean }
const lower = (p: string) => p.toLowerCase();
const RULES: readonly Rule[] = [
  { area: "database_migration", weight: 5, rollbackRisk: true, check: "Confirm the migration is additive or has a tested down path, and that a backup exists.", test: (p) => /(^|\/)(migrations?|migrate)(\/|$)|\.sql$|schema\.prisma$|alembic\//.test(lower(p)) },
  { area: "ci_cd", weight: 4, rollbackRisk: false, check: "Pipeline changes can bypass other checks; review who can trigger and what runs with which secrets.", test: (p) => /^\.github\/workflows\/|^\.gitlab-ci|jenkinsfile|^\.circleci\/|azure-pipelines|buildkite/.test(lower(p)) },
  { area: "auth_security", weight: 5, rollbackRisk: false, check: "Have a second reviewer check authentication, authorization and token handling; add negative tests.", test: (p) => /(^|\/)(auth|security|permissions?|rbac|session|oauth|crypto|credential|vault)[^/]*(\/|\.|$)/.test(lower(p)) },
  { area: "infrastructure", weight: 4, rollbackRisk: true, check: "Review the plan output; cloud resource changes may not roll back cleanly (data, IPs, deletions).", test: (p) => /\.tf$|\.tfvars$|(^|\/)(terraform|infra|k8s|kubernetes|helm|charts)\/|dockerfile$|docker-compose|\.bicep$|cloudformation|serverless\.ya?ml$/.test(lower(p)) },
  { area: "dependencies", weight: 3, rollbackRisk: false, check: "Check new packages for licence, maintenance and known vulnerabilities; review lockfile churn.", test: (p) => /(^|\/)(package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|requirements[^/]*\.txt|pyproject\.toml|poetry\.lock|go\.(mod|sum)|cargo\.(toml|lock)|gemfile(\.lock)?|pom\.xml|build\.gradle)$/.test(lower(p)) },
  { area: "secrets_config", weight: 5, rollbackRisk: false, check: "Make sure no secret values are committed; rotate anything that may have leaked.", test: (p) => /(^|\/)\.env(\.|$)|secrets?[^/]*\.(ya?ml|json)$|\.pem$|\.key$|credentials/.test(lower(p)) },
  { area: "api_contract", weight: 3, rollbackRisk: false, check: "Check for breaking API changes and update clients and SDKs together.", test: (p) => /(^|\/)api\/|openapi|swagger|\.proto$|graphql|(^|\/)sdk\//.test(lower(p)) },
  { area: "tests", weight: 0, rollbackRisk: false, check: "", test: (p) => /(^|\/)(__tests__|tests?|spec)\/|\.(test|spec)\.[a-z]+$/.test(lower(p)) },
  { area: "docs", weight: 0, rollbackRisk: false, check: "", test: (p) => /\.(md|mdx|txt)$|(^|\/)docs\//.test(lower(p)) },
  { area: "frontend", weight: 1, rollbackRisk: false, check: "Check the affected pages visually on desktop and mobile.", test: (p) => /\.(tsx|jsx|vue|svelte|css|scss)$/.test(lower(p)) },
];

export interface ImpactPreview {
  files: number; areas: { area: ImpactArea; files: number }[]; blastRadius: BlastRadius; score: number;
  rollback: "likely_clean" | "needs_plan"; checks: string[]; testsTouched: boolean; limits: string[];
}

export function previewImpact(paths: readonly string[]): ImpactPreview {
  const clean = [...new Set(paths.filter((p) => typeof p === "string" && p.length > 0 && p.length <= 400).map((p) => p.replace(/^\.?\//, "")))].slice(0, 5000);
  const counts = new Map<ImpactArea, number>();
  let score = 0; let rollbackRisk = false; const checks = new Set<string>();
  for (const p of clean) {
    const matched = RULES.filter((r) => r.test(p));
    const areas = matched.length ? matched : [{ area: "application" as ImpactArea, weight: 1, rollbackRisk: false, check: "", test: () => true }];
    for (const r of areas) {
      counts.set(r.area, (counts.get(r.area) ?? 0) + 1);
      if (r.check) checks.add(r.check);
      if (r.rollbackRisk) rollbackRisk = true;
    }
    score += Math.max(...areas.map((r) => r.weight));
  }
  const sensitive = [...counts.keys()].filter((a) => !["tests", "docs", "frontend", "application"].includes(a)).length;
  const testsTouched = counts.has("tests");
  const blastRadius: BlastRadius = sensitive >= 3 || score >= 40 || clean.length > 100 ? "wide" : sensitive >= 1 || score >= 10 || clean.length > 20 ? "moderate" : "contained";
  if (!testsTouched && clean.some((p) => !/\.(md|mdx|txt)$/.test(lower(p)))) checks.add("No test files changed. Ask for tests that cover the change.");
  return {
    files: clean.length,
    areas: [...counts.entries()].map(([area, files]) => ({ area, files })).sort((a, b) => IMPACT_AREAS.indexOf(a.area) - IMPACT_AREAS.indexOf(b.area)),
    blastRadius, score, rollback: rollbackRisk ? "needs_plan" : "likely_clean", checks: [...checks], testsTouched,
    limits: ["Based on file paths only, not file contents or runtime dependencies.", "A contained result does not prove a change is safe."],
  };
}
