/**
 * Pure GitHub release notes drafter.
 *
 * Input: a list of commits between two tags + the new version. Output:
 * a typed release-note document grouped by conventional-commit type
 * (feat / fix / docs / refactor / perf / test / chore / breaking).
 *
 * No I/O. The caller fetches commits via the GitHub REST API and hands
 * them to this kernel. The drafter's output is markdown ready for a
 * GitHub Release body — but publishing is still gated by an approval
 * packet.
 *
 * Closed unions on commit-type + breaking-change marker so future
 * conventional-commit shapes break the build.
 */

export type ConventionalCommitType =
  | "feat"
  | "fix"
  | "perf"
  | "refactor"
  | "docs"
  | "test"
  | "chore"
  | "build"
  | "ci"
  | "style"
  | "revert"
  | "unknown";

export interface Commit {
  /** Commit sha (short or long — kernel preserves what it gets). */
  sha: string;
  /** First line of the commit message. */
  subject: string;
  /** Author display name. */
  author: string;
  /** Full message — used to detect BREAKING CHANGE footer. */
  body?: string;
}

export interface ParsedCommit extends Commit {
  type: ConventionalCommitType;
  scope: string | null;
  breaking: boolean;
  /** Strip-off of type/scope prefix so the line reads cleanly. */
  cleanedSubject: string;
}

export interface ReleaseNotesInput {
  /** Version being released (e.g. "v1.7.0"). */
  newVersion: string;
  /** Previous version tag, when available. */
  previousVersion?: string;
  /** Commits since previousVersion, oldest first. */
  commits: readonly Commit[];
  /** Repo (owner/name) — used for the compare URL. */
  repo: string;
}

export interface ReleaseNotesOutput {
  /** Markdown body ready for GitHub Release. */
  markdown: string;
  /** Per-section counts for the cockpit chip strip. */
  counts: Readonly<Record<ConventionalCommitType, number>>;
  /** True when at least one BREAKING CHANGE was found. */
  hasBreakingChanges: boolean;
  /** Recommended SemVer bump based on contents. */
  recommendedBump: "major" | "minor" | "patch";
  /** Operator-readable summary line. */
  summary: string;
}

// Conventional-commit subject pattern: type(scope?)!?: subject
// Uses unnamed groups so the regex compiles under ES2017 targets
// (Vercel's TS config rejects named capture groups). Indices:
//   1 = type, 2 = scope (optional), 3 = bang (optional), 4 = rest.
const SUBJECT_PATTERN = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;

const KNOWN_TYPES: ReadonlyArray<ConventionalCommitType> = [
  "feat", "fix", "perf", "refactor", "docs", "test", "chore", "build", "ci", "style", "revert",
];

export function parseCommit(c: Commit): ParsedCommit {
  const m = SUBJECT_PATTERN.exec(c.subject);
  if (!m) {
    return {
      ...c,
      type: "unknown",
      scope: null,
      breaking: /BREAKING[\s_]CHANGE/i.test(c.body ?? ""),
      cleanedSubject: c.subject,
    };
  }
  const [, rawTypeRaw, scopeRaw, bangRaw, restRaw] = m;
  const rawType = rawTypeRaw.toLowerCase();
  const type: ConventionalCommitType = (KNOWN_TYPES as readonly string[]).includes(rawType)
    ? (rawType as ConventionalCommitType)
    : "unknown";
  const breaking = Boolean(bangRaw) || /BREAKING[\s_]CHANGE/i.test(c.body ?? "");
  return {
    ...c,
    type,
    scope: scopeRaw ?? null,
    breaking,
    cleanedSubject: restRaw,
  };
}

const SECTION_ORDER: ReadonlyArray<{ type: ConventionalCommitType; title: string }> = [
  { type: "feat",     title: "🚀 Features" },
  { type: "fix",      title: "🐛 Bug fixes" },
  { type: "perf",     title: "⚡ Performance" },
  { type: "refactor", title: "🧹 Refactoring" },
  { type: "docs",     title: "📚 Documentation" },
  { type: "test",     title: "✅ Tests" },
  { type: "build",    title: "🛠 Build" },
  { type: "ci",       title: "🤖 CI" },
  { type: "chore",    title: "🧰 Chore" },
  { type: "style",    title: "💄 Style" },
  { type: "revert",   title: "↩️  Reverts" },
  { type: "unknown",  title: "Other" },
];

function formatLine(c: ParsedCommit): string {
  const scope = c.scope ? `**${c.scope}:** ` : "";
  const shaShort = c.sha.slice(0, 7);
  const breaking = c.breaking ? "💥 " : "";
  return `- ${breaking}${scope}${c.cleanedSubject} _(${shaShort} · ${c.author})_`;
}

export function draftReleaseNotes(input: ReleaseNotesInput): ReleaseNotesOutput {
  if (!input.newVersion || !input.newVersion.trim()) {
    throw new Error("releaseNotesDrafter: newVersion is required");
  }
  if (!input.repo || !/^[\w.-]+\/[\w.-]+$/.test(input.repo)) {
    throw new Error("releaseNotesDrafter: repo must be \"owner/name\"");
  }

  const parsed = input.commits.map(parseCommit);

  const counts: Record<ConventionalCommitType, number> = {
    feat: 0, fix: 0, perf: 0, refactor: 0, docs: 0, test: 0, chore: 0,
    build: 0, ci: 0, style: 0, revert: 0, unknown: 0,
  };
  for (const c of parsed) counts[c.type] += 1;

  const hasBreakingChanges = parsed.some((c) => c.breaking);
  let recommendedBump: ReleaseNotesOutput["recommendedBump"];
  if (hasBreakingChanges) recommendedBump = "major";
  else if (counts.feat > 0) recommendedBump = "minor";
  else recommendedBump = "patch";

  // ── Markdown body assembly ───────────────────────────────────
  const lines: string[] = [];
  lines.push(`## ${input.newVersion}`);
  if (input.previousVersion) {
    lines.push("");
    lines.push(`**Compare:** [${input.previousVersion}…${input.newVersion}](https://github.com/${input.repo}/compare/${input.previousVersion}...${input.newVersion})`);
  }
  lines.push("");

  if (hasBreakingChanges) {
    lines.push("> ⚠️ **This release contains breaking changes.** Review the 💥 entries below before upgrading.");
    lines.push("");
  }

  for (const section of SECTION_ORDER) {
    const inSec = parsed.filter((c) => c.type === section.type);
    if (inSec.length === 0) continue;
    lines.push(`### ${section.title}`);
    for (const c of inSec) lines.push(formatLine(c));
    lines.push("");
  }

  if (input.commits.length === 0) {
    lines.push("_No commits between these tags._");
  }

  const summary =
    input.commits.length === 0
      ? "No commits — empty release."
      : `${input.commits.length} commits · ${counts.feat} feat · ${counts.fix} fix${hasBreakingChanges ? " · ⚠ breaking" : ""}`;

  return {
    markdown: lines.join("\n").trim(),
    counts,
    hasBreakingChanges,
    recommendedBump,
    summary,
  };
}
