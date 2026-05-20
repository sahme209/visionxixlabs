/**
 * Vitest unit tests for the pure cron-expression validator.
 */

import { describe, it, expect } from "vitest";
import { validateCron } from "../cronExpressionValidator";

describe("cronExpressionValidator", () => {
  it("empty string → invalid", () => {
    const r = validateCron("");
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toContain("empty");
  });

  it("wrong field count → invalid", () => {
    const r = validateCron("* * *");
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toContain("expected 5");
  });

  it("'* * * * *' is valid (every minute)", () => {
    const r = validateCron("* * * * *");
    expect(r.valid).toBe(true);
    expect(r.humanReadable).toBe("cron * * * * *");
  });

  it("'*/5 * * * *' → every 5 minutes", () => {
    const r = validateCron("*/5 * * * *");
    expect(r.valid).toBe(true);
    expect(r.humanReadable).toBe("every 5 minutes");
  });

  it("'0 9 * * *' → daily at 09:00", () => {
    const r = validateCron("0 9 * * *");
    expect(r.valid).toBe(true);
    expect(r.humanReadable).toBe("daily at 09:00");
  });

  it("'30 14 * * 1' → every Monday at 14:30", () => {
    const r = validateCron("30 14 * * 1");
    expect(r.valid).toBe(true);
    expect(r.humanReadable).toBe("every Monday at 14:30");
  });

  it("out-of-range field → invalid", () => {
    const r = validateCron("70 * * * *");
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toContain("out-of-range");
  });

  it("range '5-10' valid", () => {
    const r = validateCron("5-10 * * * *");
    expect(r.valid).toBe(true);
  });

  it("list '1,3,5' valid", () => {
    const r = validateCron("1,3,5 * * * *");
    expect(r.valid).toBe(true);
  });

  it("non-numeric field → invalid", () => {
    const r = validateCron("abc * * * *");
    expect(r.valid).toBe(false);
  });
});
