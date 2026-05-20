/**
 * Vitest unit tests for the pure subnet allocator.
 */

import { describe, it, expect } from "vitest";
import { allocateSubnets, parseCidr } from "../subnetAllocator";

describe("parseCidr", () => {
  it("parses valid IPv4 CIDR", () => {
    const p = parseCidr("10.0.0.0/16");
    expect(p?.prefixLength).toBe(16);
    expect(p?.size).toBe(65536);
  });

  it("masks host bits → canonical network address", () => {
    const p = parseCidr("10.0.0.5/24");
    expect(p?.network).toBe(parseCidr("10.0.0.0/24")?.network);
  });

  it("rejects malformed input", () => {
    expect(parseCidr("nope")).toBeNull();
    expect(parseCidr("10.0.0.0/40")).toBeNull();
    expect(parseCidr("999.0.0.0/24")).toBeNull();
  });
});

describe("allocateSubnets", () => {
  it("allocates three /24s out of a /22", () => {
    const r = allocateSubnets({
      parentCidr: "10.0.0.0/22",
      requests: [
        { label: "subnet-a", prefixLength: 24 },
        { label: "subnet-b", prefixLength: 24 },
        { label: "subnet-c", prefixLength: 24 },
      ],
    });
    expect(r.allocations.length).toBe(3);
    expect(r.unsatisfied).toEqual([]);
    expect(r.allocations.map((a) => a.cidr)).toEqual(["10.0.0.0/24", "10.0.1.0/24", "10.0.2.0/24"]);
  });

  it("sorts requests largest-first to avoid fragmentation", () => {
    const r = allocateSubnets({
      parentCidr: "10.0.0.0/24",
      requests: [
        { label: "small", prefixLength: 28 },
        { label: "big",   prefixLength: 25 },
      ],
    });
    expect(r.allocations[0].label).toBe("big");
    expect(r.allocations[0].cidr).toBe("10.0.0.0/25");
  });

  it("unsatisfies requests that don't fit", () => {
    const r = allocateSubnets({
      parentCidr: "10.0.0.0/24",
      requests: [
        { label: "huge", prefixLength: 23 }, // bigger than parent
      ],
    });
    expect(r.allocations).toEqual([]);
    expect(r.unsatisfied[0].label).toBe("huge");
  });

  it("unsatisfies invalid prefixes", () => {
    const r = allocateSubnets({
      parentCidr: "10.0.0.0/24",
      requests: [
        { label: "weird", prefixLength: 99 },
      ],
    });
    expect(r.unsatisfied[0].label).toBe("weird");
  });

  it("computes usable host counts (size − 2) for /24 and below", () => {
    const r = allocateSubnets({
      parentCidr: "10.0.0.0/24",
      requests: [{ label: "x", prefixLength: 24 }],
    });
    expect(r.allocations[0].usableHosts).toBe(254);
    expect(r.allocations[0].firstHost).toBe("10.0.0.1");
    expect(r.allocations[0].lastHost).toBe("10.0.0.254");
  });

  it("/31 and /32 use the full address space (no network/broadcast)", () => {
    const r = allocateSubnets({
      parentCidr: "10.0.0.0/24",
      requests: [{ label: "p2p", prefixLength: 31 }, { label: "host", prefixLength: 32 }],
    });
    const p2p = r.allocations.find((a) => a.label === "p2p")!;
    const host = r.allocations.find((a) => a.label === "host")!;
    expect(p2p.usableHosts).toBe(2);
    expect(host.usableHosts).toBe(1);
  });

  it("invalid parent CIDR → no allocations + every request unsatisfied", () => {
    const r = allocateSubnets({
      parentCidr: "not a cidr",
      requests: [{ label: "a", prefixLength: 24 }],
    });
    expect(r.allocations).toEqual([]);
    expect(r.unsatisfied.length).toBe(1);
  });

  it("reports remainingHosts after allocation", () => {
    const r = allocateSubnets({
      parentCidr: "10.0.0.0/24",
      requests: [{ label: "a", prefixLength: 25 }],
    });
    // /24 = 256 addresses; /25 consumes 128 → 128 remaining.
    expect(r.remainingHosts).toBe(128);
  });
});
