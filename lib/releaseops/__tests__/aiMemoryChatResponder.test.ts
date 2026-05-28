import { describe, expect, it } from "vitest";
import {
  buildChatHistoryResponse,
  buildChatTurnDeleteResponse,
  persistChatTurn,
  type ChatTurnRepo,
  type ChatTurnRow,
} from "../aiMemoryChatResponder";
import type { ChatAnswer } from "../aiMemoryChatEngine";

const NOW = new Date("2026-05-28T12:00:00Z");

interface Stub extends ChatTurnRepo {
  _rows: ChatTurnRow[];
  _failNext?: "missing_table" | "boom";
}

function makeRepo(): Stub {
  const stub: Stub = {
    _rows: [],
    aiMemoryChatTurn: {
      async create({ data }) {
        if (stub._failNext === "missing_table") {
          stub._failNext = undefined;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e: any = new Error("relation does not exist");
          e.code = "P2021";
          throw e;
        }
        if (stub._failNext === "boom") { stub._failNext = undefined; throw new Error("db down"); }
        const row: ChatTurnRow = {
          id: `turn_${stub._rows.length + 1}`,
          organizationId: data.organizationId,
          userId: data.userId,
          question: data.question,
          answer: data.answer,
          citationsJson: data.citationsJson,
          citationDetailsJson: data.citationDetailsJson ?? null,
          outcome: data.outcome,
          errorMessage: data.errorMessage,
          modelHint: data.modelHint,
          contextEntriesCount: data.contextEntriesCount,
          contextSummariesCount: data.contextSummariesCount,
          engineVersion: data.engineVersion,
          generatedAt: new Date(NOW.getTime() + stub._rows.length * 1000),
        };
        stub._rows.push(row);
        return row;
      },
      async findMany({ where, take }) {
        if (stub._failNext === "missing_table") {
          stub._failNext = undefined;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e: any = new Error("relation does not exist");
          e.code = "P2021";
          throw e;
        }
        if (stub._failNext === "boom") { stub._failNext = undefined; throw new Error("db down"); }
        const filtered = stub._rows.filter((r) => {
          if (r.organizationId !== where.organizationId) return false;
          if (where.userId !== undefined && r.userId !== where.userId) return false;
          return true;
        }).sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
        return typeof take === "number" ? filtered.slice(0, take) : filtered;
      },
      async findUnique({ where }) {
        if (stub._failNext === "missing_table") {
          stub._failNext = undefined;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e: any = new Error("relation does not exist");
          e.code = "P2021";
          throw e;
        }
        if (stub._failNext === "boom") { stub._failNext = undefined; throw new Error("db down"); }
        return stub._rows.find((r) => r.id === where.id) ?? null;
      },
      async delete({ where }) {
        const idx = stub._rows.findIndex((r) => r.id === where.id);
        if (idx < 0) throw new Error("not found");
        const [removed] = stub._rows.splice(idx, 1);
        return removed;
      },
    },
  };
  return stub;
}

function answer(overrides: Partial<ChatAnswer> = {}): ChatAnswer {
  return {
    outcome: "ai_generated",
    answer: "Because of blocking violations.",
    citations: ["e1", "s1"],
    modelHint: "claude-opus-4-7",
    errorMessage: null,
    engineVersion: "ai-memory-chat-v1.0.0",
    ...overrides,
  };
}

describe("persistChatTurn", () => {
  it("returns view on success and writes row", async () => {
    const stub = makeRepo();
    const out = await persistChatTurn(stub, {
      organizationId: "o", userId: "u1",
      question: "Why did we block?", answer: answer(),
      contextEntriesCount: 10, contextSummariesCount: 2,
    });
    expect(out).not.toBeNull();
    expect(out!.question).toBe("Why did we block?");
    expect(out!.citations).toEqual(["e1", "s1"]);
    expect(out!.outcome).toBe("ai_generated");
    expect(stub._rows.length).toBe(1);
  });

  it("returns null on db failure (never throws)", async () => {
    const stub = makeRepo();
    stub._failNext = "boom";
    const out = await persistChatTurn(stub, {
      organizationId: "o", userId: null,
      question: "Q?", answer: answer(),
      contextEntriesCount: 0, contextSummariesCount: 0,
    });
    expect(out).toBeNull();
    expect(stub._rows.length).toBe(0);
  });

  it("returns null on missing_table without throwing", async () => {
    const stub = makeRepo();
    stub._failNext = "missing_table";
    const out = await persistChatTurn(stub, {
      organizationId: "o", userId: null,
      question: "Q?", answer: answer(),
      contextEntriesCount: 0, contextSummariesCount: 0,
    });
    expect(out).toBeNull();
  });

  it("persists null userId for anonymous sessions", async () => {
    const stub = makeRepo();
    await persistChatTurn(stub, {
      organizationId: "o", userId: null,
      question: "Q?", answer: answer(),
      contextEntriesCount: 0, contextSummariesCount: 0,
    });
    expect(stub._rows[0].userId).toBeNull();
  });

  it("persists context counts", async () => {
    const stub = makeRepo();
    await persistChatTurn(stub, {
      organizationId: "o", userId: "u1",
      question: "Q?", answer: answer(),
      contextEntriesCount: 42, contextSummariesCount: 7,
    });
    expect(stub._rows[0].contextEntriesCount).toBe(42);
    expect(stub._rows[0].contextSummariesCount).toBe(7);
  });

  // Phase 530 — citation details persistence
  it("persists rich citation details when supplied", async () => {
    const stub = makeRepo();
    const view = await persistChatTurn(stub, {
      organizationId: "o", userId: "u1",
      question: "Q?", answer: answer(),
      contextEntriesCount: 5, contextSummariesCount: 1,
      citationDetails: [
        { citationId: "e1", kind: "entry", targetKind: "council", targetId: "c_1", narrative: "first ep", generatedAtIso: NOW.toISOString() },
        { citationId: "s1", kind: "summary", targetKind: null, targetId: null, narrative: "first sum", generatedAtIso: NOW.toISOString() },
      ],
    });
    expect(view).not.toBeNull();
    expect(view!.citationDetails).toHaveLength(2);
    expect(view!.citationDetails[0].kind).toBe("entry");
    expect(view!.citationDetails[0].targetKind).toBe("council");
    expect(view!.citationDetails[1].kind).toBe("summary");
  });

  it("citationDetails defaults to empty array when not supplied", async () => {
    const stub = makeRepo();
    const view = await persistChatTurn(stub, {
      organizationId: "o", userId: "u1",
      question: "Q?", answer: answer(),
      contextEntriesCount: 0, contextSummariesCount: 0,
    });
    expect(view!.citationDetails).toEqual([]);
  });

  it("history rehydration carries citationDetails forward", async () => {
    const stub = makeRepo();
    await persistChatTurn(stub, {
      organizationId: "o", userId: "u1",
      question: "Q?", answer: answer(),
      contextEntriesCount: 5, contextSummariesCount: 1,
      citationDetails: [
        { citationId: "e1", kind: "entry", targetKind: "triage", targetId: "t_42", narrative: "n", generatedAtIso: NOW.toISOString() },
      ],
    });
    const history = await buildChatHistoryResponse(stub, { organizationId: "o" });
    if (!history.body.ok) throw new Error("expected ok");
    expect(history.body.data.turns[0].citationDetails).toHaveLength(1);
    expect(history.body.data.turns[0].citationDetails[0].targetKind).toBe("triage");
    expect(history.body.data.turns[0].citationDetails[0].targetId).toBe("t_42");
  });

  it("tolerates legacy rows with null citationDetailsJson", async () => {
    const stub = makeRepo();
    // Inject a pre-Phase-530 row directly.
    stub._rows.push({
      id: "turn_legacy",
      organizationId: "o",
      userId: "u1",
      question: "Q?",
      answer: "A.",
      citationsJson: ["e1"],
      citationDetailsJson: null,
      outcome: "ai_generated",
      errorMessage: null,
      modelHint: null,
      contextEntriesCount: 0,
      contextSummariesCount: 0,
      engineVersion: "v1",
      generatedAt: NOW,
    });
    const history = await buildChatHistoryResponse(stub, { organizationId: "o" });
    if (!history.body.ok) throw new Error("expected ok");
    expect(history.body.data.turns[0].citationDetails).toEqual([]);
    expect(history.body.data.turns[0].citations).toEqual(["e1"]);
  });

  it("tolerates legacy rows with omitted citationDetailsJson column", async () => {
    const stub = makeRepo();
    stub._rows.push({
      id: "turn_legacy2",
      organizationId: "o",
      userId: null,
      question: "Q?",
      answer: "A.",
      citationsJson: [],
      // citationDetailsJson omitted entirely (older rows where the
      // column doesn't even exist in the Prisma client shape)
      outcome: "ai_generated",
      errorMessage: null,
      modelHint: null,
      contextEntriesCount: 0,
      contextSummariesCount: 0,
      engineVersion: "v1",
      generatedAt: NOW,
    });
    const history = await buildChatHistoryResponse(stub, { organizationId: "o" });
    if (!history.body.ok) throw new Error("expected ok");
    expect(history.body.data.turns[0].citationDetails).toEqual([]);
  });
});

describe("buildChatHistoryResponse", () => {
  async function seed(stub: Stub) {
    await persistChatTurn(stub, { organizationId: "o", userId: "u1", question: "Q1", answer: answer({ outcome: "ai_generated" }), contextEntriesCount: 5, contextSummariesCount: 1 });
    await persistChatTurn(stub, { organizationId: "o", userId: "u2", question: "Q2", answer: answer({ outcome: "fallback_rules", modelHint: null }), contextEntriesCount: 0, contextSummariesCount: 0 });
    await persistChatTurn(stub, { organizationId: "o", userId: "u1", question: "Q3", answer: answer({ outcome: "ai_generated" }), contextEntriesCount: 12, contextSummariesCount: 3 });
    await persistChatTurn(stub, { organizationId: "o", userId: null, question: "Q4", answer: answer({ outcome: "error" }), contextEntriesCount: 0, contextSummariesCount: 0 });
    await persistChatTurn(stub, { organizationId: "other-org", userId: "u9", question: "Qx", answer: answer(), contextEntriesCount: 0, contextSummariesCount: 0 });
  }

  it("200 returns turns sorted newest-first, scoped to org", async () => {
    const stub = makeRepo();
    await seed(stub);
    const r = await buildChatHistoryResponse(stub, { organizationId: "o" });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.turns).toHaveLength(4);
    // Newest first → Q4 (last inserted)
    expect(r.body.data.turns[0].question).toBe("Q4");
    expect(r.body.data.turns[3].question).toBe("Q1");
  });

  it("filters by userId when provided", async () => {
    const stub = makeRepo();
    await seed(stub);
    const r = await buildChatHistoryResponse(stub, { organizationId: "o", userId: "u1" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.turns).toHaveLength(2);
    expect(r.body.data.turns.every((t) => t.userId === "u1")).toBe(true);
  });

  it("filters by userId=null (anonymous turns only)", async () => {
    const stub = makeRepo();
    await seed(stub);
    const r = await buildChatHistoryResponse(stub, { organizationId: "o", userId: null });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.turns).toHaveLength(1);
    expect(r.body.data.turns[0].userId).toBeNull();
  });

  it("tallies per-outcome summary", async () => {
    const stub = makeRepo();
    await seed(stub);
    const r = await buildChatHistoryResponse(stub, { organizationId: "o" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.summary).toEqual({ total: 4, aiGenerated: 2, fallbackRules: 1, errored: 1 });
  });

  it("clamps take to [1, 200]", async () => {
    const stub = makeRepo();
    await seed(stub);
    const r1 = await buildChatHistoryResponse(stub, { organizationId: "o", take: 2 });
    if (!r1.body.ok) throw new Error("expected ok");
    expect(r1.body.data.turns).toHaveLength(2);

    const r2 = await buildChatHistoryResponse(stub, { organizationId: "o", take: 9999 });
    if (!r2.body.ok) throw new Error("expected ok");
    expect(r2.body.data.turns).toHaveLength(4);

    const r3 = await buildChatHistoryResponse(stub, { organizationId: "o", take: 0 });
    if (!r3.body.ok) throw new Error("expected ok");
    expect(r3.body.data.turns.length).toBeGreaterThanOrEqual(1);
  });

  it("200 empty when org has no history", async () => {
    const stub = makeRepo();
    const r = await buildChatHistoryResponse(stub, { organizationId: "empty" });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.turns).toHaveLength(0);
  });

  it("503 migration_pending", async () => {
    const stub = makeRepo();
    stub._failNext = "missing_table";
    const r = await buildChatHistoryResponse(stub, { organizationId: "o" });
    expect(r.status).toBe(503);
  });

  it("500 read_failed", async () => {
    const stub = makeRepo();
    stub._failNext = "boom";
    const r = await buildChatHistoryResponse(stub, { organizationId: "o" });
    expect(r.status).toBe(500);
  });
});

describe("buildChatTurnDeleteResponse", () => {
  async function seedOne(stub: Stub): Promise<string> {
    const view = await persistChatTurn(stub, {
      organizationId: "o", userId: "u1",
      question: "Q?", answer: answer(),
      contextEntriesCount: 0, contextSummariesCount: 0,
    });
    return view!.id;
  }

  it("200 deletes the turn", async () => {
    const stub = makeRepo();
    const id = await seedOne(stub);
    const r = await buildChatTurnDeleteResponse(stub, { organizationId: "o", turnId: id });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.deletedId).toBe(id);
    expect(stub._rows.length).toBe(0);
  });

  it("404 turn_not_found for missing id", async () => {
    const stub = makeRepo();
    const r = await buildChatTurnDeleteResponse(stub, { organizationId: "o", turnId: "nope" });
    expect(r.status).toBe(404);
  });

  it("404 cross-org isolation", async () => {
    const stub = makeRepo();
    const id = await seedOne(stub);
    const r = await buildChatTurnDeleteResponse(stub, { organizationId: "other", turnId: id });
    expect(r.status).toBe(404);
    expect(stub._rows.length).toBe(1);
  });

  it("503 migration_pending", async () => {
    const stub = makeRepo();
    const id = await seedOne(stub);
    stub._failNext = "missing_table";
    const r = await buildChatTurnDeleteResponse(stub, { organizationId: "o", turnId: id });
    expect(r.status).toBe(503);
  });

  it("500 read_failed during the pre-delete lookup", async () => {
    const stub = makeRepo();
    const id = await seedOne(stub);
    stub._failNext = "boom";
    const r = await buildChatTurnDeleteResponse(stub, { organizationId: "o", turnId: id });
    expect(r.status).toBe(500);
  });
});
