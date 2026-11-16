import { it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

it("executes the actual Windows release workflow byte-custody contracts using synthetic files only", () => {
  const result = spawnSync(process.execPath, ["--test", join(process.cwd(), "scripts/fixtures/release-windows-workflow.test.cjs")], { cwd: process.cwd(), env: { ...process.env, AXIOM_WORKFLOW_TEST_SOURCE: join(process.cwd(), ".github/workflows/desktop-release.yml") }, encoding: "utf8", timeout: 25_000 });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stdout + result.stderr).toBe(0);
}, 30_000);
