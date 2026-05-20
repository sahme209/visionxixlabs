/**
 * Vitest unit tests for the Phase 135 tenant-admin role checks.
 *
 * Locks in: case-insensitive role match, empty / null handling, the
 * OR semantic of isAdminOrOwner.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAdminOrOwner, isTenantAdmin } from "../platformAdmin";

const ORIGINAL = process.env.ADMIN_EMAILS;

describe("isTenantAdmin", () => {
  it("accepts 'owner'", () => {
    expect(isTenantAdmin(["owner"])).toBe(true);
  });

  it("accepts 'admin'", () => {
    expect(isTenantAdmin(["admin"])).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isTenantAdmin(["OWNER"])).toBe(true);
    expect(isTenantAdmin(["Admin"])).toBe(true);
  });

  it("rejects other roles", () => {
    expect(isTenantAdmin(["viewer"])).toBe(false);
    expect(isTenantAdmin(["member"])).toBe(false);
    expect(isTenantAdmin([])).toBe(false);
    expect(isTenantAdmin(undefined)).toBe(false);
  });
});

describe("isAdminOrOwner OR semantic", () => {
  beforeEach(() => {
    delete process.env.ADMIN_EMAILS;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = ORIGINAL;
  });

  it("passes when caller is a platform admin (regardless of roles)", () => {
    process.env.ADMIN_EMAILS = "ops@axiom.dev";
    expect(isAdminOrOwner({ email: "ops@axiom.dev", roles: ["viewer"] })).toBe(true);
  });

  it("passes when caller is a tenant owner (regardless of email)", () => {
    expect(isAdminOrOwner({ email: "alice@anywhere.com", roles: ["owner"] })).toBe(true);
  });

  it("fails when caller is neither", () => {
    expect(isAdminOrOwner({ email: "alice@anywhere.com", roles: ["viewer"] })).toBe(false);
  });

  it("fails when caller has no roles AND no admin email", () => {
    expect(isAdminOrOwner({ email: undefined, roles: undefined })).toBe(false);
  });
});
