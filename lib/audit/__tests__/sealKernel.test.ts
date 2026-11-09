import { describe, expect, it } from "vitest";
import { buildSeal, canonicalJson, eventsRoot, GENESIS_HASH, sealHash, verifySeals, type SealableEvent, type SealRecord } from "../sealKernel";

const t = (m: number) => new Date(Date.UTC(2026, 10, 9, 0, m));
const ev = (id: string, minute: number, extra: Partial<SealableEvent> = {}): SealableEvent => ({ id, kind: "release.transition", subjectKind: "release", subjectId: "r1", outcome: "ok", summary: `event ${id}`, actorUserId: "u1", correlationId: null, detailJson: { b: 2, a: 1 }, createdAt: t(minute), ...extra });

function chain(windows: SealableEvent[][]): { seals: SealRecord[]; byWindow: Map<number, SealableEvent[]> } {
  const seals: SealRecord[] = []; const byWindow = new Map<number, SealableEvent[]>();
  windows.forEach((events, i) => {
    const s = buildSeal({ organizationId: "org", previous: seals.at(-1) ?? null, toCreatedAt: t((i + 1) * 10), events, genesisFrom: new Date(0) });
    seals.push(s); byWindow.set(s.sequence, events);
  });
  return { seals, byWindow };
}

describe("audit seal kernel", () => {
  it("canonicalizes JSON so key order never changes a hash", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 1, e: 0 }] } })).toBe('{"a":{"c":[3,{"e":0,"f":1}],"d":2},"b":1}');
    expect(eventsRoot([ev("1", 1, { detailJson: { a: 1, b: 2 } })])).toBe(eventsRoot([ev("1", 1, { detailJson: { b: 2, a: 1 } })]));
  });

  it("orders events itself, so caller order does not matter", () => {
    expect(eventsRoot([ev("2", 2), ev("1", 1)])).toBe(eventsRoot([ev("1", 1), ev("2", 2)]));
    expect(eventsRoot([])).toBe(GENESIS_HASH);
  });

  it("links seals into a chain starting at genesis", () => {
    const { seals } = chain([[ev("1", 1)], [ev("2", 12)]]);
    expect(seals[0]).toMatchObject({ sequence: 1, prevSealHash: GENESIS_HASH, eventCount: 1 });
    expect(seals[1]).toMatchObject({ sequence: 2, prevSealHash: seals[0].sealHash, fromCreatedAt: seals[0].toCreatedAt });
    const { sealHash: h, ...rest } = seals[1]; expect(sealHash(rest)).toBe(h);
  });

  it("verifies an untouched chain as intact", () => {
    const { seals, byWindow } = chain([[ev("1", 1), ev("2", 2)], [ev("3", 12)]]);
    const r = verifySeals(seals, (s) => byWindow.get(s.sequence)!);
    expect(r.intact).toBe(true);
    expect(r.latestSealHash).toBe(seals[1].sealHash);
  });

  it("detects an edited, deleted or inserted event", () => {
    const { seals, byWindow } = chain([[ev("1", 1), ev("2", 2)], [ev("3", 12)]]);
    const edited = verifySeals(seals, (s) => s.sequence === 1 ? [ev("1", 1), ev("2", 2, { summary: "quietly changed" })] : byWindow.get(s.sequence)!);
    expect(edited.verdicts[0]).toMatchObject({ status: "events_changed" }); expect(edited.verdicts[1].status).toBe("intact");
    const deleted = verifySeals(seals, (s) => s.sequence === 1 ? [ev("1", 1)] : byWindow.get(s.sequence)!);
    expect(deleted.verdicts[0]).toEqual({ sequence: 1, status: "events_changed", expectedCount: 2, actualCount: 1 });
    const inserted = verifySeals(seals, (s) => s.sequence === 2 ? [ev("3", 12), ev("x", 13)] : byWindow.get(s.sequence)!);
    expect(inserted.intact).toBe(false);
  });

  it("detects an altered seal and a broken or reordered chain", () => {
    const { seals, byWindow } = chain([[ev("1", 1)], [ev("2", 12)], [ev("3", 22)]]);
    const altered = seals.map((s) => s.sequence === 2 ? { ...s, eventCount: 5 } : s);
    expect(verifySeals(altered, (s) => byWindow.get(s.sequence)!).verdicts[1].status).toBe("seal_altered");
    const removed = seals.filter((s) => s.sequence !== 2);
    expect(verifySeals(removed, (s) => byWindow.get(s.sequence)!).verdicts[1].status).toBe("chain_broken");
    const relinked = seals.map((s) => s.sequence === 3 ? { ...s, prevSealHash: GENESIS_HASH } : s);
    expect(verifySeals(relinked, (s) => byWindow.get(s.sequence)!).verdicts[2].status).toBe("chain_broken");
  });
});
