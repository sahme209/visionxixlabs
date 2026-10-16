import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectSavedPlanJson, parseSavedPlanBinding, openSavedPlan } from "../savedPlanArtifact";

import { binding, show, digest, sealSavedPlan } from "./savedPlanFixtures";
afterEach(() => vi.unstubAllEnvs());

describe("saved Terraform plan document", () => {
  it("reuses action summary without retaining sensitive plan values", () => {
    const result = inspectSavedPlanJson(JSON.stringify(show()), "1.9.8");
    expect(result.counts.create).toBe(1);
    expect(result.rows[0]).toMatchObject({ address: "terraform_data.fixture", kind: "create" });
    expect(JSON.stringify(result)).not.toContain("SENTINEL");
  });
  it.each([
    { resource_changes: undefined }, { resource_changes: {} }, { format_version: "2.0" }, { terraform_version: "1.9.9" },
    { errored: true }, { complete: false }, { deferred_changes: [{}] }, { resource_drift: [{}] },
  ])("rejects incomplete or unsupported document %j", (change) => {
    expect(() => inspectSavedPlanJson(JSON.stringify({ ...show(), ...change }), "1.9.8")).toThrow();
  });
  it.each([["forget"], ["create", "read"], [], ["update", "update"], ["delete,create"]].map(actions => [actions]))("rejects unsupported action tuple %j instead of no-op", (actions) => {
    const document = show(); document.resource_changes[0].change.actions = actions;
    expect(() => inspectSavedPlanJson(JSON.stringify(document), "1.9.8")).toThrow();
  });
  it("refuses unmodeled import and moved-address state transitions", () => {
    const imported = show(); Object.assign(imported.resource_changes[0].change, { importing: { id: "external-resource" } });
    expect(() => inspectSavedPlanJson(JSON.stringify(imported), "1.9.8")).toThrow();
    const moved = show(); Object.assign(moved.resource_changes[0], { previous_address: "terraform_data.old" });
    expect(() => inspectSavedPlanJson(JSON.stringify(moved), "1.9.8")).toThrow();
  });
  it("rejects duplicate addresses and oversized documents", () => {
    const document = show(); document.resource_changes.push(document.resource_changes[0]);
    expect(() => inspectSavedPlanJson(JSON.stringify(document), "1.9.8")).toThrow();
    expect(() => inspectSavedPlanJson(" ".repeat(32 * 1024 * 1024 + 1), "1.9.8")).toThrow();
  });
  it("accepts an explicit no-change plan", () => {
    expect(inspectSavedPlanJson(JSON.stringify({ ...show(), resource_changes: [] }), "1.9.8").severity).toBe("noop");
  });
});

describe("immutable saved plan envelopes", () => {
  it("binds binary and its own show to tenant/request/artifact and rederives summary", () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "synthetic-fixture-key-not-a-real-secret-12345");
    const parsed = parseSavedPlanBinding(binding());
    const record = sealSavedPlan("artifact-fixture", parsed, Buffer.from("fixture-bytes"), JSON.stringify(show()));
    const opened = openSavedPlan(record, { organizationId: parsed.organizationId, requestId: parsed.deploymentRequestId, requestVersion: 1 }, new Date("2026-10-16T12:30:00Z"));
    expect(opened.summary.counts.create).toBe(1);
    expect(opened.approval).toBe("unavailable");
    expect(opened.executionEnabled).toBe(false);
    expect(JSON.stringify(opened)).not.toMatch(/SENTINEL|encrypted|fixture-bytes|configurationDigest/);
    expect(() => openSavedPlan({ ...record, organizationId: "foreign" }, { organizationId: "foreign", requestId: parsed.deploymentRequestId, requestVersion: 1 }, new Date("2026-10-16T12:30:00Z"))).toThrow();
  });
  it("rejects byte, binding, ciphertext, current version and expiry changes", () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "synthetic-fixture-key-not-a-real-secret-12345");
    const record = sealSavedPlan("artifact-fixture", parseSavedPlanBinding(binding()), Buffer.from("fixture-bytes"), JSON.stringify(show()));
    const scope = { organizationId: "org-fixture", requestId: "request-fixture", requestVersion: 1 };
    const now = new Date("2026-10-16T12:30:00Z");
    for (const changed of [{ ...record, binaryDigest: digest("other") }, { ...record, binaryBytes: 2 }, { ...record, encryptedShow: record.encryptedBinary }, { ...record, bindingJson: { ...record.bindingJson, targetDigest: digest("changed") } }]) {
      expect(() => openSavedPlan(changed, scope, now)).toThrow();
    }
    expect(() => openSavedPlan(record, { ...scope, requestVersion: 2 }, now)).toThrow();
    expect(() => openSavedPlan(record, scope, new Date("2026-10-16T13:00:00Z"))).toThrow();
  });
  it("never permits missing backend/credential facts to masquerade as remote authority", () => {
    expect(() => parseSavedPlanBinding({ ...binding(), evidenceScope: "customer_backend", backend: { ...binding().backend, kind: "remote" } })).toThrow();
    expect(() => parseSavedPlanBinding({ ...binding(), organizationId: "" })).toThrow();
    expect(() => parseSavedPlanBinding({ ...binding(), targetDigest: "caller-asserted" })).toThrow();
    expect(() => parseSavedPlanBinding({ ...binding(), requestVersion: 0 })).toThrow();
  });
});
