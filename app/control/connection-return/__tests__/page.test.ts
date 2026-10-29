import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.context }));
beforeEach(() => m.context.mockResolvedValue({ isAuthenticated: true, organizationId: "workspace" }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(url); } }));
import Page from "../page";
const notices = [
  ["consent_recorded", "Jira consent recorded"], ["declined", "Jira setup was cancelled"],
  ["exchange_failed", "Jira setup could not be completed"], ["record_failed", "Jira consent could not be recorded"],
  ["unavailable", "Jira setup is unavailable"], ["invalid_state", "Jira setup link is no longer valid"],
  ["authorization_required", "Jira setup requires workspace authorization"], ["connection_exists", "A Jira connection already exists"],
];
it.each(notices)("surfaces Jira %s", async (status, title) => {
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ integration: "jira", status }) }));
  expect(html).toContain('role="status"'); expect(html).toContain(title);
  expect(html).not.toContain("Jira is active");
});
it("ignores unknown Jira status text", async () => {
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ integration: "jira", status: "PRIVATE_CALLBACK_TEXT" }) }));
  expect(html).not.toContain("PRIVATE_CALLBACK_TEXT"); expect(html).not.toContain('role="status"');
});
it.each(["github", "slack", "teams", "linear"])("preserves %s notices", async integration => {
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ integration, status: integration === "github" ? "installation_recorded" : "consent_recorded" }) }));
  expect(html).toContain('role="status"'); expect(html).not.toContain("Jira consent recorded");
});

it.each(notices)("preserves Jira %s across sign-in", async status => {
  m.context.mockResolvedValue({ isAuthenticated: false });
  const callback = `/auth/success?integration=jira&status=${status}`;
  await expect(Page({ searchParams: Promise.resolve({ integration: "jira", status }) })).rejects.toThrow(`/auth/signin?${new URLSearchParams({ callbackUrl: callback })}`);
});
it.each([
  { integration: "jira", status: "https://attacker.invalid/PRIVATE", callbackUrl: "https://attacker.invalid", code: "PRIVATE_CODE", state: "PRIVATE_STATE" },
  { integration: "jira", status: ["declined", "consent_recorded"] },
])("forwards only validated values through sign-in %#", async params => {
  m.context.mockResolvedValue({ isAuthenticated: false });
  await expect(Page({ searchParams: Promise.resolve(params) })).rejects.toThrow(`/auth/signin?${new URLSearchParams({ callbackUrl: "/auth/success?integration=jira" })}`);
});
it("rejects duplicate integrations before rendering notices", async () => {
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ integration: ["jira", "slack"], status: "consent_recorded" }) }));
  expect(html).not.toContain('role="status"');
});
const recoveryStates=[['authorization_required','setup needs workspace authorization'],['exchange_outcome_unknown','provider exchange could not be confirmed'],['record_outcome_unknown','connection save could not be confirmed'],['connection_changed','connection changed during setup']];
it.each(['slack','teams','linear'].flatMap(integration=>recoveryStates.map(([status,title])=>({integration,status,title}))))('shows truthful fixed callback recovery $integration/$status',async({integration,status,title})=>{const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({integration,status})}));expect(html).toContain(title);expect(html).toContain('role="status"');expect(html).not.toContain('No connection was recorded');expect(html).not.toContain('not configured');expect(html).not.toContain('try again');expect(html).toContain('connection status')});
it.each(['slack','teams','linear'].flatMap(integration=>recoveryStates.map(([status])=>({integration,status}))))('retains safe recovery outcome through login $integration/$status',async params=>{m.context.mockResolvedValue({isAuthenticated:false});await expect(Page({searchParams:Promise.resolve(params)})).rejects.toThrow(`/auth/signin?${new URLSearchParams({callbackUrl:'/auth/success?'+new URLSearchParams(params)})}`)});
it.each(['slack','teams','linear'])('never forwards private unknown callback details for %s',async integration=>{const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({integration,status:'PRIVATE_PROVIDER_TOKEN'})}));expect(html).not.toContain('PRIVATE_PROVIDER_TOKEN');expect(html).not.toContain('role="status"')});

it.each(['slack','teams','linear'])('legacy record failure does not falsely deny an existing saved connection for %s',async integration=>{const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({integration,status:'record_failed'})}));expect(html).toContain('reload connection status');expect(html).not.toContain('No connection was recorded');expect(html).not.toContain('try again')});
