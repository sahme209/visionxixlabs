/**
 * Vitest unit tests for the pure dependency-license auditor.
 */

import { describe, it, expect } from "vitest";
import { auditLicenses, type LicensePolicy, type SbomEntry } from "../licenseAuditor";

const E = (name: string, version: string, spdx: string | null): SbomEntry =>
  ({ packageName: name, version, spdxLicense: spdx });

const POLICY: LicensePolicy = {
  allow: ["MIT", "Apache-2.0", "BSD-3-Clause", "ISC"],
  warn:  ["LGPL-3.0", "MPL-2.0"],
  deny:  ["GPL-3.0", "AGPL-3.0"],
};

describe("licenseAuditor", () => {
  it("empty input → ok severity, zero counts", () => {
    const r = auditLicenses({ entries: [], policy: POLICY });
    expect(r.totals).toEqual({ allow: 0, warn: 0, deny: 0, unknown: 0 });
    expect(r.severity).toBe("ok");
  });

  it("classifies allow / warn / deny correctly", () => {
    const r = auditLicenses({
      entries: [
        E("a", "1.0", "MIT"),
        E("b", "1.0", "LGPL-3.0"),
        E("c", "1.0", "GPL-3.0"),
      ],
      policy: POLICY,
    });
    expect(r.totals).toEqual({ allow: 1, warn: 1, deny: 1, unknown: 0 });
    expect(r.severity).toBe("fail");
  });

  it("null or empty license → unknown", () => {
    const r = auditLicenses({
      entries: [E("a", "1.0", null), E("b", "1.0", ""), E("c", "1.0", "  ")],
      policy: POLICY,
    });
    expect(r.totals.unknown).toBe(3);
    expect(r.severity).toBe("warn");
  });

  it("unrecognized-by-policy license defaults to warn (not allow)", () => {
    const r = auditLicenses({
      entries: [E("a", "1.0", "CC0-1.0")],
      policy: POLICY,
    });
    expect(r.totals.warn).toBe(1);
    expect(r.totals.allow).toBe(0);
  });

  it("normalizes license casing", () => {
    const r = auditLicenses({
      entries: [E("a", "1.0", "mit"), E("b", "1.0", "MIT")],
      policy: POLICY,
    });
    expect(r.totals.allow).toBe(2);
    expect(r.byLicense.find((b) => b.license === "MIT")?.count).toBe(2);
  });

  it("byLicense sorted by count desc", () => {
    const r = auditLicenses({
      entries: [
        E("a", "1.0", "MIT"), E("b", "1.0", "MIT"), E("c", "1.0", "MIT"),
        E("d", "1.0", "Apache-2.0"),
      ],
      policy: POLICY,
    });
    expect(r.byLicense[0].license).toBe("MIT");
    expect(r.byLicense[0].count).toBe(3);
    expect(r.byLicense[1].license).toBe("APACHE-2.0");
  });

  it("severity ok only when nothing warn/deny/unknown", () => {
    const r = auditLicenses({
      entries: [E("a", "1.0", "MIT"), E("b", "1.0", "Apache-2.0")],
      policy: POLICY,
    });
    expect(r.severity).toBe("ok");
  });

  it("severity fail trumps warn", () => {
    const r = auditLicenses({
      entries: [E("a", "1.0", "LGPL-3.0"), E("b", "1.0", "GPL-3.0")],
      policy: POLICY,
    });
    expect(r.severity).toBe("fail");
  });
});
