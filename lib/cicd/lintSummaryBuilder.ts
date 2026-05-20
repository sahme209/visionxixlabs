/**
 * Pure CI lint-summary builder.
 *
 * Folds raw eslint/tsc/biome-style messages from a CI run into a
 * grouped operator-readable summary: counts by severity, top
 * offending files, top offending rules. Pure / deterministic.
 *
 * No file I/O — caller passes the parsed messages.
 */

export type LintSeverity = "info" | "warning" | "error";

export interface LintMessage {
  file: string;
  rule: string;
  severity: LintSeverity;
  message: string;
}

export interface FileGroup {
  file: string;
  errors: number;
  warnings: number;
  info: number;
  total: number;
}

export interface RuleGroup {
  rule: string;
  count: number;
  worstSeverity: LintSeverity;
}

export interface LintSummary {
  totals: { info: number; warning: number; error: number; total: number };
  topFiles: FileGroup[];      // sorted by errors desc, then total desc, capped at 20
  topRules: RuleGroup[];      // sorted by count desc, capped at 20
  verdict: "clean" | "minor" | "blocking";
}

const sevRank: Record<LintSeverity, number> = { info: 0, warning: 1, error: 2 };

export function buildLintSummary(messages: readonly LintMessage[]): LintSummary {
  const totals = { info: 0, warning: 0, error: 0, total: 0 };
  const perFile = new Map<string, FileGroup>();
  const perRule = new Map<string, RuleGroup>();

  for (const m of messages) {
    totals[m.severity] += 1;
    totals.total += 1;

    const f = perFile.get(m.file) ?? { file: m.file, errors: 0, warnings: 0, info: 0, total: 0 };
    if (m.severity === "error") f.errors += 1;
    else if (m.severity === "warning") f.warnings += 1;
    else f.info += 1;
    f.total += 1;
    perFile.set(m.file, f);

    const r = perRule.get(m.rule) ?? { rule: m.rule, count: 0, worstSeverity: "info" };
    r.count += 1;
    if (sevRank[m.severity] > sevRank[r.worstSeverity]) r.worstSeverity = m.severity;
    perRule.set(m.rule, r);
  }

  const topFiles = [...perFile.values()]
    .sort((a, b) => (b.errors - a.errors) || (b.total - a.total))
    .slice(0, 20);

  const topRules = [...perRule.values()]
    .sort((a, b) => (b.count - a.count) || (sevRank[b.worstSeverity] - sevRank[a.worstSeverity]))
    .slice(0, 20);

  const verdict: LintSummary["verdict"] =
    totals.error > 0 ? "blocking"
    : totals.warning > 0 ? "minor"
    : "clean";

  return { totals, topFiles, topRules, verdict };
}
