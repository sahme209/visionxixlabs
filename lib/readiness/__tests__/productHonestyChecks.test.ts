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

  // ---------------------------------------------------------------------------
  // Regression suite — patterns added after specific honesty bugs were fixed
  // ---------------------------------------------------------------------------

  it("flags 'auto-refresh on' as a fabricated refresh claim", () => {
    const findings = scanStringForHonesty(
      "fixture.tsx",
      `<span>3:14:22 PM · auto-refresh on</span>`,
    );
    const hit = findings.find((f) => f.id.startsWith("auto_refresh_on"));
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe("high");
  });

  it("flags 'Live · ReleaseOps engine operating'-style claims", () => {
    const findings = scanStringForHonesty(
      "fixture.tsx",
      `<p>Live · ReleaseOps engine operating</p>`,
    );
    expect(findings.find((f) => f.id.startsWith("engine_operating_claim"))).toBeDefined();
  });

  it("flags fabricated dollar savings (e.g. $4,200/mo in savings)", () => {
    const findings = scanStringForHonesty(
      "fixture.tsx",
      `<p>$4,200/mo in savings locked</p>`,
    );
    const hit = findings.find((f) => f.id.startsWith("fabricated_savings"));
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe("high");
  });

  it("flags fabricated lifetime savings like '$48,720 lifetime savings'", () => {
    const findings = scanStringForHonesty(
      "fixture.tsx",
      `<p>$48,720 lifetime savings</p>`,
    );
    expect(findings.find((f) => f.id.startsWith("fabricated_savings"))).toBeDefined();
  });

  it("flags 'fully autonomous' as unsupported autonomy claim", () => {
    const findings = scanStringForHonesty(
      "fixture.tsx",
      `<p>Axiom operates fully autonomous remediation.</p>`,
    );
    expect(findings.find((f) => f.id.startsWith("fully_autonomous"))).toBeDefined();
  });

  it("flags 'Live · Agent operational' unconditional badge", () => {
    const findings = scanStringForHonesty(
      "fixture.tsx",
      `<p>Live · Agent operational</p>`,
    );
    const hit = findings.find((f) => f.id.startsWith("agent_operational_unconditional"));
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe("high");
  });

  it("does not flag honest 'governed automation' phrasing", () => {
    const findings = scanStringForHonesty(
      "fixture.tsx",
      `<p>Governed automation: every mutation requires explicit approval.</p>`,
    );
    expect(findings).toHaveLength(0);
  });
});
