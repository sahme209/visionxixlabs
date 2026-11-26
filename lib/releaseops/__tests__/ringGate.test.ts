import { describe, expect, it, vi } from "vitest";
import { readRingGate, ringOf } from "../ringGate";

const repo = (tags: string[] | null, previous: string[], done: number) => ({
  environment: { findFirst: vi.fn(async () => (tags ? { tags } : null)), findMany: vi.fn(async () => previous.map((id) => ({ id }))) },
  deploymentExecution: { count: vi.fn(async () => done) },
});
const input = { organizationId: "o", environmentId: "e2", repositoryFullName: "acme/app", commitSha: "abc" };
describe("ring gate", () => {
  it("parses ring tags", () => { expect(ringOf(["tenant:x", "ring:2"])).toBe(2); expect(ringOf(["ring:x"])).toBeNull(); expect(ringOf([])).toBeNull(); });
  it("does not gate untagged environments or ring 0", async () => {
    expect(await readRingGate(repo([], [], 0), input)).toEqual({ ok: true, ring: null });
    expect(await readRingGate(repo(["ring:0"], [], 0), input)).toEqual({ ok: true, ring: 0 });
  });
  it("requires a successful deployment of the same repository and commit in the previous ring", async () => {
    const r = repo(["ring:1"], ["e1"], 0);
    expect(await readRingGate(r, input)).toEqual({ ok: false, ring: 1, previousRing: 0, reason: "previous_ring_not_deployed" });
    expect(r.deploymentExecution.count).toHaveBeenCalledWith({ where: { organizationId: "o", environmentId: { in: ["e1"] }, repositoryFullName: "acme/app", sourceCommitSha: "abc", status: "completed", conclusion: "success" } });
    expect(await readRingGate(repo(["ring:1"], ["e1"], 1), input)).toEqual({ ok: true, ring: 1 });
    expect(await readRingGate(repo(["ring:2"], [], 0), input)).toEqual({ ok: false, ring: 2, previousRing: 1, reason: "no_previous_ring_environment" });
  });
  it("fails closed when reads fail", async () => {
    const r = repo(["ring:1"], ["e1"], 0); r.environment.findMany.mockRejectedValueOnce(new Error("down"));
    expect(await readRingGate(r, input)).toBe("unavailable");
  });
});
