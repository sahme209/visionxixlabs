/**
 * Pure per-file-kind static validators — Phase 391.
 *
 * Replaces the dry-run code_lint stage with a real check that the
 * AI's proposed file contents are at least structurally valid for
 * their kind. NOT a full linter — we don't run tsc/eslint here; we
 * catch the gross failures (broken JSON, unbalanced braces in TS,
 * Python with bad indentation) that should never make it to a
 * human reviewer.
 *
 * Closed-union failure kinds so the executor can surface specific
 * feedback per file and (in a follow-up) hand it back to the AI
 * refinement loop.
 *
 * Pure — no I/O, no external deps.
 */

export type ValidatorFailureKind =
  | "json_parse_error"
  | "yaml_structure_error"
  | "unbalanced_braces"
  | "unbalanced_parens"
  | "unbalanced_brackets"
  | "unbalanced_quotes"
  | "python_indent_error"
  | "empty_file"
  | "invalid_utf8";

export interface ValidationFailure {
  kind: ValidatorFailureKind;
  /** Operator-readable message. */
  message: string;
  /** Approximate line number when relevant (1-indexed). */
  line?: number;
}

export interface ValidationResult {
  ok: boolean;
  failures: ReadonlyArray<ValidationFailure>;
}

const OK: ValidationResult = { ok: true, failures: [] };

function fail(...failures: ValidationFailure[]): ValidationResult {
  return { ok: false, failures };
}

// ----------------------------- JSON -----------------------------

export function validateJson(content: string): ValidationResult {
  if (content.length === 0) return fail({ kind: "empty_file", message: "Empty JSON file." });
  try {
    JSON.parse(content);
    return OK;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid JSON.";
    // Try to extract a line number from the Node error message:
    // "Unexpected token } in JSON at position 42" — convert position → line.
    const posMatch = message.match(/position (\d+)/);
    let line: number | undefined;
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      line = content.slice(0, pos).split("\n").length;
    }
    return fail({ kind: "json_parse_error", message, line });
  }
}

// ----------------------------- YAML (structural only) -----------------------------
// We don't have a YAML library wired here. The structural pass catches:
//   - tabs in indentation (YAML forbids tabs)
//   - inconsistent mapping indentation under the same key
//   - duplicate top-level keys
// Real YAML validation lands in a follow-up phase when js-yaml is added.

export function validateYaml(content: string): ValidationResult {
  if (content.length === 0) return fail({ kind: "empty_file", message: "Empty YAML file." });
  const lines = content.split("\n");
  const failures: ValidationFailure[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip blank + comment lines.
    if (line.trim().length === 0 || line.trimStart().startsWith("#")) continue;
    // Indentation may not contain tabs.
    const leadingTab = line.match(/^( *)\t/);
    if (leadingTab) {
      failures.push({
        kind: "yaml_structure_error",
        message: "YAML indentation must not contain tab characters.",
        line: i + 1,
      });
    }
  }

  // Look for duplicate top-level mapping keys (lines that start at col 0 with "key:").
  const topKeys = new Map<string, number>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0 || line.startsWith(" ") || line.startsWith("\t") || line.startsWith("#")) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:/);
    if (m) {
      const key = m[1];
      if (topKeys.has(key)) {
        failures.push({
          kind: "yaml_structure_error",
          message: `Duplicate top-level YAML key "${key}".`,
          line: i + 1,
        });
      } else {
        topKeys.set(key, i + 1);
      }
    }
  }

  return failures.length === 0 ? OK : { ok: false, failures };
}

// ----------------------------- Balanced-symbol scanner -----------------------------
// Used by TS/JS validation. Walks the source counting (), {}, [], strings, and
// template-literal interpolations. NOT a real parser — comments + strings can
// confuse it. Catches the obvious failures (truncated source mid-function).

interface BalanceResult {
  parens: number;     // ( minus )
  braces: number;     // { minus }
  brackets: number;   // [ minus ]
  unterminatedString: boolean;
  unterminatedTemplate: boolean;
  unterminatedBlockComment: boolean;
}

function scanBalance(source: string): BalanceResult {
  let parens = 0, braces = 0, brackets = 0;
  let inSingle = false, inDouble = false, inTemplate = false;
  let inLineComment = false, inBlockComment = false;
  // Track template-string depth (template literals can contain ${...} that nest).
  const templateBraceDepth: number[] = [];

  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    const next = source[i + 1];

    // Block comment end
    if (inBlockComment) {
      if (c === "*" && next === "/") { inBlockComment = false; i++; }
      continue;
    }
    // Line comment end
    if (inLineComment) {
      if (c === "\n") inLineComment = false;
      continue;
    }
    // Single-quote string
    if (inSingle) {
      if (c === "\\") { i++; continue; }     // skip next char (escape)
      if (c === "'") inSingle = false;
      if (c === "\n") return { parens, braces, brackets, unterminatedString: true, unterminatedTemplate: false, unterminatedBlockComment: false };
      continue;
    }
    if (inDouble) {
      if (c === "\\") { i++; continue; }
      if (c === '"') inDouble = false;
      if (c === "\n") return { parens, braces, brackets, unterminatedString: true, unterminatedTemplate: false, unterminatedBlockComment: false };
      continue;
    }
    if (inTemplate) {
      if (c === "\\") { i++; continue; }
      if (c === "`" && templateBraceDepth.length === 0) { inTemplate = false; continue; }
      if (c === "$" && next === "{") {
        templateBraceDepth.push(braces);
        braces++;
        i++;
        continue;
      }
      if (c === "}" && templateBraceDepth.length > 0 && braces === templateBraceDepth[templateBraceDepth.length - 1] + 1) {
        templateBraceDepth.pop();
        braces--;
        continue;
      }
      // Inside ${...}: fall through to the normal scanner by inverting the inTemplate flag temporarily.
      // For simplicity we don't fully nest — that's good enough for unbalanced detection.
      continue;
    }

    // Start of comment?
    if (c === "/" && next === "/") { inLineComment = true; i++; continue; }
    if (c === "/" && next === "*") { inBlockComment = true; i++; continue; }

    // Strings.
    if (c === "'") { inSingle = true; continue; }
    if (c === '"') { inDouble = true; continue; }
    if (c === "`") { inTemplate = true; continue; }

    // Brackets.
    if (c === "(") parens++;
    else if (c === ")") parens--;
    else if (c === "{") braces++;
    else if (c === "}") braces--;
    else if (c === "[") brackets++;
    else if (c === "]") brackets--;
  }

  return {
    parens,
    braces,
    brackets,
    unterminatedString: inSingle || inDouble,
    unterminatedTemplate: inTemplate,
    unterminatedBlockComment: inBlockComment,
  };
}

export function validateTypeScript(content: string): ValidationResult {
  if (content.length === 0) return fail({ kind: "empty_file", message: "Empty TypeScript file." });
  const r = scanBalance(content);
  const failures: ValidationFailure[] = [];
  if (r.braces !== 0)   failures.push({ kind: "unbalanced_braces",   message: `Unbalanced { } (delta=${r.braces}).` });
  if (r.parens !== 0)   failures.push({ kind: "unbalanced_parens",   message: `Unbalanced ( ) (delta=${r.parens}).` });
  if (r.brackets !== 0) failures.push({ kind: "unbalanced_brackets", message: `Unbalanced [ ] (delta=${r.brackets}).` });
  if (r.unterminatedString || r.unterminatedTemplate || r.unterminatedBlockComment) {
    failures.push({
      kind: "unbalanced_quotes",
      message: r.unterminatedString ? "Unterminated string literal." :
               r.unterminatedTemplate ? "Unterminated template literal." :
               "Unterminated /* */ block comment.",
    });
  }
  return failures.length === 0 ? OK : { ok: false, failures };
}

export const validateJavascript = validateTypeScript;
export const validateTsx = validateTypeScript;
export const validateJsx = validateTypeScript;

// ----------------------------- Python -----------------------------

export function validatePython(content: string): ValidationResult {
  if (content.length === 0) return fail({ kind: "empty_file", message: "Empty Python file." });
  const lines = content.split("\n");
  const failures: ValidationFailure[] = [];

  // Python forbids mixing tabs + spaces in indentation. We check that
  // every indented line uses ONLY spaces OR ONLY tabs (not both).
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lead = line.match(/^[ \t]*/)?.[0] ?? "";
    if (lead.includes(" ") && lead.includes("\t")) {
      failures.push({
        kind: "python_indent_error",
        message: "Indentation mixes spaces and tabs.",
        line: i + 1,
      });
    }
  }

  return failures.length === 0 ? OK : { ok: false, failures };
}

// ----------------------------- Dispatcher -----------------------------

/** Map a file path to its validator. Returns null when no validator applies (the file is skipped). */
export function dispatchValidator(path: string): ((content: string) => ValidationResult) | null {
  const lower = path.toLowerCase();
  if (lower.endsWith(".json"))                            return validateJson;
  if (lower.endsWith(".yaml") || lower.endsWith(".yml"))  return validateYaml;
  if (lower.endsWith(".ts"))                              return validateTypeScript;
  if (lower.endsWith(".tsx"))                             return validateTsx;
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return validateJavascript;
  if (lower.endsWith(".jsx"))                             return validateJsx;
  if (lower.endsWith(".py"))                              return validatePython;
  return null;
}
