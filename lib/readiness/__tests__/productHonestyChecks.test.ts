/**
 * Vitest unit tests for the product honesty content scanner.
 *
 * Uses the pure scanStringForHonesty() variant so tests run without
 * touching the filesystem.
 */

import { describe, it, expect } from "vitest";
import { scanStringForHonesty } from "../productHonestyChecks";

describe("product honesty scanner", () => {
  it("flags 'Azure live' claims as high severity", () => {
    const findings = scanStringForHonesty(
      "fixture.tsx",
      `<h1>Azure live deployment dashboard</h1>`,
    );
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe("high");
    expect(findings[0].id).toContain("azure_live_claim");
  });

  it("flags 'GCP live' claims as high severity", () => {
    const findings = scanStringForHonesty(
      "fixture.tsx",
      `<p>Connect GCP live scan for full inventory.</p>`,
    );
    expect(findings.find((f) => f.id.startsWith("gcp_live_claim"))).toBeDefined();
  });

  it("flags 'book a call' as medium severity", () => {
    const findings = scanStringForHonesty(
      "fixture.tsx",
      `<button>Book a call with our team</button>`,
    );
    expect(findings.find((f) => f.id.startsWith("book_a_call_primary"))).toBeDefined();
  });

  it("flags 'fix applied' as high severity (implies production mutation)", () => {
    const findings = scanStringForHonesty(
      "fixture.tsx",
      `<span>Fix applied · 12s ago</span>`,
    );
    const hit = findings.find((f) => f.id.startsWith("fix_applied_claim"));
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe("high");
  });

  it("flags 'autonomous execution' as high severity", () => {
    const findings = scanStringForHonesty(
      "fixture.tsx",
      `Axiom runs autonomous execution across your fleet.`,
    );
    expect(findings.find((f) => f.id.startsWith("autonomous_execution"))).toBeDefined();
  });

  it("does not flag honest preview / partial labels", () => {
    const findings = scanStringForHonesty(
      "fixture.tsx",
      `
        Preview · Live validation · Reviewed · Requires approval ·
        Pending review · Awaiting credentials · Simulated only
      `,
    );
    expect(findings).toHaveLength(0);
  });

  it("returns line numbers + snippets for matched phrases", () => {
    const findings = scanStringForHonesty(
      "fixture.tsx",
      `line 1\nbook a call now\nline 3`,
    );
    const hit = findings[0];
    expect(hit.line).toBe(2);
    expect(hit.snippet).toContain("book a call");
  });
});
