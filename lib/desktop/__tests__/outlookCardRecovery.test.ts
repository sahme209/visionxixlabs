/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {act,cleanup,render,screen,fireEvent} from '@testing-library/react';
const f=vi.hoisted(()=>({read:vi.fn(), config: {}, revision: 0, listeners: new Set<() => void>()}));
vi.mock('../../../desktop/src/lib/outlookTransport',()=>({outlookRequest:f.read}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{get config(){return f.config},getContextRevision:()=>f.revision,subscribeContext:(listener:()=>void)=>{f.listeners.add(listener);return()=>f.listeners.delete(listener)}}}));
vi.mock('../../../desktop/src/components/OutlookActionsPanel',()=>({OutlookActionsPanel:()=>null}));
vi.mock('@tauri-apps/plugin-shell',()=>({open:vi.fn()}));
import {OutlookIntegrationCard} from '../../../desktop/src/components/OutlookIntegrationCard';
afterEach(() => { cleanup(); f.read.mockReset(); f.config = {}; f.revision = 0; });
it('recovers from an unexpected rejected transport without leaking details or an unhandled rejection',async()=>{f.read.mockRejectedValueOnce(Error('PRIVATE credential')).mockResolvedValueOnce({ok:true,data:{state:'not_connected'}});render(createElement(OutlookIntegrationCard));expect((await screen.findByRole('alert')).textContent).toContain('Outlook status could not be verified. Refresh status to try again.');expect(screen.queryByText('PRIVATE credential')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Refresh status'}));expect(await screen.findByText('Not connected')).toBeTruthy();expect(f.read).toHaveBeenCalledTimes(2)});

const stamp = "2026-11-23T00:00:00Z";
const account = { id: "account", email: "fixture@example.test", displayName: "Fixture account" };
const binding = { organizationId: "workspace", connectionId: "connection", connectionRevision: stamp, accountId: account.id, consentedByUserId: "owner" };
const status = { state: "connected", account, binding, expiresAt: stamp, actionConsent: false };
const mailbox = { account, binding, observedAt: stamp, mail: {messages: [{id: "message", subject: "Scoped subject", from: null}], truncated: false}, calendar: {events: [], truncated:false} };

it("requires a fresh status after the displayed Outlook connection has rotated", async () => {
  f.read.mockResolvedValueOnce({ok:true,data:status})
    .mockResolvedValueOnce({ok:true,data:{...mailbox,binding:{...binding,connectionRevision:"2026-11-24T00:00:00Z"}}});
  render(createElement(OutlookIntegrationCard));
  fireEvent.click(await screen.findByRole("button", {name: "Read mailbox context"}));
  expect(f.read.mock.calls[1][1]).toMatchObject({
    connectionId: binding.connectionId, connectionRevision: binding.connectionRevision,
  });
  expect((await screen.findByRole("alert")).textContent).toContain("The Outlook connection changed");
  expect(screen.queryByText(/Scoped subject/)).toBeNull();
  expect(screen.queryByRole("button",{name:"Read mailbox context"})).toBeNull();
});

it("clears mailbox state and aborts pending reads while loading the new workspace status", async () => {
  let complete!: (result: unknown) => void;
  f.read.mockResolvedValueOnce({ok:true,data:status}).mockResolvedValueOnce({ok:true,data:mailbox})
    .mockReturnValueOnce(new Promise(resolve => { complete = resolve; }))
    .mockResolvedValueOnce({ok:true,data:{state:"owner_only"}});
  render(createElement(OutlookIntegrationCard));
  const read = await screen.findByRole("button",{name:"Read mailbox context"});
  fireEvent.click(read);
  expect(await screen.findByText(/Scoped subject/)).toBeTruthy();
  fireEvent.click(read);
  const signal = f.read.mock.calls[2][2] as AbortSignal;
  await act(async () => {
    f.config = {};
    f.revision++;
    f.listeners.forEach(listener => listener());
  });
  expect(signal.aborted).toBe(true);
  expect(await screen.findByText("Available to the mailbox owner")).toBeTruthy();
  await act(async () => complete({ok:true,data:mailbox}));
  expect(screen.queryByText(/Scoped subject|fixture@example.test/)).toBeNull();
  expect(f.read.mock.calls[3][1]).toBeUndefined();
});
