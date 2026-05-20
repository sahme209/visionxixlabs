/**
 * Vitest unit tests for the pure DNS sanity checker.
 */

import { describe, it, expect } from "vitest";
import { checkDnsSanity, type DnsRecord } from "../dnsSanityChecker";

const REC = (name: string, type: DnsRecord["type"], value: string, ttl?: number): DnsRecord =>
  ({ name, type, value, ttl });

describe("dnsSanityChecker", () => {
  it("identical sets → ok", () => {
    const r = checkDnsSanity({
      declared: [REC("axiom.app", "A", "1.2.3.4")],
      observed: [REC("axiom.app", "A", "1.2.3.4")],
    });
    expect(r.findings.length).toBe(0);
    expect(r.severity).toBe("ok");
  });

  it("declared but not observed → missing", () => {
    const r = checkDnsSanity({
      declared: [REC("axiom.app", "A", "1.2.3.4")],
      observed: [],
    });
    expect(r.findings[0].kind).toBe("missing");
    expect(r.severity).toBe("medium");
  });

  it("observed but not declared → orphan", () => {
    const r = checkDnsSanity({
      declared: [],
      observed: [REC("rogue.axiom.app", "A", "9.9.9.9")],
    });
    expect(r.findings[0].kind).toBe("orphan");
    expect(r.severity).toBe("low");
  });

  it("value mismatch → value_mismatch + medium severity", () => {
    const r = checkDnsSanity({
      declared: [REC("axiom.app", "A", "1.2.3.4")],
      observed: [REC("axiom.app", "A", "9.9.9.9")],
    });
    expect(r.findings[0].kind).toBe("value_mismatch");
    expect(r.severity).toBe("medium");
  });

  it("ttl mismatch when both supply ttl", () => {
    const r = checkDnsSanity({
      declared: [REC("axiom.app", "A", "1.2.3.4", 300)],
      observed: [REC("axiom.app", "A", "1.2.3.4", 60)],
    });
    expect(r.findings[0].kind).toBe("ttl_mismatch");
    expect(r.severity).toBe("low");
  });

  it("3+ breaking → high severity", () => {
    const r = checkDnsSanity({
      declared: [
        REC("a.axiom.app", "A", "1.1.1.1"),
        REC("b.axiom.app", "A", "1.1.1.2"),
        REC("c.axiom.app", "A", "1.1.1.3"),
      ],
      observed: [],
    });
    expect(r.severity).toBe("high");
  });

  it("name comparison is case-insensitive", () => {
    const r = checkDnsSanity({
      declared: [REC("AXIOM.app", "A", "1.2.3.4")],
      observed: [REC("axiom.APP", "A", "1.2.3.4")],
    });
    expect(r.findings.length).toBe(0);
  });

  it("findings sorted: missing → value_mismatch → ttl → orphan", () => {
    const r = checkDnsSanity({
      declared: [
        REC("a.axiom.app", "A", "1.1.1.1"),
        REC("b.axiom.app", "A", "9.9.9.9"),
        REC("c.axiom.app", "A", "1.1.1.3", 300),
      ],
      observed: [
        REC("b.axiom.app", "A", "1.2.3.4"),
        REC("c.axiom.app", "A", "1.1.1.3", 60),
        REC("ghost.axiom.app", "A", "0.0.0.0"),
      ],
    });
    const kinds = r.findings.map((f) => f.kind);
    expect(kinds[0]).toBe("missing");
    expect(kinds[kinds.length - 1]).toBe("orphan");
  });
});
