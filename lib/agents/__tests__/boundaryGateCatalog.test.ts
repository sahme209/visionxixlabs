/**
 * Vitest unit tests for the pure boundary catalog + classifier.
 */

import { describe, it, expect } from "vitest";
import {
  classifyBoundary, findBoundaryClass, listBoundaryClasses,
} from "../boundaryGateCatalog";

describe("boundaryGateCatalog", () => {
  it("lists 6 classes", () => {
    expect(listBoundaryClasses().length).toBe(6);
  });

  it("findBoundaryClass returns null for unknown", () => {
    // @ts-expect-error: intentionally pass invalid name
    expect(findBoundaryClass("not-a-class")).toBeNull();
  });

  it("each class has a positive minApprovals + non-empty roles", () => {
    for (const c of listBoundaryClasses()) {
      expect(c.minApprovals).toBeGreaterThan(0);
      expect(c.requiredApproverRoles.length).toBeGreaterThan(0);
    }
  });

  it("readOnly classifies to read_only regardless of radius", () => {
    expect(classifyBoundary({ blastRadius: "org", touchesCustomerData: false, readOnly: true })).toBe("read_only");
  });

  it("touchesCustomerData → data_plane", () => {
    expect(classifyBoundary({ blastRadius: "single_resource", touchesCustomerData: true, readOnly: false })).toBe("data_plane");
  });

  it("blastRadius maps when not read-only / not customer data", () => {
    expect(classifyBoundary({ blastRadius: "single_resource", touchesCustomerData: false, readOnly: false })).toBe("low_blast_radius");
    expect(classifyBoundary({ blastRadius: "service",         touchesCustomerData: false, readOnly: false })).toBe("service_scoped");
    expect(classifyBoundary({ blastRadius: "account",         touchesCustomerData: false, readOnly: false })).toBe("account_scoped");
    expect(classifyBoundary({ blastRadius: "org",             touchesCustomerData: false, readOnly: false })).toBe("org_scoped");
  });

  it("org_scoped + data_plane require all roles (strict)", () => {
    expect(findBoundaryClass("org_scoped")?.requiresAllRequiredRoles).toBe(true);
    expect(findBoundaryClass("data_plane")?.requiresAllRequiredRoles).toBe(true);
  });

  it("low classes don't require all roles", () => {
    expect(findBoundaryClass("read_only")?.requiresAllRequiredRoles).toBe(false);
    expect(findBoundaryClass("low_blast_radius")?.requiresAllRequiredRoles).toBe(false);
  });
});
