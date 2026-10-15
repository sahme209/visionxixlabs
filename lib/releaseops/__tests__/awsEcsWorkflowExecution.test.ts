import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE } from "../awsEcsDeployWorkflowTemplate";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

// Execute the actual template scripts against a fake AWS executable. This
// checks argument boundaries and rollback behavior without contacting AWS.
function harness() {
  const directory = mkdtempSync(join(tmpdir(), "axiom-ecs-workflow-"));
  directories.push(directory);
  const calls = join(directory, "calls.jsonl");
  const output = join(directory, "output");
  const sentinel = join(directory, "injected");
  const previous = `arn:aws:ecs:us-east-1:123456789012:task-definition/web:7$(touch ${sentinel})`;
  writeFileSync(join(directory, "aws"), `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.AWS_CALLS, JSON.stringify(process.argv.slice(2)) + '\\n');
if (process.argv[3] === 'describe-services') console.log(process.env.FAKE_PREVIOUS);
if (process.argv[3] === 'wait' && process.env.FAIL_WAIT === '1') process.exit(2);
`, { mode: 0o755 });
  const cluster = `cluster-$(touch ${sentinel})`;
  const service = `service-\`touch ${sentinel}\`"; touch ${sentinel}; #`;
  const environment = {
    ...process.env, PATH: `${directory}:${process.env.PATH}`, AWS_CALLS: calls,
    GITHUB_OUTPUT: output, FAKE_PREVIOUS: previous,
    ...(AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE.includes("ECS_CLUSTER: ${{ inputs.cluster }}") ? { ECS_CLUSTER: cluster } : {}),
    ...(AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE.includes("ECS_SERVICE: ${{ inputs.service }}") ? { ECS_SERVICE: service } : {}),
    ...(AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE.includes("PREVIOUS_TASK_DEF: ${{ steps.capture.outputs.previous_task_def }}") ? { PREVIOUS_TASK_DEF: previous } : {}),
  };
  function run(name: string, extra: Record<string, string> = {}) {
    const step = AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE.split("      - name: ").find((value) => value.startsWith(name + "\n"));
    if (!step?.includes("        run: |\n")) throw new Error(`Missing script: ${name}`);
    let script = step.split("        run: |\n")[1].split("\n").filter((line) => line.startsWith("          ") || !line.trim()).map((line) => line.slice(10)).join("\n");
    // Emulate Actions expression replacement. A regression to direct shell
    // interpolation must fail this test rather than leaving inert expressions.
    script = script.replaceAll("${{ inputs.cluster }}", cluster).replaceAll("${{ inputs.service }}", service)
      .replaceAll("${{ steps.capture.outputs.previous_task_def }}", previous);
    return spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script], { env: { ...environment, ...extra }, encoding: "utf8" });
  }
  return { run, previous, cluster, service, output, sentinel,
    calls: () => readFileSync(calls, "utf8").trim().split("\n").map((line) => JSON.parse(line) as string[]) };
}

describe("ECS workflow shell boundaries", () => {
  it("passes untrusted target strings as literal AWS arguments throughout deployment", () => {
    const fixture = harness();
    expect(fixture.run("Capture current task definition (rollback target)").status).toBe(0);
    expect(fixture.run("Force a new ECS deployment").status).toBe(0);
    expect(fixture.run("Wait for the new deployment to stabilize").status).toBe(0);
    expect(fixture.calls()).toEqual([
      ["ecs", "describe-services", "--cluster", fixture.cluster, "--services", fixture.service, "--query", "services[0].taskDefinition", "--output", "text"],
      ["ecs", "update-service", "--cluster", fixture.cluster, "--service", fixture.service, "--force-new-deployment", "--output", "text"],
      ["ecs", "wait", "services-stable", "--cluster", fixture.cluster, "--services", fixture.service],
    ]);
    expect(readFileSync(fixture.output, "utf8")).toBe(`previous_task_def=${fixture.previous}\n`);
    expect(() => readFileSync(fixture.sentinel)).toThrow();
  });

  it("restores the captured task definition literally and still reports the failed rollout", () => {
    const fixture = harness();
    expect(fixture.run("Wait for the new deployment to stabilize", { FAIL_WAIT: "1" }).status).toBe(2);
    expect(fixture.run("Roll back — deployment did not stabilize").status).toBe(1);
    expect(fixture.calls()[1]).toEqual(["ecs", "update-service", "--cluster", fixture.cluster, "--service", fixture.service, "--task-definition", fixture.previous, "--output", "text"]);
    expect(fixture.calls()[2]).toEqual(["ecs", "wait", "services-stable", "--cluster", fixture.cluster, "--services", fixture.service]);
    expect(() => readFileSync(fixture.sentinel)).toThrow();
  });

  it("propagates a failed rollback stabilization instead of reporting recovery success", () => {
    const fixture = harness();
    expect(fixture.run("Roll back — deployment did not stabilize", { FAIL_WAIT: "1" }).status).toBe(2);
    expect(fixture.calls()).toHaveLength(2);
  });
});
