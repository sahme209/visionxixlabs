import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureSavedPlan } from "../savedPlanArtifactIO";
import { bytesDigest, openSavedPlan, parseSavedPlanBinding } from "../savedPlanArtifact";
import { binding, show } from "./savedPlanFixtures";

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "axiom-plan-io-test-"));
  vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "synthetic-owned-IO-test-key-not-real-12345");
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
async function executable(body: string) {
  const path = join(directory, "terraform-fixture");
  await writeFile(path, `#!/bin/sh\n${body}\n`, { mode: 0o700 });
  return { executablePath: path, executableDigest: bytesDigest(await readFile(path)) };
}
it("captures its own show from the exact private binary snapshot with no inherited credentials", async () => {
  vi.stubEnv("AWS_SECRET_ACCESS_KEY", "must-not-reach-child");
  const program = await executable(`test -z "$AWS_SECRET_ACCESS_KEY" || exit 8\ntest -z "$HOME" || exit 9\nif [ "$1" = version ]; then echo '{"terraform_version":"1.9.8"}'; exit 0; fi\ntest "$1" = show && test "$2" = -json || exit 10\ntest "$(cat "$3")" = owned-bytes || exit 11\ncat <<'JSON'\n${JSON.stringify(show())}\nJSON`);
  const row = await captureSavedPlan({ id: "artifact-io", binding: parseSavedPlanBinding({ ...binding(), executableDigest: program.executableDigest }), binary: Buffer.from("owned-bytes"), executablePath: program.executablePath });
  expect(openSavedPlan(row, { organizationId: "org-fixture", requestId: "request-fixture", requestVersion: 1 }, new Date("2026-10-16T12:30:00Z")).summary.counts.create).toBe(1);
});
it("rejects executable substitution before executing it", async () => {
  const program = await executable("exit 17");
  await expect(captureSavedPlan({ id: "artifact-io", binding: parseSavedPlanBinding(binding()), binary: Buffer.from("owned-bytes"), executablePath: program.executablePath })).rejects.toThrow("saved_plan_executable_changed");
});
it("rejects corrupt binary and version disagreement without sealing evidence", async () => {
  const program = await executable(`if [ "$1" = version ]; then echo '{"terraform_version":"1.9.9"}'; else exit 1; fi`);
  await expect(captureSavedPlan({ id: "artifact-io", binding: parseSavedPlanBinding({ ...binding(), executableDigest: program.executableDigest }), binary: Buffer.from("bad-plan"), executablePath: program.executablePath })).rejects.toThrow("saved_plan_cli_version_changed");
});
it("rejects a saved snapshot modified during show", async () => {
  const program = await executable(`if [ "$1" = version ]; then echo '{"terraform_version":"1.9.8"}'; exit 0; fi\nprintf changed > "$3"\ncat <<'JSON'\n${JSON.stringify(show())}\nJSON`);
  await expect(captureSavedPlan({ id: "artifact-io", binding: parseSavedPlanBinding({ ...binding(), executableDigest: program.executableDigest }), binary: Buffer.from("original"), executablePath: program.executablePath })).rejects.toThrow("saved_plan_snapshot_changed");
});
