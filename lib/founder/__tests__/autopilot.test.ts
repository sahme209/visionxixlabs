import { describe, expect, it } from "vitest";
import { AUTOPILOT_MAX_ACTIONS, autopilotSummary, planAutopilot } from "../autopilot";
import { DEFAULT_BLUEPRINT } from "../defaultBlueprint";
import { validateBlueprint, type Blueprint } from "../blueprint";

const NOW = new Date("2026-11-27T12:00:00Z");
const clone = (): Blueprint => structuredClone(DEFAULT_BLUEPRINT);

describe("founder autopilot", () => {
  it("defaults every step to autonomous except money, outside contact and hard-to-undo steps", () => {
    const modes = new Map(DEFAULT_BLUEPRINT.steps.map((s) => [s.id, s.automation.mode]));
    for (const id of ["rel-deploy", "rel-approve", "rev-credits", "fin-billing", "out-reach", "gtm-launch"]) expect(modes.get(id)).toBe("approval");
    expect([...modes.values()].filter((m) => m === "autonomous").length).toBeGreaterThan(DEFAULT_BLUEPRINT.steps.length / 2);
    expect(validateBlueprint(DEFAULT_BLUEPRINT).ok).toBe(true);
  });
  it("marks running autonomous steps live and notes attention signals once per value per day", () => {
    const plan = planAutopilot(clone(), { leads_30d: 4, incidents_open: 2 }, NOW);
    expect(plan.actions.map((a) => `${a.kind}:${a.stepId}`)).toEqual(["mark_live:out-list", "note_attention:inc-detect"]);
    expect(plan.next.steps.find((s) => s.id === "out-list")!.status).toBe("live");
    expect(plan.next.steps.find((s) => s.id === "inc-detect")!.notes).toBe("Autopilot 2026-11-27: 2 open incidents.");
    const again = planAutopilot(plan.next, { leads_30d: 4, incidents_open: 2 }, NOW);
    expect(again.actions).toEqual([]);
    expect(validateBlueprint(plan.next).ok).toBe(true);
  });
  it("proposes instead of acting on steps that need approval, and leaves person-run steps alone", () => {
    const b = clone();
    b.steps.find((s) => s.id === "out-list")!.automation.mode = "manual";
    const plan = planAutopilot(b, { leads_30d: 4, agent_requests_pending: 3 }, NOW);
    expect(plan.actions).toEqual([]);
    expect(plan.proposals.map((p) => p.stepId)).toEqual(["ai-requests"]);
    expect(plan.next.steps.find((s) => s.id === "ai-requests")!.notes).toBe("");
  });
  it("does nothing while paused, and does not touch the input", () => {
    const b = clone(); b.autopilot.paused = true;
    expect(planAutopilot(b, { leads_30d: 4, incidents_open: 2 }, NOW)).toMatchObject({ actions: [], proposals: [] });
    const c = clone(); planAutopilot(c, { leads_30d: 4 }, NOW);
    expect(c.steps.find((s) => s.id === "out-list")!.status).toBe("draft");
  });
  it("caps actions per run and summarises them", () => {
    const b = clone();
    b.steps = Array.from({ length: 30 }, (_, i) => ({ ...b.steps[0], id: `s-${i}`, row: i, status: "draft" as const, signal: "leads_30d" as const }));
    b.links = [];
    expect(planAutopilot(b, { leads_30d: 1 }, NOW).actions).toHaveLength(AUTOPILOT_MAX_ACTIONS);
    expect(autopilotSummary([{ kind: "mark_live", stepId: "a", text: "" }, { kind: "note_attention", stepId: "b", text: "" }])).toBe("Autopilot: marked 1 step live, noted 1 signal needing attention.");
  });
});

describe("blueprints saved before automation existed", () => {
  it("take the default automation for each step id, and keep a founder's explicit choice", () => {
    const old = structuredClone(DEFAULT_BLUEPRINT) as unknown as { steps: Array<Record<string, unknown>>; autopilot?: unknown };
    delete old.autopilot;
    for (const s of old.steps) delete s.automation;
    old.steps[0].automation = { mode: "manual", agent: "" };
    const v = validateBlueprint(old);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.blueprint.steps[0].automation.mode).toBe("manual");
    expect(v.blueprint.steps.find((s) => s.id === "rel-deploy")!.automation).toEqual({ mode: "approval", agent: "Claude" });
    expect(v.blueprint.steps.find((s) => s.id === "gtm-position")!.automation.mode).toBe(old.steps[0].id === "gtm-position" ? "manual" : "autonomous");
    expect(v.blueprint.autopilot).toEqual({ paused: false });
  });
});
