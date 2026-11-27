// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { FounderBlueprint } from "../FounderBlueprint";
import { DEFAULT_BLUEPRINT } from "@/lib/founder/defaultBlueprint";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const loaded = { blueprint: DEFAULT_BLUEPRINT, version: 0, saved: false, unreadable: false, updatedAt: null, updatedBy: null, signals: { incidents_open: 2, deployments_failed_7d: null } };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

type Handler = (init?: RequestInit) => Response | Promise<Response>;
/** Routes fetch by method and path so the live activity poll and autopilot reads don't consume other answers. */
function router(routes: Record<string, Handler | Handler[]>, activity: unknown = { events: [], unavailable: [], readAt: new Date().toISOString(), signals: loaded.signals }) {
  const queues = new Map(Object.entries(routes).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]));
  const f = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).split("?")[0]; const key = `${init?.method ?? "GET"} ${url}`;
    const h = queues.get(key);
    if (Array.isArray(h)) { const next = h.length > 1 ? h.shift()! : h[0]; return next(init); }
    if (h) return h(init);
    if (url === "/api/founder/activity") return json({ ok: true, data: activity });
    if (url === "/api/founder/autopilot" && key.startsWith("GET")) return json({ ok: true, data: { paused: false, runs: [] } });
    return json({ ok: false, error: "unexpected" }, 500);
  });
  vi.stubGlobal("fetch", f);
  return f;
}
const callsTo = (f: ReturnType<typeof vi.fn>, key: string) => f.mock.calls.filter(([u, i]) => `${(i as RequestInit | undefined)?.method ?? "GET"} ${String(u).split("?")[0]}` === key);

describe("FounderBlueprint", () => {
  it("draws departments and steps, shows live signals and opens a step's details", async () => {
    router({ "GET /api/founder/blueprint": () => json({ ok: true, data: loaded }) });
    render(createElement(FounderBlueprint));
    expect(await screen.findByRole("region", { name: "Incident response" })).toBeTruthy();
    const step = screen.getByRole("button", { name: /^Incident detected, Incident response, Live, Open incidents 2, Autonomous$/ });
    fireEvent.click(step);
    const panel = screen.getByRole("complementary", { name: "Step details: Incident detected" });
    expect(within(panel).getByText(/Open incidents:/).textContent).toContain("2");
    expect(screen.getByRole("button", { name: /Verify health.*Unavailable/ })).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: "Close step details" }));
    expect(screen.queryByRole("complementary", { name: /Step details/ })).toBeNull();
  });
  it("edits a step's cost on the Cost tab and saves with a change summary and the version it read", async () => {
    const f = router({ "GET /api/founder/blueprint": () => json({ ok: true, data: loaded }), "PUT /api/founder/blueprint": () => json({ ok: true, data: { version: 1 } }) });
    render(createElement(FounderBlueprint));
    fireEvent.click(await screen.findByRole("button", { name: /^Monthly cost review/ }));
    const panel = screen.getByRole("complementary", { name: /Step details/ });
    fireEvent.click(within(panel).getByRole("tab", { name: "Cost" }));
    fireEvent.change(within(panel).getByLabelText("Minutes per run"), { target: { value: "90" } });
    fireEvent.change(within(panel).getByLabelText("Runs per month"), { target: { value: "2" } });
    fireEvent.change(within(panel).getByLabelText("$ per hour"), { target: { value: "100" } });
    expect(within(panel).getAllByText("$300").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("What changed"), { target: { value: "Costed the monthly review" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved as version 1.")).toBeTruthy();
    const body = JSON.parse(String(callsTo(f, "PUT /api/founder/blueprint")[0][1]!.body));
    expect(body).toMatchObject({ expectedVersion: 0, summary: "Costed the monthly review" });
    expect(body.blueprint.steps.find((s: { id: string }) => s.id === "fin-costs").cost).toEqual({ minutesPerRun: 90, runsPerMonth: 2, hourlyRate: 100 });
  });
  it("sets who runs a step on the Automation tab", async () => {
    router({ "GET /api/founder/blueprint": () => json({ ok: true, data: loaded }) });
    render(createElement(FounderBlueprint));
    fireEvent.click(await screen.findByRole("button", { name: /^Positioning and messaging/ }));
    const panel = screen.getByRole("complementary", { name: /Step details/ });
    fireEvent.click(within(panel).getByRole("tab", { name: "Automation" }));
    fireEvent.click(within(panel).getByLabelText(/^Person/));
    expect(screen.getByRole("button", { name: /^Positioning and messaging, GTM, Draft$/ })).toBeTruthy();
    expect(screen.getByText(/unsaved changes/)).toBeTruthy();
  });
  it("offers a list view as a text equivalent of the map", async () => {
    router({ "GET /api/founder/blueprint": () => json({ ok: true, data: loaded }) });
    render(createElement(FounderBlueprint));
    fireEvent.click(await screen.findByRole("button", { name: "List view" }));
    expect(screen.getByRole("heading", { name: /Finance/ })).toBeTruthy();
    expect(screen.queryByRole("application")).toBeNull();
  });
  it("opens a department's cost rollup from its header", async () => {
    router({ "GET /api/founder/blueprint": () => json({ ok: true, data: loaded }) });
    render(createElement(FounderBlueprint));
    fireEvent.click(await screen.findByRole("button", { name: "Finance summary and costs" }));
    const panel = screen.getByRole("complementary", { name: "Department summary" });
    expect(within(panel).getByText("Labor costs")).toBeTruthy();
    expect(within(panel).getByText("Tool costs")).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: /Monthly cost review/ }));
    expect(screen.getByRole("complementary", { name: "Step details: Monthly cost review" })).toBeTruthy();
  });
});

describe("FounderBlueprint live activity", () => {
  it("streams real events, links them to steps, and shows what needs attention", async () => {
    const at = new Date(Date.now() - 60_000).toISOString();
    router({ "GET /api/founder/blueprint": () => json({ ok: true, data: loaded }) }, { events: [{ id: "deployment_failed:d1", kind: "deployment_failed", at, signal: "deployments_failed_7d", title: "Deployment failed", detail: "Ended: failure.", tone: "failed" }], unavailable: ["leads"], readAt: new Date().toISOString(), signals: { incidents_open: 2, deployments_failed_7d: 1, deployments_7d: 4 } });
    render(createElement(FounderBlueprint));
    const rail = await screen.findByRole("complementary", { name: "Activity" });
    expect(await within(rail).findByText("Deployment failed")).toBeTruthy();
    expect(within(rail).getByText("Could not read: leads.")).toBeTruthy();
    expect(within(rail).getByText("2 open incidents across workspaces")).toBeTruthy();
    expect(within(rail).getByText("1 failed deployment this week")).toBeTruthy();
    expect(await screen.findByRole("button", { name: /^Verify health, Release and deployment, Live, Failed deployments, 7 days 1, Autonomous, 1 event today$/ })).toBeTruthy();
    fireEvent.click(within(rail).getByRole("button", { name: /Deployment failed/ }));
    expect(screen.getByRole("complementary", { name: "Step details: Verify health" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Activity/ }));
    expect(screen.getByRole("tabpanel", { name: "Activity" }).textContent).toContain("Deployment failed");
  });
  it("says so when live records cannot be read", async () => {
    router({ "GET /api/founder/blueprint": () => json({ ok: true, data: loaded }), "GET /api/founder/activity": () => json({ ok: false }, 503) });
    render(createElement(FounderBlueprint));
    expect(await screen.findByText("Live records could not be read. Showing the last read.")).toBeTruthy();
  });
});

describe("FounderBlueprint autopilot", () => {
  it("runs the autopilot now and reloads the map it saved", async () => {
    const f = router({
      "GET /api/founder/blueprint": [() => json({ ok: true, data: loaded }), () => json({ ok: true, data: { ...loaded, saved: true, version: 1 } })],
      "POST /api/founder/autopilot": () => json({ ok: true, data: { outcome: "applied", version: 1, actions: [{ kind: "mark_live", stepId: "out-list", text: 'Marked "Build target account list" live.' }], proposals: [] } }),
    });
    render(createElement(FounderBlueprint));
    fireEvent.click(await screen.findByRole("button", { name: "Run now" }));
    expect(await screen.findByText(/Autopilot made 1 change: Marked "Build target account list" live\./)).toBeTruthy();
    await waitFor(() => expect(callsTo(f, "GET /api/founder/blueprint").length).toBe(2));
  });
  it("pauses the autopilot with the version it read", async () => {
    const f = router({ "GET /api/founder/blueprint": () => json({ ok: true, data: { ...loaded, saved: true, version: 4 } }), "PATCH /api/founder/autopilot": () => json({ ok: true, data: { version: 5, paused: true } }) });
    render(createElement(FounderBlueprint));
    fireEvent.click(await screen.findByRole("button", { name: "Autopilot on" }));
    expect(await screen.findByText(/Autopilot paused\./)).toBeTruthy();
    expect(JSON.parse(String(callsTo(f, "PATCH /api/founder/autopilot")[0][1]!.body))).toEqual({ paused: true, expectedVersion: 4 });
  });
  it("lists changes that wait for approval and saves one when approved", async () => {
    const f = router({ "GET /api/founder/blueprint": () => json({ ok: true, data: loaded }), "PUT /api/founder/blueprint": () => json({ ok: true, data: { version: 1 } }) }, { events: [], unavailable: [], readAt: new Date().toISOString(), signals: { agent_requests_pending: 2 } });
    render(createElement(FounderBlueprint));
    const rail = await screen.findByRole("complementary", { name: "Activity" });
    const item = (await within(rail).findByText(/Waiting for you: Noted on "Agent requests reviewed": 2 agent requests waiting\./)).closest("li")!;
    fireEvent.click(within(item).getByRole("button", { name: "Approve and save" }));
    expect(await screen.findByText("Saved as version 1.")).toBeTruthy();
    const body = JSON.parse(String(callsTo(f, "PUT /api/founder/blueprint")[0][1]!.body));
    expect(body.summary).toMatch(/^Approved autopilot proposal: Noted on "Agent requests reviewed"/);
    expect(body.blueprint.steps.find((s: { id: string }) => s.id === "ai-requests").notes).toMatch(/Approved \d{4}-\d{2}-\d{2}: Noted on/);
  });
});

describe("FounderBlueprint history", () => {
  it("lists saved versions and restores one", async () => {
    const f = router({
      "GET /api/founder/blueprint": [() => json({ ok: true, data: { ...loaded, saved: true, version: 2 } }), () => json({ ok: true, data: { ...loaded, saved: true, version: 3 } })],
      "GET /api/founder/blueprint/revisions": () => json({ ok: true, data: { revisions: [{ version: 2, summary: "Second", savedByEmail: "f@x.test", createdAt: "2026-11-27T07:00:00Z" }, { version: 1, summary: "First", savedByEmail: "f@x.test", createdAt: "2026-11-27T06:00:00Z" }] } }),
      "POST /api/founder/blueprint/revisions": () => json({ ok: true, data: { version: 3 } }),
    });
    render(createElement(FounderBlueprint));
    fireEvent.click(await screen.findByRole("button", { name: "History" }));
    const panel = await screen.findByRole("complementary", { name: "Saved versions" });
    expect(within(panel).getByText("Version 2 · current")).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: "Restore this version" }));
    expect(await screen.findByText("Restored version 1 as version 3.")).toBeTruthy();
    expect(JSON.parse(String(callsTo(f, "POST /api/founder/blueprint/revisions")[0][1]!.body))).toEqual({ version: 1, expectedVersion: 2 });
  });
});

describe("FounderBlueprint suggestions", () => {
  it("suggests from live records and applies a change only locally until saved", async () => {
    router({ "GET /api/founder/blueprint": () => json({ ok: true, data: { ...loaded, signals: { leads_30d: 4, incidents_open: 1 } } }), "GET /api/founder/activity": () => json({ ok: false }, 503) });
    render(createElement(FounderBlueprint));
    fireEvent.click(await screen.findByRole("button", { name: /^Suggestions \(\d+\)$/ }));
    const panel = screen.getByRole("complementary", { name: "Suggestions" });
    expect(within(panel).getByText('Look at "Incident detected"')).toBeTruthy();
    const item = within(panel).getByText('Mark "Build target account list" as live').closest("li")!;
    fireEvent.click(within(item).getByRole("button", { name: "Apply" }));
    expect(screen.getByText(/Marked "Build target account list" as live\. Save to keep it\./)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Build target account list, Outbound, Live/ })).toBeTruthy();
    expect(screen.getByText(/unsaved changes/)).toBeTruthy();
  });
});
