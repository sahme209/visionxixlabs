/**
 * Product honesty scanner.
 *
 * Lightweight content scanner that flags phrases in source files which
 * could mislead users about the platform's current state — e.g. "AWS
 * connected" rendered when no connector record exists, "applied" on a
 * preview-only path, "autonomous execution" without governance gates,
 * "book a call" as the primary CTA.
 *
 * The scanner reads file contents from a curated allow-list — it does not
 * walk arbitrary directories, and it never reads `.env` / credentials.
 *
 * Server-only. Pure read-only. Safe to run from any route.
 */

import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type HonestyRisk = "low" | "medium" | "high";

export interface HonestyFinding {
  id: string;
  title: string;
  file: string;
  line: number;
  snippet: string;
  severity: HonestyRisk;
  suggestion: string;
}

interface ScanRule {
  id: string;
  /** Anchor on word boundaries so we don't false-positive inside imports / urls. */
  pattern: RegExp;
  severity: HonestyRisk;
  title: string;
  suggestion: string;
  /** Files where this rule SHOULD NOT fire (allow-list of phrases we know are honest). */
  exceptFiles?: string[];
}

// ---------------------------------------------------------------------------
// Rules — narrow + pragmatic. We add more as the team finds patterns.
// ---------------------------------------------------------------------------

const RULES: ScanRule[] = [
  {
    id: "azure_live_claim",
    pattern: /\b(Azure live|live Azure scan)\b/i,
    severity: "high",
    title: "Phrase claims Azure is live",
    suggestion: "Replace with 'Live Azure validation' (validator only) — live inventory is still preview.",
  },
  {
    id: "gcp_live_claim",
    pattern: /\b(GCP live|live GCP scan)\b/i,
    severity: "high",
    title: "Phrase claims GCP is live",
    suggestion: "Replace with 'Live GCP validation' (validator only) — live inventory is still preview.",
  },
  {
    id: "book_a_call_primary",
    pattern: /\b(book a call|schedule a demo|contact sales)\b/i,
    severity: "medium",
    title: "Sales-led phrase appears in product copy",
    suggestion: "Prefer self-serve setup + a small support link. Sales fallback at the bottom only.",
  },
  {
    id: "fix_applied_claim",
    pattern: /\b(fix applied|change applied|deployed automatically)\b/i,
    severity: "high",
    title: "Phrase implies a production mutation happened",
    suggestion: "Until execution is wired, use 'reviewed' / 'simulated' / 'pending approval' instead.",
  },
  {
    id: "autonomous_execution",
    pattern: /\bautonomous (execution|apply|deploy)\b/i,
    severity: "high",
    title: "Phrase implies unsupervised destructive autonomy",
    suggestion: "Switch to 'governed autonomy' / 'safe-task automation' — apply remains approval-gated.",
  },
  {
    id: "fully_secure",
    pattern: /\b(production-ready security|fully secure|zero risk)\b/i,
    severity: "medium",
    title: "Absolute security claim",
    suggestion: "Replace with measurable evidence (e.g. 'Passes 22 typed checks').",
  },
];

// ---------------------------------------------------------------------------
// File allow-list — curated set of product-copy surfaces to scan
// ---------------------------------------------------------------------------

const PROJECT_ROOT = process.cwd();

const SCAN_FILES = [
  // Marketing + landing copy
  "app/page.tsx",
  // Connector + product docs (high-leverage honesty surface)
  "app/docs/desktop-install/page.tsx",
  // Setup orchestrator surfaces these phrases as labels
  "lib/onboarding/selfServeSetupOrchestrator.ts",
  // Validation matrix evidence strings
  "lib/validation/platformValidationMatrix.ts",
];

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

export async function scanProductHonesty(): Promise<HonestyFinding[]> {
  const findings: HonestyFinding[] = [];

  for (const relPath of SCAN_FILES) {
    const abs = resolve(PROJECT_ROOT, relPath);
    let contents: string;
    try {
      contents = await readFile(abs, "utf8");
    } catch {
      // File doesn't exist on this deployment — skip silently.
      continue;
    }

    const lines = contents.split(/\r?\n/);
    for (const rule of RULES) {
      if (rule.exceptFiles?.includes(relPath)) continue;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = rule.pattern.exec(line);
        if (!match) continue;
        // Skip obvious comments-explaining-the-rule cases by also
        // checking the file is not the scanner itself (handled by allow-list).
        findings.push({
          id: `${rule.id}.${relPath.replace(/[^a-z0-9]/gi, "_")}.${i + 1}`,
          title: rule.title,
          file: relPath,
          line: i + 1,
          snippet: line.trim().slice(0, 160),
          severity: rule.severity,
          suggestion: rule.suggestion,
        });
      }
    }
  }

  return findings;
}

/** Convenience: filter only the high-severity hits (used by the runner). */
export function highSeverityOnly(findings: HonestyFinding[]): HonestyFinding[] {
  return findings.filter((f) => f.severity === "high");
}

/** Pure-function variant for unit tests — scans a single string instead of disk. */
export function scanStringForHonesty(file: string, contents: string): HonestyFinding[] {
  const findings: HonestyFinding[] = [];
  const lines = contents.split(/\r?\n/);
  for (const rule of RULES) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!rule.pattern.test(line)) continue;
      findings.push({
        id: `${rule.id}.test.${i + 1}`,
        title: rule.title,
        file,
        line: i + 1,
        snippet: line.trim().slice(0, 160),
        severity: rule.severity,
        suggestion: rule.suggestion,
      });
    }
  }
  return findings;
}
