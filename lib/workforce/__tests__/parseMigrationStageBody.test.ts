import { describe, it, expect } from "vitest";
import { parseMigrationStageBody } from "../parseMigrationStageBody";

const valid = () => ({
  kind: "add_column",
  target: "users",
  rationale: "Adding email_verified_at for the verification flow.",
  hasReverseScript: true,
  hasActiveWriters: false,
  estimatedRowCount: 1_000_000,
  windowHours: 24,
});

describe("parseMigrationStageBody", () => {
  it("accepts a well-formed body and defaults connector to postgres", () => {
    const r = parseMigrationStageBody(valid());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.descriptor.kind).toBe("add_column");
      expect(r.descriptor.target).toBe("users");
      expect(r.connector).toBe("postgres");
    }
  });

  it("accepts mysql connector when supplied", () => {
    const r = parseMigrationStageBody({ ...valid(), connector: "mysql" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.connector).toBe("mysql");
  });

  it("rejects non-object bodies", () => {
    expect(parseMigrationStageBody(null).ok).toBe(false);
    expect(parseMigrationStageBody("string").ok).toBe(false);
    expect(parseMigrationStageBody(42).ok).toBe(false);
  });

  it("rejects unknown migration kinds", () => {
    const r = parseMigrationStageBody({ ...valid(), kind: "yolo_drop_everything" });
    expect(r.ok).toBe(false);
  });

  it("rejects empty target", () => {
    const r = parseMigrationStageBody({ ...valid(), target: "   " });
    expect(r.ok).toBe(false);
  });

  it("rejects target over 128 chars", () => {
    const r = parseMigrationStageBody({ ...valid(), target: "x".repeat(129) });
    expect(r.ok).toBe(false);
  });

  it("rejects rationale over 2000 chars", () => {
    const r = parseMigrationStageBody({ ...valid(), rationale: "x".repeat(2001) });
    expect(r.ok).toBe(false);
  });

  it("rejects non-boolean hasReverseScript", () => {
    const r = parseMigrationStageBody({ ...valid(), hasReverseScript: "yes" });
    expect(r.ok).toBe(false);
  });

  it("rejects negative estimatedRowCount", () => {
    const r = parseMigrationStageBody({ ...valid(), estimatedRowCount: -1 });
    expect(r.ok).toBe(false);
  });

  it("rejects windowHours > 168", () => {
    const r = parseMigrationStageBody({ ...valid(), windowHours: 200 });
    expect(r.ok).toBe(false);
  });

  it("rejects unknown connector", () => {
    const r = parseMigrationStageBody({ ...valid(), connector: "sqlite" });
    expect(r.ok).toBe(false);
  });

  it("floors fractional numbers (e.g. row count 1.7 → 1)", () => {
    const r = parseMigrationStageBody({ ...valid(), estimatedRowCount: 1.7, windowHours: 24.9 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.descriptor.estimatedRowCount).toBe(1);
      expect(r.descriptor.windowHours).toBe(24);
    }
  });

  it("auto-generates id when omitted", () => {
    const r = parseMigrationStageBody(valid());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.descriptor.id.length).toBeGreaterThan(0);
  });

  it("preserves caller-supplied id", () => {
    const r = parseMigrationStageBody({ ...valid(), id: "mig_custom_123" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.descriptor.id).toBe("mig_custom_123");
  });
});
