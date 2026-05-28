import { describe, expect, it } from "vitest";
import {
  generateLearningSignals,
  LEARNING_LOOP_ENGINE_VERSION,
  type LearningLoopInputs,
  type OperatorDecisionRow,
} from "../learningLoopEngine";

const NOW = new Date("2026-05-26T12:00:00Z");

function baseInput(rows: OperatorDecisionRow[]): LearningLoopInputs {
  return {
    rows,
    rejectionClusterMin: 3,
    overrideClusterMin: 2,
    highRejectionRateThreshold: 0.5,
    lowConfidenceCeiling: 60,
    now: NOW,
  };
}

function row(over: Partial<OperatorDecisionRow> = {}): OperatorDecisionRow {
  return {
    engine: "release_advisor",
    kind: "propose_freeze",
    decision: "rejected",
    note: null,
    confidence: 70,
    decidedAtIso: NOW.toISOString(),
    ...over,
  };
}

describe("generateLearningSignals — empty", () => {
  it("zero rows produces zero signals", () => {
    const out = generateLearningSignals(baseInput([]));
    expect(out.signals).toHaveLength(0);
    expect(out.engineVersion).toBe(LEARNING_LOOP_ENGINE_VERSION);
    expect(out.generatedAtIso).toBe(NOW.toISOString());
  });
});

describe("rejection_cluster", () => {
  it("fires when ≥ min rejections share a keyword", () => {
    const out = generateLearningSignals(baseInput([
      row({ note: "Already in planned maintenance window — engine missed this" }),
      row({ note: "Planned maintenance — known issue, engine has no signal for it" }),
      row({ note: "Maintenance window is in effect, engine wrong" }),
    ]));
    const sig = out.signals.find((s) => s.kind === "rejection_cluster");
    expect(sig).toBeDefined();
    expect(sig?.keyword).toBe("maintenance");
    expect(sig?.occurrences).toBe(3);
    expect(sig?.targetKind).toBe("propose_freeze");
  });

  it("does NOT fire below rejection cluster min", () => {
    const out = generateLearningSignals(baseInput([
      row({ note: "Planned maintenance" }),
      row({ note: "Planned maintenance" }),
      // Only 2 — below default min of 3
    ]));
    expect(out.signals.find((s) => s.kind === "rejection_cluster")).toBeUndefined();
  });

  it("ignores rejected rows with no note", () => {
    const out = generateLearningSignals(baseInput([
      row({ note: "Planned maintenance" }),
      row({ note: null }),
      row({ note: null }),
      row({ note: null }),
    ]));
    expect(out.signals.find((s) => s.kind === "rejection_cluster")).toBeUndefined();
  });

  it("clusters across notes correctly (per-note dedupe)", () => {
    const out = generateLearningSignals(baseInput([
      row({ note: "maintenance maintenance maintenance" }), // counts as 1
      row({ note: "maintenance window" }),                   // counts as 1
      row({ note: "scheduled maintenance" }),                // counts as 1
    ]));
    const sig = out.signals.find((s) => s.kind === "rejection_cluster");
    expect(sig?.occurrences).toBe(3);
  });

  it("filters stopwords (would-be cluster on 'the' is ignored)", () => {
    const out = generateLearningSignals(baseInput([
      row({ note: "the the the" }),
      row({ note: "the the the" }),
      row({ note: "the the the" }),
    ]));
    // 'the' is a stopword, so no meaningful keyword → no signal
    expect(out.signals).toHaveLength(0);
  });
});

describe("override_cluster", () => {
  it("fires on ≥ 2 overrides sharing a keyword", () => {
    const out = generateLearningSignals(baseInput([
      row({ engine: "incident_triage", kind: "triage", decision: "overridden", note: "data loss — engine called this P2 but it's P0" }),
      row({ engine: "incident_triage", kind: "triage", decision: "overridden", note: "Massive data loss, real impact" }),
    ]));
    const sig = out.signals.find((s) => s.kind === "override_cluster");
    expect(sig).toBeDefined();
    expect(sig?.keyword).toBe("data");
    expect(sig?.engine).toBe("incident_triage");
  });

  it("does NOT fire on a single override", () => {
    const out = generateLearningSignals(baseInput([
      row({ engine: "incident_triage", kind: "triage", decision: "overridden", note: "data loss" }),
    ]));
    expect(out.signals.find((s) => s.kind === "override_cluster")).toBeUndefined();
  });
});

describe("low_confidence_acceptance", () => {
  it("fires when ≥3 accepts at confidence < ceiling", () => {
    const out = generateLearningSignals(baseInput([
      row({ decision: "accepted", confidence: 45, note: null }),
      row({ decision: "accepted", confidence: 50, note: null }),
      row({ decision: "accepted", confidence: 55, note: null }),
    ]));
    const sig = out.signals.find((s) => s.kind === "low_confidence_acceptance");
    expect(sig).toBeDefined();
    expect(sig?.occurrences).toBe(3);
    expect(sig?.title).toContain("avg 50%");
  });

  it("does NOT fire when confidences are above ceiling", () => {
    const out = generateLearningSignals(baseInput([
      row({ decision: "accepted", confidence: 70 }),
      row({ decision: "accepted", confidence: 80 }),
      row({ decision: "accepted", confidence: 90 }),
    ]));
    expect(out.signals.find((s) => s.kind === "low_confidence_acceptance")).toBeUndefined();
  });
});

describe("high_rejection_rate", () => {
  it("fires when ≥ threshold% rejected", () => {
    const out = generateLearningSignals(baseInput([
      row({ decision: "rejected", note: "a" }),
      row({ decision: "rejected", note: "b" }),
      row({ decision: "rejected", note: "c" }),
      row({ decision: "accepted" }),
      row({ decision: "accepted" }),
    ]));
    const sig = out.signals.find((s) => s.kind === "high_rejection_rate");
    expect(sig).toBeDefined();
    expect(sig?.strength).toBeGreaterThanOrEqual(50);
  });

  it("does NOT fire on a tiny sample (<5 decided)", () => {
    const out = generateLearningSignals(baseInput([
      row({ decision: "rejected" }),
      row({ decision: "rejected" }),
    ]));
    expect(out.signals.find((s) => s.kind === "high_rejection_rate")).toBeUndefined();
  });

  it("does NOT fire when rejection rate is acceptable", () => {
    const out = generateLearningSignals(baseInput([
      row({ decision: "rejected" }),
      row({ decision: "accepted" }),
      row({ decision: "accepted" }),
      row({ decision: "accepted" }),
      row({ decision: "accepted" }),
    ]));
    expect(out.signals.find((s) => s.kind === "high_rejection_rate")).toBeUndefined();
  });

  it("excludes implemented + dismissed from the denominator", () => {
    const out = generateLearningSignals(baseInput([
      row({ decision: "rejected" }),
      row({ decision: "rejected" }),
      row({ decision: "rejected" }),
      row({ decision: "rejected" }),
      row({ decision: "implemented" }),  // excluded from denom
      row({ decision: "dismissed" }),    // excluded from denom
      row({ decision: "accepted" }),
      row({ decision: "accepted" }),
    ]));
    // 6 decided (4 rejected + 2 accepted) = 67% rejected → fires
    const sig = out.signals.find((s) => s.kind === "high_rejection_rate");
    expect(sig).toBeDefined();
    expect(sig?.occurrences).toBe(4);
  });
});

describe("ranking + summary", () => {
  it("sorts signals by strength desc", () => {
    const out = generateLearningSignals(baseInput([
      // override cluster — strength 75
      row({ engine: "incident_triage", kind: "triage", decision: "overridden", note: "data loss" }),
      row({ engine: "incident_triage", kind: "triage", decision: "overridden", note: "data loss massive" }),
      // rejection cluster — strength 80
      row({ note: "outage critical revenue" }),
      row({ note: "outage critical revenue" }),
      row({ note: "outage critical revenue" }),
    ]));
    expect(out.signals.length).toBeGreaterThanOrEqual(2);
    expect(out.signals[0].strength).toBeGreaterThanOrEqual(out.signals[1].strength);
  });

  it("summary.signalsByKind counts each kind", () => {
    const out = generateLearningSignals(baseInput([
      row({ note: "maintenance" }),
      row({ note: "maintenance" }),
      row({ note: "maintenance" }),
    ]));
    expect(out.summary.totalRows).toBe(3);
    expect(out.summary.signalsByKind.rejection_cluster).toBe(1);
  });
});

describe("engine version pin + determinism", () => {
  it("output carries engine version", () => {
    const out = generateLearningSignals(baseInput([]));
    expect(out.engineVersion).toBe(LEARNING_LOOP_ENGINE_VERSION);
  });

  it("same input → same output", () => {
    const rows = [
      row({ note: "maintenance" }),
      row({ note: "maintenance scheduled" }),
      row({ note: "maintenance window" }),
    ];
    const out1 = generateLearningSignals(baseInput(rows));
    const out2 = generateLearningSignals(baseInput(rows));
    expect(out1).toEqual(out2);
  });
});

describe("voter_dissent_pattern (Phase 515)", () => {
  function snap(votes: Array<{ voterId: string; kind: string }>) {
    return {
      decisionId: "any",
      consensusKind: "proceed",
      votes: votes.map((v) => ({ ...v, confidence: 70 })),
      decidedAtIso: NOW.toISOString(),
    };
  }

  it("fires when a voter pair disagrees in ≥ min council runs", () => {
    const snapshots = [
      snap([{ voterId: "rule_based", kind: "proceed" }, { voterId: "conservative", kind: "proceed_with_caution" }]),
      snap([{ voterId: "rule_based", kind: "proceed" }, { voterId: "conservative", kind: "proceed_with_caution" }]),
      snap([{ voterId: "rule_based", kind: "proceed" }, { voterId: "conservative", kind: "proceed_with_caution" }]),
    ];
    const out = generateLearningSignals({ ...baseInput([]), councilSnapshots: snapshots });
    const sig = out.signals.find((s) => s.kind === "voter_dissent_pattern");
    expect(sig).toBeDefined();
    expect(sig?.engine).toBe("advisor_council");
    expect(sig?.targetKind).toContain("conservative");
    expect(sig?.targetKind).toContain("rule_based");
    expect(sig?.occurrences).toBe(3);
  });

  it("does NOT fire when dissent count below min", () => {
    const snapshots = [
      snap([{ voterId: "a", kind: "proceed" }, { voterId: "b", kind: "block_deploy" }]),
      snap([{ voterId: "a", kind: "proceed" }, { voterId: "b", kind: "block_deploy" }]),
    ];
    const out = generateLearningSignals({ ...baseInput([]), councilSnapshots: snapshots, voterDissentMin: 3 });
    expect(out.signals.find((s) => s.kind === "voter_dissent_pattern")).toBeUndefined();
  });

  it("does NOT fire when no council snapshots provided (backwards compat)", () => {
    const out = generateLearningSignals(baseInput([]));
    expect(out.signals.find((s) => s.kind === "voter_dissent_pattern")).toBeUndefined();
  });

  it("counts each pair independently (3 voters → 3 pairs)", () => {
    const snapshots = [
      snap([
        { voterId: "a", kind: "proceed" },
        { voterId: "b", kind: "block_deploy" },
        { voterId: "c", kind: "proceed_with_caution" },
      ]),
      snap([
        { voterId: "a", kind: "proceed" },
        { voterId: "b", kind: "block_deploy" },
        { voterId: "c", kind: "proceed_with_caution" },
      ]),
      snap([
        { voterId: "a", kind: "proceed" },
        { voterId: "b", kind: "block_deploy" },
        { voterId: "c", kind: "proceed_with_caution" },
      ]),
    ];
    const out = generateLearningSignals({ ...baseInput([]), councilSnapshots: snapshots, voterDissentMin: 3 });
    // Three pairs all in full disagreement → three signals.
    const dissentSignals = out.signals.filter((s) => s.kind === "voter_dissent_pattern");
    expect(dissentSignals).toHaveLength(3);
  });

  it("keyword field captures most-frequent dissenting kind for voter A", () => {
    const snapshots = [
      snap([{ voterId: "rule_based", kind: "proceed" }, { voterId: "conservative", kind: "proceed_with_caution" }]),
      snap([{ voterId: "rule_based", kind: "proceed" }, { voterId: "conservative", kind: "proceed_with_caution" }]),
      snap([{ voterId: "rule_based", kind: "proceed_with_caution" }, { voterId: "conservative", kind: "block_deploy" }]),
    ];
    const out = generateLearningSignals({ ...baseInput([]), councilSnapshots: snapshots });
    const sig = out.signals.find((s) => s.kind === "voter_dissent_pattern");
    expect(sig).toBeDefined();
    // voter A = "conservative" (lex order), most common dissenting kind is "proceed_with_caution".
    expect(sig?.keyword).toBe("proceed_with_caution");
  });

  it("summary counts voter_dissent_pattern entries", () => {
    const snapshots = [
      snap([{ voterId: "a", kind: "proceed" }, { voterId: "b", kind: "block_deploy" }]),
      snap([{ voterId: "a", kind: "proceed" }, { voterId: "b", kind: "block_deploy" }]),
      snap([{ voterId: "a", kind: "proceed" }, { voterId: "b", kind: "block_deploy" }]),
    ];
    const out = generateLearningSignals({ ...baseInput([]), councilSnapshots: snapshots });
    expect(out.summary.signalsByKind.voter_dissent_pattern).toBe(1);
  });
});
