import { expect, it } from "vitest";
import { parseCustomerPlanProfile, parseCustomerSavedPlanBinding, projectCustomerTarget, customerImportId } from "../customerPlanContract";
import { parseSavedPlanBinding } from "../savedPlanArtifact";
import { binding as fixtureBinding } from "./savedPlanFixtures";
import { customerProfile, customerBinding, hash } from "./customerPlanFixtures";

it("keeps fixture-v1 meaning and accepts a separate customer-v2 profile/binding", () => {
 const profile = customerProfile(), binding = customerBinding();
 expect(parseCustomerPlanProfile(profile)).toEqual(profile);
 expect(parseCustomerSavedPlanBinding(binding)).toEqual(binding);
 expect(parseSavedPlanBinding(fixtureBinding()).credential).toBeNull();
 expect(() => parseSavedPlanBinding(binding)).toThrow("saved_plan_binding_unavailable");
 expect(() => parseCustomerSavedPlanBinding(fixtureBinding())).toThrow("customer_plan_binding_unavailable");
});
it("does not retain mutable caller-owned profile or binding data", () => {
 const supplied = customerBinding(), parsed = parseCustomerSavedPlanBinding(supplied);
 supplied.profile.connection.version++;
 expect(parsed.profile.connection.version).toBe(3);
});
it.each([
 (p: ReturnType<typeof customerProfile>) => { p.backend.workspace = "other"; },
 (p: ReturnType<typeof customerProfile>) => { p.backend.lockKey = "foreign/key"; },
 (p: ReturnType<typeof customerProfile>) => { p.backend.bucket = "https://foreign.invalid"; },
 (p: ReturnType<typeof customerProfile>) => { p.backend.key = "../foreign"; },
 (p: ReturnType<typeof customerProfile>) => { p.producer.planRoleArn = "arn:aws:iam::999999999999:role/foreign"; },
 (p: ReturnType<typeof customerProfile>) => { p.artifacts.kmsKeyArn = p.artifacts.kmsKeyArn.replace("123456789012", "999999999999"); },
 (p: ReturnType<typeof customerProfile>) => { p.repository.sourceSha = "b".repeat(40); },
 (p: ReturnType<typeof customerProfile>) => { p.connection.version = 0; },
 (p: ReturnType<typeof customerProfile>) => { p.configuration.root = "../outside"; },
])("rejects unsupported, cross-account or malformed profile material %#", mutate => {
 const profile = customerProfile(); mutate(profile);
 expect(() => parseCustomerPlanProfile(profile)).toThrow("customer_plan_profile_invalid");
});
it.each([
 (b: ReturnType<typeof customerBinding>) => { b.profile.organizationId = "foreign"; },
 (b: ReturnType<typeof customerBinding>) => { b.producer.repositoryId = "999"; },
 (b: ReturnType<typeof customerBinding>) => { b.expiresAt = "2026-10-18T12:15:00.001Z"; },
 (b: ReturnType<typeof customerBinding>) => { b.configurationDigest = hash("other-config"); },
 (b: ReturnType<typeof customerBinding>) => { b.backendState.serial = -1; },
 (b: ReturnType<typeof customerBinding>) => { b.backendState.lineage = "unknown"; },
])("rejects changed profile/producer/state/version/expiry bindings %#", mutate => {
 const binding = customerBinding(); mutate(binding);
 expect(() => parseCustomerSavedPlanBinding(binding)).toThrow("customer_plan_binding_unavailable");
});
it("rejects request-supplied roots/URLs and unknown keys rather than silently stripping them", () => {
 expect(() => parseCustomerPlanProfile({ ...customerProfile(), trustedRoot: {} })).toThrow();
 const p = customerProfile();
 expect(() => parseCustomerPlanProfile({ ...p, producer: { ...p.producer, artifactUrl: "https://foreign.invalid" } })).toThrow();
});
it("projects independently loaded current rows without making observe-only a planning capability", () => {
 const profile = parseCustomerPlanProfile(customerProfile());
 const rows = { environment: { id: "env-owned", organizationId: "org-owned", updatedAt: new Date("2026-10-18T11:00:00Z") },
   account: { id: "connection-owned", organizationId: "org-owned", provider: "aws", externalAccountId: "123456789012", credentialRef: "cloud-v2:connection-owned", regions: ["us-east-1"], enabled: false, autopilotMode: "observe_only", updatedAt: new Date("2026-10-18T11:00:00Z") },
   credential: { id: "connection-owned", organizationId: "org-owned", version: 3, revokedAt: null } };
 const result = projectCustomerTarget(profile, rows);
 expect(result).toMatchObject({ connection: { id: "connection-owned", version: 3 } });
 expect(result?.digest).toMatch(/^[a-f0-9]{64}$/);
 expect(result).not.toHaveProperty("planAvailable");
 expect(result).not.toHaveProperty("executionEnabled");
 expect(projectCustomerTarget(profile, { ...rows, credential: { ...rows.credential, version: 4 } })).toBeNull();
 expect(projectCustomerTarget(profile, { ...rows, credential: { ...rows.credential, revokedAt: new Date() } })).toBeNull();
 expect(projectCustomerTarget(profile, { ...rows, environment: { ...rows.environment, organizationId: "foreign" } })).toBeNull();
});
it("has stable import identity while changed run attempts or subjects never collide", () => {
 const b = parseCustomerSavedPlanBinding(customerBinding());
 expect(customerImportId(b)).toBe(customerImportId(structuredClone(b)));
 const other = { ...b, producer: { ...b.producer, runAttempt: 2 } };
 expect(customerImportId(other)).not.toBe(customerImportId(b));
});
