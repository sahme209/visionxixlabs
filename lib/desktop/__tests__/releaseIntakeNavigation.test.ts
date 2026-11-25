/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';

const ports=vi.hoisted(()=>({native:vi.fn(),open:vi.fn(),vaultRead:vi.fn(),vaultWrite:vi.fn(),vaultClear:vi.fn(),listen:vi.fn()}));
vi.mock('@tauri-apps/api/core',()=>({invoke:ports.native}));
vi.mock('@tauri-apps/plugin-shell',()=>({open:ports.open}));
vi.mock('../../../desktop/src/lib/secureStorage',()=>({readSecret:ports.vaultRead,writeSecret:ports.vaultWrite,clearSecret:ports.vaultClear}));
vi.mock('../../../desktop/src/lib/preferences',()=>({readDesktopPreferences:async()=>({theme:'dark',interface_density:'comfortable',reduce_motion:true}),writeDesktopPreferences:ports.native}));

import App from '../../../desktop/src/App';
import {desktopClient,type VerifiedDesktopIdentity} from '../../../desktop/src/lib/desktopClient';

const identity:VerifiedDesktopIdentity={kind:'desktop_session',userId:'synthetic-screen-reviewer',organizationId:'ws_internal_screen_coverage',role:'read_only',capabilities:[],access:{allowed:true,code:'active',title:'Synthetic access',message:'Isolated component fixture only',planTier:'synthetic',billingStatus:'active',accessRequestPath:'/access',pricingPath:'/plans'}};
const originalScrollTo=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'scrollTo');
let emitMenuAction: (event: {payload: string}) => void;
let requests:Array<{method:string;path:string}>;
function savedRelease(id: string, title: string, version: number) {
  return {
    id, title, version, status: batchAccess && id === 'release-target' ? 'submitted' : 'draft', correlationId: id, submittedAt: null, closedAt: null,
    updatedAt: '2026-11-20T00:00:00Z', latestPlaybook: null,
    ...(id === 'release-target' && { requesterName: 'Fixture Requester' }),
    releaseContext: {
      ...(batchAccess && id === "release-target" && { batches: {selectedRunCount: 1} }),
      window: id === "release-target" ? releaseWindow : null, scope: {applicationCount: 1, repositoryCount: 1, targetEnvironment: 'staging',
        ...(canReviewRelease && id === 'release-target' && {githubRepositories: ['studio-fixture/payments'], changeNotApplicable: true})},
      approval: prRequirement,
      readiness: {developmentReady: false, productionReady: false, validationStepCount: 0, deferredValidation: false, approvalDecision: releaseApprovalDecision, blockers: []},
      recovery: {rollbackAvailability: 'unavailable', backupRequired: false, evidenceCount: 0},
      observation: {status: 'not_connected', recordedMonitoringPlan: false},
    },
  };
}
let prRequirement: {prStatus: string; noPrRequired: boolean};
let releaseApprovalDecision: "needs_attention" | "ready_for_human_approval";
let releaseVersion: number;
let olderReleaseLookup: "exact" | "advanced" | "wrong-shape" | "missing" | "offline" | undefined;
let exactLookupQueries: string[];
let releaseListingAvailable: boolean;
let ticketAccess: boolean;
let ticketDraftConversation: boolean;
let linkedTicketReleaseId: string;
let batchAccess: boolean;
let pendingReleaseListing: Promise<void> | undefined;
let pendingExactRelease: Promise<void> | undefined;
let releaseWindow: {startUtc: string; endUtc: string; displayTimeZone: string} | null;
let canReviewRelease: boolean;
let membersAvailable: boolean;
let auditAccess: boolean;
let auditAvailable: boolean;
beforeEach(()=>{
 prRequirement = {prStatus:'pending', noPrRequired:false};
 releaseApprovalDecision = 'needs_attention';
 releaseVersion = 3;
 olderReleaseLookup = undefined;
 exactLookupQueries = [];
 releaseListingAvailable = true;
 ticketAccess = false;
 ticketDraftConversation = false;
 linkedTicketReleaseId = "release-target";
 batchAccess = false;
 pendingReleaseListing = undefined;
 pendingExactRelease = undefined;
 releaseWindow = null;
 canReviewRelease = false;
 membersAvailable = true;
 auditAccess = false;
 auditAvailable = true;
 Object.defineProperty(HTMLElement.prototype,'scrollTo',{configurable:true,value:vi.fn()});
 vi.clearAllMocks();
 requests = [];
 window.localStorage.clear();
 vi.stubGlobal('__TAURI_INTERNALS__', {
   transformCallback(callback: typeof emitMenuAction) {
     emitMenuAction = callback;
     return 1;
   },
   async invoke(command: string, args: {event?: string}) {
     if (command === 'plugin:event|listen') {
       ports.listen(args.event);
       return 1;
     }
     if (command !== 'plugin:event|unlisten') throw Error('fixture_event_command_forbidden:' + command);
   },
 });
 vi.stubGlobal('__TAURI_EVENT_PLUGIN_INTERNALS__', {unregisterListener: vi.fn()});
 ports.vaultRead.mockResolvedValue(undefined);
 ports.vaultWrite.mockRejectedValue(new Error('fixture_vault_write_forbidden'));
 ports.vaultClear.mockRejectedValue(new Error('fixture_vault_clear_forbidden'));
 ports.open.mockRejectedValue(new Error('fixture_external_open_forbidden'));
 ports.native.mockImplementation(async(command:string)=>{
  if(command==='plugin:app|version')return '7.8.9';
  if(command==='default_repos_directory')return '/synthetic/empty-repositories';
  if(command==='list_local_repositories')return [];
  throw Error('fixture_native_command_forbidden:'+command);
 });
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  const method=(init?.method??(typeof Request!=='undefined'&&input instanceof Request?input.method:'GET')).toUpperCase();requests.push({method,path:url.pathname});
  if(url.origin!=='https://desktop-fixture.invalid')throw Error('fixture_unexpected_origin');
  if(method!=='GET'&&method!=='HEAD')throw Error('fixture_write_request_forbidden');
  if(url.pathname==='/api/desktop/access'){
   return Response.json({ok: true, data: {identity: (ticketAccess || batchAccess) ? {...identity, capabilities:['workspace:read','pipeline:read',...(canReviewRelease?['github:read']:[])]} : canReviewRelease ? {...identity, capabilities:['github:read']} : auditAccess ? {...identity, capabilities:['pipeline:read']} : identity, access: identity.access}});
  }
  if (ticketDraftConversation && url.pathname === "/api/desktop/agent/conversations") {
    return Response.json({ok:true,data:{conversations:[{id:"fixture-ticket-draft",title:"Planning",turnCount:0,createdAt:"2026-11-20T00:00:00Z",updatedAt:"2026-11-20T00:00:00Z"}]}});
  }
  if (ticketDraftConversation && url.pathname === "/api/desktop/agent/conversations/fixture-ticket-draft") {
    return Response.json({ok:true,data:{id:"fixture-ticket-draft",title:"Planning",turns:[],actions:[]}});
  }
  if(url.pathname==='/api/desktop/release-audit' && auditAvailable){
    expect(url.searchParams.get('limit')).toBe('4');
    return Response.json({ok:true,data:{events:[{
      id:'fixture-audit', summary:'Recorded synthetic change review', outcome:'ok', createdAtIso:'2026-11-20T10:00:00.000Z',
      actorUserId:'fixture-hidden-actor', subjectId:'fixture-hidden-subject',
    }]}});
  }
  if(url.pathname==='/api/desktop/workspace-members' && membersAvailable){
    return Response.json({ok: true, data: {currentUserId: identity.userId, currentRole: identity.role, capabilities: [], members: [
      {userId: 'synthetic-owner', email: 'owner@example.invalid', displayName: 'Synthetic Owner', role: 'owner', acceptedAt: '2026-11-20T00:00:00Z', updatedAt: '2026-11-20T00:00:00Z'},
    ]}});
  }
  if (url.pathname === "/api/desktop/tickets" && ticketAccess && url.searchParams.has("deploymentIncidentId")) {
    const incidentId = url.searchParams.get("deploymentIncidentId");
    if (incidentId !== "incident-target" || linkedTicketReleaseId === "no-matching-release") return Response.json({ok:false},{status:409});
    return Response.json({ok:true,data:{workspaceId:identity.organizationId,actorId:identity.userId,incidentId,incidentStatus:"open",
      release:{id:linkedTicketReleaseId,tag:"v2.14.0",commit:"a".repeat(40),status:"failed"}}});
  }
  if(url.pathname==='/api/desktop/tickets' && ticketAccess){
    const incident = {kind:'incident', status:'open', severity:'high', summary:null, reportedAt:'2026-11-20T00:00:00Z', mitigatedAt:null, resolvedAt:null};
    return Response.json({ok:true,data:{workspaceId:identity.organizationId,actorId:identity.userId,
      sources:{incidents:{state:'available',limited:false},changes:{state:'available',limited:false}},
      records:[{...incident,id:'incident-first',title:'Inventory incident',releaseId:'release-first'},
        {...incident,id:'incident-target',title:'Payments incident',releaseId:linkedTicketReleaseId}]}});
  }
  if(url.pathname==='/api/desktop/deployments'){
    if(url.searchParams.has('linkedReleaseId')) {
      const id = url.searchParams.get('linkedReleaseId');
      const data = id === 'release-target' ? {id, version: releaseVersion} : id === 'release-first' ? {id, version: 1} : null;
      return Response.json({ok: true, data});
    }
    if(url.searchParams.has('savedReleaseId')) {
      exactLookupQueries.push(url.search);
      if (pendingExactRelease) await pendingExactRelease;
      if (olderReleaseLookup === "offline") return Response.json({ok: false, error: "network_error"}, {status: 503});
      const older = savedRelease('release-target', 'Payments staging', olderReleaseLookup === "advanced" ? 4 : 3);
      return Response.json({ok: true, data: olderReleaseLookup === "missing" ? []
        : olderReleaseLookup === "wrong-shape" ? [{...older, intakeJson: {}}] : [older]});
    }
    if(olderReleaseLookup) return Response.json({ok: true, data: Array.from({length: 50}, (_, i) =>
      savedRelease(`recent-release-${i}`, `Recent release ${i + 1}`, 1))});
    const pending = pendingReleaseListing;
    pendingReleaseListing = undefined;
    if(pending) await pending;
    if(!releaseListingAvailable)return Response.json({ok:false,error:'network_error'},{status:503});
    const data = [savedRelease('release-first', 'Inventory staging', 1), savedRelease('release-target', 'Payments staging', releaseVersion)];
    return Response.json({ok: true, data});
  }
  return new Response(JSON.stringify({ok:false,error:'synthetic_service_unavailable'}),{status:503});
 }));
 desktopClient.setApiBase('https://desktop-fixture.invalid');
 desktopClient.setSession('axm.desk.synthetic-screen-fixture.not-a-real-signature');
});
afterEach(()=>{cleanup();desktopClient.setSession(undefined);vi.unstubAllGlobals();if(originalScrollTo)Object.defineProperty(HTMLElement.prototype,'scrollTo',originalScrollTo);else delete (HTMLElement.prototype as {scrollTo?:unknown}).scrollTo;});

async function openIntake() {
  render(createElement(App));
  fireEvent.click(await screen.findByRole('button', {name: 'Deployments'}));
  fireEvent.click(await screen.findByRole('button', {name: 'New release'}));
  const title = screen.getByRole<HTMLInputElement>('textbox', {name: 'Request title'});
  fireEvent.change(title, {target: {value: 'Synthetic unsaved draft'}});
  return title;
}

it('skips the desktop rail and header while preserving the active workspace', async () => {
  render(createElement(App));
  const skip = await screen.findByRole('link', {name: 'Skip to workspace content'});
  const main = screen.getByRole('main');
  const navigation = screen.getByRole('button', {name: 'Deployments'});
  expect(main.contains(navigation)).toBe(false);
  fireEvent.click(skip);
  expect(document.activeElement).toBe(main);
  expect(within(main).getByRole('textbox', {name: 'Planning request'})).toBeTruthy();
  fireEvent.click(navigation);
  await within(main).findByRole('button', {name: 'New release'});
  fireEvent.click(skip);
  expect(document.activeElement).toBe(main);
  expect(within(main).getByRole('button', {name: 'New release'})).toBeTruthy();
});

it('keeps the release draft on Stay and leaves only after explicit discard', async () => {
  const title = await openIntake();
  const home = screen.getByRole('button', {name: /(?:Axiom|V19) home/i});
  fireEvent.click(home);
  const docs = screen.getByRole('button', {name: 'Documentation help'});
  fireEvent.click(docs);
  const dialog = screen.getByRole('alertdialog', {name: 'Leave this release intake?'});
  fireEvent.click(within(dialog).getByRole('button', {name: 'Stay in intake'}));

  expect(screen.getByRole('textbox', {name: 'Request title'})).toBe(title);
  expect(title.value).toBe('Synthetic unsaved draft');
  fireEvent.click(docs);
  act(() => emitMenuAction({payload: 'open_settings'}));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', {name: 'Leave without saving'}));

  expect(screen.queryByLabelText('Request title')).toBeNull();
  expect(screen.getByRole('button', {name: /^Documentation$/}).getAttribute('aria-current')).toBe('page');
  expect(requests.every(request => request.method === 'GET' || request.method === 'HEAD')).toBe(true);
});

it("enters intake, returns after the command confirmation, and restores the opener on cancel", async () => {
  const title = await openIntake();
  const heading = screen.getByRole("heading", {name: "New release request"});
  expect(document.activeElement).toBe(heading);
  fireEvent.keyDown(window, {key: "k", ctrlKey: true});
  const palette = screen.getByRole("combobox", {name: "Search desktop commands"});
  fireEvent.change(palette, {target: {value: "documentation"}});
  fireEvent.keyDown(palette, {key: "Enter"});
  const dialog = screen.getByRole("alertdialog", {name: "Leave this release intake?"});
  const stay = within(dialog).getByRole("button", {name: "Stay in intake"});
  expect(document.activeElement).toBe(stay);
  fireEvent.keyDown(stay, {key: "Escape"});
  expect(document.activeElement).toBe(heading);
  expect(title.value).toBe("Synthetic unsaved draft");
  const opener = screen.getByRole("button", {name: "Cancel intake"});
  fireEvent.click(opener);
  expect(document.activeElement).toBe(opener);
  expect(opener.textContent).toContain("New release");
  expect(requests.every(request => request.method === "GET" || request.method === "HEAD")).toBe(true);
});

it('guards command-menu navigation away from intake and invalidates the confirmation on session replacement', async () => {
  await openIntake();
  fireEvent.keyDown(window, {key: 'k', ctrlKey: true});
  const field = screen.getByRole('combobox', {name: 'Search desktop commands'});
  fireEvent.change(field, {target: {value: 'documentation'}});
  fireEvent.keyDown(field, {key: 'Enter'});
  expect(screen.getByRole('alertdialog', {name: 'Leave this release intake?'})).toBeTruthy();

  await act(async () => { desktopClient.setSession('axm.desk.synthetic-replacement.not-a-real-signature'); });

  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(screen.queryByLabelText('Request title')).toBeNull();
  expect(requests.every(request => request.method === 'GET' || request.method === 'HEAD')).toBe(true);
});

it('uses the current intake guard for native menu actions without replacing its subscription', async () => {
  await openIntake();
  expect(ports.listen).toHaveBeenCalledTimes(1);

  act(() => emitMenuAction({payload: 'open_settings'}));

  expect(screen.getByRole('alertdialog', {name: 'Leave this release intake?'})).toBeTruthy();
  expect(ports.listen).toHaveBeenCalledTimes(1);
});

it('rejects a pending discard after same-token config replacement', async () => {
  const title = await openIntake();
  const docs = screen.getByRole('button', {name: 'Documentation'});
  fireEvent.click(docs);
  const leave = within(screen.getByRole('alertdialog')).getByRole('button', {name: 'Leave without saving'});

  const revision = desktopClient.getContextRevision();
  desktopClient.setSession(desktopClient.config.sessionToken);
  expect(desktopClient.getContextRevision()).toBe(revision);
  fireEvent.click(leave);

  expect(title.isConnected).toBe(true);
  expect(docs.getAttribute('aria-current')).toBeNull();
});

it('keeps a parked ticket-first draft when cancelling navigation', async () => {
  render(createElement(App));
  fireEvent.click(await screen.findByRole('button', {name: 'Deployments'}));
  fireEvent.click(await screen.findByRole('button', {name: 'Start from ticket'}));
  const title = screen.getByRole<HTMLInputElement>('textbox', {name: 'Request title'});
  fireEvent.change(title, {target: {value: 'Synthetic ticket-first draft'}});
  fireEvent.click(screen.getByRole('button', {name: 'Cancel draft'}));
  fireEvent.click(screen.getByRole('button', {name: 'Documentation'}));
  const dialog = screen.getByRole('alertdialog', {name: 'Leave this release intake?'});
  fireEvent.keyDown(dialog, {key: 'Escape'});

  expect(screen.queryByRole('alertdialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', {name: 'Start from ticket'}));
  expect(screen.getByRole('textbox', {name: 'Request title'})).toBe(title);
  expect(title.value).toBe('Synthetic ticket-first draft');
});

it.each([
  {prStatus:"pending",noPrRequired:true},
  {prStatus:"not_applicable",noPrRequired:false},
])("keeps the Batches and Deployments approval gate consistent for %j", async requirement => {
  prRequirement = requirement;
  batchAccess = true;
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button", {name:"Batches"}));
  fireEvent.click(screen.getByRole("button", {name:"Release dependencies"}));
  const gate = within(await screen.findByRole("region", {name:"Approval gate"}));
  expect(gate.getByText("Recorded PR state").nextElementSibling?.textContent).toBe("PR not required");
  expect(screen.queryByRole("button", {name:"Review approvals"})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name:"Open release Payments staging"}));
  const overview = within(await screen.findByRole("region", {name:"Recorded approvals"}));
  expect(overview.getByText("Recorded PR state").nextElementSibling?.textContent).toBe("PR not required");
  expect(screen.queryByRole("button", {name:"View release review"})).toBeNull();
  expect(requests.every(request => request.method === "GET" || request.method === "HEAD")).toBe(true);
});

it.each([
  {advanced:false, section:"release"},
  {advanced:true, section:"release"},
  {advanced:false, section:"review"},
  {advanced:true, section:"review"},
  {advanced:false, section:"logs"},
  {advanced:true, section:"logs"},
])("returns to the exact Batches dependency ($section, version advanced: $advanced)", async ({advanced, section}) => {
  const opener = section === "logs" ? "Open release logs" : section === "review" ? "Review approvals" : "Open release Payments staging";
  batchAccess = true;
  canReviewRelease = section === "logs";
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button", {name: "Batches"}));
  fireEvent.click(screen.getByRole("button", {name: "Release dependencies"}));
  await screen.findByRole("heading", {name: "Payments staging"});
  if (section === "logs") {
    const nav = screen.getByRole("navigation", {name: "Release dependency sections"});
    fireEvent.click(within(nav).getByRole("button", {name: "Logs"}));
  }
  const open = await screen.findByRole("button", {name: opener});
  const search = screen.getByRole("searchbox", {name: "Search release dependencies"});
  fireEvent.change(search, {target: {value: "Payments"}});
  if (advanced) releaseVersion = 4;
  open.focus();
  fireEvent.click(open);

  const back = await screen.findByRole("button", {name: "Return to Batches"});
  if (advanced) expect(within(screen.getByRole("region", {name: "Saved release unavailable"})).getByRole("button", {name: "Return to Batches"})).toBe(back);
  else expect(screen.getByRole("navigation", {name: "Select a release"}).querySelector("[aria-current]")?.textContent).toContain("Payments staging");
  if (section === "review" && !advanced) {
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("region", {name:"Merge review"})));
    expect(screen.getByRole("heading", {name:"Payments staging"})).toBeTruthy();
  }
  if (section === "logs" && !advanced) {
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("region", {name: "Release logs"})));
    const initiallyFocused = screen.getByRole("navigation", {name: "Release detail sections"});
    expect(within(initiallyFocused).getByRole("button", {name: "Logs"}).getAttribute("aria-current")).toBe("location");
    const directory = screen.getByRole("navigation", {name: "Select a release"});
    fireEvent.click(within(directory).getByRole("button", {name: /^Inventory staging/}));
    fireEvent.click(within(directory).getByRole("button", {name: /^Payments staging/}));
    const navigation = screen.getByRole("navigation", {name: "Release detail sections"});
    fireEvent.click(within(navigation).getByRole("button", {name: "Logs"}));
    const readCount = requests.length;
    const logs = screen.getByRole("region", {name: "Release logs"});
    fireEvent.click(within(logs).getByRole("button", {name: "Find recorded workflow logs"}));
    const evidence = screen.getByRole("region", {name: "Release evidence"});
    expect(document.activeElement).toBe(evidence);
    expect(within(evidence).getByRole("button", {name: "Load evidence plans"})).toBeTruthy();
    expect(within(navigation).getByRole("button", {name: "Evidence"}).getAttribute("aria-current")).toBe("location");
    expect(within(navigation).getByRole("button", {name: "Logs"}).hasAttribute("aria-current")).toBe(false);
    expect(requests.slice(readCount).some(request => /operation-plans|workflow-evidence/.test(request.path) || request.method !== "GET")).toBe(false);
  }
  if (advanced) {
    expect(screen.queryByRole("region", {name:"Merge review"})).toBeNull();
    expect(screen.queryByRole("region", {name:"Release logs"})).toBeNull();
  }
  back.focus();
  fireEvent.click(back);

  expect(await screen.findByRole("searchbox", {name: "Search release dependencies"})).toHaveProperty("value", "Payments");
  if (advanced) {
    const notice = await screen.findByText(/The selected release version is unavailable/);
    expect(document.activeElement).toBe(notice);
    expect(screen.queryByRole("button", {name: opener})).toBeNull();
    fireEvent.click(within(screen.getByRole("navigation", {name: "Select a release dependency"})).getByRole("button", {name: /Payments staging/}));
    expect(screen.getByText("Release version 4")).toBeTruthy();
  } else {
    const restored = await screen.findByRole("button", {name: opener});
    expect(document.activeElement).toBe(restored);
    expect(screen.getByText("Release version 3")).toBeTruthy();
    const navigation = screen.getByRole("navigation", {name: "Release dependency sections"});
    const activeSection = section === "logs" ? "Logs" : section === "review" ? "Approvals" : "Overview";
    expect(within(navigation).getByRole("button", {name: activeSection}).getAttribute("aria-current")).toBe("location");
  }
  expect(requests.every(request => request.method === "GET" || request.method === "HEAD")).toBe(true);
});

it.each([false,true])("preserves only the exact Batches selection hidden by search (version advances: %s)", async advanced => {
  batchAccess = true;
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button", {name:"Batches"}));
  fireEvent.click(screen.getByRole("button", {name:"Release dependencies"}));
  const directory = await screen.findByRole("navigation", {name:"Select a release dependency"});
  fireEvent.click(within(directory).getByRole("button", {name:/Payments staging/}));
  const inspector = await screen.findByRole("article", {name:"Selected release dependency"});
  const nav = within(inspector).getByRole("navigation", {name:"Release dependency sections"});
  const logs = within(nav).getByRole("button", {name:"Logs"});
  fireEvent.click(logs);
  const disclosure = within(inspector).getByText("View logs").closest("details");
  expect(disclosure?.open).toBe(true);

  const search = screen.getByRole("searchbox", {name:"Search release dependencies"});
  search.focus();
  const reads = requests.length;
  fireEvent.change(search, {target:{value:"No matching dependency"}});
  expect(document.activeElement).toBe(search);
  expect(screen.getByText(/Search has hidden the selected release version/)).toBeTruthy();
  expect(screen.queryByText("No loaded dependencies match.")).toBeNull();
  expect(screen.queryByRole("article", {name:"Selected release dependency"})).toBeNull();
  expect(inspector.hidden).toBe(true);
  expect(inspector.hasAttribute("inert")).toBe(true);

  if (advanced) {
    releaseVersion = 4;
    fireEvent.click(screen.getByRole("button", {name:"Refresh dependencies"}));
    await screen.findByText(/The selected release version is unavailable/);
    expect(inspector.isConnected).toBe(false);
    fireEvent.change(search, {target:{value:""}});
    expect(screen.queryByRole("article", {name:"Selected release dependency"})).toBeNull();
    fireEvent.click(within(screen.getByRole("navigation", {name:"Select a release dependency"})).getByRole("button", {name:/Payments staging/}));
    expect(screen.getByText("Release version 4")).toBeTruthy();
  } else {
    fireEvent.change(search, {target:{value:""}});
    expect(screen.getByRole("article", {name:"Selected release dependency"})).toBe(inspector);
    expect(document.activeElement).toBe(search);
    expect(disclosure?.open).toBe(true);
    expect(logs.getAttribute("aria-current")).toBe("location");
    expect(requests).toHaveLength(reads);
  }
});

it.each(["current", "advanced", "outside directory", "unavailable"] as const)("opens the selected release dependency from Deployments (%s)", async scenario => {
  batchAccess = true;
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button", {name: "Deployments"}));
  const directory = await screen.findByRole("navigation", {name: "Select a release"});
  fireEvent.click(within(directory).getByRole("button", {name: /Payments staging/}));
  const inspect = await screen.findByRole("button", {name: "Inspect release dependencies"});
  if (scenario === "advanced") releaseVersion = 4;
  if (scenario === "outside directory") olderReleaseLookup = "exact";
  if (scenario === "unavailable") releaseListingAvailable = false;
  inspect.focus();
  fireEvent.click(inspect);

  expect((await screen.findByRole("button", {name: "Release dependencies"})).getAttribute("aria-pressed")).toBe("true");
  if (scenario === "advanced") {
    const notice = await screen.findByText(/The selected release version is unavailable/);
    expect(document.activeElement).toBe(notice);
    expect(screen.queryByRole("article", {name: "Selected release dependency"})).toBeNull();
    expect(exactLookupQueries).toEqual([]);
  } else if (scenario === "unavailable") {
    const notice = await screen.findByRole("alert");
    expect(notice.textContent).toContain("Release requests could not be verified");
    expect(document.activeElement).toBe(notice);
  } else {
    const detail = await screen.findByRole("article", {name: "Selected release dependency"});
    expect(within(detail).getByText("Release version 3")).toBeTruthy();
    expect(document.activeElement).toBe(detail);
    if (scenario === "outside directory") {
      expect(exactLookupQueries).toHaveLength(1);
      const query = new URLSearchParams(exactLookupQueries[0]);
      expect(query.get("savedReleaseId")).toBe("release-target");
      expect(query.get("savedReleaseVersion")).toBe("3");
    }
    fireEvent.click(within(detail).getByRole("button", {name: "Open release Payments staging"}));
    const back = await screen.findByRole("button", {name: "Return to Batches"});
    expect(screen.getByRole("navigation", {name: "Select a release"}).querySelector("[aria-current]")?.textContent).toContain("Payments staging");
    back.focus();
    fireEvent.click(back);
    const restored = await screen.findByRole("button", {name: "Open release Payments staging"});
    expect(document.activeElement).toBe(restored);
  }
  expect(requests.every(request => request.method === "GET" || request.method === "HEAD")).toBe(true);
  expect(requests.some(request => /batch-(readiness|tasks|wait)$/.test(request.path))).toBe(false);
});

it('selects the exact saved release from Home without sending a write', async () => {
  render(createElement(App));
  fireEvent.click(await screen.findByRole('button', {name: /Payments staging v3/}));
  const releases = await screen.findByRole('navigation', {name: 'Select a release'});
  const selected = within(releases).getByRole('button', {name: /Payments staging/});
  expect(selected.getAttribute('aria-current')).toBe('true');
  expect(document.activeElement).toBe(selected);
  expect(requests.every(request => request.method === 'GET' || request.method === 'HEAD')).toBe(true);
});

it('leaves release selection empty when the version changed since Home loaded', async () => {
  render(createElement(App));
  const link = await screen.findByRole('button', {name: /Payments staging v3/});
  releaseVersion = 4;
  fireEvent.click(link);
  const unavailable = await screen.findByRole('region', {name: 'Saved release unavailable'});
  expect(within(unavailable).getByText(/saved release version could not be verified/)).toBeTruthy();
  const releases = screen.getByRole('navigation', {name: 'Select a release'});
  expect(releases.querySelector('[aria-current]')).toBeNull();
  fireEvent.click(within(releases).getByRole('button', {name: /Payments staging/}));
  expect(releases.querySelector('[aria-current]')).toBeTruthy();
});

it('invalidates a previously exact Home selection when directory refresh advances the version', async () => {
  canReviewRelease = true;
  render(createElement(App));
  fireEvent.click(await screen.findByRole('button', {name: /Payments staging v3/}));
  await screen.findByRole('button', {name: 'Review saved plans in Agent'});
  releaseVersion = 4;
  fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
  const unavailable = await screen.findByRole('region', {name: 'Saved release unavailable'});
  expect(document.activeElement).toBe(unavailable);
  const releases = screen.getByRole('navigation', {name: 'Select a release'});
  expect(releases.querySelector('[aria-current]')).toBeNull();
  expect(screen.queryByRole('button', {name: 'Review saved plans in Agent'})).toBeNull();
});

it.each(['version advanced', 'service unavailable'])('keeps directory search focus when saved release refresh reports %s', async outcome => {
  canReviewRelease = true;
  render(createElement(App));
  fireEvent.click(await screen.findByRole('button', {name: /Payments staging v3/}));
  await screen.findByRole('button', {name: 'Review saved plans in Agent'});

  let finishListing!: () => void;
  pendingReleaseListing = new Promise(resolve => { finishListing = resolve; });
  const refresh = screen.getByRole('button', {name: 'Refresh'});
  refresh.focus();
  fireEvent.click(refresh);
  const search = screen.getByRole('searchbox', {name: 'Search loaded releases'});
  search.focus();
  fireEvent.change(search, {target: {value: 'Payments'}});
  releaseVersion = 4;
  releaseListingAvailable = outcome !== 'service unavailable';
  await act(async () => finishListing());

  const unavailable = await screen.findByRole('region', {name: 'Saved release unavailable'});
  expect(within(unavailable).getByRole('button', {name: 'Return to Home activity'})).toBeTruthy();
  expect(document.activeElement).toBe(search);
  expect(search).toHaveProperty('value', 'Payments');
  expect(screen.getAllByRole('status').some(status => status.textContent?.includes('The saved release version could not be verified.'))).toBe(true);
  expect(screen.getByRole('navigation', {name: 'Select a release'}).querySelector('[aria-current]')).toBeNull();
  expect(screen.queryByRole('button', {name: 'Review saved plans in Agent'})).toBeNull();
  expect(requests.every(request => request.method === 'GET' || request.method === 'HEAD')).toBe(true);
});

it.each([false, true])('returns to refreshed Home releases without losing the unsent planner (planner focused: %s)', async focusPlanner => {
  canReviewRelease = true;
  render(createElement(App));
  const link = await screen.findByRole('button', {name: /Payments staging v3/});
  const planner = screen.getByRole('textbox', {name: 'Planning request'});
  fireEvent.change(planner, {target: {value: 'Keep the independently prepared plan'}});
  releaseVersion = 4;
  fireEvent.click(link);
  const unavailable = await screen.findByRole('region', {name: 'Saved release unavailable'});
  expect(document.activeElement).toBe(unavailable);
  expect(screen.queryByRole('button', {name: 'Review saved plans in Agent'})).toBeNull();
  let finishListing!: () => void;
  pendingReleaseListing = new Promise(resolve => { finishListing = resolve; });
  fireEvent.click(within(unavailable).getByRole('button', {name: 'Return to Home activity'}));
  expect(screen.queryByRole('button', {name: /Payments staging v3/})).toBeNull();
  expect(screen.getByText('Loading recent releases…')).toBeTruthy();
  if (focusPlanner) planner.focus();
  await act(async () => finishListing());
  const revised = await screen.findByRole('button', {name: /Payments staging v4/});
  expect(document.activeElement).toBe(focusPlanner ? planner : revised);
  expect(planner).toHaveProperty('value', 'Keep the independently prepared plan');
  expect(requests.every(request => request.method === 'GET' || request.method === 'HEAD')).toBe(true);
});

it("returns from an exact release to Agent plan review with the draft intact", async () => {
  canReviewRelease = true;
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button", {name: /Payments staging v3/}));
  fireEvent.click(await screen.findByRole("button", {name: "Review saved plans in Agent"}));
  const context = within(await screen.findByRole("complementary", {name: "Saved release plan context"}));
  const draft = screen.getByRole("textbox", {name: "Agent request"});
  fireEvent.change(draft, {target: {value: "Keep this plan draft"}});
  fireEvent.click(context.getByRole("button", {name: "Open exact release"}));
  fireEvent.click(await screen.findByRole("button", {name: "Return to Agent"}));
  const heading = await screen.findByRole("heading", {name: "Saved release plans"});
  expect(document.activeElement).toBe(heading);
  expect(draft).toHaveProperty("value", "Keep this plan draft");
  expect(requests.every(request => request.method === "GET" || request.method === "HEAD")).toBe(true);
});

it('refuses a newer release on return from Agent and recovers the original plan context', async () => {
  canReviewRelease = true;
  render(createElement(App));
  fireEvent.click(await screen.findByRole('button', {name: /Payments staging v3/}));
  const inspect = await screen.findByRole('button', {name: 'Review saved plans in Agent'});
  fireEvent.click(inspect);
  const original = await screen.findByRole('complementary', {name: 'Saved release plan context'});
  expect(within(original).getByText(/Release version 3/)).toBeTruthy();
  releaseVersion = 4;
  fireEvent.click(within(original).getByRole('button', {name: 'Open exact release'}));
  const unavailable = await screen.findByRole('region', {name: 'Saved release unavailable'});
  expect(document.activeElement).toBe(unavailable);
  expect(screen.queryByRole('button', {name: 'Review saved plans in Agent'})).toBeNull();
  fireEvent.click(within(unavailable).getByRole('button', {name: 'Return to Agent'}));
  const restored = await screen.findByRole('heading', {name: 'Saved release plans'});
  expect(document.activeElement).toBe(restored);
  expect(within(screen.getByRole('complementary', {name: 'Saved release plan context'})).getByText(/Release version 3/)).toBeTruthy();
  expect(requests.every(request => request.method === 'GET' || request.method === 'HEAD')).toBe(true);
});

it('resumes the open intake and explains why the saved release did not open', async () => {
  const title = await openIntake();
  fireEvent.click(screen.getByRole('button', {name: /^Home$/}));
  fireEvent.click(await screen.findByRole('button', {name: /Payments staging v3/}));
  expect(screen.getByText(/Your release intake is still in progress/)).toBeTruthy();
  expect(screen.getByRole('textbox', {name: 'Request title'})).toBe(title);
  expect(title.value).toBe('Synthetic unsaved draft');
  fireEvent.click(screen.getByRole('button', {name: 'Cancel intake'}));
  expect(screen.queryByText(/Your release intake is still in progress/)).toBeNull();
  expect(requests.every(request => request.method === 'GET' || request.method === 'HEAD')).toBe(true);
});

it('shows authorized workspace roles in Settings and links to current Permissions', async () => {
  render(createElement(App));
  fireEvent.click(await screen.findByRole('button', {name: /^Settings$/}));
  const overview = screen.getByRole('region', {name: 'Access & roles'});
  expect(await within(overview).findByText('Synthetic Owner')).toBeTruthy();
  expect(within(overview).getByText('Workspace owner')).toBeTruthy();
  expect(screen.getByText('Owner', {selector: 'dt'}).nextElementSibling?.textContent).toBe('Synthetic Owner');
  expect(requests.filter(request => request.path === '/api/desktop/workspace-members')).toHaveLength(1);
  expect(within(overview).getByText('1 accepted member')).toBeTruthy();
  expect(overview.querySelector("time")?.dateTime).toBe("2026-11-20T00:00:00.000Z");
  fireEvent.click(within(overview).getByRole('button', {name: 'View permissions'}));
  expect(screen.getByRole('heading', {name: /^Permissions$/})).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole('region', {name: 'Current settings section'}));
  expect(requests.every(request => request.method === 'GET' || request.method === 'HEAD')).toBe(true);
});

it('opens the named workspace configuration sections without a preference or policy write', async () => {
  render(createElement(App));
  fireEvent.click(await screen.findByRole('button', {name: /^Settings$/}));
  expect(screen.getByText('Device time zone')).toBeTruthy();
  for (const [title, button, destination] of [
    ['Environments', 'Review environments', 'Environments'],
    ['Models & AI', 'Review models', 'Models'],
    ['Security', 'Review identity', 'Identity'],
  ]) {
    const overview = screen.getByRole('region', {name: title});
    expect(within(overview).getByRole('heading', {name: title})).toBeTruthy();
    fireEvent.click(within(overview).getByRole('button', {name: button}));
    const current = screen.getByRole('region', {name: 'Current settings section'});
    expect(within(current).getByRole('heading', {name: new RegExp(destination, "i")})).toBeTruthy();
    expect(document.activeElement).toBe(current);
    fireEvent.keyDown(current, {key: 'Escape'});
    expect(document.activeElement).toBe(screen.getByRole('button', {name: destination}));
    fireEvent.click(screen.getByRole('button', {name: /^General$/}));
  }
  expect(requests.every(request => request.method === 'GET' || request.method === 'HEAD')).toBe(true);
});

it('copies the verified Settings workspace ID and makes the exact fallback selectable', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('fixture_clipboard_denied'));
  Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText}});
  try {
    render(createElement(App));
    fireEvent.click(await screen.findByRole('button', {name: /^Settings$/}));
    const copy = screen.getByRole('button', {name: 'Copy workspace ID'});
    copy.focus();
    fireEvent.click(copy);
    await screen.findByText('Workspace ID copied.');
    expect(document.activeElement).toBe(copy);
    expect(writeText).toHaveBeenLastCalledWith(identity.organizationId);
    fireEvent.click(copy);
    const fallback = await screen.findByRole<HTMLInputElement>('textbox', {name: 'Workspace ID for manual copy'});
    expect(fallback.value).toBe(identity.organizationId);
    expect(fallback.readOnly).toBe(true);
    expect(copy.parentElement?.querySelectorAll('button,input')[1]).toBe(fallback);
    fallback.focus();
    expect(fallback.selectionStart).toBe(0);
    expect(fallback.selectionEnd).toBe(fallback.value.length);
    expect(requests.every(request => request.method === 'GET' || request.method === 'HEAD')).toBe(true);
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});

it('opens the existing browser audit log from Settings and shows a retryable launch failure', async () => {
  ports.open.mockRejectedValueOnce(new Error('fixture_external_open_forbidden')).mockResolvedValueOnce(undefined);
  render(createElement(App));
  fireEvent.click(await screen.findByRole('button', {name: /^Settings$/}));
  const audit = screen.getByRole('button', {name: 'View audit log'});
  expect(audit.getAttribute('aria-describedby')).toBe('settings-audit-scope');
  audit.focus();
  fireEvent.click(audit);
  await screen.findByText('The audit log could not be opened. Try again.');
  expect(document.activeElement).toBe(audit);
  expect(ports.open).toHaveBeenCalledWith('https://visionxixlabs.com/control/audit-security');
  fireEvent.click(audit);
  await waitFor(() => expect(screen.queryByText('The audit log could not be opened. Try again.')).toBeNull());
  expect(ports.open).toHaveBeenCalledTimes(2);
  expect(requests.every(request => request.method === 'GET' || request.method === 'HEAD')).toBe(true);
});

it('shows the Settings membership failure without sample names', async () => {
  membersAvailable = false;
  render(createElement(App));
  fireEvent.click(await screen.findByRole('button', {name: 'Account settings'}));
  const overview = screen.getByRole('region', {name: 'Access & roles'});
  expect(await within(overview).findByText('Workspace members are unavailable.')).toBeTruthy();
  expect(within(overview).queryByRole('list')).toBeNull();
  expect(screen.getByText('Owner', {selector: 'dt'}).nextElementSibling?.textContent).toBe('Unavailable');
});

it('keeps both drafts when a Home plan meets the release intake guard', async () => {
  const title = await openIntake();
  fireEvent.click(screen.getByRole('button', {name: /^Home$/}));
  fireEvent.change(screen.getByRole('textbox', {name: 'Planning request'}), {target: {value: 'Plan the reporting update'}});
  fireEvent.click(screen.getByRole('button', {name: 'Create plan'}));
  const guard = screen.getByRole('alertdialog', {name: 'Leave this release intake?'});
  fireEvent.click(within(guard).getByRole('button', {name: 'Stay in intake'}));
  expect(screen.getByRole('textbox', {name: 'Request title'})).toBe(title);
  fireEvent.click(screen.getByRole('button', {name: /^Home$/}));
  expect(screen.getByRole<HTMLTextAreaElement>('textbox', {name: 'Planning request'}).value).toBe('Plan the reporting update');
  expect(requests.every(request => request.method === 'GET' || request.method === 'HEAD')).toBe(true);
});

it('returns from Settings to Home with the planner text intact', async () => {
  render(createElement(App));
  const planner = await screen.findByRole('textbox', {name: 'Planning request'});
  fireEvent.change(planner, {target: {value: 'Prepare the next staging review'}});
  fireEvent.click(screen.getByRole('button', {name: /^Settings$/}));
  fireEvent.click(screen.getByRole('button', {name: 'Back to workspace'}));
  expect(screen.getByRole<HTMLTextAreaElement>('textbox', {name: 'Planning request'}).value).toBe('Prepare the next staging review');
});

it('shows only the selected request’s recorded lifecycle stages without triggering execution',async()=>{
  render(createElement(App));
  fireEvent.click(await screen.findByRole('button',{name:/Payments staging v3/}));
  const lifecycle=await screen.findByRole('region',{name:'Selected release lifecycle'});
  const stages=within(lifecycle).getAllByRole('listitem');
  expect(stages.map(stage=>stage.querySelector('strong')?.textContent)).toEqual(['Plan','Validate','Approve','Deploy','Verify']);
  expect(stages[0].textContent).toContain('Draft request');
  expect(stages[1].textContent).toContain('No steps recorded');
  expect(stages[2].textContent).toContain('Readiness needs attention');
  expect(stages[2].querySelector('[data-review-ready]')).toBeNull();
  expect(stages[4].textContent).toContain('Verification unavailable');
  expect(within(lifecycle).queryByRole('button',{name:'Review saved plans in Agent'})).toBeNull();
  expect(requests.every(request=>request.method==='GET'||request.method==='HEAD')).toBe(true);
});

it('summarizes only loaded release requests and retains totals through directory filters',async()=>{
  render(createElement(App));
  fireEvent.click(await screen.findByRole('button',{name:'Deployments'}));
  const summary=await screen.findByLabelText('Loaded release request summary');
  expect(Array.from(summary.querySelectorAll('dd'),count=>count.textContent)).toEqual(['2','2','0','0']);
  fireEvent.click(screen.getByRole('button',{name: /^Submitted$/}));
  expect(screen.getByText('No loaded releases match.')).toBeTruthy();
  expect(Array.from(summary.querySelectorAll('dd'),count=>count.textContent)).toEqual(['2','2','0','0']);
  expect(requests.every(request=>request.method==='GET'||request.method==='HEAD')).toBe(true);
});

it("counts loaded release records without claiming deployment outcomes", async () => {
  render(createElement(App));
  await screen.findByRole("button", {name: /Payments staging v3/});
  const summary = within(screen.getByLabelText("Loaded release summary"));
  expect(summary.getByText("Loaded requests").nextElementSibling?.textContent).toBe("2");
  expect(summary.getByText("Draft requests").nextElementSibling?.textContent).toBe("2");
  expect(summary.getByText("Submitted requests").nextElementSibling?.textContent).toBe("0");
  expect(summary.getByText("Closed requests").nextElementSibling?.textContent).toBe("0");
  expect(summary.queryByText(/success|health/i)).toBeNull();
});

it("filters Home recent activity by request state without another request", async () => {
  render(createElement(App));
  await screen.findByRole("button", {name: /Payments staging v3/});
  const activity = screen.getByRole("region", {name: "Recent deployment activity"});
  const filter = within(activity).getByRole("combobox", {name: "Filter recent activity by request state"});
  const reads = requests.length;
  fireEvent.change(filter, {target: {value: "closed"}});
  expect(within(activity).queryByRole("button", {name: /Payments staging v3/})).toBeNull();
  expect(within(activity).getByText("No loaded releases in this state.")).toBeTruthy();
  fireEvent.change(filter, {target: {value: "draft"}});
  expect(within(activity).getByRole("button", {name: /Payments staging v3/})).toBeTruthy();
  fireEvent.change(filter, {target: {value: "all"}});
  expect(within(activity).getByRole("button", {name: /Payments staging v3/})).toBeTruthy();
  expect(requests.length).toBe(reads);
});

it.each([false, true])("returns from the Home next action to the refreshed exact action without losing the planner (version advances: %s)", async advances => {
  render(createElement(App));
  const actions = await screen.findByRole("region", {name:"Next actions"});
  const link = await within(actions).findByRole("button", {name:"Complete release details for Payments staging, saved version 3"});
  const planner = screen.getByRole("textbox", {name:"Planning request"});
  fireEvent.change(planner, {target:{value:"Unsent Home plan"}});
  if (advances) releaseVersion = 4;
  fireEvent.click(link);
  if (advances) expect(await screen.findByRole("region", {name:"Saved release unavailable"})).toBeTruthy();
  else expect(await screen.findByRole("navigation", {name:"Select a release"})).toBeTruthy();

  fireEvent.click(await screen.findByRole("button", {name:"Return to Home activity"}));
  const restored = await within(actions).findByRole("button", {name:`Complete release details for Payments staging, saved version ${advances ? 4 : 3}`});
  expect(document.activeElement).toBe(restored);
  expect(planner).toHaveProperty("value", "Unsent Home plan");
  expect(Boolean(screen.queryByText(/Review version 4 to continue/))).toBe(advances);
  expect(requests.every(request => request.method === "GET" || request.method === "HEAD")).toBe(true);
});

it('shows only a bounded authorized Home activity feed alongside exact saved release navigation', async () => {
  auditAccess = true;
  render(createElement(App));
  const activity = await screen.findByRole('region', {name:'Activity feed'});
  expect(await within(activity).findByText('Recorded synthetic change review')).toBeTruthy();
  const recordedAt = new Date('2026-11-20T10:00:00.000Z');
  const fullTimestamp = recordedAt.toLocaleString(undefined, {dateStyle:'medium', timeStyle:'short'});
  const time = within(activity).getByText(fullTimestamp).closest('time');
  expect(time?.getAttribute('datetime')).toBe(recordedAt.toISOString());
  expect(time?.hasAttribute('aria-label')).toBe(false);
  expect(within(activity).queryByText(/fixture-hidden/)).toBeNull();
  expect(requests.filter(request => request.path === '/api/desktop/release-audit')).toEqual([{method:'GET',path:'/api/desktop/release-audit'}]);
  fireEvent.click(await screen.findByRole('button', {name:/^Payments staging/}));
  const rows = await screen.findByRole('navigation', {name:'Select a release'});
  expect(within(rows).getByRole('button', {name:/Payments staging/}).getAttribute('aria-current')).toBe('true');
});

it('keeps recent releases available when the Home audit feed is unavailable', async () => {
  auditAccess = true;
  auditAvailable = false;
  render(createElement(App));
  expect(await screen.findByText('Release audit events are unavailable.')).toBeTruthy();
  expect(await screen.findByRole('button', {name:/^Payments staging/})).toBeTruthy();
});

it('does not request the Home audit feed without paired pipeline access', async () => {
  render(createElement(App));
  await screen.findByRole('button', {name:/^Payments staging/});
  expect(screen.queryByRole('region', {name:'Activity feed'})).toBeNull();
  expect(requests.some(request => request.path === '/api/desktop/release-audit')).toBe(false);
});

it('navigates between selected release sections without a provider action', async () => {
  render(createElement(App));
  fireEvent.click(await screen.findByRole('button', {name:/^Payments staging/}));
  const nav = await screen.findByRole('navigation', {name:'Release detail sections'});
  const overviewButton = within(nav).getByRole('button', {name: /^Overview$/});
  const evidenceButton = within(nav).getByRole('button', {name: /^Evidence$/});
  const logsButton = within(nav).getByRole('button', {name: /^Logs$/});
  expect(overviewButton.getAttribute('aria-current')).toBe('location');
  fireEvent.click(evidenceButton);
  expect(document.activeElement).toBe(screen.getByRole('region', {name:'Release evidence'}));
  expect(evidenceButton.getAttribute('aria-current')).toBe('location');
  expect(overviewButton.hasAttribute('aria-current')).toBe(false);
  fireEvent.click(logsButton);
  const logs = screen.getByRole('region', {name:'Release logs'});
  expect(document.activeElement).toBe(logs);
  expect(logsButton.getAttribute('aria-current')).toBe('location');
  expect(within(logs).getByText('Live logs and application health are unavailable for this request.')).toBeTruthy();
  expect(within(logs).queryByRole("button", {name: "Find recorded workflow logs"})).toBeNull();
  fireEvent.click(overviewButton);
  expect(overviewButton.getAttribute('aria-current')).toBe('location');
  const overview = screen.getByRole('region', {name:'Release overview'});
  expect(document.activeElement).toBe(overview);
  const summary = within(overview).getByRole('region', {name:'Recorded release summary'});
  for (const label of ['Repository', 'Commit', 'Change']) {
    expect(within(summary).getByText(label).nextElementSibling?.textContent).toBe('Unavailable');
  }
  expect(within(summary).getByText('staging')).toBeTruthy();
  expect(within(summary).getByText('Planned validation').nextElementSibling?.textContent).toBe('No steps recorded');
  expect(within(summary).getByText('Recorded PR state')).toBeTruthy();
  const approvals = within(summary).getByRole('region', {name:'Recorded approvals'});
  expect(within(approvals).getByText('Pending')).toBeTruthy();
  const directory = screen.getByRole('navigation', {name:'Select a release'});
  const selectedRow = within(directory).getByRole('button', {name:/Payments staging.*PR review:\s*Pending.*Requester: Fixture Requester/});
  expect(within(selectedRow).getByText('FR').getAttribute('aria-hidden')).toBe('true');
  expect(within(directory).getByRole('button', {name:/Inventory staging.*Requester: Unavailable/})).toBeTruthy();
  expect(screen.queryByRole('button', {name:'View release review'})).toBeNull();
  const readiness = within(summary).getByRole('region', {name:'Recorded readiness'});
  expect(within(readiness).getByText('Workflow run').nextElementSibling?.textContent).toBe('Unavailable');
  expect(within(readiness).getAllByText('Not recorded')).toHaveLength(2);
  expect(within(summary).queryByText(/passed|verified|approved/i)).toBeNull();
  expect(requests.some(request => request.method === 'POST')).toBe(false);
});

it('guides a ready, submitted release to review and withholds guidance during refresh', async () => {
  batchAccess = true;
  releaseApprovalDecision = 'ready_for_human_approval';
  render(createElement(App));
  fireEvent.click(await screen.findByRole('button', {name: /^Payments staging/}));
  const overview = await screen.findByRole('region', {name:'Release overview'});
  const nextStep = within(overview).getByRole('region', {name:'Release next step'});
  expect(within(nextStep).getByRole('heading', {name:'View release review'})).toBeTruthy();
  const review = screen.getByRole('button', {name:'View release review'});
  expect(overview.contains(review)).toBe(false);
  expect(screen.getByRole('heading', {name:'Payments staging'})).toBeTruthy();
  const readsBeforeReview = requests.length;
  fireEvent.click(review);
  const mergeReview = screen.getByRole('region', {name:'Merge review'});
  expect(document.activeElement).toBe(mergeReview);
  expect(requests).toHaveLength(readsBeforeReview);
  let finish!: () => void;
  pendingReleaseListing = new Promise<void>(resolve => { finish = resolve; });
  fireEvent.click(screen.getByRole('button', {name:'Refresh'}));
  expect((review as HTMLButtonElement).disabled).toBe(true);
  expect(within(nextStep).getByRole('heading', {name:'Refresh saved status'})).toBeTruthy();
  expect(within(nextStep).getByText('Current approval requirements and decisions are unavailable.')).toBeTruthy();
  expect(within(nextStep).queryByText(/PR approval needs review|Recorded prerequisite signals are present/)).toBeNull();
  expect(screen.queryByRole('region', {name:'Merge review'})).toBeNull();
  expect(screen.getByText('Checking the release version before merge review…')).toBeTruthy();
  await act(async () => finish());
  expect((review as HTMLButtonElement).disabled).toBe(false);
  expect(within(nextStep).getByRole('heading', {name:'View release review'})).toBeTruthy();
  expect(screen.getByRole('region', {name:'Merge review'})).toBe(mergeReview);
});

it('shows repository scope and an explicit inapplicable change only for the selected recorded release', async () => {
  canReviewRelease = true;
  render(createElement(App));
  fireEvent.click(await screen.findByRole('button', {name: /^Payments staging/}));
  const summary = within(await screen.findByRole('region', {name:'Recorded release summary'}));
  expect(summary.getByText('Repository').nextElementSibling?.textContent).toBe('studio-fixture/payments');
  expect(summary.getByText('Commit').nextElementSibling?.textContent).toBe('Unavailable');
  expect(summary.getByText('Change').nextElementSibling?.textContent).toBe('Not applicable');
  expect(requests.every(request => request.method === 'GET')).toBe(true);
});

it('marks approval and readiness unavailable when the selected directory refresh fails', async () => {
  batchAccess = true;
  render(createElement(App));
  fireEvent.click(await screen.findByRole('button', {name: /^Payments staging/}));
  await screen.findByRole('region', {name:'Recorded approvals'});
  releaseListingAvailable = false;
  fireEvent.click(screen.getByRole('button', {name:'Refresh'}));
  await screen.findByText(/Showing the last successfully loaded records/);
  const releases = screen.getByRole('navigation', {name:'Select a release'});
  fireEvent.click(within(releases).getByRole('button', {name:/Payments staging.*PR review:\s*Unavailable.*Requester: Unavailable/}));
  const approvals = within(screen.getByRole('region', {name:'Recorded approvals'}));
  expect(approvals.getByText('Recorded PR state').nextElementSibling?.textContent).toBe('Unavailable');
  expect(screen.queryByRole('region', {name:'Merge review'})).toBeNull();
  expect(screen.getByText('Refresh releases to verify this version before merge review.')).toBeTruthy();
  const readiness = within(screen.getByRole('region', {name:'Recorded readiness'}));
  expect(readiness.getByText('Planned validation').nextElementSibling?.textContent).toBe('Unavailable');
});

it("retains the guide section and search through the unsent Agent handoff", async () => {
  render(createElement(App));
  const docs = await screen.findByRole("button", {name: "Documentation"});
  fireEvent.click(docs);
  const search = screen.getByRole("searchbox", {name: "Search documentation"});
  fireEvent.change(search, {target: {value: "approval"}});
  const outline = within(screen.getByRole("navigation", {name: "On this page"}));
  const section = outline.getByRole("button", {name: "Prepare a governed release"});
  fireEvent.click(section);
  expect(section.getAttribute("aria-current")).toBe("location");
  const ask = screen.getByRole("button", {name: "Ask about this page"});
  fireEvent.click(ask);
  expect(screen.queryByRole("searchbox", {name: "Search documentation"})).toBeNull();
  fireEvent.click(docs);
  expect(screen.getByRole("searchbox", {name: "Search documentation"})).toBe(search);
  expect(search).toHaveProperty("value", "approval");
  expect(document.activeElement).toBe(ask);
  expect(section.getAttribute("aria-current")).toBe("location");
  const batches = screen.getByRole("button", {name: "Open Batches"});
  fireEvent.click(batches);
  expect(screen.queryByRole("searchbox", {name: "Search documentation"})).toBeNull();
  fireEvent.click(docs);
  expect(document.activeElement).toBe(batches);
  expect(search).toHaveProperty("value", "approval");
  expect(screen.getByRole("link", {name: "Guide source"}).getAttribute("href"))
    .toBe("https://visionxixlabs.com/docs/getting-started#guide-stage-schedule");
  expect(requests.every(request => request.method === "GET" || request.method === "HEAD")).toBe(true);
});

it("enters a Settings section from search and returns to its exact row", async () => {
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button", {name: "Settings"}));
  const nav = within(screen.getByRole("navigation", {name: "Settings sections"}));
  const search = nav.getByRole("searchbox", {name: "Search settings"});
  const general = nav.getByRole("button", {name: "General"});
  general.focus();
  expect(fireEvent.keyDown(general, {key: "/"})).toBe(false);
  expect(document.activeElement).toBe(search);
  expect(fireEvent.keyDown(search, {key: "/"})).toBe(true);
  fireEvent.change(search, {target: {value: "permission"}});
  const row = nav.getByRole("button", {name: "Permissions"});
  fireEvent.click(row);
  const content = screen.getByRole("region", {name: "Current settings section"});
  expect(document.activeElement).toBe(content);
  expect(row.getAttribute("aria-current")).toBe("page");
  expect(search).toHaveProperty("value", "");
  fireEvent.keyDown(content, {key: "Escape"});
  expect(document.activeElement).toBe(row);
  fireEvent.click(row);
  expect(document.activeElement).toBe(content);
  expect(requests.every(request => request.method === "GET" || request.method === "HEAD")).toBe(true);
});


it("shows only the selected release's valid recorded UTC window", async () => {
  releaseWindow = {startUtc: "2026-11-21T09:00:00.000Z", endUtc: "2026-11-21T10:00:00.000Z", displayTimeZone: "ET"};
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button", {name: /Payments staging v3/}));
  const summary = within(await screen.findByRole("region", {name: "Recorded release summary"}));
  const disclosure = within(screen.getByRole("region", {name: "Release overview"})).getByText("Recorded release details").closest("details")!;
  disclosure.open = true;
  const window = within(disclosure).getByText("Recorded window").nextElementSibling!;
  expect(summary.queryByText("Recorded window")).toBeNull();
  expect(Array.from(window.querySelectorAll("time"), time => time.dateTime)).toEqual([releaseWindow.startUtc, releaseWindow.endUtc]);
  expect(window.textContent).toContain("UTC");
  releaseWindow = {...releaseWindow, endUtc: "2026-11-21T08:00:00.000Z"};
  fireEvent.click(screen.getByRole("button", {name: "Refresh"}));
  expect(window.textContent).toBe("Unavailable");
  await waitFor(() => expect(summary.getByText("Target").nextElementSibling?.textContent).toBe("staging"));
  expect(window.textContent).toBe("Unavailable");
  expect(requests.every(request => request.method === "GET" || request.method === "HEAD")).toBe(true);
});


it("opens the existing profile from the account overview and returns focus to its section row", async () => {
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button", {name: "Settings"}));
  const account = within(screen.getByRole("region", {name: "Account"}));
  fireEvent.click(account.getByRole("button", {name: "Review profile"}));
  const content = screen.getByRole("region", {name: "Current settings section"});
  expect(within(content).getByRole("heading", {name: "Profile"})).toBeTruthy();
  expect(document.activeElement).toBe(content);
  fireEvent.keyDown(content, {key: "Escape"});
  const nav = within(screen.getByRole("navigation", {name: "Settings sections"}));
  expect(document.activeElement).toBe(nav.getByRole("button", {name: "Profile"}));
  expect(requests.every(request => request.method === "GET" || request.method === "HEAD")).toBe(true);
});

it.each(["exact", "advanced", "wrong-shape", "missing"] as const)("handles an older saved release lookup with %s evidence", async outcome => {
  render(createElement(App));
  const link = await screen.findByRole("button", {name: /Payments staging v3/});
  olderReleaseLookup = outcome;
  fireEvent.click(link);
  const directory = within(await screen.findByRole("navigation", {name: "Select a release"}));
  expect(exactLookupQueries).toEqual(["?savedReleaseId=release-target&savedReleaseVersion=3&includeRequester=1"]);
  if (outcome === "exact") {
    const row = directory.getByRole("button", {name: /Payments staging Version 3/});
    expect(row.getAttribute("aria-current")).toBe("true");
    expect(document.activeElement).toBe(row);
    expect(screen.getByText("Showing 49–51 of 51 loaded releases")).toBeTruthy();
    expect(screen.queryByRole("region", {name: "Saved release unavailable"})).toBeNull();
  } else {
    const unavailable = screen.getByRole("region", {name: "Saved release unavailable"});
    expect(document.activeElement).toBe(unavailable);
    expect(directory.queryByRole("button", {name: /Payments staging/})).toBeNull();
    expect(directory.getByRole("button", {name: /Recent release 1 Version 1/})).toBeTruthy();
  }
});

it("allows browsing the current directory during an older exact lookup without resetting the selection", async () => {
  render(createElement(App));
  const link = await screen.findByRole("button", {name: /Payments staging v3/});
  let finishLookup!: () => void;
  pendingExactRelease = new Promise(resolve => { finishLookup = resolve; });
  olderReleaseLookup = "exact";
  fireEvent.click(link);
  const directory = within(await screen.findByRole("navigation", {name: "Select a release"}));
  expect(screen.getByText("Checking the saved release version…")).toBeTruthy();
  expect(directory.queryByRole("button", {name: /Payments staging/})).toBeNull();

  const search = screen.getByRole("searchbox", {name: "Search loaded releases"});
  search.focus();
  fireEvent.change(search, {target: {value: "Recent release 1"}});
  const row = directory.getByRole("button", {name: /^Recent release 1 Version 1/});
  row.focus();
  fireEvent.keyDown(row, {key: "ArrowDown"});
  const next = directory.getByRole("button", {name: /^Recent release 10 Version 1/});
  expect(document.activeElement).toBe(next);

  await act(async () => finishLookup());
  expect(screen.queryByText("Checking the saved release version…")).toBeNull();
  expect(search).toHaveProperty("value", "Recent release 1");
  expect(next.getAttribute("aria-current")).toBe("true");
  expect(document.activeElement).toBe(next);
  expect(directory.queryByRole("button", {name: /Payments staging/})).toBeNull();
  expect(exactLookupQueries).toEqual(["?savedReleaseId=release-target&savedReleaseVersion=3&includeRequester=1"]);
});

it("keeps current directory rows when exact lookup fails and restores the saved version on retry", async () => {
  render(createElement(App));
  const link = await screen.findByRole("button", {name: /Payments staging v3/});
  olderReleaseLookup = "offline";
  fireEvent.click(link);
  const unavailable = await screen.findByRole("region", {name: "Saved release unavailable"});
  expect(within(unavailable).getByText(/Refresh to retry this version/)).toBeTruthy();
  expect(document.activeElement).toBe(unavailable);
  const directory = within(screen.getByRole("navigation", {name: "Select a release"}));
  expect(directory.getByRole("button", {name: /Recent release 1 Version 1/})).toBeTruthy();
  expect(directory.queryByRole("button", {name: /Payments staging/})).toBeNull();

  olderReleaseLookup = "exact";
  fireEvent.click(screen.getByRole("button", {name: "Refresh"}));
  const restored = await directory.findByRole("button", {name: /Payments staging Version 3/});
  expect(restored.getAttribute("aria-current")).toBe("true");
  expect(screen.queryByRole("region", {name: "Saved release unavailable"})).toBeNull();
  expect(exactLookupQueries).toEqual(Array(2).fill("?savedReleaseId=release-target&savedReleaseVersion=3&includeRequester=1"));
});

it("preserves directory search when a retry verifies the saved release", async () => {
  render(createElement(App));
  const link = await screen.findByRole("button", {name: /Payments staging v3/});
  olderReleaseLookup = "offline";
  fireEvent.click(link);
  await screen.findByRole("region", {name: "Saved release unavailable"});

  let finishListing!: () => void;
  pendingReleaseListing = new Promise(resolve => { finishListing = resolve; });
  olderReleaseLookup = "exact";
  const refresh = screen.getByRole("button", {name: "Refresh"});
  refresh.focus();
  fireEvent.click(refresh);
  const search = screen.getByRole("searchbox", {name: "Search loaded releases"});
  search.focus();
  fireEvent.change(search, {target: {value: "Payments"}});
  await act(async () => finishListing());

  const restored = await screen.findByRole("button", {name: /Payments staging Version 3/});
  expect(restored.getAttribute("aria-current")).toBe("true");
  expect(document.activeElement).toBe(search);
  expect(search).toHaveProperty("value", "Payments");
  expect(screen.queryByRole("region", {name: "Saved release unavailable"})).toBeNull();
  expect(requests.every(request => request.method === "GET" || request.method === "HEAD")).toBe(true);
});

it("reads canonical release evidence without changing the selected incident or tab", async () => {
  ticketAccess = true;
  linkedTicketReleaseId = "canonical-release-only";
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button",{name:"Tickets"}));
  fireEvent.change(screen.getByRole("searchbox",{name:"Search tickets"}),{target:{value:"Payments"}});
  const overview = await screen.findByRole("tab",{name:"Overview"});
  overview.focus();
  fireEvent.keyDown(overview,{key:"ArrowRight"});
  fireEvent.keyDown(screen.getByRole("tab",{name:"Investigation"}),{key:"ArrowRight"});
  const action = screen.getByRole("button",{name:"Review linked release evidence"});
  action.focus();
  fireEvent.click(action);
  const link = await screen.findByRole("link",{name:"Open release record in browser"});
  expect(link.getAttribute("href")).toBe("https://visionxixlabs.com/control/releases/canonical-release-only");
  expect(screen.getByRole("tab",{name:"Evidence",selected:true})).toBeTruthy();
  expect(document.activeElement).toBe(action);
  expect(screen.getByRole("searchbox",{name:"Search tickets"})).toHaveProperty("value","Payments");
  expect(exactLookupQueries).toEqual([]);
});

it("prepares an unsent remediation draft and restores the exact incident action", async () => {
  ticketAccess = true;
  ticketDraftConversation = true;
  linkedTicketReleaseId = "canonical-release-only";
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button",{name:"Tickets"}));
  const search = screen.getByRole("searchbox",{name:"Search tickets"});
  fireEvent.change(search,{target:{value:"Payments"}});
  const prepare = await screen.findByRole("button",{name:"Prepare remediation plan"});
  prepare.focus();
  fireEvent.click(prepare);
  const request = await screen.findByRole("textbox",{name:"Agent request"}) as HTMLTextAreaElement;
  await waitFor(() => expect(request.value).toContain('Linked release record: "canonical-release-only" · failed'));
  expect(request.value).toContain('Incident: "incident-target" · high · open');
  expect(request.value).toContain("Keep the plan read-only.");
  expect(request.value).toContain("Recorded commit: " + "a".repeat(40));
  expect(document.activeElement).toBe(request);
  fireEvent.click(screen.getByRole("button",{name:"Return to Tickets"}));
  expect(await screen.findByRole("searchbox",{name:"Search tickets"})).toHaveProperty("value","Payments");
  const restored = await screen.findByRole("button",{name:"Prepare remediation plan"});
  expect(document.activeElement).toBe(restored);
  expect(screen.getByRole("heading",{name:"Payments incident"})).toBeTruthy();
  expect(requests.every(entry => entry.method === "GET" || entry.method === "HEAD")).toBe(true);
});

it("stays in Tickets when the exact linked release cannot be verified", async () => {
  ticketAccess = true;
  linkedTicketReleaseId = "no-matching-release";
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button",{name:"Tickets"}));
  fireEvent.change(screen.getByRole("searchbox",{name:"Search tickets"}),{target:{value:"Payments"}});
  fireEvent.click(await screen.findByRole("button",{name:"Prepare remediation plan"}));
  expect(await screen.findByText(/The current linked release could not be verified/)).toBeTruthy();
  expect(screen.getByRole("heading",{name:"Payments incident"})).toBeTruthy();
  expect(screen.queryByRole("textbox",{name:"Agent request"})).toBeNull();
});

it("keeps text already in the Agent composer when preparing an incident draft", async () => {
  ticketAccess = true;
  ticketDraftConversation = true;
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button",{name:"Agent"}));
  const composer = await screen.findByRole("textbox",{name:"Agent request"});
  await waitFor(() => expect((composer as HTMLTextAreaElement).disabled).toBe(false));
  fireEvent.change(composer,{target:{value:"Existing unsent request"}});
  fireEvent.click(screen.getByRole("button",{name:"Tickets"}));
  fireEvent.change(screen.getByRole("searchbox",{name:"Search tickets"}),{target:{value:"Payments"}});
  fireEvent.click(await screen.findByRole("button",{name:"Prepare remediation plan"}));
  expect(await screen.findByText("The new request is ready once you finish or clear this draft.")).toBeTruthy();
  expect(composer).toHaveProperty("value","Existing unsent request");
  expect(requests.every(entry=>entry.method==="GET"||entry.method==="HEAD")).toBe(true);
});

it("requires a new selection when a manually opened release advances on refresh", async () => {
  canReviewRelease = true;
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button", {name: /Payments staging v3/}));
  const directory = within(await screen.findByRole("navigation", {name: "Select a release"}));
  fireEvent.click(directory.getByRole("button", {name: /Payments staging Version 3/}));
  await screen.findByRole("button", {name: "Review saved plans in Agent"});

  releaseVersion = 4;
  fireEvent.click(screen.getByRole("button", {name: "Refresh"}));
  await screen.findByText("The selected release version changed. Choose a release to review its current version.");
  const current = directory.getByRole("button", {name: /Payments staging Version 4/});
  expect(current.getAttribute("aria-current")).toBeNull();
  expect(current.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("button", {name: "Review saved plans in Agent"})).toBeNull();
  fireEvent.click(current);
  expect(current.getAttribute("aria-current")).toBe("true");
  expect(current.getAttribute("aria-expanded")).toBe("true");
  expect(document.activeElement?.textContent).toContain("Version 4");
  expect(requests.every(request => request.method === "GET" || request.method === "HEAD")).toBe(true);
});

it("keeps the implicitly shown release version bound through a fast refresh", async () => {
  canReviewRelease = true;
  render(createElement(App));
  fireEvent.click(await screen.findByRole("button", {name: "Deployments"}));
  const directory = within(await screen.findByRole("navigation", {name: "Select a release"}));
  fireEvent.change(screen.getByRole("searchbox", {name: "Search loaded releases"}), {target: {value: "Payments"}});
  const displayed = directory.getByRole("button", {name: /Payments staging Version 3/});
  expect(displayed.getAttribute("aria-expanded")).toBe("true");

  releaseVersion = 4;
  const refresh = screen.getByRole("button", {name: "Refresh"});
  refresh.focus();
  fireEvent.click(refresh);
  await screen.findByText("The selected release version changed. Choose a release to review its current version.");
  const current = directory.getByRole("button", {name: /Payments staging Version 4/});
  expect(current.getAttribute("aria-current")).toBeNull();
  expect(current.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(refresh);
  fireEvent.click(current);
  expect(current.getAttribute("aria-expanded")).toBe("true");
  expect(document.activeElement?.textContent).toContain("Version 4");
  expect(requests.every(request => request.method === "GET" || request.method === "HEAD")).toBe(true);
});
