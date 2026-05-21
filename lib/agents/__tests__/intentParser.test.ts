import { describe, it, expect } from "vitest";
import { parseIntent } from "../intentParser";

describe("parseIntent", () => {
  it("empty statement → unknown / 0 confidence", () => {
    const r = parseIntent("  ");
    expect(r.kind).toBe("unknown");
    expect(r.confidence).toBe(0);
  });

  it("investigate verb is picked up", () => {
    const r = parseIntent("Why is the api-prod service slow today?");
    expect(r.kind).toBe("investigate");
  });

  it("fix verb is picked up", () => {
    const r = parseIntent("Please fix the broken pipeline on main");
    expect(r.kind).toBe("fix");
  });

  it("optimize verb is picked up", () => {
    const r = parseIntent("Reduce cost on the prod EBS volumes");
    expect(r.kind).toBe("optimize");
  });

  it("cloud domain is detected from AWS keywords", () => {
    const r = parseIntent("Audit the AWS IAM roles in prod");
    expect(r.domain).toBe("cloud");
    expect(r.kind).toBe("scan");
  });

  it("database domain is detected", () => {
    const r = parseIntent("Investigate the slow Postgres query on orders");
    expect(r.domain).toBe("database");
  });

  it("observability domain is detected", () => {
    const r = parseIntent("The p95 alert is firing on prod-web — check the dashboard");
    expect(r.domain).toBe("observability");
  });

  it("marketing domain stays internal (not exposed to client)", () => {
    const r = parseIntent("Draft a LinkedIn post for our latest launch");
    expect(r.domain).toBe("marketing");
    expect(r.kind).toBe("draft");
  });

  it("critical urgency raises tier", () => {
    const r = parseIntent("CRITICAL: production is on fire");
    expect(r.urgency).toBe("critical");
  });

  it("high urgency is picked up", () => {
    const r = parseIntent("This is urgent — fix today please");
    expect(r.urgency).toBe("high");
  });

  it("low urgency is detected from backlog language", () => {
    const r = parseIntent("Whenever you have time, scan the GCP project");
    expect(r.urgency).toBe("low");
  });

  it("destructive verb sets the flag", () => {
    const r = parseIntent("Delete the unused EBS volumes in us-east-1");
    expect(r.flaggedDestructive).toBe(true);
  });

  it("normal optimize doesn't set destructive flag", () => {
    const r = parseIntent("Optimize cost on idle resources");
    expect(r.flaggedDestructive).toBe(false);
  });

  it("entities are extracted from service-like names", () => {
    const r = parseIntent("Why is api-prod slow on prod-db-02?");
    expect(r.entities.some((e) => /api-prod|prod-db-02/.test(e))).toBe(true);
  });

  it("confidence scales with matches", () => {
    const rich = parseIntent("URGENT: fix the AWS IAM role on prod-web");
    const sparse = parseIntent("hello");
    expect(rich.confidence).toBeGreaterThan(sparse.confidence);
  });

  it("normalisedStatement collapses whitespace + caps at 300 chars", () => {
    const r = parseIntent("   fix    the   pipeline    please   ");
    expect(r.normalisedStatement).toBe("fix the pipeline please");
  });

  it("normalisedStatement is capped at 300 chars", () => {
    const long = "fix the issue ".repeat(50);
    const r = parseIntent(long);
    expect(r.normalisedStatement.length).toBeLessThanOrEqual(300);
  });

  it("rationale text mentions detected signals", () => {
    const r = parseIntent("Urgent: fix the AWS IAM role");
    expect(r.rationale).toMatch(/verb|domain|urgency/);
  });

  it("unknown statement gets human-triage rationale", () => {
    const r = parseIntent("hmm not sure");
    expect(r.kind).toBe("unknown");
    expect(r.rationale).toMatch(/human triage/i);
  });

  it("rollback verb is picked", () => {
    const r = parseIntent("Please roll back the release");
    expect(r.kind).toBe("rollback");
  });

  it("approve verb is picked", () => {
    const r = parseIntent("Approve the staged Terraform plan");
    expect(r.kind).toBe("approve");
  });
});
