import { describe, expect, it } from "vitest";
import {
  ALL_DEPLOYMENT_TYPES,
  deploymentTypeLabel,
  generateSop,
  type DeploymentType,
  type SopSectionId,
} from "../sopGenerator";

/* ──────────────────────────────────────────────────────────────────
   Catalog integrity.
   ────────────────────────────────────────────────────────────── */

describe("ALL_DEPLOYMENT_TYPES catalog", () => {
  it("contains the 10 deployment types from spec §3", () => {
    expect(ALL_DEPLOYMENT_TYPES).toHaveLength(10);
  });

  it("every deployment type has a non-empty operator-readable label", () => {
    for (const t of ALL_DEPLOYMENT_TYPES) {
      const label = deploymentTypeLabel(t);
      expect(label.length).toBeGreaterThan(3);
      expect(label).not.toMatch(/_/);
    }
  });
});

/* ──────────────────────────────────────────────────────────────────
   Document shape — every type produces every section.
   ────────────────────────────────────────────────────────────── */

const REQUIRED_SECTIONS: ReadonlyArray<SopSectionId> = [
  "purpose",
  "scope",
  "roles_and_responsibilities",
  "pre_deployment_readiness_checklist",
  "branch_validation_checklist",
  "change_ticket_checklist",
  "release_evidence_checklist",
  "deployment_execution_steps",
  "post_deployment_validation_steps",
  "rollback_steps",
  "communication_templates",
  "go_no_go_rules",
  "audit_and_evidence_requirements",
  "exception_handling_process",
  "emergency_change_process",
  "post_incident_follow_up",
];

describe("generateSop — required sections per type", () => {
  it.each(ALL_DEPLOYMENT_TYPES)("%s produces all 16 required sections in order", (t) => {
    const doc = generateSop(t, { now: new Date("2026-06-01T00:00:00Z") });
    expect(doc.sections.map((s) => s.id)).toEqual(REQUIRED_SECTIONS);
  });

  it.each(ALL_DEPLOYMENT_TYPES)("%s — every section has at least one bullet", (t) => {
    const doc = generateSop(t);
    for (const sec of doc.sections) {
      expect(sec.bullets.length).toBeGreaterThan(0);
      for (const b of sec.bullets) {
        expect(b.length).toBeGreaterThan(4);
      }
    }
  });

  it.each(ALL_DEPLOYMENT_TYPES)("%s — section titles are human-readable (no underscores)", (t) => {
    const doc = generateSop(t);
    for (const sec of doc.sections) {
      expect(sec.title).not.toMatch(/_/);
      expect(sec.title.length).toBeGreaterThan(3);
    }
  });
});

/* ──────────────────────────────────────────────────────────────────
   Branch validation checklist is exactly the 18 spec checks.
   ────────────────────────────────────────────────────────────── */

describe("branch validation checklist", () => {
  it.each(ALL_DEPLOYMENT_TYPES)("%s includes all 18 branch-validation bullets", (t) => {
    const doc = generateSop(t);
    const sec = doc.sections.find((s) => s.id === "branch_validation_checklist");
    expect(sec).toBeDefined();
    expect(sec!.bullets).toHaveLength(18);
  });
});

/* ──────────────────────────────────────────────────────────────────
   Type-specific content sanity — each type carries its
   signature language so a UI mix-up would be obvious.
   ────────────────────────────────────────────────────────────── */

describe("type-specific signatures", () => {
  it("kubernetes_helm execution steps reference helm upgrade", () => {
    const doc = generateSop("kubernetes_helm");
    const sec = doc.sections.find((s) => s.id === "deployment_execution_steps");
    expect(sec!.bullets.some((b) => /helm upgrade/i.test(b))).toBe(true);
    expect(sec!.bullets.some((b) => /kubectl rollout/i.test(b))).toBe(true);
  });

  it("kubernetes_helm rollback steps reference helm rollback", () => {
    const doc = generateSop("kubernetes_helm");
    const sec = doc.sections.find((s) => s.id === "rollback_steps");
    expect(sec!.bullets.some((b) => /helm rollback/i.test(b))).toBe(true);
  });

  it("database_liquibase references checksum and DATABASECHANGELOG", () => {
    const doc = generateSop("database_liquibase");
    const evidence = doc.sections.find((s) => s.id === "release_evidence_checklist");
    const execution = doc.sections.find((s) => s.id === "deployment_execution_steps");
    expect(evidence!.bullets.some((b) => /DATABASECHANGELOG/.test(b))).toBe(true);
    expect(execution!.bullets.some((b) => /liquibase|flyway/i.test(b))).toBe(true);
    expect(execution!.bullets.some((b) => /checksum/i.test(b))).toBe(true);
  });

  it("airflow_dag references DAG / schedule / sensor concepts", () => {
    const doc = generateSop("airflow_dag");
    const preDeploy = doc.sections.find((s) => s.id === "pre_deployment_readiness_checklist");
    const validation = doc.sections.find((s) => s.id === "post_deployment_validation_steps");
    expect(preDeploy!.bullets.some((b) => /schedule/i.test(b) && /retry/i.test(b))).toBe(true);
    expect(validation!.bullets.some((b) => /sensor/i.test(b))).toBe(true);
  });

  it("terraform_iac references plan + apply + state", () => {
    const doc = generateSop("terraform_iac");
    const exec = doc.sections.find((s) => s.id === "deployment_execution_steps");
    expect(exec!.bullets.some((b) => /terraform plan/i.test(b))).toBe(true);
    expect(exec!.bullets.some((b) => /terraform apply/i.test(b))).toBe(true);
  });

  it("emergency_fix references reconciliation task pre-creation", () => {
    const doc = generateSop("emergency_fix");
    const preDeploy = doc.sections.find((s) => s.id === "pre_deployment_readiness_checklist");
    expect(preDeploy!.bullets.some((b) => /reconciliation task/i.test(b))).toBe(true);
  });

  it("rollback_recovery references previous release tag / Helm revision", () => {
    const doc = generateSop("rollback_recovery");
    const preDeploy = doc.sections.find((s) => s.id === "pre_deployment_readiness_checklist");
    expect(preDeploy!.bullets.some((b) => /previous (verified )?release tag|helm revision/i.test(b))).toBe(true);
  });

  it("manual_reconciliation references source-of-truth language", () => {
    const doc = generateSop("manual_reconciliation");
    const preDeploy = doc.sections.find((s) => s.id === "pre_deployment_readiness_checklist");
    expect(preDeploy!.bullets.some((b) => /source.of.truth/i.test(b))).toBe(true);
  });

  it("data_pipeline references file pattern / sidecar / idempotency", () => {
    const doc = generateSop("data_pipeline");
    const preDeploy = doc.sections.find((s) => s.id === "pre_deployment_readiness_checklist");
    expect(preDeploy!.bullets.some((b) => /file.pattern|wildcard/i.test(b))).toBe(true);
    expect(preDeploy!.bullets.some((b) => /sidecar|control.file/i.test(b))).toBe(true);
    expect(preDeploy!.bullets.some((b) => /idempotency|batch.ID/i.test(b))).toBe(true);
  });

  it("connector references downstream consumer / retry", () => {
    const doc = generateSop("connector");
    const preDeploy = doc.sections.find((s) => s.id === "pre_deployment_readiness_checklist");
    expect(preDeploy!.bullets.some((b) => /downstream/i.test(b))).toBe(true);
    expect(preDeploy!.bullets.some((b) => /retry/i.test(b))).toBe(true);
  });

  it("application references release tag + rollback reference + change window", () => {
    const doc = generateSop("application");
    const preDeploy = doc.sections.find((s) => s.id === "pre_deployment_readiness_checklist");
    expect(preDeploy!.bullets.some((b) => /release tag/i.test(b))).toBe(true);
    expect(preDeploy!.bullets.some((b) => /rollback reference/i.test(b))).toBe(true);
    expect(preDeploy!.bullets.some((b) => /change window/i.test(b))).toBe(true);
  });
});

/* ──────────────────────────────────────────────────────────────────
   Customer-facing copy guards.
   ────────────────────────────────────────────────────────────── */

describe("copy guards", () => {
  it.each(ALL_DEPLOYMENT_TYPES)("%s — no internal jargon leaks", (t) => {
    const doc = generateSop(t);
    for (const sec of doc.sections) {
      for (const b of sec.bullets) {
        expect(b).not.toMatch(/process\.env|prisma|node_modules|@anthropic-ai/i);
      }
    }
  });
});

/* ──────────────────────────────────────────────────────────────────
   GenerateSopOptions.
   ────────────────────────────────────────────────────────────── */

describe("generateSop options", () => {
  it("opts.now overrides generatedAt deterministically", () => {
    const at = new Date("2026-06-01T22:00:00Z");
    const doc = generateSop("application", { now: at });
    expect(doc.generatedAt).toBe(at.toISOString());
  });

  it("opts.purpose overrides the default purpose bullet AND surfaces on the doc shape", () => {
    const doc = generateSop("application", { purpose: "Custom org purpose." });
    expect(doc.purposeOverride).toBe("Custom org purpose.");
    const sec = doc.sections.find((s) => s.id === "purpose");
    expect(sec!.bullets[0]).toBe("Custom org purpose.");
  });

  it("default purpose is non-empty per type when no override given", () => {
    for (const t of ALL_DEPLOYMENT_TYPES as DeploymentType[]) {
      const doc = generateSop(t);
      const sec = doc.sections.find((s) => s.id === "purpose");
      expect(sec!.bullets[0].length).toBeGreaterThan(20);
    }
  });
});
