/**
 * Vitest unit tests for the workflow template catalog.
 *
 * Invariants:
 *   - Every template uses ONLY the closed-union trigger/action kinds.
 *   - No template references an execution action (apply_change, etc.).
 *   - Each template has a non-empty actions list.
 *   - Template ids are unique.
 */

import { describe, it, expect } from "vitest";
import {
  findTemplate, listTemplates, listTemplatesByArea, TEMPLATE_AREAS,
  type TriggerKind, type ActionKind,
} from "../workflowTemplateCatalog";

const TRIGGERS: ReadonlySet<TriggerKind> = new Set<TriggerKind>([
  "telemetry_signal", "cloud_inventory_change", "schedule", "manual",
]);
const ACTIONS: ReadonlySet<ActionKind> = new Set<ActionKind>([
  "notify_outbound", "stage_runbook", "stage_policy_proposal", "open_approval_packet", "log_audit_only",
]);

describe("workflowTemplateCatalog", () => {
  it("listTemplates returns at least one template per area", () => {
    for (const area of TEMPLATE_AREAS) {
      expect(listTemplatesByArea(area).length).toBeGreaterThan(0);
    }
  });

  it("every template uses only allowed trigger kinds", () => {
    for (const t of listTemplates()) {
      expect(TRIGGERS.has(t.trigger.kind)).toBe(true);
    }
  });

  it("every template uses only allowed action kinds", () => {
    for (const t of listTemplates()) {
      for (const a of t.actions) {
        expect(ACTIONS.has(a.kind)).toBe(true);
      }
    }
  });

  it("no template uses an execution-kind action (closed-union contract)", () => {
    const bannedKinds = ["apply_change", "rollback", "execute", "auto_apply"];
    for (const t of listTemplates()) {
      for (const a of t.actions) {
        expect(bannedKinds).not.toContain(a.kind);
      }
    }
  });

  it("every template has at least one action and a non-empty selector", () => {
    for (const t of listTemplates()) {
      expect(t.actions.length).toBeGreaterThan(0);
      expect(t.trigger.selector.length).toBeGreaterThan(0);
    }
  });

  it("findTemplate locates known ids and returns null for unknowns", () => {
    const known = listTemplates()[0];
    expect(findTemplate(known.id)).not.toBeNull();
    expect(findTemplate("definitely-not-a-real-id")).toBeNull();
  });

  it("template ids are unique", () => {
    const ids = listTemplates().map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
