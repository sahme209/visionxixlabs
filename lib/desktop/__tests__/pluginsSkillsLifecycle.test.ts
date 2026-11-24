/** @vitest-environment jsdom */
import {createElement} from "react";
import {act, cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {afterEach, beforeEach, expect, it, vi} from "vitest";
const m = vi.hoisted(() => ({open: vi.fn(), listeners: new Set<() => void>(), revision: 0, client: {config: {}, subscribeContext: (fn: () => void) => {m.listeners.add(fn); return () => {m.listeners.delete(fn);};}, getContextRevision: () => m.revision, listAgentSkills: vi.fn(), integrationStatus: vi.fn(), airflowConnection: vi.fn(), updateAgentSkill: vi.fn(), startIntegrationConnection: vi.fn(), listSlackChannels:vi.fn(),validateGitHubReadOnly: vi.fn(), verifyExistingGitHubConnection:vi.fn(),confirmExistingGitHubConnection:vi.fn(),reloadGitHubReconnectStatus:vi.fn(),githubReconnectNeedsReload:()=>false}}));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({desktopClient: m.client}));
vi.mock("@tauri-apps/plugin-shell", () => ({open: m.open}));
vi.mock('../../../desktop/src/components/OutlookIntegrationCard',()=>({OutlookIntegrationCard:()=>createElement('div',null,'Existing Outlook connection controls')}));
import {PluginsSkillsView} from "../../../desktop/src/views/PluginsSkillsView";
const skill = {id: "safe-change", name: "Safe change", description: "Existing governed workflow", category: "GitHub", toolNames: ["read_github_file", "commit_github_file"], status: "not_installed", installedAt: null, updatedAt: null};
const ok = (data: unknown) => ({ok: true, data});
function deferred() {let resolve!: (value: unknown) => void; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};}
function show(canManage = true) {return render(createElement(PluginsSkillsView, {onOpenSettings() {}, onOpenAirflow() {}, canManage}));}
function changeContext() {m.client.config = {}; m.revision++; for (const fn of m.listeners) fn();}
beforeEach(() => {vi.resetAllMocks(); m.client.config = {}; m.revision++; m.client.listAgentSkills.mockResolvedValue(ok({skills: [skill], storageAvailable: true})); m.client.integrationStatus.mockResolvedValue(ok({configuration: {github: true, slack: false, teams: false, linear: false}, github: {status: "not_connected", repositorySelection: "selected"}, cloud: [], collaboration: []})); m.client.airflowConnection.mockResolvedValue(ok({status: "not_connected"}));});
afterEach(cleanup);
it("summarizes recorded connectivity and distinguishes unavailable counts from zero", async () => {
  m.client.integrationStatus.mockResolvedValue(ok({
    github: {status: "active", repositorySelection: "selected"},
    cloud: [{provider: "azure", status: "read_only_connected"}],
    collaboration: [{provider: "slack", status: "validation_overdue"}],
  }));
  m.client.airflowConnection.mockRejectedValueOnce(new Error("unavailable"));
  show();
  const value = (label: string) => screen.getByText(label).nextElementSibling;
  await waitFor(() => expect(value("Read-only cloud connections")?.textContent).toBe("1"));
  expect(value("Overdue validations")?.textContent).toBe("1");
  expect(value("Enabled skills")?.textContent).toBe("0");
  expect(value("Connected catalogue apps")?.textContent).toContain("Unavailable");
  fireEvent.click(screen.getByRole("button", {name: "Refresh capabilities"}));
  await waitFor(() => expect(value("Connected catalogue apps")?.textContent).toBe("2"));
  expect(m.client.startIntegrationConnection).not.toHaveBeenCalled();
});
it("distinguishes pending skill results without changing search focus or Apps view", async () => {
  const pending=deferred(); m.client.listAgentSkills.mockReturnValueOnce(pending.promise);
  show(false);
  const views=within(screen.getByRole("group",{name:"Choose catalogue view"}));
  const search=screen.getByRole("searchbox",{name:"Search apps and skills"}) as HTMLInputElement;
  fireEvent.change(search,{target:{value:"Safe"}});
  fireEvent.click(views.getByRole("button",{name:"Apps"}));
  expect(screen.queryByText("Loading skills…")).toBeNull();
  fireEvent.click(views.getByRole("button",{name:"Enabled"})); search.focus();
  expect(screen.getByText("Loading skills…").getAttribute("role")).toBe("status");
  expect(screen.queryByText("No matching capabilities")).toBeNull();
  await act(async()=>{pending.resolve(ok({skills:[{...skill,status:"enabled"}],storageAvailable:true}));});
  expect(screen.getByText("Safe change")).toBeTruthy();
  expect(screen.queryByText("Loading skills…")).toBeNull();
  expect(search.value).toBe("Safe"); expect(document.activeElement).toBe(search);
  expect(m.client.updateAgentSkill).not.toHaveBeenCalled(); expect(m.client.startIntegrationConnection).not.toHaveBeenCalled();
});
it("does not label a failed skills response as an empty search", async () => {
  m.client.listAgentSkills.mockRejectedValueOnce(new Error("unavailable")); show();
  fireEvent.click(within(screen.getByRole("group",{name:"Choose catalogue view"})).getByRole("button",{name:"Enabled"}));
  await screen.findByText(/Skills could not be loaded right now/);
  expect(screen.queryByText("Loading skills…")).toBeNull();
  expect(screen.queryByText("No matching capabilities")).toBeNull();
  expect(screen.getByRole("button",{name:"Retry"})).toBeTruthy();
});
it("shows a true empty skills result only after the response settles", async () => {
  const pending=deferred();m.client.listAgentSkills.mockReturnValueOnce(pending.promise);show();
  fireEvent.click(within(screen.getByRole("group",{name:"Choose catalogue view"})).getByRole("button",{name:"Disabled"}));
  expect(screen.queryByText("No matching capabilities")).toBeNull();
  await act(async()=>{pending.resolve(ok({skills:[],storageAvailable:true}));});
  expect(screen.getByText("No matching capabilities")).toBeTruthy();
  expect(screen.queryByText("Loading skills…")).toBeNull();
});
it("uses one catalogue view while preserving search and read-only action guards", async () => {
  m.client.listAgentSkills.mockResolvedValue(ok({skills:[{...skill,status:"enabled"},{...skill,id:"other",name:"Release guidance",status:"disabled"}],storageAvailable:true}));
  show(false); await screen.findByText("Safe change");
  const views=within(screen.getByRole("group",{name:"Choose catalogue view"}));
  expect(screen.getByText("Select one view at a time. Enabled and Disabled show saved skills.")).toBeTruthy();
  const search=screen.getByRole("searchbox",{name:"Search apps and skills"});
  fireEvent.change(search,{target:{value:"Safe"}});
  fireEvent.click(views.getByRole("button",{name:"Apps"}));
  expect(screen.queryByText("Safe change")).toBeNull();
  fireEvent.click(views.getByRole("button",{name:"Enabled"}));
  expect(screen.getByText("Safe change")).toBeTruthy();
  expect((search as HTMLInputElement).value).toBe("Safe");
  expect(views.getAllByRole("button",{pressed:true})).toHaveLength(1);
  expect(views.getByRole("button",{name:"Apps"}).getAttribute("aria-pressed")).toBe("false");
  expect((screen.getByRole("button",{name:"Disable"}) as HTMLButtonElement).disabled).toBe(true);
  expect(m.client.updateAgentSkill).not.toHaveBeenCalled();
  expect(m.client.startIntegrationConnection).not.toHaveBeenCalled();
});
it("shows declared tools and keeps members read-only", async () => {
  show(false); await screen.findByText("Safe change");
  fireEvent.click(screen.getByText("Review skill tools"));
  expect(screen.getByText("commit_github_file")).toBeTruthy();
  expect((screen.getByRole("button", {name: "Add"}) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/workspace administrator/)).toBeTruthy();
});
it("rejects stale catalog data after a credential context change", async () => {
  const old = deferred(); m.client.listAgentSkills.mockReturnValueOnce(old.promise); show();
  await act(async () => {changeContext();}); await screen.findByText("Safe change");
  await act(async () => {old.resolve(ok({skills: [{...skill, name: "PRIVATE OLD WORKSPACE"}]}));});
  expect(screen.queryByText("PRIVATE OLD WORKSPACE")).toBeNull();
});
it("never opens a late consent URL after credential context changes", async () => {
  const old = deferred(); m.client.startIntegrationConnection.mockReturnValueOnce(old.promise); show();
  fireEvent.click(await screen.findByRole("button", {name: "Connect ↗"}));
  await act(async () => {changeContext();});
  await act(async () => {old.resolve(ok({consentUrl: "https://github.com/login/oauth/authorize?state=old"}));});
  expect(m.open).not.toHaveBeenCalled();
});
it("recovers a rejected mutation after an explicit catalog verification", async () => {
  m.client.updateAgentSkill.mockRejectedValueOnce(new Error("PRIVATE_RAW_ERROR")).mockResolvedValueOnce(ok({status: "enabled"})); show();
  fireEvent.click(await screen.findByRole("button", {name: "Add"}));
  await screen.findByText(/Could not update Safe change/);
  expect(screen.queryByText(/PRIVATE_RAW_ERROR/)).toBeNull();
  expect((screen.getByRole("button", {name: "Add"}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", {name: "Refresh capabilities"}));
  await waitFor(() => expect((screen.getByRole("button", {name: "Add"}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", {name: "Add"}));
  await screen.findByText(/Safe change is now enabled/);
  expect(m.client.updateAgentSkill).toHaveBeenCalledTimes(2);
});
it.each(["https://user:pass@github.com/login", "https://github.com:444/login", "http://github.com/login", "https://github.com.evil.invalid/login"])("rejects unsafe consent destination %s", async consentUrl => {
  m.client.startIntegrationConnection.mockResolvedValue(ok({consentUrl})); show();
  fireEvent.click(await screen.findByRole("button", {name: "Connect ↗"}));
  await screen.findByText(/connection could not be opened/); expect(m.open).not.toHaveBeenCalled();
});
it("shows independent refresh failures and clears stale integration health", async () => {
  m.client.integrationStatus.mockResolvedValueOnce(ok({github: {status: "connected"}, cloud: [], collaboration: []})).mockRejectedValueOnce(new Error("PRIVATE_NETWORK_ERROR"));
  show(); await screen.findByText("Safe change");
  fireEvent.click(screen.getByRole("button", {name: "Refresh capabilities"}));
  await screen.findByText(/Integration status is unavailable/);
  expect(screen.queryByText(/PRIVATE_NETWORK_ERROR/)).toBeNull();
  expect(screen.getByText("Safe change")).toBeTruthy();
});
it("keeps the newest focus refresh when an older catalog finishes last", async () => {
  const old = deferred(); m.client.listAgentSkills.mockReturnValueOnce(old.promise);
  show(); fireEvent(window, new Event("focus"));
  await screen.findByText("Safe change");
  await act(async () => {old.resolve(ok({skills: [{...skill, name: "STALE CATALOG"}]}));});
  expect(screen.queryByText("STALE CATALOG")).toBeNull();
});
it("opens an allowed consent URL once", async () => {
  m.client.startIntegrationConnection.mockResolvedValue(ok({consentUrl: "https://github.com/login/oauth/authorize?state=fixture"}));
  show(); fireEvent.click(await screen.findByRole("button", {name: "Connect ↗"}));
  await screen.findByText(/Secure provider consent opened/);
  expect(m.open).toHaveBeenCalledTimes(1);
});
it("does not publish a previous workspace's mutation receipt or refresh it after switching", async () => {
  const old = deferred(); m.client.updateAgentSkill.mockReturnValueOnce(old.promise); show();
  fireEvent.click(await screen.findByRole("button", {name: "Add"}));
  await act(async () => {changeContext();}); await screen.findByText("Safe change");
  const loads = m.client.listAgentSkills.mock.calls.length;
  await act(async () => {old.resolve(ok({status: "enabled"}));});
  expect(screen.queryByText(/Safe change is now enabled/)).toBeNull();
  expect(m.client.listAgentSkills).toHaveBeenCalledTimes(loads);
});

it("releases the validation lock after rejection without exposing raw errors", async () => {
  m.client.integrationStatus.mockResolvedValue(ok({configuration: {github: true, slack: false, teams: false, linear: false}, github: {status: "awaiting_validation"}, cloud: [], collaboration: []}));
  m.client.validateGitHubReadOnly.mockRejectedValue(new Error("PRIVATE_VALIDATION_ERROR")); show();
  fireEvent.click(await screen.findByRole("button", {name: "Verify access"}));
  await screen.findByText(/connection could not be verified/);
  expect(screen.queryByText(/PRIVATE_VALIDATION_ERROR/)).toBeNull();
  expect((screen.getByRole("button", {name: "Verify access"}) as HTMLButtonElement).disabled).toBe(false);
});
it("does not list unavailable integrations as installed", async () => {
  m.client.integrationStatus.mockRejectedValue(new Error("offline")); m.client.airflowConnection.mockRejectedValue(new Error("offline"));
  show(); await screen.findByText(/Integration status is unavailable/);
  fireEvent.click(screen.getByRole("button", {name: "installed"}));
  expect(screen.getByText("No matching capabilities")).toBeTruthy();
});

it("keeps the skill catalog usable while an independent Airflow lookup is pending", async () => {
  const airflow = deferred(); m.client.airflowConnection.mockReturnValueOnce(airflow.promise); show();
  await screen.findByText("Safe change");
  await act(async () => {airflow.resolve(ok({status: "not_connected"}));});
});
it("hands an enabled skill to the Agent without installation mutation", async () => {
  const onUseSkill = vi.fn();
  m.client.listAgentSkills.mockResolvedValue(ok({skills: [{...skill, status: "enabled"}], storageAvailable: true}));
  render(createElement(PluginsSkillsView, {canManage: false, onOpenSettings() {}, onOpenAirflow() {}, onUseSkill}));
  fireEvent.click(await screen.findByRole("button", {name: "Use in Agent"}));
  expect(onUseSkill).toHaveBeenCalledWith(skill.id);
  expect(m.client.updateAgentSkill).not.toHaveBeenCalled();
});

it("publishes Airflow readiness while the independent integration inventory is pending", async () => {
  const inventory = deferred(); m.client.integrationStatus.mockReturnValueOnce(inventory.promise);
  m.client.airflowConnection.mockResolvedValue(ok({status: "connected"}));
  show();
  await waitFor(() => expect(within(screen.getByText("Apache Airflow").closest("tr")!).getByText("connected")).toBeTruthy());
  await act(async () => {inventory.resolve(ok({configuration: {}, github: {status: "not_connected"}, cloud: [], collaboration: []}));});
});
it("shows Airflow's recorded validation alongside the row and clears it when access is revoked", async () => {
  const validated = "2026-11-22T09:00:00.000Z";
  m.client.airflowConnection.mockResolvedValueOnce(ok({connected:true, status:"active",lastValidatedAt:validated}))
    .mockResolvedValueOnce(ok({connected:false,status:"revoked",lastValidatedAt:validated}));
  show(false);
  const row=(await screen.findByText("Apache Airflow")).closest("tr")!;
  await waitFor(()=>expect(row.querySelector("time")?.dateTime).toBe(validated));
  const inspect=within(row).getByRole("button",{name:"Inspect Apache Airflow"});
  fireEvent.click(inspect);
  const detail=screen.getByRole("dialog");
  expect(within(detail).getByText("Recorded validation").nextElementSibling?.querySelector("time")?.dateTime).toBe(validated);
  fireEvent.click(within(detail).getByRole("button",{name:"Close details"}));
  expect(document.activeElement).toBe(inspect);
  fireEvent.click(screen.getByRole("button",{name:"Refresh capabilities"}));
  await within(row).findByText("revoked");
  expect(row.querySelector("time")).toBeNull();
  fireEvent.click(inspect);
  expect(screen.getByRole("dialog").querySelector("time")).toBeNull();
  expect(m.client.startIntegrationConnection).not.toHaveBeenCalled();
});

it("shows existing Azure and GCP inventory and opens settings without starting provider consent", async () => {
  const onOpenSettings = vi.fn();
  m.client.integrationStatus.mockResolvedValue(ok({configuration: {github: true, slack: false, teams: false, linear: false}, github: {status: "not_connected"}, cloud: [{provider: "azure", status: "connected", lastTransitionAt: null}, {provider: "gcp", status: "not_connected", lastTransitionAt: null}], collaboration: []}));
  render(createElement(PluginsSkillsView, {onOpenSettings, onOpenAirflow() {}, canManage: false}));
  const azure = await screen.findByText("Microsoft Azure");
  const gcp = screen.getByText("Google Cloud");
  await waitFor(() => expect(within(azure.closest("tr")!).getByText("connected")).toBeTruthy());
  expect(within(gcp.closest("tr")!).getByText("not connected")).toBeTruthy();
  const card = azure.closest("tr")!;
  fireEvent.click(within(card).getByRole("button", {name: "Manage"}));
  expect(onOpenSettings).toHaveBeenCalledTimes(1);
  expect(m.client.startIntegrationConnection).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "installed"}));
  expect(screen.getByText("Microsoft Azure")).toBeTruthy();
  expect(screen.queryByText("Google Cloud")).toBeNull();
});

it("requires a fresh catalog after an uncertain skill change before allowing another mutation", async () => {
  const refresh = deferred();
  m.client.updateAgentSkill.mockRejectedValue(new Error("offline after send"));
  m.client.listAgentSkills.mockResolvedValueOnce(ok({skills: [skill], storageAvailable: true})).mockReturnValueOnce(refresh.promise);
  show(); fireEvent.click(await screen.findByRole("button", {name: "Add"}));
  await screen.findByText(/Could not update Safe change/);
  expect((screen.getByRole("button", {name: "Add"}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", {name: "Refresh capabilities"}));
  await act(async () => { refresh.resolve(ok({skills: [{...skill, status: "disabled"}], storageAvailable: true})); });
  await screen.findByRole("button", {name: "Enable"});
  expect(m.client.updateAgentSkill).toHaveBeenCalledTimes(1);
  expect((screen.getByRole("button", {name: "Enable"}) as HTMLButtonElement).disabled).toBe(false);
});

it("filters enabled and disabled skills separately with explicit saved status", async () => {
  m.client.listAgentSkills.mockResolvedValue(ok({skills: [{...skill, status: "enabled"}, {...skill, id: "second", name: "Release guidance", status: "disabled"}], storageAvailable: true}));
  show(); await screen.findByText("Release guidance");
  fireEvent.click(screen.getByRole("button", {name: "Enabled"}));
  expect(screen.getByText("Safe change")).toBeTruthy();
  expect(screen.queryByText("Release guidance")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Disabled"}));
  expect(screen.queryByText("Safe change")).toBeNull();
  expect(screen.getByText("Release guidance")).toBeTruthy();
  expect(screen.getByText("Installed · disabled")).toBeTruthy();
});

it("does not offer consent before inventory verifies configuration or after an inventory failure", async () => {
  const inventory = deferred();
  m.client.integrationStatus.mockReturnValueOnce(inventory.promise);
  show(); await screen.findByText("Safe change");
  for (const button of screen.queryAllByRole("button", {name: "Connect ↗"})) {
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
  }
  expect(m.client.startIntegrationConnection).not.toHaveBeenCalled();
  await act(async () => {inventory.resolve({ok: false, error: "offline"});});
  await screen.findByText(/Integration status is unavailable/);
  for (const button of screen.queryAllByRole("button", {name: "Connect ↗"})) {
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
  }
  expect(m.client.startIntegrationConnection).not.toHaveBeenCalled();
  expect(screen.getByText("Safe change")).toBeTruthy();
});

const reconnectChallenge={challengeId:'github_reconnect_12345678-1234-4123-8123-123456789abc',version:0,expiresAt:'2099-01-01T00:00:00Z',accountLogin:'verified-team',accountType:'Organization',repositorySelection:'selected',providerWritesPerformed:false};
function revoked(){m.client.integrationStatus.mockResolvedValue(ok({configuration:{github:true},github:{status:'revoked',repositorySelection:'selected'},cloud:[],collaboration:[]}));m.client.verifyExistingGitHubConnection.mockResolvedValue(ok(reconnectChallenge))}
it('reviews actual verified GitHub account before explicit reconnect and holds unknown until status reload',async()=>{revoked();m.client.confirmExistingGitHubConnection.mockResolvedValue({ok:false});show();fireEvent.click(await screen.findByRole('button',{name:'Connect'}));await screen.findByText(/Verified account: verified-team/);expect(m.client.confirmExistingGitHubConnection).not.toHaveBeenCalled();fireEvent.click(screen.getByText('Reconnect verified installation'));await screen.findByText('Reload GitHub status');expect(m.client.confirmExistingGitHubConnection).toHaveBeenCalledWith(reconnectChallenge.challengeId,expect.any(AbortSignal));expect(screen.queryByRole('button',{name:'Connect'})).toBeNull();m.client.reloadGitHubReconnectStatus.mockResolvedValue(ok({github:{status:'revoked',repositorySelection:'selected'},cloud:[],collaboration:[]}));fireEvent.click(screen.getByText('Reload GitHub status'));await screen.findByRole('button',{name:'Connect'});expect(m.client.confirmExistingGitHubConnection).toHaveBeenCalledTimes(1)});
it('never exposes reconnect recovery to nonmanaging members',async()=>{revoked();show(false);await screen.findByText('Safe change');expect(screen.queryByRole('button',{name:'Connect'})).toBeNull();expect(m.client.verifyExistingGitHubConnection).not.toHaveBeenCalled()});
it('discards late verified account after context changes',async()=>{revoked();const old=deferred();m.client.verifyExistingGitHubConnection.mockReturnValueOnce(old.promise);show();fireEvent.click(await screen.findByRole('button',{name:'Connect'}));await act(async()=>changeContext());await act(async()=>old.resolve(ok(reconnectChallenge)));expect(screen.queryByText(/Verified account:/)).toBeNull();expect(m.client.confirmExistingGitHubConnection).not.toHaveBeenCalled()});

it('uses one primary Connect action and shows pending state without auto confirmation',async()=>{revoked();const old=deferred();m.client.verifyExistingGitHubConnection.mockReturnValueOnce(old.promise);show();const connect=await screen.findByRole('button',{name:'Connect'});expect(screen.queryByText('Verify existing connection')).toBeNull();expect(screen.getByText('Connect in browser ↗').closest('details')?.open).toBe(false);fireEvent.click(connect);expect(await screen.findByRole('button',{name:'Connecting…'})).toBeTruthy();expect(m.client.confirmExistingGitHubConnection).not.toHaveBeenCalled();await act(async()=>old.resolve(ok(reconnectChallenge)));await screen.findByText(/Verified account: verified-team/);expect(m.client.confirmExistingGitHubConnection).not.toHaveBeenCalled()});

it('active Slack Manage opens the shared workspace manager rather than generic settings',async()=>{const settings=vi.fn();m.client.integrationStatus.mockResolvedValue(ok({configuration:{slack:true},github:{status:'not_connected',repositorySelection:'selected'},cloud:[],collaboration:[{provider:'slack',status:'active'}]}));m.client.listSlackChannels.mockResolvedValue(ok({workspaceId:'T123',workspaceName:'Actual Slack workspace',connectionVersion:'2030-01-01T00:00:00.000Z',channels:[]}));render(createElement(PluginsSkillsView,{canManage:true,onOpenSettings:settings,onOpenAirflow(){}}));fireEvent.click(await screen.findByRole('button',{name:'Manage'}));await screen.findByText('Actual Slack workspace');expect(settings).not.toHaveBeenCalled();expect(m.client.listSlackChannels).toHaveBeenCalledTimes(1)});

it('labels canonical Azure access read-only and manages it without enabling execution', async()=>{
 m.client.integrationStatus.mockResolvedValue(ok({github:{status:'not_connected'},cloud:[{provider:'azure',status:'read_only_connected',lastTransitionAt:null}],collaboration:[]}));
 const settings=vi.fn();render(createElement(PluginsSkillsView,{onOpenSettings:settings,onOpenAirflow(){},canManage:true}));
 const azure=await screen.findByText('Microsoft Azure');const row=azure.closest('.min-h-\\[78px\\]') ?? azure.closest("tr")!;
 expect(within(row as HTMLElement).getByText('Read-only connected')).toBeTruthy();
 expect(within(row as HTMLElement).getByText(/Agent scans and deployments remain unavailable/)).toBeTruthy();
 fireEvent.click(within(row as HTMLElement).getByRole('button',{name:'Manage'}));expect(settings).toHaveBeenCalledOnce();expect(m.client.startIntegrationConnection).not.toHaveBeenCalled();
});
it.each([['read_only_connected','Manage'],['not_connected','Connect']])('keeps AWS %s access and ECS deployment setup distinct',async(status,label)=>{
 m.client.integrationStatus.mockResolvedValue(ok({github:{status:'not_connected'},cloud:[{provider:'aws',status,lastTransitionAt:null}],collaboration:[]}));const settings=vi.fn();render(createElement(PluginsSkillsView,{onOpenSettings:settings,onOpenAirflow(){},canManage:true}));const title=await screen.findByText('AWS ECS');const row=title.closest("tr")!;
 expect(within(row).getByText(/Read-only AWS account access and EC2 metadata/)).toBeTruthy();expect(within(row).getByText(/ECS deployment requires a separately configured workflow/)).toBeTruthy();expect(within(row).queryByText(/OIDC-backed ECS deployments/)).toBeNull();if(status==='read_only_connected')expect(within(row).getByText('Read-only connected')).toBeTruthy();fireEvent.click(within(row).getByRole('button',{name:label==='Connect'?'Connect AWS':label}));expect(settings).toHaveBeenCalledOnce();expect(m.client.startIntegrationConnection).not.toHaveBeenCalled();
});

it('finds existing Outlook controls from Apps without opening consent or showing a false empty result',async()=>{show();await screen.findByText('Safe change');expect(screen.queryByText('Existing Outlook connection controls')).toBeNull();fireEvent.change(screen.getByPlaceholderText('Search apps and skills'),{target:{value:'outlook'}});expect(screen.getByRole('button',{name:'Open Outlook'})).toBeTruthy();expect(screen.queryByText('No matching capabilities')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Open Outlook'}));expect(screen.getByText('Existing Outlook connection controls')).toBeTruthy();expect(m.open).not.toHaveBeenCalled();expect(m.client.startIntegrationConnection).not.toHaveBeenCalled()});

it('groups exclusive catalogue views and app connections without granting access',async()=>{
 show();await screen.findByText('Safe change');
 expect(screen.getByRole('group',{name:'Browse capabilities'})).toBeTruthy();
 expect(screen.getByRole('group',{name:'Saved catalogue views'})).toBeTruthy();
 expect(screen.getByRole('heading',{name:'App connections'})).toBeTruthy();
 for (const [app, category] of [['GitHub','Source control'],['Slack','Collaboration'],['Linear','Work management'],['AWS ECS','Cloud delivery'],['Apache Airflow','Batch automation']]) {
  expect(within(within(screen.getByRole('region',{name:'App connections'})).getByText(app).closest('th')!).getByText(category)).toBeTruthy();
 }
 const search=screen.getByRole('searchbox',{name:'Search apps and skills'});
 fireEvent.change(search,{target:{value:'aws'}});
 expect(screen.getByText('AWS ECS')).toBeTruthy();expect(screen.queryByRole('rowheader',{name:/Collaboration/})).toBeNull();
 expect(m.client.startIntegrationConnection).not.toHaveBeenCalled();expect(m.client.updateAgentSkill).not.toHaveBeenCalled();expect(m.open).not.toHaveBeenCalled();
});


it("opens a read-only detail drawer and restores focus without starting consent or changing skills", async () => {
  show();
  const inspect = await screen.findByRole("button", {name: "Inspect Safe change"});
  fireEvent.click(inspect);
  const details = screen.getByRole("dialog", {name: "Details for Safe change"});
  expect(within(details).getByText("commit_github_file")).toBeTruthy();
  const close = within(details).getByRole("button", {name: "Close details"});
  expect(document.activeElement).toBe(close);
  expect(inspect.closest("[inert]")).toBeTruthy();
  expect(fireEvent.keyDown(close, {key: "Tab", shiftKey: true})).toBe(false);
  const panel = within(details).getByRole("tabpanel", {name: "Overview"});
  expect(document.activeElement).toBe(panel);
  expect(fireEvent.keyDown(panel, {key: "Tab"})).toBe(false);
  expect(document.activeElement).toBe(close);
  fireEvent.keyDown(details, {key: "Escape"});
  expect(document.activeElement).toBe(inspect);
  expect(screen.queryByRole("dialog", {name: "Details for Safe change"})).toBeNull();
  expect(m.client.updateAgentSkill).not.toHaveBeenCalled();
  expect(m.client.startIntegrationConnection).not.toHaveBeenCalled();
});

it("shows only a reported GitHub selection and keeps inspection read-only", async () => {
  const recordedCheck = "2026-11-20T10:00:00.000Z";
  m.client.integrationStatus.mockResolvedValue(ok({
    github: {status: "validated_read_only", repositorySelection: "selected", lastSeenAt: recordedCheck}, cloud: [], collaboration: [],
  }));
  show(false);
  await screen.findByText("Safe change");
  const inspect = screen.getByRole("button", {name: "Inspect GitHub"});
  expect(inspect.closest("tr")?.querySelector("time")?.dateTime).toBe(recordedCheck);
  expect(within(inspect.closest("tr")!).getByText("Selected repositories")).toBeTruthy();
  inspect.focus();
  const search = screen.getByRole("searchbox", {name: "Search apps and skills"});
  expect(fireEvent.keyDown(inspect, {key: "/"})).toBe(false);
  expect(document.activeElement).toBe(search);
  expect(fireEvent.keyDown(search, {key: "/"})).toBe(true);
  inspect.focus();
  fireEvent.click(inspect);
  const details = within(screen.getByRole("dialog", {name: "Details for GitHub"}));
  expect(details.getByText("Selected repositories")).toBeTruthy();
  expect(within(inspect.closest("tr")!).getByText("Read access verified").hasAttribute("data-read-verified")).toBe(true);
  expect(details.getByText("Read access verified").hasAttribute("data-read-verified")).toBe(true);
  expect(details.getByText("Authentication").nextElementSibling?.textContent).toBe("GitHub App");
  expect(details.queryByRole("button", {name: "Verify read access"})).toBeNull();
  expect(details.getByText("Recorded installation check").nextElementSibling?.querySelector("time")?.dateTime).toBe(recordedCheck);
  expect(document.activeElement).toBe(details.getByRole("button", {name: "Close details"}));
  expect(fireEvent.keyDown(details.getByRole("button", {name: "Close details"}), {key: "/"})).toBe(true);
  expect(document.activeElement).toBe(details.getByRole("button", {name: "Close details"}));
  expect(inspect.closest("tr")?.dataset.inspected).toBe("true");

  m.client.integrationStatus.mockResolvedValueOnce(ok({
    github: {status: "revoked", repositorySelection: "selected", lastSeenAt: recordedCheck}, cloud: [], collaboration: [],
  }));
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(details.queryByText("Reported repository access")).toBeNull());
  expect(details.queryByText("Recorded installation check")).toBeNull();
  expect(details.queryByText("Read access verified")).toBeNull();
  expect(details.queryByText("GitHub App")).toBeNull();
  expect(inspect.closest("tr")?.querySelector("time")).toBeNull();
  fireEvent.click(details.getByRole("button", {name: "Close details"}));
  expect(document.activeElement).toBe(inspect);
  expect(inspect.closest("tr")?.dataset.inspected).toBe("false");
  expect(m.client.updateAgentSkill).not.toHaveBeenCalled();
  expect(m.client.startIntegrationConnection).not.toHaveBeenCalled();
});

it("requires a recorded GitHub check time for the verified cue", async () => {
  m.client.integrationStatus.mockResolvedValue(ok({
    github: {status: "validated_read_only", repositorySelection: "selected", lastSeenAt: null},
    cloud: [], collaboration: [],
  }));
  show(false);
  await screen.findByText("Read check unconfirmed");
  const inspect = screen.getByRole("button", {name: "Inspect GitHub"});
  expect(within(inspect.closest("tr")!).getByText("Read check unconfirmed").getAttribute("data-connected")).toBe("false");
  fireEvent.click(inspect);
  const details = within(screen.getByRole("dialog", {name: "Details for GitHub"}));
  expect(details.getByText("Read check unconfirmed").hasAttribute("data-read-verified")).toBe(false);
  expect(details.getByText("Selected repositories")).toBeTruthy();
});

it("keeps catalogue and inspector status consistent and exposes only recorded timestamps", async () => {
  const validated = "2026-11-20T10:00:00.000Z";
  const installed = "2026-11-19T10:00:00.000Z";
  m.client.integrationStatus.mockResolvedValue(ok({
    configuration: {github: true, slack: true, teams: false, linear: false},
    github: {status: "active", repositorySelection: "selected"},
    cloud: [
      {provider: "aws", status: "read_only_connected", lastTransitionAt: validated},
      {provider: "gcp", status: "read_only_connected", lastTransitionAt: "2026-02-30T10:00:00Z"},
    ],
    collaboration: [{provider: "slack", status: "active", lastValidatedAt: validated}],
  }));
  m.client.listAgentSkills.mockResolvedValue(ok({
    skills: [{...skill, status: "enabled", installedAt: installed, updatedAt: "2026-02-30T10:00:00Z"}],
    storageAvailable: true,
  }));
  show(false);
  await screen.findByText("Safe change");
  fireEvent.click(screen.getByRole("button", {name: "Inspect Slack"}));
  const connector = screen.getByRole("dialog");
  expect(within(connector).getByText("Reported status").nextElementSibling?.textContent).toBe("active");
  expect(connector.querySelector("time")?.dateTime).toBe(validated);
  fireEvent.click(within(connector).getByRole("button", {name: "Close details"}));
  fireEvent.click(screen.getByRole("button", {name: "Inspect AWS ECS"}));
  const aws = screen.getByRole("dialog");
  expect(within(aws).getByText("Reported status").nextElementSibling?.textContent).toBe("Read-only connected");
  expect(within(aws).getByText("Recorded validation").nextElementSibling?.querySelector("time")?.dateTime).toBe(validated);
  fireEvent.click(within(aws).getByRole("button", {name: "Close details"}));
  fireEvent.click(screen.getByRole("button", {name: "Inspect Google Cloud"}));
  const gcp = screen.getByRole("dialog");
  expect(within(gcp).getByText("Recorded validation").nextElementSibling?.textContent).toBe("Unavailable");
  expect(gcp.querySelector("time")).toBeNull();
  fireEvent.click(within(gcp).getByRole("button", {name: "Close details"}));
  fireEvent.click(screen.getByRole("button", {name: "Inspect Microsoft Teams"}));
  const teams = screen.getByRole("dialog");
  expect(within(teams).getByText("admin setup required")).toBeTruthy();
  expect(teams.querySelector("time")).toBeNull();
  fireEvent.click(within(teams).getByRole("button", {name: "Close details"}));
  fireEvent.click(screen.getByRole("button", {name: "Inspect Safe change"}));
  const installedSkill = screen.getByRole("dialog");
  expect(installedSkill.querySelector("time")?.dateTime).toBe(installed);
  expect(within(installedSkill).getByText("Recorded update").nextElementSibling?.textContent).toBe("Unavailable");
  expect(within(installedSkill).getByRole("region", {name: "Execution boundary"})).toBeTruthy();
  expect(m.client.startIntegrationConnection).not.toHaveBeenCalled();
  expect(m.client.updateAgentSkill).not.toHaveBeenCalled();
});

it("withholds consent and incomplete totals when connector records cannot be verified", async () => {
  const configuration = {github: true, slack: true, teams: true, linear: false};
  const unavailable = {status:"unavailable", lastValidatedAt:null};
  m.client.integrationStatus.mockResolvedValueOnce(ok({
    configuration, github: {status:"unavailable", repositorySelection:"unknown"},
    cloud: [{provider:"aws",status:"unavailable"}],
    collaboration: ["slack","teams","linear"].map(provider => ({provider,...unavailable})),
  })).mockResolvedValueOnce(ok({
    configuration, github: {status:"not_connected", repositorySelection:"unknown"},
    cloud: [{provider:"aws",status:"not_connected"}], collaboration: [],
  }));
  show();
  const git = (await screen.findByText("GitHub")).closest("tr")!;
  await within(git).findByText("Status unavailable");
  expect(within(git).queryByRole("button",{name:"Connect ↗"})).toBeNull();
  const linear = screen.getByText("Linear").closest("tr")!;
  expect(within(linear).getByText("Status unavailable")).toBeTruthy();
  for (const label of ["Connected catalogue apps","Read-only cloud connections","Overdue validations"]) {
    expect(screen.getByText(label).nextElementSibling?.textContent).toContain("Unavailable");
  }
  fireEvent.click(within(git).getByRole("button",{name:"Inspect GitHub"}));
  const details=screen.getByRole("dialog");
  expect(within(details).getByText("Status unavailable")).toBeTruthy();
  fireEvent.click(within(details).getByRole("button",{name:"Close details"}));
  const refresh=screen.getByRole("button",{name:"Refresh capabilities"});
  refresh.focus();
  fireEvent.click(refresh);
  expect(await within(git).findByRole("button",{name:"Connect ↗"})).toBeTruthy();
  expect(document.activeElement).toBe(refresh);
  expect(m.client.startIntegrationConnection).not.toHaveBeenCalled();
});

it("shows an unknown installation in the row and inspector until storage is verified", async () => {
  m.client.listAgentSkills.mockResolvedValueOnce(ok({skills: [skill], storageAvailable: false}));
  show();
  const row = (await screen.findByText("Safe change")).closest("tr")!;
  expect(within(row).getByText("Unknown")).toBeTruthy();
  expect(within(row).queryByRole("button", {name: "Add"})).toBeNull();
  fireEvent.click(within(row).getByRole("button", {name: "Inspect Safe change"}));
  expect(within(screen.getByRole("dialog")).getByText("Unknown")).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("dialog"), {key: "Escape"});
  fireEvent.click(screen.getByRole("button", {name: "Refresh capabilities"}));
  await screen.findByRole("button", {name: "Add"});
  expect(m.client.updateAgentSkill).not.toHaveBeenCalled();
});

it("refreshes a conflict without replaying the stale action", async () => {
  m.client.updateAgentSkill.mockResolvedValueOnce({ok: false, error: "skill_state_changed"});
  show();
  fireEvent.click(await screen.findByRole("button", {name: "Add"}));
  await screen.findByText(/Skill state changed/);
  const refresh = screen.getByRole("button", {name: "Refresh capabilities"});
  expect(document.activeElement).toBe(refresh);
  expect(screen.queryByRole("button", {name: "Add"})).toBeNull();
  m.client.listAgentSkills.mockResolvedValueOnce(ok({skills: [{...skill, status: "enabled"}], storageAvailable: true}));
  fireEvent.click(refresh);
  await screen.findByRole("button", {name: "Disable"});
  expect(screen.queryByText(/Skill state changed/)).toBeNull();
  expect(m.client.updateAgentSkill).toHaveBeenCalledTimes(1);
});

it.each([true, false])("opens connection settings from GitHub inspection only for managers (%s)", async canManage => {
  m.client.integrationStatus.mockResolvedValue(ok({
    configuration: {github: true}, github: {status: "installation_recorded", repositorySelection: "selected"},
    cloud: [], collaboration: [],
  }));
  const openSettings = vi.fn();
  render(createElement(PluginsSkillsView, {onOpenSettings: openSettings, onOpenAirflow() {}, canManage}));
  await screen.findByText("Selected repositories");
  const inspect = screen.getByRole("button", {name: "Inspect GitHub"});
  fireEvent.click(inspect);
  const details = within(screen.getByRole("dialog", {name: "Details for GitHub"}));
  const configure = details.queryByRole("button", {name: "Configure GitHub connection"});
  if (canManage) {
    expect(configure).not.toBeNull();
    fireEvent.click(configure!);
  } else {
    expect(configure).toBeNull();
  }
  expect(openSettings).toHaveBeenCalledTimes(canManage ? 1 : 0);
  expect(m.client.validateGitHubReadOnly).not.toHaveBeenCalled();
  expect(m.client.startIntegrationConnection).not.toHaveBeenCalled();
  fireEvent.click(details.getByRole("button", {name: "Close details"}));
  expect(document.activeElement).toBe(inspect);
});

it("checks GitHub from the inspector once, keeps focus and announces the result", async () => {
  const recordedCheck = "2026-11-20T10:01:00.000Z";
  m.client.integrationStatus.mockResolvedValue(ok({
    configuration: {github: true}, github: {status: "installation_recorded", repositorySelection: "selected"},
    cloud: [], collaboration: [],
  }));
  const pending = deferred();
  m.client.validateGitHubReadOnly.mockReturnValueOnce(pending.promise);
  show();
  await screen.findByText("Selected repositories");
  const inspect = screen.getByRole("button", {name: "Inspect GitHub"});
  fireEvent.click(inspect);
  const details = within(screen.getByRole("dialog", {name: "Details for GitHub"}));
  const verify = details.getByRole("button", {name: "Verify read access"});
  expect(m.client.validateGitHubReadOnly).not.toHaveBeenCalled();
  verify.focus();
  fireEvent.click(verify);
  fireEvent.click(verify);
  expect(m.client.validateGitHubReadOnly).toHaveBeenCalledTimes(1);
  expect(verify.getAttribute("aria-disabled")).toBe("true");
  expect(details.getByRole("button", {name: "Configure GitHub connection"}).getAttribute("aria-disabled")).toBe("true");
  m.client.integrationStatus.mockResolvedValue(ok({
    configuration: {github: true}, github: {status: "validated_read_only", repositorySelection: "selected", lastSeenAt: recordedCheck},
    cloud: [], collaboration: [],
  }));
  await act(async () => pending.resolve(ok({status: "validated_read_only"})));
  expect(details.getByRole("status").textContent).toBe("GitHub read access is verified for this workspace.");
  expect(details.getByText("Recorded installation check").nextElementSibling?.querySelector("time")?.dateTime).toBe(recordedCheck);
  expect(document.activeElement).toBe(verify);
  m.client.integrationStatus.mockResolvedValue(ok({
    configuration: {github: true}, github: {status: "revoked", repositorySelection: "selected"},
    cloud: [], collaboration: [],
  }));
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(verify.getAttribute("aria-disabled")).toBe("true"));
  expect(details.queryByText("GitHub App")).toBeNull();
  expect(details.getByRole("status").textContent).toBe("GitHub access is revoked.");
  m.client.integrationStatus.mockResolvedValueOnce({ok: false, error: "unavailable"});
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(details.getByRole("status").textContent).toBe("Current GitHub read access is unconfirmed."));
  expect(document.activeElement).toBe(verify);
  fireEvent.click(verify);
  expect(m.client.validateGitHubReadOnly).toHaveBeenCalledTimes(1);
  fireEvent.click(details.getByRole("button", {name: "Close details"}));
  expect(document.activeElement).toBe(inspect);
  expect(m.client.startIntegrationConnection).not.toHaveBeenCalled();
});

it("navigates reported scope and recorded activity without starting a provider action", async () => {
  const at = "2026-11-20T10:00:00.000Z";
  m.client.integrationStatus.mockResolvedValue(ok({
    github: {status: "validated_read_only", repositorySelection: "selected", lastSeenAt: at}, cloud: [], collaboration: [],
  }));
  show();
  await screen.findByText("Selected repositories");
  const inspect = screen.getByRole("button", {name: "Inspect GitHub"});
  fireEvent.click(inspect);
  const details = within(screen.getByRole("dialog", {name: "Details for GitHub"}));
  const overview = details.getByRole("tab", {name: "Overview"});
  overview.focus();
  fireEvent.keyDown(overview, {key: "ArrowRight"});
  const permissions = details.getByRole("tab", {name: "Permissions"});
  expect(document.activeElement).toBe(permissions);
  expect(within(details.getByRole("tabpanel", {name: "Permissions"})).getByText("Selected repositories")).toBeTruthy();
  expect(details.getByRole("region", {name: "Execution boundary"})).toBeTruthy();

  fireEvent.keyDown(permissions, {key: "End"});
  const activity = details.getByRole("tab", {name: "Activity"});
  expect(document.activeElement).toBe(activity);
  expect(details.getByRole("tabpanel", {name: "Activity"}).querySelector("time")?.dateTime).toBe(at);
  expect(m.client.validateGitHubReadOnly).not.toHaveBeenCalled();
  expect(m.client.startIntegrationConnection).not.toHaveBeenCalled();
  fireEvent.keyDown(activity, {key: "Escape"});
  expect(document.activeElement).toBe(inspect);
});
