import { describe, expect, it } from "vitest";
import { applyReleaseAutopilot } from "../releaseAutopilot";
import { evaluateGatewayPolicyWithImpact } from "../policyKernel";
import { autopilotFromDocument, diffPolicy, exportPolicyDocument, isPolicyDiffEmpty, parsePolicyDocument, readStoredAutopilot } from "@/lib/releaseops/policyAsCode";

const rule = { deployEnvironments: ["development", "staging"], maxFiles: 5 };
const decide = (environment: "development" | "staging" | "production", files: string[] | undefined, r: typeof rule | null = rule) => {
  const { impact, ...policy } = evaluateGatewayPolicyWithImpact({ actionKind: "deploy", environment, target: "acme/web", summary: "ship", changedFiles: files });
  return applyReleaseAutopilot(policy, { actionKind: "deploy", environment }, impact, r);
};

describe("applyReleaseAutopilot", () => {
  it("allows a contained deploy to a named environment and says why", () => {
    const p = decide("staging", ["src/app/page.tsx", "src/app/button.tsx"]);
    expect(p.decision).toBe("allow");
    expect(p.reasons.at(-1)).toMatch(/release autopilot.*2 files to staging/);
  });
  it("never allows production, even with a rule", () => {
    expect(decide("production", ["src/a.ts"]).decision).not.toBe("allow");
  });
  it("keeps review without a rule, without files, above the limit or on sensitive areas", () => {
    expect(decide("staging", ["src/a.ts"], null).decision).toBe("require_approval");
    expect(decide("staging", undefined).decision).toBe("require_approval");
    expect(decide("staging", ["a", "b", "c", "d", "e", "f"].map((f) => `src/${f}.ts`)).decision).toBe("require_approval");
    expect(decide("staging", ["prisma/migrations/1/migration.sql"]).decision).toBe("require_approval");
    expect(decide("staging", [".github/workflows/deploy.yml"]).decision).toBe("require_approval");
  });
  it("only covers environments the rule names and only deploys", () => {
    expect(decide("development", ["src/a.ts"], { deployEnvironments: ["staging"], maxFiles: 5 }).decision).toBe("require_approval");
    const { impact, ...policy } = evaluateGatewayPolicyWithImpact({ actionKind: "merge", environment: "staging", target: "t", summary: "s", changedFiles: ["src/a.ts"] });
    expect(applyReleaseAutopilot(policy, { actionKind: "merge", environment: "staging" }, impact, rule)).toEqual(policy);
  });
  it("never loosens a deny", () => {
    const deny = { decision: "deny" as const, riskLevel: "high" as const, reasons: ["no"] };
    expect(applyReleaseAutopilot(deny, { actionKind: "deploy", environment: "staging" }, null, rule)).toBe(deny);
  });
});

describe("autopilot in the policy file", () => {
  const doc = (autopilot?: unknown) => JSON.stringify({ kind: "v19.policy", version: 1, rules: [], ...(autopilot ? { autopilot } : {}) });
  it("refuses production, duplicates and out-of-range limits", () => {
    expect(parsePolicyDocument(doc({ deploy: { environments: ["production"], maxFiles: 5 } })).ok).toBe(false);
    expect(parsePolicyDocument(doc({ deploy: { environments: ["staging", "staging"], maxFiles: 5 } })).ok).toBe(false);
    expect(parsePolicyDocument(doc({ deploy: { environments: ["staging"], maxFiles: 51 } })).ok).toBe(false);
    expect(parsePolicyDocument(doc({ deploy: { environments: ["staging"], maxFiles: 5 } })).ok).toBe(true);
  });
  it("turning it on or widening it is loosening; turning it off is not", () => {
    const on = parsePolicyDocument(doc({ deploy: { environments: ["staging"], maxFiles: 5 } }));
    if (!on.ok) throw new Error("parse");
    const d = diffPolicy([], on.document, null);
    expect(d.autopilot).toEqual({ from: null, to: { deployEnvironments: ["staging"], maxFiles: 5 } });
    expect(d.loosening).toEqual(["release autopilot: agents may deploy contained changes to staging without review"]);
    expect(isPolicyDiffEmpty(d)).toBe(false);
    const wider = parsePolicyDocument(doc({ deploy: { environments: ["staging"], maxFiles: 9 } }));
    if (!wider.ok) throw new Error("parse");
    expect(diffPolicy([], wider.document, { deployEnvironments: ["staging"], maxFiles: 5 }).loosening).toEqual(["release autopilot: allows up to 9 files (was 5)"]);
    const off = parsePolicyDocument(doc());
    if (!off.ok) throw new Error("parse");
    const offDiff = diffPolicy([], off.document, { deployEnvironments: ["staging"], maxFiles: 5 });
    expect(offDiff.loosening).toEqual([]);
    expect(autopilotFromDocument(off.document)).toBeNull();
    expect(isPolicyDiffEmpty(diffPolicy([], on.document, { deployEnvironments: ["staging"], maxFiles: 5 }))).toBe(true);
  });
  it("exports byte-identically when off and round-trips when on", () => {
    expect(exportPolicyDocument([])).toBe(exportPolicyDocument([], null));
    expect(exportPolicyDocument([])).not.toContain("autopilot");
    const text = exportPolicyDocument([], { deployEnvironments: ["staging", "development"], maxFiles: 3 });
    const parsed = parsePolicyDocument(text);
    expect(parsed.ok && autopilotFromDocument(parsed.document)).toEqual({ deployEnvironments: ["development", "staging"], maxFiles: 3 });
  });
  it("reads stored rows defensively", () => {
    expect(readStoredAutopilot(null)).toBeNull();
    expect(readStoredAutopilot({ deployEnvironments: [], maxFiles: 5 })).toBeNull();
    expect(readStoredAutopilot({ deployEnvironments: ["production", "staging"], maxFiles: 5 })).toEqual({ deployEnvironments: ["staging"], maxFiles: 5 });
    expect(readStoredAutopilot({ deployEnvironments: ["staging"], maxFiles: 0 })).toBeNull();
  });
});
