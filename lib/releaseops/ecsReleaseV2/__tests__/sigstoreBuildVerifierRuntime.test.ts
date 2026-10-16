import { expect, it, vi } from "vitest";
import { verifyBuildProvenance, type BuildBinding } from "../sigstoreBuildVerifier";

const verifier = vi.hoisted(() => ({ imported: vi.fn() }));
vi.mock("@sigstore/verify", () => {
  verifier.imported();
  throw new Error("The unsupported runtime must never load the official verifier");
});

it("fails on the actual Node 20 runtime boundary before loading verifier code or checking authority", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(process.versions, "node")!;
  const authorize = vi.fn(async () => true);
  const binding: BuildBinding = {
    organizationId: "fixture-tenant", repositoryId: "123", repositoryFullName: "owner/repo",
    sourceSha: "a".repeat(40), sourceRef: "refs/heads/main", workflowPath: ".github/workflows/build.yml",
    workflowSha: "b".repeat(40), runId: "1", runAttempt: 1, attestationDigest: `sha256:${"c".repeat(64)}`,
    subjects: [{ name: "registry.test/app", sha256: "d".repeat(64) }],
  };
  try {
    Object.defineProperty(process.versions, "node", { ...descriptor, value: "20.19.0" });
    expect(await verifyBuildProvenance({ bytes: new Uint8Array(), binding, profile: null, authorize, now: new Date() }))
      .toEqual({ kind: "unavailable", reason: "unsupported_sigstore_runtime" });
    expect(verifier.imported).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(process.versions, "node", descriptor);
  }
});
