import {beforeEach,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({context:vi.fn(),callback:vi.fn()}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:m.context}));vi.mock('../runtime',()=>({gcpGuided:{callback:m.callback}}));
import {GET} from '@/app/api/integrations/gcp-cloud/callback/route';
const actor={isAuthenticated:true,userId:'user',sessionUserId:'user',organizationId:'org',roles:['admin']};
const request=(query='state='+'s'.repeat(64)+'&code=synthetic-code',origin='https://visionxixlabs.com')=>new NextRequest(origin+'/api/integrations/gcp-cloud/callback?'+query);
beforeEach(()=>{vi.resetAllMocks();m.context.mockResolvedValue(actor);m.callback.mockResolvedValue({attemptId:'owned'})});
it('binds callback to verified browser and returns no state/code in response',async()=>{const r=await GET(request());expect(r.status).toBe(303);expect(r.headers.get('location')).toBe('https://visionxixlabs.com/desktop/cloud/return');const text=await r.text();expect(text).not.toContain('synthetic-code');expect(text).not.toContain('s'.repeat(64));expect(m.callback.mock.calls[0][0].browser).toEqual({organizationId:'org',userId:'user'});expect(r.headers.get('referrer-policy')).toBe('no-referrer')});
it('rechecks current browser identity from the trusted service',async()=>{m.callback.mockImplementation(async input=>{m.context.mockResolvedValue({...actor,userId:'other',sessionUserId:'other'});await input.assertBrowser()});expect((await GET(request())).status).toBe(303)});
it.each(['state=x&code=a&code=b','state=a&state=b&code=x','state=x&error=access_denied'])('never exchanges malformed/declined callback %s',async q=>{expect((await GET(request(q))).status).toBe(303);expect(m.callback).not.toHaveBeenCalled()});
it('refuses untrusted callback origin without consuming state',async()=>{expect((await GET(request(undefined,'https://attacker.invalid'))).status).toBe(303);expect(m.callback).not.toHaveBeenCalled()});
it('refuses legacy email fallback browser identity',async()=>{m.context.mockResolvedValue({...actor,sessionUserId:undefined});expect((await GET(request())).status).toBe(303);expect(m.callback).not.toHaveBeenCalled()});

it('uses the same data-free app handoff on uncertain outcome',async()=>{m.callback.mockRejectedValue(new Error('private_provider_detail'));const r=await GET(request());expect(r.status).toBe(303);expect(r.headers.get('location')).toBe('https://visionxixlabs.com/desktop/cloud/return');expect(await r.text()).not.toContain('private_provider_detail')});
