import { describe, it, expect, beforeEach } from "vitest";
import {
  consolidate,
  retrieveMemories,
  __resetMemoryCounter,
  type RawObservation,
  type MemoryStore,
  type MemoryRecord,
} from "../agentMemoryConsolidator";

const NOW = new Date("2026-05-21T12:00:00.000Z");

function obs(overrides: Partial<RawObservation> & { id: string; tags: string[] }): RawObservation {
  return {
    at: "2026-05-21T11:00:00.000Z",
    agentId: "detector",
    narrative: "Test observation",
    outcomeQuality: 0.9,
    recurrent: false,
    ...overrides,
  };
}

function rec(overrides: Partial<MemoryRecord> & { id: string; tags: string[] }): MemoryRecord {
  return {
    kind: "episodic",
    lastSeenAt: NOW.toISOString(),
    agentIds: ["detector"],
    narrative: "existing",
    reinforcementCount: 1,
    relevance: 0.5,
    ...overrides,
  };
}

beforeEach(() => __resetMemoryCounter());

describe("consolidate", () => {
  it("empty observations + empty store → empty result", () => {
    const r = consolidate({ store: { records: [] }, observations: [], now: NOW });
    expect(r.store.records).toEqual([]);
    expect(r.added).toEqual([]);
  });

  it("new observation creates an episodic record", () => {
    const r = consolidate({
      store: { records: [] },
      observations: [obs({ id: "o1", tags: ["aws", "cost"] })],
      now: NOW,
    });
    expect(r.added.length).toBe(1);
    expect(r.added[0].kind).toBe("episodic");
    expect(r.added[0].tags).toContain("aws");
  });

  it("recurrent observation creates a procedural record", () => {
    const r = consolidate({
      store: { records: [] },
      observations: [obs({ id: "o1", tags: ["a", "b"], recurrent: true })],
      now: NOW,
    });
    expect(r.added[0].kind).toBe("procedural");
  });

  it("matching tags reinforce existing record + bump count", () => {
    const store: MemoryStore = {
      records: [rec({ id: "m1", tags: ["aws", "cost"], reinforcementCount: 1 })],
    };
    const r = consolidate({
      store,
      observations: [obs({ id: "o1", tags: ["aws", "cost"] })],
      now: NOW,
    });
    expect(r.reinforced.length).toBe(1);
    expect(r.reinforced[0].reinforcementCount).toBe(2);
    expect(r.added.length).toBe(0);
  });

  it("recurrent reinforcement past threshold promotes episodic → semantic", () => {
    const store: MemoryStore = {
      records: [rec({ id: "m1", tags: ["aws", "cost"], reinforcementCount: 2, kind: "episodic" })],
    };
    const r = consolidate({
      store,
      observations: [obs({ id: "o1", tags: ["aws", "cost"], recurrent: true })],
      now: NOW,
    });
    expect(r.promoted.length).toBe(1);
    expect(r.promoted[0].kind).toBe("semantic");
  });

  it("tags below overlap threshold do NOT reinforce — they create a new record", () => {
    const store: MemoryStore = {
      records: [rec({ id: "m1", tags: ["aws", "cost"], reinforcementCount: 1 })],
    };
    const r = consolidate({
      store,
      observations: [obs({ id: "o1", tags: ["postgres", "schema"] })],
      now: NOW,
    });
    expect(r.added.length).toBe(1);
    expect(r.reinforced.length).toBe(0);
  });

  it("prunes records past maxAgeDays without reinforcement", () => {
    const longAgo = new Date(NOW.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const store: MemoryStore = {
      records: [rec({ id: "m1", tags: ["a"], lastSeenAt: longAgo })],
    };
    const r = consolidate({ store, observations: [], now: NOW, maxAgeDays: 180 });
    expect(r.pruned.length).toBe(1);
    expect(r.store.records.length).toBe(0);
  });

  it("does not prune fresh records", () => {
    const store: MemoryStore = {
      records: [rec({ id: "m1", tags: ["a"], reinforcementCount: 5 })],
    };
    const r = consolidate({ store, observations: [], now: NOW });
    expect(r.pruned.length).toBe(0);
  });

  it("union of tags + agentIds on reinforcement", () => {
    const store: MemoryStore = {
      records: [rec({ id: "m1", tags: ["aws", "cost"], agentIds: ["detector"] })],
    };
    const r = consolidate({
      store,
      observations: [obs({ id: "o1", tags: ["aws", "cost", "ebs"], agentId: "reasoner" })],
      now: NOW,
    });
    expect(r.reinforced[0].tags).toContain("ebs");
    expect(r.reinforced[0].agentIds).toContain("reasoner");
    expect(r.reinforced[0].agentIds).toContain("detector");
  });

  it("relevance score is bounded 0..1", () => {
    const r = consolidate({
      store: { records: [] },
      observations: [obs({ id: "o1", tags: ["a"] })],
      now: NOW,
    });
    expect(r.added[0].relevance).toBeGreaterThanOrEqual(0);
    expect(r.added[0].relevance).toBeLessThanOrEqual(1);
  });
});

describe("retrieveMemories", () => {
  it("empty query tags → empty result", () => {
    const r = retrieveMemories({ records: [rec({ id: "m1", tags: ["a"] })] }, []);
    expect(r).toEqual([]);
  });

  it("returns matches sorted by overlap × relevance", () => {
    const store: MemoryStore = {
      records: [
        rec({ id: "m1", tags: ["aws", "cost"], relevance: 0.8 }),
        rec({ id: "m2", tags: ["aws"],         relevance: 0.9 }),
        rec({ id: "m3", tags: ["azure"],       relevance: 0.9 }),
      ],
    };
    const r = retrieveMemories(store, ["aws", "cost"], 3);
    expect(r[0].id).toBe("m1"); // higher overlap × relevance
    expect(r.some((x) => x.id === "m3")).toBe(false); // azure doesn't overlap
  });

  it("honours topN limit", () => {
    const store: MemoryStore = {
      records: Array.from({ length: 10 }, (_, i) =>
        rec({ id: `m${i}`, tags: ["aws"], relevance: 0.5 }),
      ),
    };
    const r = retrieveMemories(store, ["aws"], 3);
    expect(r.length).toBe(3);
  });
});
