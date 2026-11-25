/** @vitest-environment jsdom */
import {createElement} from "react";
import {act, cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {afterEach, beforeEach, expect, it, vi} from "vitest";

const m = vi.hoisted(() => ({readAssignment:vi.fn(), saveAssignment:vi.fn(), readCollection: vi.fn(), readCollectionReceipt: vi.fn(), saveCollection: vi.fn(), remediationReview: vi.fn(), transition: vi.fn(), updates: vi.fn(), saveUpdate: vi.fn(), createDraft: vi.fn(), exportCsv: vi.fn(), report: vi.fn(), reportReleases: vi.fn(), read: vi.fn(), activity: vi.fn(), triage: vi.fn(), releases: vi.fn(), links: vi.fn(), client: {config: {apiBase: "https://fixture.invalid", sessionToken: "axm.desk.synthetic"}, getContextRevision: () => 1, subscribeContext: () => () => {}, createReleaseResolutionDraft: (...args: unknown[]) => m.createDraft(...args)}}));
vi.mock("@tauri-apps/api/core", () => ({invoke: m.exportCsv}));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({desktopClient: m.client}));
vi.mock("../../../desktop/src/lib/ticketDirectoryClient", () => ({readIncidentAssignment:m.readAssignment, saveIncidentAssignment:m.saveAssignment, readIncidentCollection:m.readCollection, readIncidentCollectionReceipt:m.readCollectionReceipt, saveIncidentCollection:m.saveCollection, readIncidentRemediationReview: m.remediationReview, changeIncidentStatus: m.transition, readTicketDirectory: m.read, readIncidentUpdates: m.updates, saveIncidentUpdate: m.saveUpdate, readIncidentReportReleases: m.reportReleases, reportDeploymentIncident: m.report, readIncidentActivity: m.activity, readIncidentTriage: m.triage, readTicketReleaseLinks: m.links, readIncidentRelease: m.releases}));
import {TicketsDirectoryView} from "../../../desktop/src/views/TicketsDirectoryView";
import type {VerifiedDesktopIdentity} from "../../../desktop/src/lib/desktopClient";

const identity: VerifiedDesktopIdentity = {
  kind: "desktop_session", userId: "fixture-user", organizationId: "fixture-workspace", capabilities: ["workspace:read"],
  access: {allowed: true, code: "active", title: "Active", message: "Synthetic", planTier: "test", billingStatus: "active", accessRequestPath: "/access", pricingPath: "/pricing"},
};
const instant = "2026-11-20T12:00:00.000Z";
const data = {
  workspaceId: identity.organizationId, actorId: identity.userId,
  sources: {incidents: {state: "available", limited: false}, changes: {state: "available", limited: false}},
  records: [
    {kind: "incident", id: "same-id", title: "Fixture incident", status: "open", severity: "high", releaseId: "release-1", summary: "Synthetic readiness details", reportedAt: instant, mitigatedAt: null, resolvedAt: null},
    {kind: "change", id: "same-id", title: "Fixture change", reference: "CHG-10", type: "change_request", provider: "jira", status: "pending", priority: "normal", observedAt: instant, relatedReleases: 1},
  ],
};
function show(verified = identity, onOpenReleases = vi.fn(), onPrepareRemediation = vi.fn()) {
  return render(createElement(TicketsDirectoryView, {identity: verified, revision: 1, onOpenReleases, onPrepareRemediation}));
}
beforeEach(() => {vi.resetAllMocks();m.read.mockResolvedValue(data);m.updates.mockResolvedValue({
  workspaceId:identity.organizationId,actorId:identity.userId,incidentId:"same-id",releaseId:"release-1",
  canWrite:false,limited:false,notes:[],
});});
afterEach(cleanup);

it("keeps keyboard focus on retry and starts one read while tickets refresh", async () => {
  let complete!: (value: typeof data) => void;
  m.read.mockResolvedValueOnce(undefined).mockImplementationOnce(() => new Promise(resolve => {complete = resolve;}));
  show();
  await screen.findByRole("alert");
  const refresh = screen.getByRole<HTMLButtonElement>("button", {name: "Refresh tickets"});
  refresh.focus();
  fireEvent.click(refresh);
  expect(refresh.disabled).toBe(false);
  expect(refresh.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(refresh);
  expect(m.read).toHaveBeenCalledTimes(2);
  await act(async () => complete(data));
  expect(refresh.getAttribute("aria-disabled")).toBe("false");
  expect(document.activeElement).toBe(refresh);
  expect(screen.getByRole("heading", {name: "Fixture incident"})).toBeTruthy();
});

it.each([false,true])("leaves the inspector empty when its ticket is absent after refresh (explicit: %s)", async explicit => {
  m.read.mockResolvedValueOnce(data).mockResolvedValue({...data, records:[data.records[1]]});
  show();
  const directory = within(await screen.findByRole("navigation",{name:"Select a ticket"}));
  if (explicit) fireEvent.click(directory.getByRole("button",{name:/Fixture incident/}));
  expect(screen.getByRole("heading",{name:"Fixture incident"})).toBeTruthy();

  const refresh = screen.getByRole("button",{name:"Refresh tickets"});
  refresh.focus();
  fireEvent.click(refresh);
  expect(await screen.findByText(/The selected ticket could not be verified in the loaded records/)).toBeTruthy();
  expect(document.activeElement).toBe(refresh);
  expect(screen.queryByRole("article",{name:"Selected ticket details"})).toBeNull();
  const other = within(screen.getByRole("navigation",{name:"Select a ticket"})).getByRole<HTMLButtonElement>("button",{name:/Fixture change/});
  expect(other.tabIndex).toBe(0);
  expect(other.getAttribute("aria-controls")).toBeNull();
  expect(other.getAttribute("aria-current")).toBeNull();
  fireEvent.click(other);
  const inspector = screen.getByRole("article",{name:"Selected ticket details"});
  expect(within(inspector).getByRole("heading",{name:"Fixture change"})).toBeTruthy();
  expect(document.activeElement).toBe(inspector);
});

it("opens exact source records with colliding ids and keeps Releases reachable", async () => {
  const openReleases = vi.fn();
  show(identity, openReleases);
  expect(await screen.findByText("Synthetic readiness details")).toBeTruthy();
  const open = screen.getByRole("button", {name: "Open, 2 loaded"});
  expect(open.textContent).toBe("Open2");
  fireEvent.click(screen.getByRole("button", {name: "Changes"}));
  expect(open.textContent).toBe("Open2");
  const details = within(screen.getByRole("article", {name: "Selected ticket details"}));
  expect(details.getByText("Fixture change")).toBeTruthy();
  expect(details.getByText("Priority: normal")).toBeTruthy();
  expect(details.queryByText("Synthetic readiness details")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Open Deployments"}));
  expect(openReleases).toHaveBeenCalledOnce();
  expect(m.read).toHaveBeenCalledTimes(1);
});

it("shows only recorded lifecycle events with their exact timestamps", async () => {
  const openView = show();
  const reportOnly = within(await screen.findByRole("region", {name: "Recorded timeline"}));
  expect(reportOnly.getAllByRole("listitem").map(row => row.querySelector("time")?.dateTime)).toEqual([instant]);
  openView.unmount();

  const mitigatedAt = "2026-11-20T12:10:00.000Z";
  const resolvedAt = "2026-11-20T12:20:00.000Z";
  m.read.mockResolvedValue({...data, records: [{...data.records[0], status: "resolved", mitigatedAt, resolvedAt}]});
  show();
  fireEvent.click(screen.getByRole("button", {name: "Resolved"}));
  const timeline = within(await screen.findByRole("region", {name: "Recorded timeline"}));
  expect(timeline.getAllByRole("listitem").map(row => [
    row.querySelector("span")?.textContent, row.querySelector("time")?.dateTime,
  ])).toEqual([["Reported", instant], ["Mitigated", mitigatedAt], ["Resolved", resolvedAt]]);
});

it("preserves a source outage separately from filtered empty results", async () => {
  m.read.mockResolvedValue({...data, sources: {...data.sources, changes: {state: "unavailable", limited: false}}, records: [data.records[0]]});
  show();
  expect(await screen.findByText("Change tickets are unavailable.")).toBeTruthy();
  expect(screen.getByRole("button", {name: "Open"}).textContent).toBe("Open");
  fireEvent.change(screen.getByRole("searchbox", {name: "Search tickets"}), {target: {value: "missing"}});
  expect(screen.getByText("No loaded tickets match.")).toBeTruthy();
  expect(screen.getByText("Change tickets are unavailable.")).toBeTruthy();
});

it("refuses missing read capability and foreign response identity", async () => {
  const closed = show({...identity, capabilities: []});
  expect(m.read).not.toHaveBeenCalled();
  closed.unmount();
  m.read.mockResolvedValue({...data, actorId: "foreign"});
  show();
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("Synthetic readiness details")).toBeNull();
});

it("discards a result after the request context changes", async () => {
  let resolve!: (value: typeof data) => void;
  m.read.mockReturnValue(new Promise(done => { resolve = done; }));
  show();
  m.client.config = {...m.client.config};
  await act(async () => { resolve(data); });
  expect(screen.queryByText("Synthetic readiness details")).toBeNull();
});

it("scopes slash search focus to the visible ticket workspace and preserves typing", async () => {
  const props = {identity, revision: 1, onOpenReleases: vi.fn()};
  const view = render(createElement(TicketsDirectoryView, props));
  await screen.findByText("Synthetic readiness details");
  const search = screen.getByRole("searchbox", {name: "Search tickets"});
  const changes = screen.getByRole("button", {name: "Changes"});
  changes.focus();
  expect(fireEvent.keyDown(changes, {key: "/"})).toBe(false);
  expect(document.activeElement).toBe(search);
  expect(fireEvent.keyDown(search, {key: "/"})).toBe(true);
  view.rerender(createElement(TicketsDirectoryView, {...props, active: false}));
  changes.focus();
  expect(fireEvent.keyDown(changes, {key: "/"})).toBe(true);
  expect(document.activeElement).toBe(changes);
  expect(m.read).toHaveBeenCalledOnce();
});

it("filters loaded classifications by source without a new directory read", async () => {
  m.read.mockResolvedValue({...data, records: [data.records[0], {...data.records[1], priority: "high"}]});
  show();
  await screen.findByText("Synthetic readiness details");
  const filter = screen.getByRole("combobox", {name: "Filter tickets by priority or severity"});
  const rows = within(screen.getByRole("navigation", {name: "Select a ticket"}));

  fireEvent.change(filter, {target: {value: "change:high"}});
  expect(rows.getByText("Fixture change")).toBeTruthy();
  expect(rows.queryByText("Fixture incident")).toBeNull();

  fireEvent.change(filter, {target: {value: "incident:high"}});
  expect(rows.getByText("Fixture incident")).toBeTruthy();
  expect(rows.queryByText("Fixture change")).toBeNull();

  const search = screen.getByRole("searchbox", {name: "Search tickets"});
  fireEvent.change(search, {target: {value: "CHG-10"}});
  expect(screen.getByText("No loaded tickets match.")).toBeTruthy();
  fireEvent.change(filter, {target: {value: ""}});
  expect(screen.getByRole("heading", {name: "Fixture change"})).toBeTruthy();
  expect(m.read).toHaveBeenCalledOnce();
});

it("moves through exact visible case rows, enters details, and returns without a new read", async () => {
  show();
  const list = within(await screen.findByRole("navigation", {name: "Select a ticket"}));
  const incident = list.getByRole("button", {name: /Fixture incident/});
  const change = list.getByRole("button", {name: /Fixture change/});
  expect([incident.tabIndex, change.tabIndex]).toEqual([0, -1]);
  incident.focus();
  expect(fireEvent.keyDown(incident, {key: "ArrowDown", isComposing: true})).toBe(true);
  expect(document.activeElement).toBe(incident);
  fireEvent.keyDown(incident, {key: "ArrowDown"});
  expect(document.activeElement).toBe(change);
  expect(change.getAttribute("aria-current")).toBe("true");
  expect([incident.tabIndex, change.tabIndex]).toEqual([-1, 0]);
  fireEvent.click(change);
  const details = screen.getByRole("article", {name: "Selected ticket details"});
  expect(document.activeElement).toBe(details);
  expect(within(details).getByRole("heading", {name: "Fixture change"})).toBeTruthy();
  fireEvent.keyDown(details, {key: "Escape"});
  expect(document.activeElement).toBe(change);
  fireEvent.keyDown(change, {key: "Home"});
  expect(document.activeElement).toBe(incident);
  expect(incident.getAttribute("aria-current")).toBe("true");
  expect(m.read).toHaveBeenCalledOnce();
});

const scopedIdentity = {...identity, capabilities: ["workspace:read", "pipeline:read"]};
const linkedRecord = {workspaceId:identity.organizationId,actorId:identity.userId,incidentId:"same-id",incidentStatus:"open",
  release:{id:"release-1",tag:"v1.2.0",commit:"a".repeat(40),status:"failed"}};

it("reads canonical release facts for the selected incident under pipeline read authority", async () => {
  m.releases.mockResolvedValue(linkedRecord);
  show(scopedIdentity);
  const button = await screen.findByRole("button", {name: "View linked release"});
  expect(m.releases).not.toHaveBeenCalled();
  button.focus();
  fireEvent.click(button);
  const browser = await screen.findByRole("link",{name:"Open release record in browser"});
  expect(browser.getAttribute("href")).toBe("https://visionxixlabs.com/control/releases/release-1");
  expect(m.releases).toHaveBeenCalledExactlyOnceWith(m.client.config.apiBase,m.client.config.sessionToken,expect.any(AbortSignal),"same-id",undefined);
  expect(screen.getByText("v1.2.0 · failed")).toBeTruthy();
  expect(document.activeElement).toBe(button);
});

it("keeps an incident readable when the linked release is unavailable or pipeline read is absent", async () => {
  const view = show();
  await screen.findByRole("heading", {name: "Fixture incident"});
  expect(screen.queryByRole("button", {name: "View linked release"})).toBeNull();
  expect(m.releases).not.toHaveBeenCalled();
  view.unmount();
  m.releases.mockResolvedValue({...linkedRecord,actorId:"foreign"});
  show(scopedIdentity);
  fireEvent.click(await screen.findByRole("button", {name: "View linked release"}));
  expect(await screen.findByText(/The current linked release could not be verified/)).toBeTruthy();
  expect(screen.queryByRole("link",{name:"Open release record in browser"})).toBeNull();
});

it("discards a linked release result after selecting another ticket", async () => {
  let complete!: (value: unknown) => void;
  m.releases.mockImplementation(() => new Promise(resolve => {complete = resolve;}));
  show(scopedIdentity);
  fireEvent.click(await screen.findByRole("button", {name: "View linked release"}));
  fireEvent.click(screen.getByRole("button", {name: "Changes"}));
  await act(async () => complete(linkedRecord));
  expect(screen.queryByRole("link",{name:"Open release record in browser"})).toBeNull();
  expect(screen.getByRole("heading", {name: "Fixture change"})).toBeTruthy();
});

it.each(["Overview", "Evidence", "Linked items"])("shows confirmed browser release links only after a change ticket lookup in %s", async tab => {
  m.links.mockResolvedValueOnce({workspaceId: identity.organizationId, actorId: identity.userId,
    ticketId: "same-id", incomplete: true, releases: [{id: "release-1", tag: "v2.14.0"}]});
  show({...identity, capabilities: ["workspace:read", "pipeline:read"]});
  await screen.findByRole("heading", {name: "Fixture incident"});
  fireEvent.click(screen.getByRole("button", {name: "Changes"}));
  if (tab !== "Overview") fireEvent.click(screen.getByRole("tab", {name: tab}));
  expect(m.links).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "View linked releases"}));
  const link = await screen.findByRole("link", {name: /v2.14.0/});
  expect(link.getAttribute("href")).toBe("https://visionxixlabs.com/control/releases/release-1");
  expect(m.links).toHaveBeenCalledExactlyOnceWith(m.client.config.apiBase, m.client.config.sessionToken, expect.any(AbortSignal), "same-id");
  expect(screen.getByText("Some recorded links are unavailable in this view.")).toBeTruthy();
});

it("shows only the opted-in evidence summary in a verified incident Evidence tab", async () => {
  m.releases.mockResolvedValue({...linkedRecord,evidence:{
    state:"recorded",generatedAt:instant,branchCheckCount:2,changeTicketCount:1,
    readiness:{score:72,evaluatedAt:null},
  }});
  show(scopedIdentity);
  await screen.findByRole("heading",{name:"Fixture incident"});
  fireEvent.click(screen.getByRole("tab",{name:"Evidence"}));
  fireEvent.click(screen.getByRole("button",{name:"Review linked release evidence"}));
  expect(await screen.findByRole("heading",{name:"Saved release evidence"})).toBeTruthy();
  expect(screen.getByText(/72\/100 · evaluation time unverified/)).toBeTruthy();
  expect(m.releases).toHaveBeenCalledExactlyOnceWith(m.client.config.apiBase,m.client.config.sessionToken,expect.any(AbortSignal),"same-id","evidence");
});

it("reads the recorded rollback reference on demand and preserves keyboard focus", async () => {
  m.releases.mockResolvedValue({...linkedRecord, recovery: {
    state: "recorded", releaseId: "prior-release", tag: "v1.1.9", commit: "b".repeat(40),
  }});
  show(scopedIdentity);
  await screen.findByRole("heading", {name: "Fixture incident"});
  fireEvent.click(screen.getByRole("tab", {name: "Linked items"}));
  expect(m.releases).not.toHaveBeenCalled();
  const action = screen.getByRole("button", {name: "View linked release"});
  action.focus();
  fireEvent.click(action);
  const link = await screen.findByRole("link", {name: "Open rollback reference in browser"});
  expect(link.getAttribute("href")).toBe("https://visionxixlabs.com/control/releases/prior-release");
  expect(screen.getByText("b".repeat(40))).toBeTruthy();
  expect(m.releases).toHaveBeenCalledExactlyOnceWith(m.client.config.apiBase, m.client.config.sessionToken, expect.any(AbortSignal), "same-id", "recovery");
  expect(document.activeElement).toBe(action);
});

it("labels a closed-without-fix timestamp accurately", async () => {
  m.read.mockResolvedValue({...data, records: [{...data.records[0], status: "wont_fix", resolvedAt: instant}]});
  show(scopedIdentity);
  fireEvent.click(screen.getByRole("button", {name: "All tickets"}));
  await screen.findByRole("heading", {name: "Fixture incident"});
  fireEvent.click(screen.getByRole("tab", {name: "Activity"}));
  const timeline = within(screen.getByRole("region", {name: "Recorded timeline"}));
  expect(timeline.getByText("Closed without a fix")).toBeTruthy();
  expect(timeline.queryByText("Resolved", {exact: true})).toBeNull();
});

const reopenedHistory = {workspaceId: identity.organizationId, actorId: identity.userId,
  incidentId: "same-id", releaseId: "release-1", limited: false, events: [
    {id: "reopen-1", action: "reopen", recordedAt: "2026-11-20T12:40:00.000Z"},
    {id: "mitigate-1", action: "mitigate", recordedAt: "2026-11-20T12:20:00.000Z"},
  ]};

it("opens saved transitions on demand and keeps focus on the lookup button", async () => {
  m.activity.mockResolvedValueOnce(reopenedHistory);
  show(scopedIdentity);
  await screen.findByRole("heading", {name: "Fixture incident"});
  fireEvent.click(screen.getByRole("button", {name: "View activity"}));
  const activityTab = screen.getByRole("tab", {name: "Activity"});
  expect(activityTab.getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(activityTab);
  expect(m.activity).not.toHaveBeenCalled();
  const button = screen.getByRole("button", {name: "View transition history"});
  button.focus();
  fireEvent.click(button);
  const region = within(screen.getByRole("region", {name: "Saved transitions"}));
  expect(await region.findByText("Reopened")).toBeTruthy();
  expect(region.getByText("Mitigated")).toBeTruthy();
  expect(document.activeElement).toBe(button);
  expect(m.activity).toHaveBeenCalledExactlyOnceWith(m.client.config.apiBase, m.client.config.sessionToken,
    expect.any(AbortSignal), "same-id");
});

it("withholds history for a stale release and recovers after an explicit retry", async () => {
  m.activity.mockResolvedValueOnce({...reopenedHistory, releaseId: "stale-release"}).mockResolvedValueOnce(reopenedHistory);
  show(scopedIdentity);
  await screen.findByRole("heading", {name: "Fixture incident"});
  fireEvent.click(screen.getByRole("tab", {name: "Activity"}));
  fireEvent.click(screen.getByRole("button", {name: "View transition history"}));
  expect(await screen.findByText("Transition history is unavailable.")).toBeTruthy();
  expect(screen.queryByText("Reopened")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "View transition history"}));
  expect(await screen.findByText("Reopened")).toBeTruthy();
});

it("keeps investigation focus and shows a saved decision separately from the recommended priority", async () => {
  m.triage.mockResolvedValueOnce({
    workspaceId: identity.organizationId, actorId: identity.userId, incidentId: "same-id", releaseId: "release-1",
    recommendation: {id: "triage-1", priority: "P1", suggestedTeam: "platform-sre", rationale: "Recorded rationale",
      generatedAt: instant, decidedAt: instant, decision: "overridden", overridePriority: "P2"},
  });
  m.read.mockResolvedValue({...data,records:[data.records[0], {...data.records[0], id:"other-incident", title:"Second incident"}, data.records[1]]});
  show(scopedIdentity);
  await screen.findByRole("heading", {name: "Fixture incident"});
  fireEvent.click(screen.getByRole("button", {name: "Review saved triage"}));
  const investigationTab = screen.getByRole("tab", {name: "Investigation"});
  expect(investigationTab.getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(investigationTab);
  expect(m.triage).not.toHaveBeenCalled();
  const action = screen.getByRole("button", {name: "View saved triage"});
  action.focus();
  fireEvent.click(action);
  const region = within(screen.getByRole("region", {name: "Saved triage recommendation"}));
  expect(await region.findByText("Overridden")).toBeTruthy();
  for (const detail of ["P1", "P2", "platform-sre", "Recorded rationale"]) expect(region.getByText(detail)).toBeTruthy();
  expect(document.activeElement).toBe(action);
  expect(m.triage).toHaveBeenCalledExactlyOnceWith(m.client.config.apiBase, m.client.config.sessionToken,
    expect.any(AbortSignal), "same-id");
  fireEvent.click(screen.getByRole("tab", {name:"Overview"}));
  const summary = within(screen.getByRole("region", {name:"Saved triage"}));
  expect(summary.getByText("Overridden")).toBeTruthy();
  expect(summary.getByText("Recorded rationale")).toBeTruthy();
  fireEvent.click(summary.getByRole("button", {name:"Review saved triage"}));
  expect(screen.getByRole("button", {name:"Refresh saved triage"})).toBeTruthy();
  expect(m.triage).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", {name:/Second incident/}));
  expect(screen.queryByText("Recorded rationale")).toBeNull();

});

it("links Overview evidence to the exact selected incident and keeps the read explicit", async () => {
  m.releases.mockResolvedValueOnce(linkedRecord);
  show(scopedIdentity);
  await screen.findByRole("heading", {name: "Fixture incident"});
  fireEvent.click(screen.getByRole("button", {name: "View release evidence"}));
  const evidenceTab = screen.getByRole("tab", {name: "Evidence"});
  expect(evidenceTab.getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(evidenceTab);
  expect(m.releases).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "Review linked release evidence"}));
  expect(await screen.findByRole("link", {name: "Open release record in browser"})).toBeTruthy();
  expect(m.releases).toHaveBeenCalledExactlyOnceWith(m.client.config.apiBase, m.client.config.sessionToken,
    expect.any(AbortSignal), "same-id", "evidence");
});

it("shows recorded references and searches a change ticket by its ID when it has no provider reference", async () => {
  m.read.mockResolvedValue({...data, records: [data.records[0], {...data.records[1], id: "internal-change", reference: ""}]});
  show();
  const rows = within(await screen.findByRole("navigation", {name: "Select a ticket"}));
  expect(rows.getByRole("button", {name: /same-id.*Fixture incident/})).toBeTruthy();
  expect(rows.getByRole("button", {name: /internal-change.*Fixture change/})).toBeTruthy();
  fireEvent.change(screen.getByRole("searchbox", {name: "Search tickets"}), {target: {value: "internal-change"}});
  expect(screen.getByRole("heading", {name: "Fixture change"})).toBeTruthy();
  expect(rows.getAllByRole("button")).toHaveLength(1);
  expect(m.read).toHaveBeenCalledOnce();
});

it("searches the saved release context and shows unavailable catalog values without filtering the case out", async () => {
  m.read.mockResolvedValue({...data, records: [
    {...data.records[0], releaseContext: {application: "Inventory service", environment: "Staging"}},
    {...data.records[0], id: "other-incident", title: "Other incident", releaseContext: {application: "Payments", environment: null}},
    data.records[1],
  ]});
  show();
  const rows = within(await screen.findByRole("navigation", {name: "Select a ticket"}));
  const search = screen.getByRole("searchbox", {name: "Search tickets"});
  fireEvent.change(search, {target: {value: "staging"}});
  expect(rows.getAllByRole("button")).toHaveLength(1);
  expect(rows.getByRole("button", {name: /Fixture incident.*Staging · Inventory service/})).toBeTruthy();
  const details = within(screen.getByRole("article", {name: "Selected ticket details"}));
  expect(details.getByText("Inventory service")).toBeTruthy();
  expect(details.getByText("Staging")).toBeTruthy();
  fireEvent.change(search, {target: {value: "payments"}});
  expect(details.getByRole("heading", {name: "Other incident"})).toBeTruthy();
  expect(details.getByText("Unavailable")).toBeTruthy();
  expect(m.read).toHaveBeenCalledOnce();
});

it("exports only the visible ticket columns and keeps keyboard focus through the native dialog", async () => {
  let complete!: (saved: boolean) => void;
  m.exportCsv.mockImplementation(() => new Promise(resolve => {complete = resolve;}));
  show();
  await screen.findByText("Synthetic readiness details");
  fireEvent.change(screen.getByRole("searchbox", {name: "Search tickets"}), {target: {value: "Fixture incident"}});
  const action = screen.getByRole("button", {name: "Export visible tickets"});
  action.focus();
  fireEvent.click(action);
  fireEvent.click(action);
  expect(action.getAttribute("aria-disabled")).toBe("true");
  expect(m.exportCsv).toHaveBeenCalledExactlyOnceWith("export_ticket_csv", {rows: [{
    kind: "Deployment incident", reference: "same-id", title: "Fixture incident", status: "open",
    classification: "high", application: "", environment: "",
  }]});
  await act(async () => complete(true));
  expect(await screen.findByText("Ticket CSV saved.")).toBeTruthy();
  expect(document.activeElement).toBe(action);
  expect(m.read).toHaveBeenCalledOnce();
});

it("announces cancellation and refuses export when no visible records match", async () => {
  m.exportCsv.mockResolvedValue(false);
  show();
  await screen.findByText("Synthetic readiness details");
  const action = screen.getByRole("button", {name: "Export visible tickets"});
  fireEvent.click(action);
  expect(await screen.findByText("Ticket export canceled.")).toBeTruthy();
  fireEvent.change(screen.getByRole("searchbox", {name: "Search tickets"}), {target: {value: "no-such-ticket"}});
  expect(action.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(action);
  expect(m.exportCsv).toHaveBeenCalledOnce();
});

it("keeps an unconfirmed report bound to the same attempt and selects the saved incident on retry", async () => {
  m.reportReleases.mockResolvedValue({...data, releases:[{id:"release-1",tag:"v1.2.0"}]});
  m.report.mockResolvedValueOnce(undefined).mockResolvedValueOnce({state:"saved", incidentId:"saved-incident"});
  m.read.mockResolvedValueOnce(data).mockResolvedValueOnce({...data, records:[
    {...data.records[0], id:"saved-incident", title:"Database timeout"}, ...data.records,
  ]});
  show({...identity, role:"operator"});
  await screen.findByText("Synthetic readiness details");
  const action = screen.getByRole("button", {name:"New ticket"});
  action.focus();
  fireEvent.click(action);
  const panel = within(screen.getByRole("dialog", {name:"Report deployment incident"}));
  const release = panel.getByLabelText("Release ID");
  expect(document.activeElement).toBe(release);
  fireEvent.change(release,{target:{value:"release-1"}});
  fireEvent.change(panel.getByRole("textbox",{name:"Title"}),{target:{value:"Database timeout"}});
  fireEvent.click(panel.getByRole("button",{name:"Report incident"}));
  const retry = await panel.findByRole("button",{name:"Retry report"});
  expect(release).toHaveProperty("disabled",true);
  fireEvent.click(retry);
  expect(await screen.findByRole("heading",{name:"Database timeout"})).toBeTruthy();
  expect(m.report.mock.calls[0][3]).toEqual(m.report.mock.calls[1][3]);
  expect(document.activeElement).toBe(action);
});

it("keeps New ticket outside the read-only workspace role", async () => {
  show({...identity, role:"read_only"});
  await screen.findByText("Synthetic readiness details");
  expect(screen.queryByRole("button",{name:"New ticket"})).toBeNull();
  expect(m.reportReleases).not.toHaveBeenCalled();
});

it("keeps unsent fields when the source draft closes and opens only the exact saved release", async () => {
  const onOpenSavedDraft = vi.fn();
  m.createDraft.mockImplementation(async (_body, correlationId) => ({
    ok:true,data:{id:"saved-draft",version:1,status:"draft",correlationId},
  }));
  render(createElement(TicketsDirectoryView,{identity:scopedIdentity,revision:1,onOpenReleases:vi.fn(),onOpenSavedDraft}));
  await screen.findByRole("heading",{name:"Fixture incident"});
  fireEvent.click(screen.getByRole("button",{name:"Changes"}));
  const action=screen.getByRole("button",{name:"Start release draft"});
  action.focus();
  fireEvent.click(action);
  expect(screen.getByText("Source ticket CHG-10 · Jira")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Applications"),{target:{value:"Checkout"}});
  fireEvent.change(screen.getByLabelText("What needs to be released?"),{target:{value:"Check the workflow"}});
  fireEvent.click(screen.getByRole("button",{name:"Close"}));
  expect(m.createDraft).not.toHaveBeenCalled();
  const resume=screen.getByRole("button",{name:"Resume release draft for CHG-10"});
  expect(document.activeElement).toBe(resume);
  fireEvent.click(resume);
  expect(screen.getByDisplayValue("Check the workflow")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Save draft"}));
  const open=await screen.findByRole("button",{name:"Open saved release draft"});
  await waitFor(() => expect(document.activeElement).toBe(open));
  expect(m.createDraft).toHaveBeenCalledExactlyOnceWith({
    title:"Fixture change",applications:["Checkout"],requestDetails:"Check the workflow",sourceChangeTicketId:"same-id",
  },expect.any(String));
  fireEvent.click(open);
  expect(onOpenSavedDraft).toHaveBeenCalledExactlyOnceWith({id:"saved-draft",version:1});
});

it.each([true,false])("restores focus when returning from the saved release (source available: %s)", async sourceAvailable => {
  const onOpenSavedDraft = vi.fn();
  const props = {identity:scopedIdentity,revision:1,onOpenReleases:vi.fn(),onOpenSavedDraft};
  m.createDraft.mockImplementation(async (_body, correlationId) => ({
    ok:true,data:{id:"saved-draft",version:1,status:"draft",correlationId},
  }));
  const view = render(createElement(TicketsDirectoryView,props));
  await screen.findByRole("heading",{name:"Fixture incident"});
  fireEvent.click(screen.getByRole("button",{name:"Changes"}));
  fireEvent.click(screen.getByRole("button",{name:"Start release draft"}));
  fireEvent.change(screen.getByLabelText("Applications"),{target:{value:"Inventory"}});
  fireEvent.change(screen.getByLabelText("What needs to be released?"),{target:{value:"Update staging"}});
  fireEvent.click(screen.getByRole("button",{name:"Save draft"}));
  fireEvent.click(await screen.findByRole("button",{name:"Open saved release draft"}));
  expect(onOpenSavedDraft).toHaveBeenCalledExactlyOnceWith({id:"saved-draft",version:1});

  view.rerender(createElement(TicketsDirectoryView,{...props,active:false}));
  if (!sourceAvailable) m.read.mockResolvedValue({...data,records:[data.records[0]]});
  view.rerender(createElement(TicketsDirectoryView,props));
  const target = sourceAvailable ? await screen.findByRole("button",{name:/Fixture change/})
    : screen.getByRole("searchbox",{name:"Search tickets"});
  await waitFor(() => expect(document.activeElement).toBe(target));
  if (!sourceAvailable) expect(screen.queryByRole("button",{name:/Fixture change/})).toBeNull();
});

it("parks independent draft fields for two change tickets and saves the selected source", async () => {
  m.read.mockResolvedValue({...data,records:[...data.records,{
    ...data.records[1],id:"other-change",provider:"servicenow",reference:"CHG-20",title:"Other change",
  }]});
  m.createDraft.mockImplementation(async (_body, correlationId) => ({
    ok:true,data:{id:"saved-draft",version:1,status:"draft",correlationId},
  }));
  show(scopedIdentity);
  await screen.findByRole("heading",{name:"Fixture incident"});
  fireEvent.click(screen.getByRole("button",{name:"Changes"}));
  const choose = (name: string) => fireEvent.click(screen.getByRole("button",{name:new RegExp(name)}));
  const enter = (value: string) => {
    fireEvent.change(screen.getByLabelText("Applications"),{target:{value:"Checkout"}});
    fireEvent.change(screen.getByLabelText("What needs to be released?"),{target:{value}});
  };
  choose("^Start release draft$");
  enter("Jira work in progress");
  choose("^Close$");
  choose("Other change");
  choose("^Start release draft$");
  expect(screen.getByText("Source ticket CHG-20 · ServiceNow")).toBeTruthy();
  expect(screen.getByLabelText("What needs to be released?")).toHaveProperty("value","");
  enter("ServiceNow work in progress");
  choose("^Close$");
  choose("Fixture change");
  choose("Resume release draft for CHG-10");
  expect(screen.getByDisplayValue("Jira work in progress")).toBeTruthy();
  choose("^Close$");
  choose("Other change");
  choose("Resume release draft for CHG-20");
  expect(screen.getByDisplayValue("ServiceNow work in progress")).toBeTruthy();
  choose("^Save draft$");
  await screen.findByText(/Draft saved/);
  expect(m.createDraft).toHaveBeenCalledExactlyOnceWith({
    title:"Other change",applications:["Checkout"],requestDetails:"ServiceNow work in progress",sourceChangeTicketId:"other-change",
  },expect.any(String));
  choose("^Close$");
  choose("Fixture change");
  choose("Resume release draft for CHG-10");
  expect(screen.getByDisplayValue("Jira work in progress")).toBeTruthy();
});

it("keeps an interrupted update bound to the same incident and attempt", async () => {
  m.updates.mockResolvedValueOnce({workspaceId:identity.organizationId, actorId:identity.userId,
    incidentId:"same-id",releaseId:"release-1",canWrite:true,limited:false,notes:[]});
  m.saveUpdate.mockResolvedValueOnce(undefined).mockImplementationOnce(async (_base,_token,_signal,command) => ({
    ...command,note:{id:"update-1",body:command.body,recordedAt:instant,authoredByYou:true},
  }));
  show();
  const field=await screen.findByRole("textbox",{name:"Investigation note"});
  fireEvent.change(field,{target:{value:"Recheck the staging cache."}});
  fireEvent.click(screen.getByRole("button",{name:"Add update"}));
  const retry=await screen.findByRole("button",{name:"Retry update"});
  expect(field).toHaveProperty("readOnly",true);
  retry.focus();
  fireEvent.click(retry);
  expect(await screen.findByText("Investigation update added.")).toBeTruthy();
  expect(screen.getByText("Recheck the staging cache.")).toBeTruthy();
  expect(document.activeElement).toBe(retry);
  expect(m.saveUpdate.mock.calls[0][3]).toEqual(m.saveUpdate.mock.calls[1][3]);
  expect(m.saveUpdate.mock.calls[1][3]).toMatchObject({incidentId:"same-id",releaseId:"release-1"});
});

it("preserves the note and requires fresh review when attached release evidence changes before saving", async () => {
  const evidence = {commit:"a".repeat(40),digest:"d".repeat(64),generatedAt:instant,branchCheckCount:2,changeTicketCount:1};
  const refreshed = {...evidence,digest:"e".repeat(64)};
  const base = {workspaceId:identity.organizationId,actorId:identity.userId,
    incidentId:"same-id",releaseId:"release-1",canWrite:true,limited:false,notes:[]};
  m.updates.mockResolvedValueOnce({...base,attachableEvidence:evidence}).mockResolvedValue({...base,attachableEvidence:refreshed});
  m.saveUpdate.mockResolvedValueOnce({state:"evidence_changed"}).mockImplementationOnce(async (_base,_token,_signal,command) => ({
    ...command,note:{id:"update-1",body:command.body,recordedAt:instant,authoredByYou:true,evidence:refreshed},
  }));
  show();
  const field = await screen.findByRole("textbox",{name:"Investigation note"});
  fireEvent.change(field,{target:{value:"Reviewed the linked evidence."}});
  const attach = async (digest: string) => {
    fireEvent.click(await screen.findByRole("button",{name:"Review release evidence"}));
    expect(screen.getByText(digest)).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Attach reviewed evidence"}));
    expect(document.activeElement).toBe(field);
  };
  await attach(evidence.digest);
  expect(m.saveUpdate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Add update"}));
  expect(await screen.findByText("The saved release evidence changed. Review it again before attaching it.")).toBeTruthy();
  expect(field).toHaveProperty("value","Reviewed the linked evidence.");
  expect(field).toHaveProperty("readOnly",false);
  await attach(refreshed.digest);
  fireEvent.click(screen.getByRole("button",{name:"Add update"}));
  expect(await screen.findByText("Release evidence snapshot")).toBeTruthy();
  const first = m.saveUpdate.mock.calls[0][3];
  const second = m.saveUpdate.mock.calls[1][3];
  expect(first.evidence).toEqual({commit:evidence.commit,digest:evidence.digest});
  expect(second.evidence).toEqual({commit:refreshed.commit,digest:refreshed.digest});
  expect(first.attemptId).not.toBe(second.attemptId);
});

it("shows only recorded resolution steps and clears evidence when switching incidents", async () => {
  const current = {...data.records[0], status:"resolved", resolvedAt:instant, releaseContext:{application:"Checkout",environment:"Staging"}};
  const other = {...current,id:"other-incident",title:"Other incident",status:"wont_fix",releaseId:"release-2",releaseContext:null};
  m.read.mockResolvedValue({...data,records:[current,other]});
  const snapshot = {commit:"a".repeat(40),digest:"d".repeat(64),generatedAt:instant,branchCheckCount:2,changeTicketCount:1};
  const notedAt = "2026-11-20T12:10:00.000Z";
  const result = {workspaceId:identity.organizationId,actorId:identity.userId,incidentId:"same-id",releaseId:"release-1",
    canWrite:false, limited:false,attachableEvidence:null,
    notes:[
      {id:"update-2",body:"Recorded investigation progress.",recordedAt:notedAt,authoredByYou:true},
      {id:"update-1",body:"Reviewed checks.",recordedAt:instant,authoredByYou:true,evidence:snapshot},
    ]};
  m.updates.mockResolvedValue(result);
  show();
  fireEvent.click(await screen.findByRole("button",{name:"All tickets"}));
  const checklist = within(await screen.findByRole("region",{name:"Resolution checklist"}));
  expect(checklist.getAllByRole("listitem")).toHaveLength(5);
  expect(await checklist.findByText("Resolution recorded")).toBeTruthy();
  const timeline = within(screen.getByRole("region", {name:"Recorded timeline"}));
  expect(timeline.getByText("Investigation update added").nextElementSibling).toHaveProperty("dateTime", notedAt);
  expect(timeline.getByText("Release evidence attached").nextElementSibling).toHaveProperty("dateTime", instant);
  expect(timeline.getAllByRole("listitem").at(-1)?.textContent).toContain("Investigation update added");
  expect(timeline.queryByText("Recorded investigation progress.")).toBeNull();
  const shortcut = screen.getByRole("button",{name:/Review attached evidence/});
  expect(shortcut.querySelector("time")?.dateTime).toBe(instant);
  fireEvent.click(shortcut);
  const attachment = screen.getByText("Release evidence snapshot");
  expect(document.activeElement).toBe(attachment);
  expect(attachment.closest("details")?.open).toBe(true);
  expect(within(attachment.closest("details")!).getByText(snapshot.digest)).toBeTruthy();
  expect(checklist.getByText("Recovery unverified")).toBeTruthy();
  expect(checklist.getByText("Review unconfirmed")).toBeTruthy();
  expect(checklist.getByText("Collection unconfirmed")).toBeTruthy();
  expect(checklist.getAllByText(", recorded")).toHaveLength(2);

  fireEvent.click(screen.getByRole("button",{name:/Other incident/}));
  const next = within(screen.getByRole("region",{name:"Resolution checklist"}));
  expect(await next.findByText("Closed without a fix · Attachment unverified")).toBeTruthy();
  expect(next.getByText("Linked environment unavailable")).toBeTruthy();
  expect(next.queryByText(", recorded")).toBeNull();
  expect(screen.queryByText("Reviewed checks.")).toBeNull();
  expect(screen.queryByText("Investigation update added")).toBeNull();
  expect(screen.queryByText("Release evidence attached")).toBeNull();
  expect(screen.queryByRole("button",{name:/Review attached evidence/})).toBeNull();
  expect(m.saveUpdate).not.toHaveBeenCalled();
});

it("keeps closure pending when the open incident has a verified attachment", async () => {
  m.updates.mockResolvedValue({
    workspaceId:identity.organizationId,actorId:identity.userId,incidentId:"same-id",releaseId:"release-1",
    canWrite:false,limited:false,attachableEvidence:null,
    notes:[{id:"update-1",body:"Release details.",recordedAt:instant,authoredByYou:true,
    evidence:{commit:"a".repeat(40),digest:"e".repeat(64),generatedAt:instant,branchCheckCount:0,changeTicketCount:0}}]});
  show();
  const checklist = within(await screen.findByRole("region",{name:"Resolution checklist"}));
  expect(await checklist.findByText("Evidence attached · Closure pending")).toBeTruthy();
  expect(checklist.queryByText(", recorded")).toBeNull();
});

it("requires explicit status confirmation and retries only the original paired attempt", async () => {
  const record = {...data.records[0],revision:instant};
  m.read.mockResolvedValueOnce({...data, records:[record]}).mockResolvedValue({...data,records:[{...record,status:"resolved"}]});
  m.transition.mockResolvedValueOnce(undefined).mockImplementationOnce(async (_base,_token,_signal,request) => ({...request,status:"resolved"}));
  show({...identity,role:"operator",capabilities:["workspace:read","pipeline:read"]});
  fireEvent.click(await screen.findByRole("button",{name:"Incident status actions"}));
  fireEvent.click(screen.getByRole("button",{name:"Resolve incident"}));
  expect(m.transition).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(screen.getByRole("button",{name:"Cancel"}));
  fireEvent.click(screen.getByRole("button",{name:"Confirm status change"}));
  expect(await screen.findByText("The status change is unconfirmed.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Retry same status change"}));
  expect(await screen.findByText("Incident status change recorded: resolved.")).toBeTruthy();
  expect(m.transition.mock.calls[0][3]).toEqual(m.transition.mock.calls[1][3]);
  expect(m.transition.mock.calls[1][3]).toMatchObject({
    action:"resolve", previousStatus:"open", expectedRevision:instant, incidentId:"same-id", releaseId:"release-1",
  });
  expect((await screen.findByRole("button",{name:/Fixture incident/})).getAttribute("aria-current")).toBe("true");
});

it("opens only the recorded repository run and release commit comparison", async () => {
  const commit = "a".repeat(40);
  const baseline = "c".repeat(40);
  m.releases.mockResolvedValue({
    workspaceId:identity.organizationId,actorId:identity.userId,incidentId:"same-id",incidentStatus:"open",
    release:{id:"release-1",tag:"v1.9.3",commit,status:"failed"},
    sources:{state:"recorded",repository:"fixture-owner/inventory",commit,limited:false,
      runs:[{runId:"17",name:"Validate staging",status:"completed",conclusion:"failure",observedAt:instant}],
      comparison:{baselineCommit:baseline,baselineTag:"v1.9.2"}},
  });
  show({...identity,capabilities:["workspace:read","pipeline:read","github:read"]});
  fireEvent.click(await screen.findByRole("button",{name:"View release evidence"}));
  const review = screen.getByRole("button",{name:"Review linked release evidence"});
  review.focus();
  fireEvent.click(review);
  const run = await screen.findByRole("link",{name:/View workflow logs on GitHub/});
  expect(run.getAttribute("href")).toBe("https://github.com/fixture-owner/inventory/actions/runs/17");
  expect(run.textContent).toContain("Validate staging · failure");
  expect(screen.getByRole("link",{name:/Compare release commits on GitHub/}).getAttribute("href"))
    .toBe(`https://github.com/fixture-owner/inventory/compare/${baseline}..${commit}`);
  expect(screen.getByText("Service recovery validation is unavailable.")).toBeTruthy();
  expect(document.activeElement).toBe(review);
  expect(m.releases.mock.calls[0][4]).toBe("sources");
});

it("records only a current remediation decision for the selected incident revision", async () => {
  m.read.mockResolvedValueOnce({...data,records:[{...data.records[0],revision:instant}]});
  const proposal = {id:"proposal-1",title:"Prepare rollback",decision:"accepted",binding:"historical",
    generatedAt:instant,decidedAt:instant};
  const scope = {workspaceId:identity.organizationId,actorId:identity.userId,incidentId:"same-id",releaseId:"release-1",incidentRevision:instant};
  m.remediationReview.mockResolvedValueOnce({...scope,proposal})
    .mockResolvedValueOnce({...scope,proposal:{...proposal,binding:"current"}})
    .mockResolvedValueOnce({...scope,incidentRevision:"2026-11-21T12:00:00.000Z",proposal:{...proposal,binding:"current"}});
  show({...identity,capabilities:["workspace:read","pipeline:read"]});
  const review = await screen.findByRole("button",{name:"Review remediation plan"});
  review.focus();
  fireEvent.click(review);
  expect(await screen.findByText("Historical proposal")).toBeTruthy();
  expect(screen.queryByText(", recorded")).toBeNull();
  fireEvent.click(review);
  expect(await screen.findByText("Review recorded · accepted")).toBeTruthy();
  expect(screen.getByText(", recorded")).toBeTruthy();
  expect(document.activeElement).toBe(review);
  fireEvent.click(review);
  expect(await screen.findByText("Refresh tickets to review the current revision")).toBeTruthy();
  expect(screen.queryByText(", recorded")).toBeNull();
  expect(screen.getByText("Recovery unverified")).toBeTruthy();
});

it.each([true,false])("recovers the exact collection attempt and reloads the checklist (receipt found: %s)", async receiptFound => {
  const commit = "a".repeat(40);
  const baseline = "c".repeat(40);
  const scope = {workspaceId:identity.organizationId,actorId:identity.userId,incidentId:"same-id",releaseId:"release-1",incidentRevision:instant};
  m.read.mockResolvedValue({...data,records:[{...data.records[0],revision:instant}]});
  m.readCollection.mockResolvedValueOnce({...scope,collectedAt:null}).mockResolvedValue({...scope,collectedAt:instant});
  m.releases.mockResolvedValue({
    ...scope,incidentStatus:"open",release:{id:"release-1",tag:"v1.9.3",commit,status:"failed"},
    sources:{state:"recorded",repository:"fixture-owner/inventory",commit,limited:false,
      runs:[{runId:"17",name:"Validate staging",status:"completed",conclusion:"failure",observedAt:instant}],
      comparison:{baselineCommit:baseline,baselineTag:"v1.9.2"}},
  });
  m.saveCollection.mockResolvedValueOnce(undefined).mockResolvedValueOnce({});
  show({...identity,role:"operator",capabilities:["workspace:read","pipeline:read","github:read"]});
  fireEvent.click(await screen.findByRole("button",{name:"View release evidence"}));
  fireEvent.click(screen.getByRole("button",{name:"Review linked release evidence"}));
  const submit = await screen.findByRole("button",{name:"Record evidence collection"});
  fireEvent.click(submit);
  expect(m.saveCollection).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox",{name:/I collected the selected workflow logs/}));
  fireEvent.click(submit);
  const check = await screen.findByRole("button",{name:"Check collection receipt"});
  m.readCollectionReceipt.mockResolvedValueOnce(receiptFound ? {} : null);
  check.focus();
  fireEvent.click(check);
  if (receiptFound) {
    const receipt = await screen.findByText("The original collection was recorded. Review current evidence separately.");
    expect(document.activeElement).toBe(receipt);
    expect(m.saveCollection).toHaveBeenCalledTimes(1);
  } else {
    expect(await screen.findByText("No receipt was found for this attempt.")).toBeTruthy();
    expect(document.activeElement).toBe(check);
    expect(m.saveCollection).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button",{name:"Retry evidence collection"}));
    expect(await screen.findByText("Evidence collection recorded.")).toBeTruthy();
    expect(m.saveCollection.mock.calls[0][3]).toEqual(m.saveCollection.mock.calls[1][3]);
  }
  expect(m.readCollectionReceipt.mock.calls[0][3]).toEqual(m.saveCollection.mock.calls[0][3]);
  expect(m.saveCollection.mock.calls[0][3]).toMatchObject({...scope,repository:"fixture-owner/inventory",commit,
    baselineCommit:baseline,runId:"17",observedAt:instant});
  fireEvent.click(screen.getByRole("tab",{name:"Overview"}));
  expect(await screen.findByText("Collection recorded by operator")).toBeTruthy();
  expect(screen.getByText("Recovery unverified")).toBeTruthy();
});

it("assigns an eligible owner on explicit save and uses saved ownership for My work and Owner filters", async () => {
  const row = {...data.records[0],revision:instant,owner:{state:"unassigned"}};
  const scope = {workspaceId:identity.organizationId,actorId:identity.userId,incidentId:"same-id",releaseId:"release-1",incidentRevision:instant};
  const target = {userId:identity.userId,displayName:"Current operator"};
  const other = {...row,id:"other",title:"Other incident"};
  const response = {...data,assignmentAvailable:true,records:[row,other]};
  m.read.mockResolvedValueOnce(response).mockResolvedValue({...response,records:[{...row,owner:{state:"assigned",...target}},other]});
  m.readAssignment.mockResolvedValue({...scope,candidates:[target],assignmentRevision:null,limited:false});
  m.saveAssignment.mockResolvedValue({});
  show({...identity,role:"operator",capabilities:["workspace:read","pipeline:read"]});
  fireEvent.click(await screen.findByRole("button",{name:"Assign owner"}));
  const choice = await screen.findByRole("combobox",{name:/Assign to/});
  fireEvent.change(choice,{target:{value:`user:${identity.userId}`}});
  expect(m.saveAssignment).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Save owner"}));
  expect(await screen.findByText("Incident owner updated.")).toBeTruthy();
  expect(m.saveAssignment.mock.calls[0][3]).toMatchObject({...scope,ownerUserId:identity.userId,expectedAssignmentRevision:null});
  const mine = await screen.findByRole("button",{name:"My work, 1 loaded"});
  fireEvent.click(mine);
  expect(await screen.findByRole("button",{name:/Fixture incident/})).toBeTruthy();
  expect(screen.queryByRole("button",{name:/Other incident/})).toBeNull();
  fireEvent.click(within(screen.getByRole("group",{name:"Ticket filters"})).getByRole("button",{name:/^Open/}));
  fireEvent.change(screen.getByRole("combobox",{name:"Filter tickets by owner"}),{target:{value:"unassigned"}});
  expect(await screen.findByRole("button",{name:/Other incident/})).toBeTruthy();
  expect(screen.queryByRole("button",{name:/Fixture incident/})).toBeNull();
});

it("shows the saved triage deadline and selected priority without creating another response timer for closed incidents", async () => {
  const due = new Date(Date.now()+43*60000-1000).toISOString();
  const current = {...data.records[0],responseTarget:{deadline:due,priority:"P1",decision:"accepted"}};
  const closed = {...current,id:"closed",title:"Closed incident",status:"resolved",resolvedAt:instant};
  m.read.mockResolvedValue({...data,records:[current,closed]});
  show();
  expect((await screen.findByText("43 min remaining")).getAttribute("datetime")).toBe(due);
  expect(screen.getByText("Accepted triage · P1")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Resolved"}));
  expect(await screen.findByText("Closed incident",{selector:"h2"})).toBeTruthy();
  expect(screen.queryByText("43 min remaining")).toBeNull();
  expect(document.querySelector(`time[datetime="${due}"]`)).toBeTruthy();
});

it("applies and clears recorded ticket filters without changing the other controls or exporting hidden rows", async () => {
  const owner = {state:"assigned",userId:identity.userId,displayName:"Current operator"};
  const incident = {...data.records[0],owner,releaseContext:{application:"Inventory",environment:"Staging"}};
  const other = {...incident,id:"other",title:"Fixture production incident",releaseContext:{application:"Inventory",environment:"Production"}};
  m.read.mockResolvedValue({...data,assignmentAvailable:true,records:[incident,other,data.records[1]]});
  m.exportCsv.mockResolvedValue(true);
  show();
  const search = await screen.findByRole("searchbox",{name:"Search tickets"});
  fireEvent.change(search,{target:{value:"Fixture"}});
  fireEvent.change(screen.getByRole("combobox",{name:"Filter tickets by priority or severity"}),{target:{value:"incident:high"}});
  fireEvent.change(screen.getByRole("combobox",{name:"Filter tickets by owner"}),{target:{value:`user:${identity.userId}`}});
  const trigger = screen.getByRole("button",{name:"Filters"});
  trigger.focus();
  fireEvent.click(trigger);
  let dialog = within(screen.getByRole("dialog",{name:"Ticket filters"}));
  expect(document.activeElement).toBe(dialog.getByRole("combobox",{name:"Status"}));
  fireEvent.change(dialog.getByRole("combobox",{name:"Application"}),{target:{value:"Inventory"}});
  fireEvent.change(dialog.getByRole("combobox",{name:"Environment"}),{target:{value:"Staging"}});
  fireEvent.click(dialog.getByRole("button",{name:"Apply filters"}));
  expect(document.activeElement).toBe(trigger);
  expect(trigger.getAttribute("aria-label")).toBe("Filters, 2 active");
  expect(screen.queryByRole("button",{name:/Fixture production incident/})).toBeNull();
  expect(search).toHaveProperty("value","Fixture");
  expect(screen.getByRole("combobox",{name:"Filter tickets by owner"})).toHaveProperty("value",`user:${identity.userId}`);
  expect(screen.getByRole("combobox",{name:"Filter tickets by priority or severity"})).toHaveProperty("value","incident:high");
  expect(m.read).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button",{name:"Export visible tickets"}));
  await screen.findByText("Ticket CSV saved.");
  expect(m.exportCsv).toHaveBeenCalledWith("export_ticket_csv",{rows:[
    expect.objectContaining({reference:"same-id",environment:"Staging"}),
  ]});

  fireEvent.click(trigger);
  dialog = within(screen.getByRole("dialog",{name:"Ticket filters"}));
  fireEvent.click(dialog.getByRole("button",{name:"Reset filters"}));
  fireEvent.keyDown(dialog.getByRole("button",{name:"Cancel"}),{key:"Escape"});
  expect(document.activeElement).toBe(trigger);
  expect(screen.queryByRole("button",{name:/Fixture production incident/})).toBeNull();

  fireEvent.click(trigger);
  dialog = within(screen.getByRole("dialog",{name:"Ticket filters"}));
  expect(dialog.getByRole("combobox",{name:"Environment"})).toHaveProperty("value","Staging");
  fireEvent.click(dialog.getByRole("button",{name:"Reset filters"}));
  fireEvent.click(dialog.getByRole("button",{name:"Apply filters"}));
  expect(await screen.findByRole("button",{name:/Fixture production incident/})).toBeTruthy();
  expect(trigger.getAttribute("aria-label")).toBeNull();
});
