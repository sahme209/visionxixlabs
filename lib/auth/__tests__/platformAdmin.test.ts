/**
 * Vitest unit tests for the platform-admin gate.
 *
 * The gate reads ADMIN_EMAILS from process.env. Tests save/restore
 * the env between cases so the suite is order-independent.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isPlatformAdmin, listAdminEmails } from "../platformAdmin";

const ORIGINAL = process.env.ADMIN_EMAILS;

describe("platformAdmin gate", () => {
  beforeEach(() => {
    delete process.env.ADMIN_EMAILS;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = ORIGINAL;
  });

  it("returns false when ADMIN_EMAILS is unset", () => {
    expect(isPlatformAdmin("anyone@example.com")).toBe(false);
  });

  it("returns false when email is undefined", () => {
    process.env.ADMIN_EMAILS = "admin@axiom.dev";
    expect(isPlatformAdmin(undefined)).toBe(false);
  });

  it("matches case-insensitively", () => {
    process.env.ADMIN_EMAILS = "Admin@AXIOM.DEV";
    expect(isPlatformAdmin("admin@axiom.dev")).toBe(true);
    expect(isPlatformAdmin("ADMIN@AXIOM.DEV")).toBe(true);
  });

  it("supports multiple admin emails (comma-separated)", () => {
    process.env.ADMIN_EMAILS = "a@x.com, b@y.com,c@z.com ";
    expect(isPlatformAdmin("a@x.com")).toBe(true);
    expect(isPlatformAdmin("b@y.com")).toBe(true);
    expect(isPlatformAdmin("c@z.com")).toBe(true);
    expect(isPlatformAdmin("d@w.com")).toBe(false);
  });

  it("listAdminEmails returns the parsed list, trimmed", () => {
    process.env.ADMIN_EMAILS = " a@x.com ,b@y.com , c@z.com";
    expect(listAdminEmails()).toEqual(["a@x.com", "b@y.com", "c@z.com"]);
  });

  it("listAdminEmails returns [] when env unset", () => {
    expect(listAdminEmails()).toEqual([]);
  });
});
