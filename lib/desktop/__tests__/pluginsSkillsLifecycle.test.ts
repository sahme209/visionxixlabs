/** @vitest-environment jsdom */
import {createElement} from "react";
import {act, cleanup, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {afterEach, beforeEach, expect, it, vi} from "vitest";
const m = vi.hoisted(() => ({open: vi.fn(), listeners: new Set<() => void>(), revision: 0, client: {config: {}, subscribeContext: (fn: () => void) => {m.listeners.add(fn); return () => {m.listeners.delete(fn);};}, getContextRevision: () => m.revision, listAgentSkills: vi.fn(), integrationStatus: vi.fn(), airflowConnection: vi.fn(), updateAgentSkill: vi.fn(), startIntegrationConnection: vi.fn(), listSlackChannels:vi.fn(),validateGitHubReadOnly: vi.fn(), verifyExistingGitHubConnection:vi.fn(),confirmExistingGitHubConnection:vi.fn(),reloadGitHubReconnectStatus:vi.fn(),githubReconnectNeedsReload:()=>false}}));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({desktopClient: m.client}));
vi.mock("@tauri-apps/plugin-shell", () => ({open: m.open}));
import {PluginsSkillsView} from "../../../desktop/src/views/PluginsSkillsView";
const skill = {id: "safe-change", name: "Safe change", description: "Existing governed workflow", category: "GitHub", toolNames: ["read_github_file", "commit_github_file"], status: "not_installed", installedAt: null, updatedAt: null};
const ok = (data: unknown) => ({ok: true, data});
function deferred() {let resolve!: (value: unknown) => void; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};}
function show(canManage = true) {return render(createElement(PluginsSkillsView, {onOpenSettings() {}, onOpenAirflow() {}, canManage}));}
function changeContext() {m.client.config = {}; m.revision++; for (const fn of m.listeners) fn();}
beforeEach(() => {vi.resetAllMocks(); m.client.config = {}; m.revision++; m.client.listAgentSkills.mockResolvedValue(ok({skills: [skill], storageAvailable: true})); m.client.integrationStatus.mockResolvedValue(ok({configuration: {github: true, slack: false, teams: false, linear: false}, github: {status: "not_connected", repositorySelection: "selected"}, cloud: [], collaboration: []})); m.client.airflowConnection.mockResolvedValue(ok({status: "not_connected"}));});
afterEach(cleanup);
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
  await waitFor(() => expect(within(screen.getByText("Apache Airflow").parentElement!).getByText("connected")).toBeTruthy());
  await act(async () => {inventory.resolve(ok({configuration: {}, github: {status: "not_connected"}, cloud: [], collaboration: []}));});
});
it("shows existing Azure and GCP inventory and opens settings without starting provider consent", async () => {
  const onOpenSettings = vi.fn();
  m.client.integrationStatus.mockResolvedValue(ok({configuration: {github: true, slack: false, teams: false, linear: false}, github: {status: "not_connected"}, cloud: [{provider: "azure", status: "connected", lastTransitionAt: null}, {provider: "gcp", status: "not_connected", lastTransitionAt: null}], collaboration: []}));
  render(createElement(PluginsSkillsView, {onOpenSettings, onOpenAirflow() {}, canManage: false}));
  const azure = await screen.findByText("Microsoft Azure");
  const gcp = screen.getByText("Google Cloud");
  await waitFor(() => expect(within(azure.parentElement!).getByText("connected")).toBeTruthy());
  expect(within(gcp.parentElement!).getByText("not connected")).toBeTruthy();
  const card = azure.parentElement!.parentElement!.parentElement!;
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
it('reviews actual verified GitHub account before explicit reconnect and holds unknown until status reload',async()=>{revoked();m.client.confirmExistingGitHubConnection.mockResolvedValue({ok:false});show();fireEvent.click(await screen.findByRole('button',{name:'Connect',exact:true}));await screen.findByText(/Verified account: verified-team/);expect(m.client.confirmExistingGitHubConnection).not.toHaveBeenCalled();fireEvent.click(screen.getByText('Reconnect verified installation'));await screen.findByText('Reload GitHub status');expect(m.client.confirmExistingGitHubConnection).toHaveBeenCalledWith(reconnectChallenge.challengeId,expect.any(AbortSignal));expect(screen.queryByRole('button',{name:'Connect',exact:true})).toBeNull();m.client.reloadGitHubReconnectStatus.mockResolvedValue(ok({github:{status:'revoked',repositorySelection:'selected'},cloud:[],collaboration:[]}));fireEvent.click(screen.getByText('Reload GitHub status'));await screen.findByRole('button',{name:'Connect',exact:true});expect(m.client.confirmExistingGitHubConnection).toHaveBeenCalledTimes(1)});
it('never exposes reconnect recovery to nonmanaging members',async()=>{revoked();show(false);await screen.findByText('Safe change');expect(screen.queryByRole('button',{name:'Connect',exact:true})).toBeNull();expect(m.client.verifyExistingGitHubConnection).not.toHaveBeenCalled()});
it('discards late verified account after context changes',async()=>{revoked();const old=deferred();m.client.verifyExistingGitHubConnection.mockReturnValueOnce(old.promise);show();fireEvent.click(await screen.findByRole('button',{name:'Connect',exact:true}));await act(async()=>changeContext());await act(async()=>old.resolve(ok(reconnectChallenge)));expect(screen.queryByText(/Verified account:/)).toBeNull();expect(m.client.confirmExistingGitHubConnection).not.toHaveBeenCalled()});

it('uses one primary Connect action and shows pending state without auto confirmation',async()=>{revoked();const old=deferred();m.client.verifyExistingGitHubConnection.mockReturnValueOnce(old.promise);show();const connect=await screen.findByRole('button',{name:'Connect',exact:true});expect(screen.queryByText('Verify existing connection')).toBeNull();expect(screen.getByText('Connect in browser ↗').closest('details')?.open).toBe(false);fireEvent.click(connect);expect(await screen.findByRole('button',{name:'Connecting…'})).toBeTruthy();expect(m.client.confirmExistingGitHubConnection).not.toHaveBeenCalled();await act(async()=>old.resolve(ok(reconnectChallenge)));await screen.findByText(/Verified account: verified-team/);expect(m.client.confirmExistingGitHubConnection).not.toHaveBeenCalled()});

it('active Slack Manage opens the shared workspace manager rather than generic settings',async()=>{const settings=vi.fn();m.client.integrationStatus.mockResolvedValue(ok({configuration:{slack:true},github:{status:'not_connected',repositorySelection:'selected'},cloud:[],collaboration:[{provider:'slack',status:'active'}]}));m.client.listSlackChannels.mockResolvedValue(ok({workspaceId:'T123',workspaceName:'Actual Slack workspace',connectionVersion:'2030-01-01T00:00:00.000Z',channels:[]}));render(createElement(PluginsSkillsView,{canManage:true,onOpenSettings:settings,onOpenAirflow(){}}));fireEvent.click(await screen.findByRole('button',{name:'Manage',exact:true}));await screen.findByText('Actual Slack workspace');expect(settings).not.toHaveBeenCalled();expect(m.client.listSlackChannels).toHaveBeenCalledTimes(1)});

it('labels canonical Azure access read-only and manages it without enabling execution', async()=>{
 m.client.integrationStatus.mockResolvedValue(ok({github:{status:'not_connected'},cloud:[{provider:'azure',status:'read_only_connected',lastTransitionAt:null}],collaboration:[]}));
 const settings=vi.fn();render(createElement(PluginsSkillsView,{onOpenSettings:settings,onOpenAirflow(){},canManage:true}));
 const azure=await screen.findByText('Microsoft Azure');const row=azure.closest('.min-h-\\[78px\\]') ?? azure.parentElement!.parentElement!.parentElement!;
 expect(within(row as HTMLElement).getByText('Read-only connected')).toBeTruthy();
 expect(within(row as HTMLElement).getByText(/Agent scans and deployments remain unavailable/)).toBeTruthy();
 fireEvent.click(within(row as HTMLElement).getByRole('button',{name:'Manage'}));expect(settings).toHaveBeenCalledOnce();expect(m.client.startIntegrationConnection).not.toHaveBeenCalled();
});
it.each([['read_only_connected','Manage'],['not_connected','Connect']])('keeps AWS %s access and ECS deployment setup distinct',async(status,label)=>{
 m.client.integrationStatus.mockResolvedValue(ok({github:{status:'not_connected'},cloud:[{provider:'aws',status,lastTransitionAt:null}],collaboration:[]}));const settings=vi.fn();render(createElement(PluginsSkillsView,{onOpenSettings:settings,onOpenAirflow(){},canManage:true}));const title=await screen.findByText('AWS ECS');const row=title.parentElement!.parentElement!.parentElement!;
 expect(within(row).getByText(/Read-only AWS account access and EC2 metadata/)).toBeTruthy();expect(within(row).getByText(/ECS deployment requires a separately configured workflow/)).toBeTruthy();expect(within(row).queryByText(/OIDC-backed ECS deployments/)).toBeNull();if(status==='read_only_connected')expect(within(row).getByText('Read-only connected')).toBeTruthy();fireEvent.click(within(row).getByRole('button',{name:label==='Connect'?'Connect AWS':label,exact:true}));expect(settings).toHaveBeenCalledOnce();expect(m.client.startIntegrationConnection).not.toHaveBeenCalled();
});
