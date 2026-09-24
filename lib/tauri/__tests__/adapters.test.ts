import { describe, expect, it } from "vitest";
import {
  SecureMockAdapter,
  classifyDeploymentError,
  requiredAdapterSystems,
} from "../adapters";

const request = {
  tenantId: "tenant-demo",
  correlationId: "correlation-1",
  actorId: "operator-1",
  payload: { workflow: "Deploy Config" },
};

describe("SecureMockAdapter", () => {
  it("exposes every required connector contract", () => {
    expect(requiredAdapterSystems).toHaveLength(15);
    expect(requiredAdapterSystems).toEqual(expect.arrayContaining([
      "github", "servicenow", "oracle", "airflow", "azure", "kubernetes",
      "helm", "registry", "vault", "pagerduty", "confluence",
    ]));
  });

  it("runs deterministic mock success without claiming live mode", async () => {
    const adapter = new SecureMockAdapter("github", "mock", {
      outcome: "success",
      data: { approved: true },
    });
    const result = await adapter.execute(request);
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("mock");
    expect(result.data).toEqual({ approved: true });
    expect(result.audit.tenantId).toBe("tenant-demo");
  });

  it("requires confirmation for write mode", async () => {
    const adapter = new SecureMockAdapter("github", "write");
    const result = await adapter.execute(request);
    expect(result.ok).toBe(false);
    expect(result.error?.category).toBe("approval");
  });

  it("separates repository permission errors from generic contributor access", async () => {
    const adapter = new SecureMockAdapter("github", "sandbox", {
      outcome: "permission_denied",
      message: "Run Workflow button not visible",
    });
    const result = await adapter.execute(request);
    expect(result.error).toMatchObject({ category: "access", retryable: false });
  });

  it("redacts secrets from adapter errors", async () => {
    const adapter = new SecureMockAdapter("servicenow", "mock", {
      outcome: "failure",
      message: "token=super-secret ServiceNow failed",
    });
    const result = await adapter.execute(request);
    expect(result.error?.message).not.toContain("super-secret");
    expect(result.error?.message).toContain("[REDACTED]");
  });
});

describe("classifyDeploymentError", () => {
  it("does not mislabel a Node warning as the ServiceNow root cause", () => {
    expect(classifyDeploymentError([
      "Node 16 is deprecated",
      "This user does not belong to assigned workgroup",
    ])).toMatchObject({ category: "access", blocking: true });
  });

  it("treats a lone Node deprecation as non-blocking", () => {
    expect(classifyDeploymentError(["Deprecated Node runtime"])).toMatchObject({
      category: "build",
      blocking: false,
    });
  });

  it("blocks Helm resource drift", () => {
    expect(classifyDeploymentError(["Helm conflict: resource drift detected"])).toMatchObject({
      category: "helm",
      blocking: true,
    });
  });

  it("blocks an omitted table drop", () => {
    expect(classifyDeploymentError(["Missing table drop for CUSTOMER_T"])).toMatchObject({
      category: "database",
      blocking: true,
    });
  });

  it("blocks unknown failures pending review", () => {
    expect(classifyDeploymentError(["Unexpected frobnicator output"])).toMatchObject({
      category: "unknown",
      blocking: true,
    });
  });
});
