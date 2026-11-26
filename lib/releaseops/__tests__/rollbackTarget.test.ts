import { describe, expect, it } from "vitest";
import { findRollbackTarget, rollbackCommitMatches } from "../rollbackTarget";

const d = (id: string, commit: string, ok: boolean, day: number, kind = "tag", ref = `v${day}`) => ({ id, environmentId: "prod", repositoryFullName: "acme/web", sourceRef: ref, sourceKind: kind, sourceCommitSha: commit.repeat(40).slice(0, 40), status: "completed", conclusion: ok ? "success" : "failure", createdAt: `2026-11-${String(day).padStart(2, "0")}T10:00:00Z` });

describe("rollback target", () => {
  it("rolls back a successful latest deployment to the previous good, different commit", () => {
    const otherEnvironment = { ...d("x", "x", true, 24), environmentId: "staging" };
    const r = findRollbackTarget([d("a", "a", true, 20), d("b", "b", true, 22), d("c", "b", true, 23), otherEnvironment], "prod", "acme/web");
    expect(r).toMatchObject({ kind: "target", from: { id: "c" }, to: { id: "a" }, pinned: true });
    if (r.kind === "target") expect(r.note).toBe("Redeploys tag v20 (aaaaaaa), which last deployed successfully here.");
  });
  it("after a failed attempt, returns to the last success", () => {
    const r = findRollbackTarget([d("a", "a", true, 20), d("b", "b", false, 22)], "prod", "acme/web");
    expect(r).toMatchObject({ kind: "target", from: { id: "b" }, to: { id: "a" } });
  });
  it("warns that a branch may have moved and checks the resolved commit", () => {
    const r = findRollbackTarget([d("a", "a", true, 20, "branch", "release"), d("b", "b", true, 22)], "prod", "acme/web");
    expect(r).toMatchObject({ kind: "target", pinned: false });
    if (r.kind === "target") expect(r.note).toMatch(/may have moved/);
    expect(rollbackCommitMatches(r, "A".repeat(40))).toBe(true);
    expect(rollbackCommitMatches(r, "c".repeat(40))).toBe(false);
    expect(rollbackCommitMatches(r, null)).toBeNull();
  });
  it("reports when there is nothing to roll back to", () => {
    expect(findRollbackTarget([], "prod", "acme/web")).toEqual({ kind: "none", reason: "no_deployments" });
    expect(findRollbackTarget([d("a", "a", true, 20)], "prod", "acme/web")).toEqual({ kind: "none", reason: "no_earlier_success" });
    expect(findRollbackTarget([d("a", "a", false, 20)], "prod", "acme/web")).toEqual({ kind: "none", reason: "no_earlier_success" });
  });
});
