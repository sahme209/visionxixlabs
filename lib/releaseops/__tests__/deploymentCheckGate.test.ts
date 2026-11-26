import { describe, expect, it } from "vitest";
import { evaluateStageGate, type GateCheck, type GateResult } from "../deploymentCheckGate";

const now = new Date("2026-11-26T12:00:00Z");
const chk = (o: Partial<GateCheck>): GateCheck => ({ key: "probe", name: "Probe", kind: "smoke_test", stage: "validate", mode: "blocking", enabled: true, version: 2, ...o });
const res = (o: Partial<GateResult>): GateResult => ({ checkKey: "probe", checkVersion: 2, status: "passed", releaseRef: "abc123", reportedAt: new Date("2026-11-26T11:00:00Z"), ...o });
const run = (checks: GateCheck[], results: GateResult[]) => evaluateStageGate({ checks, results, startingStage: "deploy", commitSha: "abc123", now });

describe("evaluateStageGate", () => {
  it("passes with a fresh passing result for this commit at the current version", () => {
    expect(run([chk({})], [res({})])).toEqual({ ok: true, satisfied: ["probe"], notEnforceable: [] });
  });
  it("blocks on missing, failed, stale-version and expired results, and ignores other commits", () => {
    const block = (results: GateResult[]) => { const o = run([chk({})], results); return o.ok ? null : o.blocked[0].reason; };
    expect(block([])).toBe("no_result");
    expect(block([res({ releaseRef: "other" })])).toBe("no_result");
    expect(block([res({ status: "failed" })])).toBe("failed");
    expect(block([res({ status: "passed", reportedAt: new Date("2026-11-26T10:00:00Z") }), res({ status: "failed" })])).toBe("failed");
    expect(block([res({ checkVersion: 1 })])).toBe("stale_version");
    expect(block([res({ reportedAt: new Date("2026-11-20T00:00:00Z") })])).toBe("expired");
  });
  it("only gates blocking, enabled checks at earlier stages and lists manual and health checks as not enforceable", () => {
    const out = run([chk({ stage: "verify" }), chk({ key: "adv", mode: "advisory" }), chk({ key: "off", enabled: false }), chk({ key: "manual", kind: "manual_checklist" }), chk({ key: "metric", kind: "health_check", stage: "plan" })], []);
    expect(out).toEqual({ ok: true, satisfied: [], notEnforceable: ["manual", "metric"] });
  });
});
