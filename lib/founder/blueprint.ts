/**
 * Founder operations blueprint (C1). A map of how the company runs: departments, the steps in each,
 * decision branches and the links between them, with each step's status, owner, notes and cost.
 * Pure: schema, validation, cost math and layout. Storage and access live in the founder routes.
 */
import { z } from "zod";
import { defaultAutomationFor } from "./automationDefaults";

export const BLUEPRINT_KIND = "v19.founder-blueprint";
export const BLUEPRINT_VERSION = 1;
export const STEP_STATUSES = ["draft", "in_progress", "testing", "live", "archived"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];
export const STEP_KINDS = ["step", "decision", "start", "end"] as const;
/**
 * Who runs a step: a person (manual), a person helped by an agent (assisted), an agent that acts
 * only after the founder approves (approval), or V19 or an agent on its own (autonomous).
 */
export const AUTOMATION_MODES = ["manual", "assisted", "approval", "autonomous"] as const;
export type AutomationMode = (typeof AUTOMATION_MODES)[number];
/** Live V19 records a step can watch. Values are computed server-side for the founder only. */
export const SIGNAL_KEYS = ["feedback_30d", "leads_30d", "deployments_failed_7d", "deployments_7d", "incidents_open", "freezes_active", "ai_cost_30d_cents", "agent_requests_pending", "webhook_failures_7d", "workspaces_total", "workspaces_new_30d", "revenue_30d_cents", "unanswered_questions_30d", "at_risk_workspaces"] as const;
export type SignalKey = (typeof SIGNAL_KEYS)[number];

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,47}$/, "lowercase letters, digits and hyphens");
const text = (max: number) => z.string().max(max).refine((v) => !/[\u0000-\u0008\u000b-\u001f]/.test(v), "no control characters");
const money = z.number().finite().min(0).max(10_000_000);

const toolSchema = z.object({ name: text(80).pipe(z.string().min(1)), monthlyCost: money.default(0), oneTimeCost: money.default(0), active: z.boolean().default(true) }).strict();
const stepObject = z.object({
  id,
  departmentId: id,
  kind: z.enum(STEP_KINDS).default("step"),
  title: text(120).pipe(z.string().min(1)),
  /** Grid position inside its department: column and row, from 0. */
  col: z.number().int().min(0).max(20),
  row: z.number().int().min(0).max(40),
  status: z.enum(STEP_STATUSES).default("draft"),
  owner: text(80).default(""),
  roles: z.array(text(60)).max(12).default([]),
  notes: text(4000).default(""),
  cost: z.object({ minutesPerRun: z.number().finite().min(0).max(100_000).default(0), runsPerMonth: z.number().finite().min(0).max(1_000_000).default(0), hourlyRate: money.default(0) }).strict().default({ minutesPerRun: 0, runsPerMonth: 0, hourlyRate: 0 }),
  tools: z.array(toolSchema).max(20).default([]),
  signal: z.enum(SIGNAL_KEYS).nullable().default(null),
  automation: z.object({ mode: z.enum(AUTOMATION_MODES).default("manual"), agent: text(80).default("") }).strict().default({ mode: "manual", agent: "" }),
}).strict();
/** Steps saved before automation existed take the default for their id instead of "manual". */
const stepSchema = z.preprocess((v) => (v && typeof v === "object" && !Array.isArray(v) && !("automation" in v) && typeof (v as { id?: unknown }).id === "string" ? { ...v, automation: defaultAutomationFor((v as { id: string }).id) } : v), stepObject);
const departmentSchema = z.object({ id, name: text(60).pipe(z.string().min(1)), group: text(40).default("Company"), description: text(300).default("") }).strict();
const linkSchema = z.object({ from: id, to: id, label: text(40).default("") }).strict();

export const blueprintSchema = z.object({
  kind: z.literal(BLUEPRINT_KIND),
  version: z.literal(BLUEPRINT_VERSION),
  departments: z.array(departmentSchema).min(1).max(40),
  steps: z.array(stepSchema).max(1000),
  links: z.array(linkSchema).max(3000),
  /** The founder autopilot: when paused, it reads but never changes the map. */
  autopilot: z.object({ paused: z.boolean().default(false) }).strict().default({ paused: false }),
}).strict();

export type Blueprint = z.infer<typeof blueprintSchema>;
export type BlueprintStep = Blueprint["steps"][number];
export type BlueprintDepartment = Blueprint["departments"][number];

/** Validates structure and references: unique ids, steps in a known department, links between known steps. */
export function validateBlueprint(input: unknown): { ok: true; blueprint: Blueprint } | { ok: false; errors: string[] } {
  const parsed = blueprintSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.slice(0, 20).map((i) => `${i.path.join(".") || "blueprint"}: ${i.message}`) };
  const b = parsed.data; const errors: string[] = [];
  const deps = new Set<string>();
  for (const d of b.departments) { if (deps.has(d.id)) errors.push(`department "${d.id}" appears twice`); deps.add(d.id); }
  const steps = new Set<string>(); const cells = new Set<string>();
  for (const s of b.steps) {
    if (steps.has(s.id)) errors.push(`step "${s.id}" appears twice`);
    steps.add(s.id);
    if (!deps.has(s.departmentId)) errors.push(`step "${s.id}" is in unknown department "${s.departmentId}"`);
    const cell = `${s.departmentId}:${s.col}:${s.row}`;
    if (cells.has(cell)) errors.push(`step "${s.id}" overlaps another step in ${s.departmentId} at column ${s.col}, row ${s.row}`);
    cells.add(cell);
  }
  for (const l of b.links) {
    if (!steps.has(l.from) || !steps.has(l.to)) errors.push(`link ${l.from} → ${l.to} refers to a missing step`);
    if (l.from === l.to) errors.push(`link ${l.from} → ${l.to} points at itself`);
  }
  return errors.length ? { ok: false, errors: errors.slice(0, 20) } : { ok: true, blueprint: b };
}

export interface StepCost { hoursPerRun: number; costPerRun: number; hoursPerMonth: number; monthlyLabor: number; annualLabor: number; monthlyTools: number; oneTimeTools: number; monthlyTotal: number }
const round2 = (n: number) => Math.round(n * 100) / 100;

export function stepCost(s: Pick<BlueprintStep, "cost" | "tools">): StepCost {
  const hoursPerRun = s.cost.minutesPerRun / 60;
  const costPerRun = hoursPerRun * s.cost.hourlyRate;
  const hoursPerMonth = hoursPerRun * s.cost.runsPerMonth;
  const monthlyLabor = costPerRun * s.cost.runsPerMonth;
  const monthlyTools = s.tools.filter((t) => t.active).reduce((n, t) => n + t.monthlyCost, 0);
  const oneTimeTools = s.tools.reduce((n, t) => n + t.oneTimeCost, 0);
  return { hoursPerRun: round2(hoursPerRun), costPerRun: round2(costPerRun), hoursPerMonth: round2(hoursPerMonth), monthlyLabor: round2(monthlyLabor), annualLabor: round2(monthlyLabor * 12), monthlyTools: round2(monthlyTools), oneTimeTools: round2(oneTimeTools), monthlyTotal: round2(monthlyLabor + monthlyTools) };
}

/** Department totals roll up their steps, as in "this summary rolls up step cost data from steps within this section". */
export function departmentCost(b: Blueprint, departmentId: string): StepCost & { steps: number; live: number } {
  const steps = b.steps.filter((s) => s.departmentId === departmentId && s.status !== "archived");
  const zero: StepCost = { hoursPerRun: 0, costPerRun: 0, hoursPerMonth: 0, monthlyLabor: 0, annualLabor: 0, monthlyTools: 0, oneTimeTools: 0, monthlyTotal: 0 };
  const total = steps.map(stepCost).reduce((a, c) => ({ hoursPerRun: a.hoursPerRun + c.hoursPerRun, costPerRun: a.costPerRun + c.costPerRun, hoursPerMonth: a.hoursPerMonth + c.hoursPerMonth, monthlyLabor: a.monthlyLabor + c.monthlyLabor, annualLabor: a.annualLabor + c.annualLabor, monthlyTools: a.monthlyTools + c.monthlyTools, oneTimeTools: a.oneTimeTools + c.oneTimeTools, monthlyTotal: a.monthlyTotal + c.monthlyTotal }), zero);
  const r = Object.fromEntries(Object.entries(total).map(([k, v]) => [k, round2(v)])) as unknown as StepCost;
  return { ...r, steps: steps.length, live: steps.filter((s) => s.status === "live").length };
}

/** Canvas layout: departments as regions in a grid, steps placed on a cell grid inside each region. */
export const CELL_W = 196, CELL_H = 104, CARD_W = 164, CARD_H = 68, REGION_PAD = 28, REGION_HEADER = 44, REGION_GAP = 56, REGIONS_PER_ROW = 4;

export interface RegionBox { departmentId: string; x: number; y: number; w: number; h: number }
export interface StepBox { stepId: string; x: number; y: number; w: number; h: number }

export function layoutBlueprint(b: Blueprint): { regions: RegionBox[]; steps: Map<string, StepBox>; width: number; height: number } {
  const sizes = b.departments.map((d) => {
    const own = b.steps.filter((s) => s.departmentId === d.id);
    const cols = Math.max(2, ...own.map((s) => s.col + 1)), rows = Math.max(1, ...own.map((s) => s.row + 1));
    return { d, w: cols * CELL_W + REGION_PAD * 2, h: rows * CELL_H + REGION_PAD * 2 + REGION_HEADER };
  });
  const regions: RegionBox[] = []; const steps = new Map<string, StepBox>();
  let y = 0, width = 0;
  for (let i = 0; i < sizes.length; i += REGIONS_PER_ROW) {
    const row = sizes.slice(i, i + REGIONS_PER_ROW);
    const rowH = Math.max(...row.map((r) => r.h));
    let x = 0;
    for (const r of row) {
      regions.push({ departmentId: r.d.id, x, y, w: r.w, h: rowH });
      for (const s of b.steps.filter((st) => st.departmentId === r.d.id)) {
        steps.set(s.id, { stepId: s.id, x: x + REGION_PAD + s.col * CELL_W + (CELL_W - CARD_W) / 2, y: y + REGION_HEADER + REGION_PAD + s.row * CELL_H + (CELL_H - CARD_H) / 2, w: CARD_W, h: CARD_H });
      }
      x += r.w + REGION_GAP;
    }
    width = Math.max(width, x - REGION_GAP);
    y += rowH + REGION_GAP;
  }
  return { regions, steps, width, height: Math.max(0, y - REGION_GAP) };
}

/** Orthogonal connector between two cards: out of the source's bottom (or side), into the target's top. */
export function connectorPath(a: StepBox, b: StepBox): string {
  const ax = a.x + a.w / 2, bx = b.x + b.w / 2;
  if (b.y >= a.y + a.h) {
    const y1 = a.y + a.h, y2 = b.y, mid = Math.round((y1 + y2) / 2);
    return `M ${ax} ${y1} V ${mid} H ${bx} V ${y2}`;
  }
  const fromRight = b.x > a.x;
  const x1 = fromRight ? a.x + a.w : a.x, x2 = fromRight ? b.x : b.x + b.w, ay = a.y + a.h / 2, by = b.y + b.h / 2, mid = Math.round((x1 + x2) / 2);
  return `M ${x1} ${ay} H ${mid} V ${by} H ${x2}`;
}
