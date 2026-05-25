import { describe, expect, it } from "vitest";
import {
  describeTransition,
  suggestNextAction,
  type TransitionView,
} from "../connectorSetupOperatorCopy";
import { ALL_STATUSES, statusLabel, type ConnectorSetupStatus } from "../connectorSetupSession";

/* ──────────────────────────────────────────────────────────────────
   Phase 417 — operator copy.

   Two contracts:
   1. Every status produces a SuggestedAction whose tone and copy
      are stable. Future copy refinements should be intentional.
   2. Every legal kernel event produces a non-empty timeline line
      that does NOT reference internal jargon.
   ────────────────────────────────────────────────────────────── */

describe("suggestNextAction — every status returns a stable, non-empty action", () => {
  it.each(ALL_STATUSES)("%s produces a non-empty description", (status) => {
    const action = suggestNextAction(status);
    expect(action.description.length).toBeGreaterThan(20);
    // tone:"none" is the only case where ctaLabel is allowed to be empty
    if (action.tone === "none") {
      expect(action.ctaLabel).toBe("");
    } else {
      expect(action.ctaLabel.length).toBeGreaterThan(0);
    }
  });

  it("primary CTA on initial + recoverable + paused states", () => {
    expect(suggestNextAction("not_connected").tone).toBe("primary");
    expect(suggestNextAction("setup_started").tone).toBe("primary");
    expect(suggestNextAction("waiting_for_provider").tone).toBe("primary");
    expect(suggestNextAction("failed").tone).toBe("primary");
    expect(suggestNextAction("disconnected").tone).toBe("primary");
    expect(suggestNextAction("needs_attention").tone).toBe("primary");
  });

  it("danger tone on revoked (provider invalidated us)", () => {
    expect(suggestNextAction("revoked").tone).toBe("danger");
  });

  it("secondary tone on connected (the CTA is destructive Disconnect)", () => {
    expect(suggestNextAction("connected").tone).toBe("secondary");
  });

  it("validating has no CTA (still in flight)", () => {
    expect(suggestNextAction("validating").tone).toBe("none");
    expect(suggestNextAction("validating").ctaLabel).toBe("");
  });

  it("never leaks SDK names or env-var jargon", () => {
    for (const s of ALL_STATUSES) {
      const a = suggestNextAction(s);
      const blob = `${a.ctaLabel} ${a.description} ${a.hint ?? ""}`;
      expect(blob).not.toMatch(/AWS_BROKER|sts:AssumeRole|process\.env|AWS_SDK/i);
    }
  });
});

describe("suggestNextAction — failed status surfaces lastErrorCode hint", () => {
  it("AccessDenied → 'wait 30 seconds' hint", () => {
    const a = suggestNextAction("failed", "AccessDenied");
    expect(a.hint).toMatch(/wait 30 seconds/i);
  });

  it("HealthCheckAuthFailed → IAM/SP regression hint", () => {
    const a = suggestNextAction("failed", "HealthCheckAuthFailed");
    expect(a.hint).toMatch(/IAM|service principal/i);
  });

  it("AssumeRoleFailed → re-deploy template hint (real fix from Phase 410-412)", () => {
    const a = suggestNextAction("failed", "AssumeRoleFailed");
    expect(a.hint).toMatch(/re-deploy/i);
  });

  it("unknown errorCode → surfaced verbatim, no pre-diagnosis", () => {
    const a = suggestNextAction("failed", "UnexpectedShoutyError");
    expect(a.hint).toBe("Provider returned UnexpectedShoutyError.");
  });

  it("no errorCode → no hint field", () => {
    const a = suggestNextAction("failed");
    expect(a.hint).toBeUndefined();
  });

  it("hint only attaches to failed status — not to other statuses with stale errorCode", () => {
    const a = suggestNextAction("connected", "AccessDenied");
    expect(a.hint).toBeUndefined();
  });
});

describe("describeTransition — legal transitions render as human-readable lines", () => {
  const baseTx = {
    isLegal: true,
    actorUserId: "user_1",
    actorLabel: null,
  } as const;

  const LEGAL_EVENTS: { eventKind: string; from: ConnectorSetupStatus; to: ConnectorSetupStatus; matcher: RegExp }[] = [
    { eventKind: "operator_started",             from: "not_connected",        to: "setup_started",        matcher: /started setup/i },
    { eventKind: "provider_link_opened",         from: "setup_started",        to: "waiting_for_provider", matcher: /opened the provider/i },
    { eventKind: "bounce_back_received",         from: "waiting_for_provider", to: "validating",           matcher: /returned with credentials/i },
    { eventKind: "validation_succeeded",         from: "validating",           to: "connected",            matcher: /confirmed access/i },
    { eventKind: "validation_failed",            from: "validating",           to: "failed",               matcher: /could not confirm/i },
    { eventKind: "operator_disconnected",        from: "connected",            to: "disconnected",         matcher: /disconnected/i },
    { eventKind: "provider_revoked_credentials", from: "connected",            to: "revoked",              matcher: /revoked by the provider/i },
    { eventKind: "health_check_regressed",       from: "connected",            to: "needs_attention",      matcher: /detected a regression/i },
    { eventKind: "health_check_recovered",       from: "needs_attention",      to: "connected",            matcher: /saw access recover/i },
  ];

  it.each(LEGAL_EVENTS)("$eventKind → matches $matcher and ends with new status label", ({ eventKind, from, to, matcher }) => {
    const t: TransitionView = { ...baseTx, eventKind, fromStatus: from, toStatus: to };
    const line = describeTransition(t);
    expect(line).toMatch(matcher);
    expect(line.toLowerCase()).toContain(statusLabel(to).toLowerCase());
  });

  it("operator (userId set) renders as 'Operator …'", () => {
    const t: TransitionView = { ...baseTx, eventKind: "operator_started", fromStatus: "not_connected", toStatus: "setup_started" };
    expect(describeTransition(t)).toMatch(/^Operator/);
  });

  it("system actorLabel='cron:health-check' renders as 'Health check …'", () => {
    const t: TransitionView = {
      isLegal: true,
      actorUserId: null,
      actorLabel: "cron:health-check",
      eventKind: "health_check_regressed",
      fromStatus: "connected",
      toStatus: "needs_attention",
    };
    expect(describeTransition(t)).toMatch(/^Health check/);
  });

  it("system actorLabel='validator:aws' renders as 'Validator …'", () => {
    const t: TransitionView = {
      isLegal: true,
      actorUserId: null,
      actorLabel: "validator:aws",
      eventKind: "validation_succeeded",
      fromStatus: "validating",
      toStatus: "connected",
    };
    expect(describeTransition(t)).toMatch(/^Validator/);
  });

  it("no actor (system fallback) renders as 'System …'", () => {
    const t: TransitionView = {
      isLegal: true,
      actorUserId: null,
      actorLabel: null,
      eventKind: "validation_succeeded",
      fromStatus: "validating",
      toStatus: "connected",
    };
    expect(describeTransition(t)).toMatch(/^System/);
  });
});

describe("describeTransition — illegal transitions render as 'Ignored …'", () => {
  it("renders illegal attempts with the from-status label", () => {
    const t: TransitionView = {
      isLegal: false,
      actorUserId: "user_1",
      actorLabel: null,
      eventKind: "provider_link_opened",
      fromStatus: "not_connected",
      toStatus: "not_connected",
    };
    const line = describeTransition(t);
    expect(line).toMatch(/Ignored/);
    expect(line).toMatch(/Not connected/i);
  });
});

describe("describeTransition — never leaks SDK / env-var jargon", () => {
  it("scans every legal-and-illegal combo for forbidden words", () => {
    const events = [
      "operator_started", "provider_link_opened", "bounce_back_received",
      "validation_succeeded", "validation_failed", "operator_disconnected",
      "provider_revoked_credentials", "health_check_regressed", "health_check_recovered",
    ];
    for (const eventKind of events) {
      for (const isLegal of [true, false]) {
        const t: TransitionView = {
          isLegal, actorUserId: "u", actorLabel: null, eventKind,
          fromStatus: "connected", toStatus: "needs_attention",
        };
        const line = describeTransition(t);
        expect(line).not.toMatch(/sts:AssumeRole|AWS_BROKER|process\.env/i);
      }
    }
  });
});
