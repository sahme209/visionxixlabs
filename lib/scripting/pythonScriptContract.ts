/**
 * Python script contract — the typed shape every Python script must
 * conform to before the platform agrees to run it.
 *
 * Pure / no I/O. Contract violations cause refusal BEFORE the script
 * ever executes. The contract is enforced at three layers:
 *   1. registration (this validator) — script must declare its
 *      manifest at registration time
 *   2. composition (scriptExecutionPlanner) — inputs must match
 *      the manifest's input schema
 *   3. execution (cloud sandbox / desktop runtime) — exit code +
 *      output must match the declared schema
 *
 * Closed unions on capability + risk tier + exit-code shape so future
 * shapes break the build.
 */

import type { DesktopCapability } from "@/lib/desktop/desktopScriptCatalog";

export type PythonInputType = "string" | "number" | "boolean" | "string_list" | "secret_ref";
export type PythonOutputType = "json" | "markdown" | "csv" | "text";

export type ScriptRiskTier = "low" | "medium" | "high" | "critical";

export interface PythonInputParam {
  name: string;
  type: PythonInputType;
  required: boolean;
  description: string;
  /** Numeric bounds — only meaningful for type=number. */
  min?: number;
  max?: number;
  /** Max string length — only meaningful for string types. */
  maxLength?: number;
  /** Closed-union enum of allowed string values. */
  enum?: readonly string[];
}

export interface PythonScriptManifest {
  /** Stable id — used in handoffs + audit rows. */
  id: string;
  /** Display name. */
  name: string;
  /** Pinned Python version range, e.g. ">=3.11,<3.13". */
  pythonVersion: string;
  /** Public-facing purpose. */
  purpose: string;
  /** Closed-union risk tier. */
  riskTier: ScriptRiskTier;
  /** Required local capabilities. */
  requiresCapabilities: ReadonlyArray<DesktopCapability>;
  /** Required pip dependencies — pinned exact versions only. */
  pipDependencies: ReadonlyArray<{ name: string; version: string }>;
  /** Input schema — every script declares its parameters. */
  inputs: ReadonlyArray<PythonInputParam>;
  /** Output schema. */
  output: { type: PythonOutputType; description: string };
  /** Whether the script supports dry-run (no side effects). */
  supportsDryRun: boolean;
  /** Wall-clock timeout in seconds. */
  timeoutSeconds: number;
  /** Allowed exit codes — anything else is treated as failure. */
  allowedExitCodes: ReadonlyArray<number>;
  /** Operator-readable rollback note. */
  rollbackNote: string | null;
}

export type ManifestError =
  | "missing_id"
  | "missing_name"
  | "missing_python_version"
  | "invalid_python_version"
  | "missing_inputs_array"
  | "duplicate_input_name"
  | "invalid_input_bound"
  | "unpinned_dependency"
  | "timeout_out_of_range"
  | "exit_codes_empty"
  | "high_risk_requires_dry_run";

export interface ValidateManifestResult {
  ok: boolean;
  errors: readonly { code: ManifestError; message: string }[];
}

const PYTHON_VERSION_PATTERN = /^[<>=,.\d\s]+$/; // forgiving range syntax check

const DEPENDENCY_VERSION_PATTERN = /^\d+\.\d+(?:\.\d+)?$/; // pin exact, no caret/tilde

export function validatePythonManifest(m: PythonScriptManifest): ValidateManifestResult {
  const errors: { code: ManifestError; message: string }[] = [];

  if (!m.id || !m.id.trim()) errors.push({ code: "missing_id", message: "Manifest is missing id." });
  if (!m.name || !m.name.trim()) errors.push({ code: "missing_name", message: "Manifest is missing name." });
  if (!m.pythonVersion) {
    errors.push({ code: "missing_python_version", message: "pythonVersion is required (e.g. \">=3.11,<3.13\")." });
  } else if (!PYTHON_VERSION_PATTERN.test(m.pythonVersion)) {
    errors.push({ code: "invalid_python_version", message: `pythonVersion "${m.pythonVersion}" doesn't look like a valid range.` });
  }

  if (!Array.isArray(m.inputs)) {
    errors.push({ code: "missing_inputs_array", message: "inputs must be an array (use [] for no inputs)." });
  } else {
    const seen = new Set<string>();
    for (const p of m.inputs) {
      if (seen.has(p.name)) {
        errors.push({ code: "duplicate_input_name", message: `Duplicate input name: ${p.name}` });
      }
      seen.add(p.name);
      if (p.type === "number" && p.min !== undefined && p.max !== undefined && p.min > p.max) {
        errors.push({ code: "invalid_input_bound", message: `Input ${p.name}: min > max.` });
      }
      if (p.maxLength !== undefined && p.maxLength <= 0) {
        errors.push({ code: "invalid_input_bound", message: `Input ${p.name}: maxLength must be > 0.` });
      }
    }
  }

  for (const d of m.pipDependencies) {
    if (!DEPENDENCY_VERSION_PATTERN.test(d.version)) {
      errors.push({
        code: "unpinned_dependency",
        message: `Dependency ${d.name}@${d.version} is not exactly pinned (use 1.2.3, not ^1 or ~1.2).`,
      });
    }
  }

  if (m.timeoutSeconds <= 0 || m.timeoutSeconds > 3600) {
    errors.push({ code: "timeout_out_of_range", message: "timeoutSeconds must be between 1 and 3600." });
  }

  if (!Array.isArray(m.allowedExitCodes) || m.allowedExitCodes.length === 0) {
    errors.push({ code: "exit_codes_empty", message: "allowedExitCodes must contain at least one entry (usually [0])." });
  }

  if ((m.riskTier === "high" || m.riskTier === "critical") && !m.supportsDryRun) {
    errors.push({
      code: "high_risk_requires_dry_run",
      message: `High-risk scripts must support dry-run. ${m.id} declares ${m.riskTier} without supportsDryRun.`,
    });
  }

  return { ok: errors.length === 0, errors };
}

/** Type-safe input collection — caller provides values, we validate
 * each against the manifest's declared shape. Returns the typed map
 * or a list of errors. */
export type ValidatedInputValue = string | number | boolean | readonly string[];

export interface ValidateInputsResult {
  ok: boolean;
  values: Readonly<Record<string, ValidatedInputValue>>;
  errors: readonly { name: string; message: string }[];
}

export function validateInputs(
  manifest: PythonScriptManifest,
  given: Readonly<Record<string, unknown>>,
): ValidateInputsResult {
  const values: Record<string, ValidatedInputValue> = {};
  const errors: { name: string; message: string }[] = [];

  for (const p of manifest.inputs) {
    const raw = given[p.name];
    if (raw === undefined || raw === null) {
      if (p.required) errors.push({ name: p.name, message: "Required input missing." });
      continue;
    }
    switch (p.type) {
      case "string":
      case "secret_ref": {
        if (typeof raw !== "string") {
          errors.push({ name: p.name, message: `Expected string, got ${typeof raw}.` });
          break;
        }
        if (p.maxLength !== undefined && raw.length > p.maxLength) {
          errors.push({ name: p.name, message: `Exceeds maxLength of ${p.maxLength}.` });
          break;
        }
        if (p.enum && !p.enum.includes(raw)) {
          errors.push({ name: p.name, message: `Value not in enum: ${p.enum.join(", ")}` });
          break;
        }
        values[p.name] = raw;
        break;
      }
      case "number": {
        if (typeof raw !== "number" || !Number.isFinite(raw)) {
          errors.push({ name: p.name, message: `Expected finite number, got ${typeof raw}.` });
          break;
        }
        if (p.min !== undefined && raw < p.min) {
          errors.push({ name: p.name, message: `Below min ${p.min}.` });
          break;
        }
        if (p.max !== undefined && raw > p.max) {
          errors.push({ name: p.name, message: `Above max ${p.max}.` });
          break;
        }
        values[p.name] = raw;
        break;
      }
      case "boolean": {
        if (typeof raw !== "boolean") {
          errors.push({ name: p.name, message: `Expected boolean, got ${typeof raw}.` });
          break;
        }
        values[p.name] = raw;
        break;
      }
      case "string_list": {
        if (!Array.isArray(raw) || !raw.every((x) => typeof x === "string")) {
          errors.push({ name: p.name, message: `Expected string[].` });
          break;
        }
        values[p.name] = raw as readonly string[];
        break;
      }
    }
  }

  return { ok: errors.length === 0, values, errors };
}
