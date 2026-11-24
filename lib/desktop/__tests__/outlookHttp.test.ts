import {it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {createOutlookDesktopHttp} from '../outlookHttp';
const session={id:'paired',organizationId:'org',userId:'owner',credentialKind:'desktop_session'};
it('refuses API-key and browser-cookie principals before creating the runtime',async()=>{const runtime=vi.fn();const h=createOutlookDesktopHttp({resolve:async()=>({...session,credentialKind:'api_key'}),configured:()=>true,runtime});expect((await h(new NextRequest('https://visionxixlabs.com/api/desktop/integrations/outlook'))).status).toBe(401);expect(runtime).not.toHaveBeenCalled()});
it('shows not configured without manufacturing a connection or accessing Microsoft',async()=>{const runtime=vi.fn();const h=createOutlookDesktopHttp({resolve:async()=>session,configured:()=>false,runtime});expect(await(await h(new NextRequest('https://visionxixlabs.com/api/desktop/integrations/outlook'))).json()).toEqual({ok:true,data:{state:'not_configured'}});expect(runtime).not.toHaveBeenCalled()});
it('refuses malformed or excessive calendar windows before reading the mailbox',async()=>{const read=vi.fn();const h=createOutlookDesktopHttp({resolve:async()=>session,configured:()=>true,runtime:()=>({status:async()=>({state:'not_connected'}),read})});expect((await h(new NextRequest('https://visionxixlabs.com/api/desktop/integrations/outlook?start=2030-01-01T00:00:00Z&end=2031-01-01T00:00:00Z'))).status).toBe(409);expect(read).not.toHaveBeenCalled()});
it('withholds a response when the paired user changes during the request',async()=>{const resolve=vi.fn().mockResolvedValueOnce(session).mockResolvedValue({...session,userId:'different'});const h=createOutlookDesktopHttp({resolve,configured:()=>true,runtime:()=>({status:async()=>({state:'not_connected'}),read:vi.fn()})});const r=await h(new NextRequest('https://visionxixlabs.com/api/desktop/integrations/outlook'));expect(r.status).toBe(409);expect(await r.json()).toEqual({ok:false,error:'outlook_authorization_required'})});

it('passes the complete selected target and preserves the legacy range request', async () => {
  const read = vi.fn().mockRejectedValue(Error('outlook_connection_changed'));
  const handler = createOutlookDesktopHttp({
    resolve: async () => session,
    configured: () => true,
    runtime: () => ({ status: async () => ({ state: 'not_connected' }), read }),
  });
  const range = { start: '2026-11-24T00:00:00.000Z', end: '2026-11-27T00:00:00.000Z' };
  const target = { connectionId: 'selected-connection', connectionRevision: range.start };
  const url = 'https://visionxixlabs.com/api/desktop/integrations/outlook?';
  const response = await handler(new NextRequest(url + new URLSearchParams({ ...range, ...target })));
  expect(await response.json()).toEqual({ ok: false, error: 'outlook_connection_changed' });
  expect(read).toHaveBeenLastCalledWith({ organizationId: 'org', actorUserId: 'owner', sessionId: 'paired' },
    range, expect.any(AbortSignal), target);
  await handler(new NextRequest(url + new URLSearchParams(range)));
  expect(read).toHaveBeenLastCalledWith(expect.any(Object), range, expect.any(AbortSignal), undefined);
  await handler(new NextRequest(url + new URLSearchParams({ ...range, connectionId: target.connectionId })));
  expect(read).toHaveBeenCalledTimes(2);
});
