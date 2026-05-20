/**
 * Vitest unit tests for the pure tray-icon state machine.
 */

import { describe, it, expect } from "vitest";
import { reduceTrayState, type TrayInputs } from "../trayIconStateMachine";

const BASE: TrayInputs = {
  unreadIncidentCount: 0,
  pendingApprovalCount: 0,
  platformVerdict: "operational",
  activeAiProvider: "github_models",
  integrationVerdict: "operational",
  sessionVerdict: "ok",
  online: true,
};

describe("trayIconStateMachine", () => {
  it("all-clear → ok variant, no badge", () => {
    const s = reduceTrayState(BASE);
    expect(s.variant).toBe("ok");
    expect(s.badgeCount).toBe(0);
    expect(s.tooltip).toContain("all clear");
  });

  it("offline overrides everything", () => {
    const s = reduceTrayState({ ...BASE, online: false, pendingApprovalCount: 5 });
    expect(s.variant).toBe("offline");
    expect(s.tooltip).toBe("Axiom — offline");
  });

  it("session require_login → needs_login variant", () => {
    const s = reduceTrayState({ ...BASE, sessionVerdict: "require_login" });
    expect(s.variant).toBe("needs_login");
  });

  it("3+ unread incidents → critical", () => {
    const s = reduceTrayState({ ...BASE, unreadIncidentCount: 3 });
    expect(s.variant).toBe("critical");
    expect(s.badgeCount).toBe(3);
  });

  it("platform down → critical", () => {
    const s = reduceTrayState({ ...BASE, platformVerdict: "down" });
    expect(s.variant).toBe("critical");
  });

  it("integrations down → critical", () => {
    const s = reduceTrayState({ ...BASE, integrationVerdict: "down" });
    expect(s.variant).toBe("critical");
  });

  it("pending approvals → attention with badge", () => {
    const s = reduceTrayState({ ...BASE, pendingApprovalCount: 2 });
    expect(s.variant).toBe("attention");
    expect(s.badgeCount).toBe(2);
  });

  it("session warn → attention", () => {
    const s = reduceTrayState({ ...BASE, sessionVerdict: "warn" });
    expect(s.variant).toBe("attention");
  });

  it("menu always includes open_app + quit + per-section rows", () => {
    const s = reduceTrayState(BASE);
    const kinds = s.menu.map((m) => m.kind);
    expect(kinds).toContain("approvals");
    expect(kinds).toContain("incidents");
    expect(kinds).toContain("status");
    expect(kinds).toContain("ai_provider");
    expect(kinds).toContain("integrations");
    expect(kinds).toContain("open_app");
    expect(kinds).toContain("quit");
  });

  it("offline menu is minimal — no approvals/incidents rows", () => {
    const s = reduceTrayState({ ...BASE, online: false });
    const kinds = s.menu.map((m) => m.kind);
    expect(kinds).not.toContain("approvals");
    expect(kinds).toContain("open_app");
  });

  it("AI provider null → 'mock fallback' label in menu", () => {
    const s = reduceTrayState({ ...BASE, activeAiProvider: null });
    const aiItem = s.menu.find((m) => m.kind === "ai_provider")!;
    expect(aiItem.label).toContain("mock fallback");
  });
});
