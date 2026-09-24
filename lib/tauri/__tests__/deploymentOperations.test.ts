import { describe, expect, it } from "vitest";
import {
  canTransition,
  generatePlaybook,
  redactSecrets,
  transitionBlockers,
  validateIntake,
  type DeploymentIntake,
} from "../deploymentOperations";

function validIntake(): DeploymentIntake {
  return {
    id: "dep-demo-1",
    tenantId: "tenant-fictional",
    title: "Fictional checkout configuration release",
    serviceImpactingNow: false,
    requestClass: "planned_release",
    windowStartUtc: "2026-10-10T18:00:00.000Z",
    windowEndUtc: "2026-10-10T20:00:00.000Z",
    displayTimeZone: "ET",
    changeTypes: ["configuration_change"],
    applications: ["Northstar Checkout"],
    clients: ["Sample Client A"],
    deploymentContact: "release.operator@example.test",
    repositoryUrls: ["https://git.example.test/demo/checkout"],
    productionPrUrls: ["https://git.example.test/demo/checkout/pull/42"],
    noPrRequired: false,
    prApprovalStatus: "approved",
    sourceBranch: "release/demo",
    targetBranch: "main",
    deploymentMethod: "GitHub Actions Manual Workflow",
    workflowName: "Deploy Config",
    targetEnvironment: "Production",
    workflowInputs: { branch: "main", environment: "Production", client: "Sample Client A" },
    manualSteps: [],
    lowerEnvironmentTested: ["Stage"],
    lowerEnvironmentValidation: "yes",
    developmentReady: true,
    productionReady: true,
    validationSteps: [{
      id: "validate-config",
      instruction: "Confirm the expected fictional configuration is present.",
      owner: "application_team",
      evidenceRequired: true,
      completed: false,
    }],
    expectedProductionResult: "The fictional configuration matches the approved pull request.",
    validationOwner: "shared",
    rollbackAvailability: "yes",
    rollbackSteps: [{
      id: "rollback",
      instruction: "Redeploy the prior known-good configuration.",
      owner: "devops",
      evidenceRequired: true,
      completed: false,
    }],
    rollbackOwner: "release.operator@example.test",
    backupRequired: false,
    backupEvidenceIds: [],
    changeCreationMethod: "manual_servicenow",
    applicationContact: "app.sme@example.test",
    escalationContact: "incident.commander@example.test",
    facts: [{
      id: "fact-1",
      classification: "confirmed",
      value: "Publishing is manual.",
      sourceEvidenceId: "evidence-1",
      confirmedBy: "owner@example.test",
    }],
  };
}

describe("validateIntake", () => {
  it("accepts a complete planned request", () => {
    expect(validateIntake(validIntake())).toEqual([]);
  });

  it("routes current service impact away from planned deployment", () => {
    const intake = validIntake();
    intake.serviceImpactingNow = true;
    expect(validateIntake(intake).map((issue) => issue.code)).toContain("incident_route_required");
  });

  it("requires all ad hoc governance context", () => {
    const intake = validIntake();
    intake.requestClass = "emergency";
    intake.adHocReason = "Urgent defect";
    expect(validateIntake(intake).map((issue) => issue.code)).toContain("ad_hoc_details_required");
  });

  it("requires a production PR unless explicitly not applicable", () => {
    const intake = validIntake();
    intake.productionPrUrls = [];
    expect(validateIntake(intake).map((issue) => issue.code)).toContain("pr_required");
    intake.noPrRequired = true;
    intake.prApprovalStatus = "not_applicable";
    expect(validateIntake(intake).map((issue) => issue.code)).not.toContain("pr_required");
  });

  it("hard-stops a database backup without evidence", () => {
    const intake = validIntake();
    intake.changeTypes = ["database_change"];
    intake.backupRequired = true;
    expect(validateIntake(intake).map((issue) => issue.code)).toContain("backup_evidence_required");
  });

  it("does not convert uncertain sourced facts into executable steps", () => {
    const intake = validIntake();
    intake.facts[0] = {
      id: "fact-open",
      classification: "open_item",
      value: "Repository write group is unknown.",
      sourceEvidenceId: "transcript-1",
    };
    expect(validateIntake(intake).map((issue) => issue.code)).toContain("uncertain_executable_fact");
  });
});

describe("deployment state machine", () => {
  it("allows only declared transitions", () => {
    expect(canTransition("draft", "submitted")).toBe(true);
    expect(canTransition("draft", "in_progress")).toBe(false);
    expect(canTransition("closed", "in_progress")).toBe(false);
  });

  it("gates production execution by window, approval, access, and separation of duties", () => {
    const intake = validIntake();
    expect(transitionBlockers(intake, "ready_to_deploy", "in_progress", {
      nowUtc: "2026-10-10T17:00:00.000Z",
      actorId: "requester",
      requesterId: "requester",
      approverIds: ["approver"],
      hasRequiredAccess: true,
      approvalsComplete: false,
    })).toEqual(expect.arrayContaining([
      "Required approvals are incomplete.",
      "Production execution is outside the approved deployment window.",
      "Four-eyes separation requires a deployment executor distinct from requester and approvers.",
    ]));
  });

  it("permits a distinct executor inside an approved window", () => {
    expect(transitionBlockers(validIntake(), "ready_to_deploy", "in_progress", {
      nowUtc: "2026-10-10T19:00:00.000Z",
      actorId: "executor",
      requesterId: "requester",
      approverIds: ["approver"],
      hasRequiredAccess: true,
      approvalsComplete: true,
    })).toEqual([]);
  });
});

describe("generatePlaybook", () => {
  it("creates an ordered, versioned, tenant-scoped, human-gated playbook", () => {
    const playbook = generatePlaybook(validIntake(), "2026-09-24T12:00:00.000Z", 3);
    expect(playbook.tenantId).toBe("tenant-fictional");
    expect(playbook.version).toBe(3);
    expect(playbook.steps[0].type).toBe("verify_pr_approval");
    expect(playbook.steps.every((step) => step.requiresHumanConfirmation)).toBe(true);
    expect(playbook.steps.some((step) => step.type === "dispatch_workflow")).toBe(true);
    expect(playbook.steps.some((step) => step.type === "validate")).toBe(true);
    expect(playbook.steps.some((step) => step.type === "rollback")).toBe(true);
    expect(playbook.sourceFactIds).toEqual(["fact-1"]);
  });
});

describe("redactSecrets", () => {
  it("redacts common secret assignments and bearer credentials", () => {
    const redacted = redactSecrets("token=abc123 password: hunter2 Authorization: Bearer eyJ.secret");
    expect(redacted).not.toContain("abc123");
    expect(redacted).not.toContain("hunter2");
    expect(redacted).not.toContain("eyJ.secret");
    expect(redacted.match(/\[REDACTED\]/g)?.length).toBe(3);
  });
});
