import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { serverlessDeployWorkflow, SERVERLESS_PLATFORMS } from "../serverlessDeployTemplates";

const base = { name: "checkout-api", region: "us-east-1", resourceGroup: "rg-shop" };
describe("serverless deploy workflow templates", () => {
  it.each(SERVERLESS_PLATFORMS.map((p) => p.id))("generates valid OIDC-only YAML for %s", (platform) => {
    const r = serverlessDeployWorkflow({ ...base, platform });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const doc = parse(r.yaml);
    expect(doc.permissions).toEqual({ contents: "read", "id-token": "write" });
    expect(doc.on.workflow_dispatch.inputs.image.required).toBe(true);
    expect(doc.concurrency.group).toBe(`v19-serverless-${platform}-checkout-api`);
    expect(r.yaml).not.toMatch(/secrets\./); // no stored cloud keys
    for (const uses of r.yaml.match(/uses: \S+/g) ?? []) expect(uses).toMatch(/@[0-9a-f]{40}$/); // actions pinned by SHA
    expect(r.yaml).toContain('[[ "$IMAGE" =~');
  });
  it("encodes each platform's gradual rollout and rollback", () => {
    const y = (platform: "aws_lambda" | "gcp_cloud_run" | "azure_functions") => { const r = serverlessDeployWorkflow({ ...base, platform, canaryPercent: 20, observeMinutes: 3 }); return r.ok ? r.yaml : ""; };
    expect(y("aws_lambda")).toContain('\\"AdditionalVersionWeights\\":{\\"$NEW\\":0.20}');
    expect(y("aws_lambda")).toMatch(/moving all traffic back/);
    expect(y("gcp_cloud_run")).toMatch(/--no-traffic[\s\S]*candidate=20[\s\S]*candidate=0[\s\S]*--to-latest/);
    expect(y("azure_functions")).toMatch(/--slot staging[\s\S]*seq 1 3[\s\S]*slot swap/);
  });
  it("refuses unsafe names and missing Azure settings, and clamps numbers", () => {
    expect(serverlessDeployWorkflow({ ...base, platform: "aws_lambda", name: "x; rm -rf /" }).ok).toBe(false);
    expect(serverlessDeployWorkflow({ ...base, platform: "gcp_cloud_run", region: "${{ x }}" }).ok).toBe(false);
    expect(serverlessDeployWorkflow({ ...base, platform: "azure_functions", resourceGroup: undefined }).ok).toBe(false);
    expect(serverlessDeployWorkflow({ ...base, platform: "azure_functions", healthPath: "health" }).ok).toBe(false);
    expect(serverlessDeployWorkflow({ ...base, platform: "nope" as never }).ok).toBe(false);
    const r = serverlessDeployWorkflow({ ...base, platform: "gcp_cloud_run", canaryPercent: 99, observeMinutes: 0 });
    expect(r.ok && r.yaml.includes("candidate=50") && r.yaml.includes("seq 1 1")).toBe(true);
  });
});
