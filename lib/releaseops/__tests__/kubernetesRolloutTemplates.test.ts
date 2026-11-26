import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { kubernetesRolloutWorkflow, ROLLOUT_STRATEGIES } from "../kubernetesRolloutTemplates";

const base = { namespace: "shop", deployment: "checkout", container: "web" };
describe("Kubernetes rollout workflow templates", () => {
  it.each(ROLLOUT_STRATEGIES.map((s) => s.id))("generates valid, credential-free YAML for %s", (strategy) => {
    const r = kubernetesRolloutWorkflow({ ...base, strategy });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const doc = parse(r.yaml);
    expect(doc.on.workflow_dispatch.inputs.image.required).toBe(true);
    expect(doc.permissions).toEqual({ contents: "read" });
    expect(doc.concurrency.group).toBe("v19-k8s-shop-checkout");
    expect(doc.jobs.deploy.env).toMatchObject({ NS: "shop", DEPLOY: "checkout", CONTAINER: "web" });
    expect(r.yaml).not.toMatch(/uses:/); // no third-party actions
    expect(r.yaml).toContain("secrets.KUBE_CONFIG");
    expect(r.yaml).toContain('[[ "$IMAGE" =~');
    expect(r.filename).toBe(`v19-k8s-${strategy.replace("_", "-")}-checkout.yml`);
  });
  it("encodes each strategy's safety behaviour", () => {
    const yaml = (strategy: "rolling" | "blue_green" | "canary") => { const r = kubernetesRolloutWorkflow({ ...base, strategy, canaryReplicas: 2, observeMinutes: 3 }); return r.ok ? r.yaml : ""; };
    expect(yaml("rolling")).toContain("rollout undo");
    expect(yaml("blue_green")).toMatch(/selector\.slot[\s\S]*rollout status[\s\S]*patch service/);
    const canary = yaml("canary");
    expect(canary).toContain("--replicas=2");
    expect(canary).toContain("seq 1 3");
    expect(parse(canary).jobs.deploy.steps.at(-1)).toMatchObject({ name: "Scale canary to zero", if: "always()" });
  });
  it("refuses names that are not Kubernetes names and clamps numbers", () => {
    for (const bad of [{ namespace: "Shop" }, { deployment: "a;rm -rf" }, { container: "${{ secrets.X }}" }, { deployment: "x".repeat(51) }]) {
      expect(kubernetesRolloutWorkflow({ ...base, ...bad, strategy: "rolling" }).ok).toBe(false);
    }
    expect(kubernetesRolloutWorkflow({ ...base, strategy: "nope" as never }).ok).toBe(false);
    const r = kubernetesRolloutWorkflow({ ...base, strategy: "canary", canaryReplicas: 99, observeMinutes: 0, timeoutMinutes: 999 });
    expect(r.ok && r.yaml.includes("--replicas=10") && r.yaml.includes("seq 1 1") && r.yaml.includes("--timeout=60m")).toBe(true);
  });
});
