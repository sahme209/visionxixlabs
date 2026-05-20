/**
 * Vitest unit tests for the production env validator.
 *
 * Locks in: severity classification, required vs recommended math,
 * never-leak-value invariant (only valueHash exposed), per-rule
 * custom check predicates.
 */

import { describe, it, expect } from "vitest";
import { validateProductionEnv } from "../envValidator";

describe("production env validator", () => {
  it("fails when no env vars are set", () => {
    const report = validateProductionEnv({} as NodeJS.ProcessEnv);
    expect(report.pass).toBe(false);
    expect(report.requiredFailures).toBeGreaterThan(0);
  });

  it("passes when all required vars are set with valid shapes", () => {
    const env = {
      DATABASE_URL: "postgres://user:pw@host/db",
      NEXTAUTH_SECRET: "a".repeat(40),
      NEXTAUTH_URL: "https://app.example.com",
      CRON_SECRET: "c".repeat(32),
    } as unknown as NodeJS.ProcessEnv;
    const report = validateProductionEnv(env);
    expect(report.pass).toBe(true);
    expect(report.requiredFailures).toBe(0);
  });

  it("flags short NEXTAUTH_SECRET as failing", () => {
    const env = {
      DATABASE_URL: "postgres://x",
      NEXTAUTH_SECRET: "tooshort",
      NEXTAUTH_URL: "https://app.example.com",
      CRON_SECRET: "x".repeat(32),
    } as unknown as NodeJS.ProcessEnv;
    const report = validateProductionEnv(env);
    const rule = report.rules.find((r) => r.key === "NEXTAUTH_SECRET");
    expect(rule?.pass).toBe(false);
  });

  it("flags non-https NEXTAUTH_URL as failing", () => {
    const env = {
      DATABASE_URL: "postgres://x",
      NEXTAUTH_SECRET: "x".repeat(40),
      NEXTAUTH_URL: "not-a-url",
      CRON_SECRET: "x".repeat(32),
    } as unknown as NodeJS.ProcessEnv;
    const report = validateProductionEnv(env);
    const rule = report.rules.find((r) => r.key === "NEXTAUTH_URL");
    expect(rule?.pass).toBe(false);
  });

  it("never echoes the raw env value — only valueHash + key", () => {
    const env = {
      DATABASE_URL: "SUPER_SECRET_VALUE",
      NEXTAUTH_SECRET: "another-secret-12345678901234567890123456789012",
      NEXTAUTH_URL: "https://app.example.com",
      CRON_SECRET: "x".repeat(32),
    } as unknown as NodeJS.ProcessEnv;
    const report = validateProductionEnv(env);
    const serialised = JSON.stringify(report);
    expect(serialised).not.toContain("SUPER_SECRET_VALUE");
    expect(serialised).not.toContain("another-secret");
    // But the rule must still surface presence via valueHash.
    const rule = report.rules.find((r) => r.key === "DATABASE_URL");
    expect(rule?.valueHash).toBeDefined();
    expect(rule?.valueHash?.length).toBe(8);
  });

  it("partitions failures by severity", () => {
    const env = {
      DATABASE_URL: "postgres://x",
      NEXTAUTH_SECRET: "x".repeat(40),
      NEXTAUTH_URL: "https://app.example.com",
      CRON_SECRET: "x".repeat(32),
      // All recommended ones intentionally missing.
    } as unknown as NodeJS.ProcessEnv;
    const report = validateProductionEnv(env);
    expect(report.requiredFailures).toBe(0);
    expect(report.recommendedFailures).toBeGreaterThan(0);
    expect(report.pass).toBe(true);
  });

  it("validates SLACK_WEBHOOK_URL must look like a Slack hook URL", () => {
    const env = {
      DATABASE_URL: "postgres://x",
      NEXTAUTH_SECRET: "x".repeat(40),
      NEXTAUTH_URL: "https://app.example.com",
      CRON_SECRET: "x".repeat(32),
      SLACK_WEBHOOK_URL: "https://example.com/totally-not-slack",
    } as unknown as NodeJS.ProcessEnv;
    const report = validateProductionEnv(env);
    const rule = report.rules.find((r) => r.key === "SLACK_WEBHOOK_URL");
    expect(rule?.pass).toBe(false);
  });
});
