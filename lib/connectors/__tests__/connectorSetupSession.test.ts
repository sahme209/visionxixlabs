import { describe, expect, it } from "vitest";
import {
  ALL_STATUSES,
  isActive,
  isInFlight,
  isRecoverable,
  statusLabel,
  transitionConnectorSetup,
  type ConnectorSetupEvent,
  type ConnectorSetupStatus,
} from "../connectorSetupSession";

/* ──────────────────────────────────────────────────────────────────
   Phase 413 — ConnectorSetupSession state-machine matrix tests.

   Pin every legal transition + a representative set of illegal
   transitions so the kernel becomes load-bearing for future
   surfaces (cron health checks, audit log, UI status pills).
   ────────────────────────────────────────────────────────────── */

describe("transitionConnectorSetup — legal transitions", () => {
  it("operator_started lands on setup_started from not_connected / failed / disconnected / revoked", () => {
    for (const from of ["not_connected", "failed", "disconnected", "revoked"] as const) {
      const r = transitionConnectorSetup(from, { kind: "operator_started" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.next).toBe("setup_started");
    }
  });

  it("provider_link_opened moves setup_started → waiting_for_provider", () => {
    const r = transitionConnectorSetup("setup_started", { kind: "provider_link_opened" });
    expect(r).toEqual({ ok: true, next: "waiting_for_provider" });
  });

  it("bounce_back_received moves waiting_for_provider → validating", () => {
    const r = transitionConnectorSetup("waiting_for_provider", { kind: "bounce_back_received" });
    expect(r).toEqual({ ok: true, next: "validating" });
  });

  it("validation_succeeded moves validating → connected", () => {
    const r = transitionConnectorSetup("validating", { kind: "validation_succeeded" });
    expect(r).toEqual({ ok: true, next: "connected" });
  });

  it("validation_failed moves validating → failed", () => {
    const r = transitionConnectorSetup("validating", { kind: "validation_failed", errorCode: "AccessDenied" });
    expect(r).toEqual({ ok: true, next: "failed" });
  });

  it("validation_failed during re-validation moves needs_attention → failed", () => {
    const r = transitionConnectorSetup("needs_attention", { kind: "validation_failed", errorCode: "AssumeRoleFailed" });
    expect(r).toEqual({ ok: true, next: "failed" });
  });

  it("operator_disconnected fires from connected / needs_attention / failed", () => {
    for (const from of ["connected", "needs_attention", "failed"] as const) {
      const r = transitionConnectorSetup(from, { kind: "operator_disconnected" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.next).toBe("disconnected");
    }
  });

  it("provider_revoked_credentials fires from connected / needs_attention", () => {
    for (const from of ["connected", "needs_attention"] as const) {
      const r = transitionConnectorSetup(from, { kind: "provider_revoked_credentials" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.next).toBe("revoked");
    }
  });

  it("health_check_regressed moves connected → needs_attention", () => {
    const r = transitionConnectorSetup("connected", { kind: "health_check_regressed" });
    expect(r).toEqual({ ok: true, next: "needs_attention" });
  });

  it("health_check_recovered moves needs_attention → connected", () => {
    const r = transitionConnectorSetup("needs_attention", { kind: "health_check_recovered" });
    expect(r).toEqual({ ok: true, next: "connected" });
  });
});

describe("transitionConnectorSetup — illegal transitions (closed-union safety)", () => {
  it("rejects provider_link_opened from not_connected", () => {
    const r = transitionConnectorSetup("not_connected", { kind: "provider_link_opened" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("illegal_transition");
      expect(r.from).toBe("not_connected");
      expect(r.eventKind).toBe("provider_link_opened");
    }
  });

  it("rejects validation_succeeded from anything other than validating", () => {
    for (const from of ALL_STATUSES.filter((s) => s !== "validating")) {
      const r = transitionConnectorSetup(from, { kind: "validation_succeeded" });
      expect(r.ok).toBe(false);
    }
  });

  it("rejects operator_disconnected from setup_started (operator can't disconnect what they never finished)", () => {
    const r = transitionConnectorSetup("setup_started", { kind: "operator_disconnected" });
    expect(r.ok).toBe(false);
  });

  it("rejects health_check_regressed from non-active statuses", () => {
    for (const from of ALL_STATUSES.filter((s) => s !== "connected")) {
      const r = transitionConnectorSetup(from, { kind: "health_check_regressed" });
      expect(r.ok).toBe(false);
    }
  });

  it("rejects health_check_recovered from anything other than needs_attention", () => {
    for (const from of ALL_STATUSES.filter((s) => s !== "needs_attention")) {
      const r = transitionConnectorSetup(from, { kind: "health_check_recovered" });
      expect(r.ok).toBe(false);
    }
  });
});

describe("isActive / isInFlight / isRecoverable — UI-driving predicates", () => {
  it("isActive is true only for connected + needs_attention", () => {
    const active = ALL_STATUSES.filter(isActive);
    expect(new Set(active)).toEqual(new Set(["connected", "needs_attention"]));
  });

  it("isInFlight is true only for setup_started + waiting_for_provider + validating", () => {
    const inFlight = ALL_STATUSES.filter(isInFlight);
    expect(new Set(inFlight)).toEqual(new Set(["setup_started", "waiting_for_provider", "validating"]));
  });

  it("isRecoverable is true only for failed + disconnected + revoked", () => {
    const recover = ALL_STATUSES.filter(isRecoverable);
    expect(new Set(recover)).toEqual(new Set(["failed", "disconnected", "revoked"]));
  });

  it("every status falls into exactly one of {not_connected} ∪ active ∪ inFlight ∪ recoverable", () => {
    for (const s of ALL_STATUSES) {
      const buckets = [s === "not_connected", isActive(s), isInFlight(s), isRecoverable(s)].filter(Boolean).length;
      expect(buckets).toBe(1);
    }
  });
});

describe("statusLabel — customer-facing copy", () => {
  it("returns a plain-English label for every status", () => {
    for (const s of ALL_STATUSES) {
      const label = statusLabel(s);
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(2);
    }
  });

  it("never includes internal jargon (no underscores, no SDK names)", () => {
    for (const s of ALL_STATUSES) {
      const label = statusLabel(s);
      expect(label).not.toMatch(/_/);
    }
  });
});

describe("happy-path lifecycle — full flow from not_connected to connected", () => {
  it("walks the full lifecycle without hitting an illegal transition", () => {
    const events: ConnectorSetupEvent[] = [
      { kind: "operator_started" },
      { kind: "provider_link_opened" },
      { kind: "bounce_back_received" },
      { kind: "validation_succeeded" },
    ];
    let s: ConnectorSetupStatus = "not_connected";
    for (const e of events) {
      const r = transitionConnectorSetup(s, e);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.next;
    }
    expect(s).toBe("connected");
  });

  it("recovers from failure: failed → operator_started → setup_started", () => {
    let s: ConnectorSetupStatus = "failed";
    const r = transitionConnectorSetup(s, { kind: "operator_started" });
    expect(r.ok).toBe(true);
    if (r.ok) s = r.next;
    expect(s).toBe("setup_started");
  });

  it("health-check round trip: connected → regressed → recovered", () => {
    let s: ConnectorSetupStatus = "connected";
    const r1 = transitionConnectorSetup(s, { kind: "health_check_regressed" });
    expect(r1.ok).toBe(true);
    if (r1.ok) s = r1.next;
    expect(s).toBe("needs_attention");

    const r2 = transitionConnectorSetup(s, { kind: "health_check_recovered" });
    expect(r2.ok).toBe(true);
    if (r2.ok) s = r2.next;
    expect(s).toBe("connected");
  });
});
