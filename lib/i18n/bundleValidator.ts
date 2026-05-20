/**
 * Pure i18n bundle validator.
 *
 * Given a base locale + a set of translated locales, flag:
 *   - missing keys (in base but not in target)
 *   - extra keys (in target but not in base)
 *   - placeholder mismatches ({name} present in base but missing/typo'd in target)
 *   - empty strings
 *
 * Pure / deterministic.
 */

export interface LocaleBundle {
  locale: string;
  messages: Readonly<Record<string, string>>;
}

export type FindingKind = "missing_key" | "extra_key" | "placeholder_mismatch" | "empty_string";

export interface LocaleFinding {
  locale: string;
  kind: FindingKind;
  key: string;
  detail: string;
}

export interface LocaleReport {
  locale: string;
  findings: LocaleFinding[];
  /** 0..1 coverage = base keys present + non-empty in target / base key count. */
  coverage: number;
  status: "ok" | "warn" | "incomplete";
}

export interface BundleValidationReport {
  baseLocale: string;
  baseKeyCount: number;
  locales: LocaleReport[];
  /** Overall verdict — worst per-locale status. */
  overall: "ok" | "warn" | "incomplete";
}

const PLACEHOLDER_RE = /\{[a-zA-Z_][a-zA-Z0-9_]*\}/g;

function placeholdersIn(s: string): Set<string> {
  const set = new Set<string>();
  const m = s.match(PLACEHOLDER_RE);
  if (m) for (const ph of m) set.add(ph);
  return set;
}

function equalSets(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function statusFor(coverage: number, hasPlaceholderMismatch: boolean): LocaleReport["status"] {
  if (coverage >= 1 && !hasPlaceholderMismatch) return "ok";
  if (coverage >= 0.9) return "warn";
  return "incomplete";
}

export function validateLocaleBundles(input: {
  base: LocaleBundle;
  others: readonly LocaleBundle[];
}): BundleValidationReport {
  const baseKeys = Object.keys(input.base.messages).sort();
  const baseKeyCount = baseKeys.length;

  const localeReports: LocaleReport[] = input.others.map((target) => {
    const findings: LocaleFinding[] = [];
    let presentNonEmpty = 0;
    let placeholderMismatch = false;

    for (const key of baseKeys) {
      const baseVal = input.base.messages[key];
      const targetVal = target.messages[key];

      if (targetVal === undefined) {
        findings.push({ locale: target.locale, kind: "missing_key", key, detail: "key absent in target" });
        continue;
      }
      if (targetVal.length === 0) {
        findings.push({ locale: target.locale, kind: "empty_string", key, detail: "empty translation" });
        continue;
      }
      presentNonEmpty += 1;
      const basePh = placeholdersIn(baseVal);
      const targetPh = placeholdersIn(targetVal);
      if (!equalSets(basePh, targetPh)) {
        placeholderMismatch = true;
        findings.push({
          locale: target.locale,
          kind: "placeholder_mismatch",
          key,
          detail: `base=${[...basePh].join(",") || "(none)"} target=${[...targetPh].join(",") || "(none)"}`,
        });
      }
    }

    for (const key of Object.keys(target.messages)) {
      if (!(key in input.base.messages)) {
        findings.push({ locale: target.locale, kind: "extra_key", key, detail: "key not in base — likely typo or stale" });
      }
    }

    const coverage = baseKeyCount === 0 ? 1 : presentNonEmpty / baseKeyCount;
    return {
      locale: target.locale,
      findings,
      coverage,
      status: statusFor(coverage, placeholderMismatch),
    };
  });

  const worst = localeReports.reduce<BundleValidationReport["overall"]>((acc, r) => {
    const rank: Record<LocaleReport["status"], number> = { incomplete: 0, warn: 1, ok: 2 };
    return rank[r.status] < rank[acc] ? r.status : acc;
  }, "ok");

  return {
    baseLocale: input.base.locale,
    baseKeyCount,
    locales: localeReports,
    overall: worst,
  };
}
