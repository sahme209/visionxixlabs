import { describe, it, expect } from "vitest";
import {
  validatePythonManifest,
  validateInputs,
  type PythonScriptManifest,
} from "../pythonScriptContract";

const BASE: PythonScriptManifest = {
  id: "test_script",
  name: "Test script",
  pythonVersion: ">=3.11,<3.13",
  purpose: "A test script.",
  riskTier: "low",
  requiresCapabilities: ["python_runtime"],
  pipDependencies: [{ name: "requests", version: "2.31.0" }],
  inputs: [
    { name: "url",   type: "string", required: true,  description: "Target URL", maxLength: 200 },
    { name: "limit", type: "number", required: false, description: "Row cap",   min: 1, max: 1000 },
  ],
  output: { type: "json", description: "Result rows." },
  supportsDryRun: true,
  timeoutSeconds: 120,
  allowedExitCodes: [0],
  rollbackNote: null,
};

describe("validatePythonManifest", () => {
  it("happy path", () => {
    const r = validatePythonManifest(BASE);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("rejects missing id + name", () => {
    const r = validatePythonManifest({ ...BASE, id: "", name: "" });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === "missing_id")).toBe(true);
    expect(r.errors.some((e) => e.code === "missing_name")).toBe(true);
  });

  it("rejects invalid python version", () => {
    const r = validatePythonManifest({ ...BASE, pythonVersion: "python 3?" });
    expect(r.errors.some((e) => e.code === "invalid_python_version")).toBe(true);
  });

  it("rejects unpinned dependency", () => {
    const r = validatePythonManifest({
      ...BASE,
      pipDependencies: [{ name: "x", version: "^1.2.3" }],
    });
    expect(r.errors.some((e) => e.code === "unpinned_dependency")).toBe(true);
  });

  it("rejects duplicate input names", () => {
    const r = validatePythonManifest({
      ...BASE,
      inputs: [
        { name: "x", type: "string", required: true, description: "" },
        { name: "x", type: "number", required: true, description: "" },
      ],
    });
    expect(r.errors.some((e) => e.code === "duplicate_input_name")).toBe(true);
  });

  it("rejects min > max", () => {
    const r = validatePythonManifest({
      ...BASE,
      inputs: [{ name: "x", type: "number", required: true, description: "", min: 10, max: 1 }],
    });
    expect(r.errors.some((e) => e.code === "invalid_input_bound")).toBe(true);
  });

  it("rejects timeout out of range", () => {
    const a = validatePythonManifest({ ...BASE, timeoutSeconds: 0 });
    const b = validatePythonManifest({ ...BASE, timeoutSeconds: 4000 });
    expect(a.errors.some((e) => e.code === "timeout_out_of_range")).toBe(true);
    expect(b.errors.some((e) => e.code === "timeout_out_of_range")).toBe(true);
  });

  it("rejects empty allowedExitCodes", () => {
    const r = validatePythonManifest({ ...BASE, allowedExitCodes: [] });
    expect(r.errors.some((e) => e.code === "exit_codes_empty")).toBe(true);
  });

  it("high-risk script without dry-run is rejected", () => {
    const r = validatePythonManifest({ ...BASE, riskTier: "high", supportsDryRun: false });
    expect(r.errors.some((e) => e.code === "high_risk_requires_dry_run")).toBe(true);
  });

  it("critical-risk script without dry-run is rejected", () => {
    const r = validatePythonManifest({ ...BASE, riskTier: "critical", supportsDryRun: false });
    expect(r.errors.some((e) => e.code === "high_risk_requires_dry_run")).toBe(true);
  });
});

describe("validateInputs", () => {
  it("happy path with all params", () => {
    const r = validateInputs(BASE, { url: "https://example.com", limit: 50 });
    expect(r.ok).toBe(true);
    expect(r.values.url).toBe("https://example.com");
    expect(r.values.limit).toBe(50);
  });

  it("optional missing is fine", () => {
    const r = validateInputs(BASE, { url: "https://example.com" });
    expect(r.ok).toBe(true);
  });

  it("required missing is an error", () => {
    const r = validateInputs(BASE, { limit: 5 });
    expect(r.ok).toBe(false);
    expect(r.errors[0].name).toBe("url");
  });

  it("type mismatch", () => {
    const r = validateInputs(BASE, { url: 123, limit: "no" });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("maxLength is enforced", () => {
    const long = "x".repeat(300);
    const r = validateInputs(BASE, { url: long });
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toMatch(/maxLength/);
  });

  it("min/max numeric is enforced", () => {
    const r = validateInputs(BASE, { url: "ok", limit: 5000 });
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toMatch(/Above max/);
  });

  it("enum is enforced for string types", () => {
    const manifest: PythonScriptManifest = {
      ...BASE,
      inputs: [{ name: "lvl", type: "string", required: true, description: "", enum: ["info", "warn"] }],
    };
    const r = validateInputs(manifest, { lvl: "error" });
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toMatch(/enum/);
  });

  it("string_list is accepted", () => {
    const manifest: PythonScriptManifest = {
      ...BASE,
      inputs: [{ name: "tags", type: "string_list", required: true, description: "" }],
    };
    const r = validateInputs(manifest, { tags: ["a", "b"] });
    expect(r.ok).toBe(true);
    expect(r.values.tags).toEqual(["a", "b"]);
  });
});
