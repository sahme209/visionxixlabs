import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateWorkflowExecutionContract } from "../workflowExecutionContract";

const source = { repositoryFullName: "team/service", ref: "release/v1", path: ".github/workflows/release.yml", blobSha: "a".repeat(40) };
const yaml = `on:
  workflow_dispatch:
    inputs:
      client:
        type: choice
        required: true
        options: [first, second]
      publish:
        type: boolean
        default: false
      count:
        type: number
      target:
        type: environment
`;
const blob = (content: string) => createHash("sha1").update(`blob ${Buffer.byteLength(content, "utf8")}\0`).update(content).digest("hex");
source.blobSha = blob(yaml);
const check = (inputs: unknown, current = source, content = yaml) => {
  const bound = { ...source, blobSha: blob(content) };
  return validateWorkflowExecutionContract({ expectedSource: bound, currentSource: current === source ? bound : current, content, inputs });
};

describe("source-bound workflow execution contract", () => {
  it("rejects source metadata whose blob does not match the actual workflow bytes", () => {
    expect(validateWorkflowExecutionContract({ expectedSource: source, currentSource: source, content: "on: workflow_dispatch", inputs: {} }).ok).toBe(false);
  });
  it("accepts exact source and literal typed inputs without creating defaults", () => {
    expect(check({ client: "first", publish: "false", count: "0", target: "staging" })).toEqual({ ok: true, inputs: { client: "first", publish: "false", count: "0", target: "staging" } });
    expect(check({ client: "second" })).toEqual({ ok: true, inputs: { client: "second" } });
  });
  it.each(["repositoryFullName", "ref", "path", "blobSha"] as const)("rejects changed %s", key => {
    expect(check({ client: "first" }, { ...source, [key]: key === "blobSha" ? "b".repeat(40) : "different" }).ok).toBe(false);
  });
  it("permits zero-input workflows only with exact dispatch metadata and no extra values", () => {
    expect(check({}, source, "on: workflow_dispatch")).toEqual({ ok: true, inputs: {} });
    expect(check({ unknown: "x" }, source, "on: workflow_dispatch").ok).toBe(false);
    expect(check({}, source, "on: push").ok).toBe(false);
  });
  it.each([{}, { client: "" }, { client: "third" }, { client: "first", unknown: "x" }, { client: "first", publish: "False" }, { client: "first", count: "0x10" }, { client: "first", count: " 1 " }, { client: "first", count: "1e999" }, { client: "first", target: "" }, { client: "first", publish: false }, [], null])("rejects invalid payload %#", inputs => {
    expect(check(inputs).ok).toBe(false);
  });
  it("rejects invalid source identities even when both observations agree", () => {
    for (const invalid of [{ ...source, blobSha: "fake" }, { ...source, path: "../release.yml" }, { ...source, ref: "" }, { ...source, repositoryFullName: "team/service/extra" }]) {
      expect(validateWorkflowExecutionContract({ expectedSource: invalid, currentSource: invalid, content: yaml, inputs: { client: "first" } }).ok).toBe(false);
    }
  });
  it("bounds actual UTF-8 payload and refuses expression substitutions", () => {
    const content = "on:\n  workflow_dispatch:\n    inputs:\n      text:\n        type: string\n";
    expect(check({ text: "x".repeat(65_536) }, source, content).ok).toBe(false);
    expect(check({ text: "😀".repeat(20_000) }, source, content).ok).toBe(false);
    expect(check({ text: "${{ secrets.TOKEN }}" }, source, content).ok).toBe(false);
  });
  it("does not mutate submitted values or report environment authorization", () => {
    const inputs = Object.freeze({ client: "first", target: "production" });
    expect(check(inputs)).toEqual({ ok: true, inputs });
  });
  it("requires explicit required values even when metadata offers a default", () => {
    expect(check({}, source, "on:\n  workflow_dispatch:\n    inputs:\n      client:\n        type: string\n        required: true\n        default: first\n").ok).toBe(false);
  });
});
