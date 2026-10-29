import {beforeEach,it,expect,vi} from 'vitest';
import {NextRequest,NextResponse} from 'next/server';
const m=vi.hoisted(()=>({principal:vi.fn(),start:vi.fn(),status:vi.fn(),complete:vi.fn(),cancel:vi.fn()}));
vi.mock('../runtime',()=>({guidedPrincipal:m.principal,gcpGuided:m,guidedReply:(data:unknown)=>NextResponse.json({ok:true,data}),guidedFailure:()=>NextResponse.json({ok:false,error:'gcp_guided_unavailable'},{status:503})}));
import {guidedHttp} from '../http';
const id='11111111-1111-4111-8111-111111111111',p={organizationId:'org',userId:'user',sessionId:'session'};
beforeEach(()=>{vi.resetAllMocks();m.principal.mockResolvedValue(p);m.status.mockResolvedValue({status:'not_connected'});m.start.mockResolvedValue({attemptId:id});m.complete.mockResolvedValue({status:'connected_read_only'});m.cancel.mockResolvedValue(undefined)});
const post=(action:string,body:unknown)=>new NextRequest(`https://visionxixlabs.com/api/desktop/cloud/gcp/guided/${action}`,{method:'POST',body:JSON.stringify(body)});
it('status resumes latest exact paired owner without client-supplied identity',async()=>{const r=await guidedHttp(new NextRequest('https://visionxixlabs.com/api/desktop/cloud/gcp/guided/status'),'status');expect(r.status).toBe(200);expect(m.status).toHaveBeenCalledWith(p,undefined)});
it('explicit saved attempt status is bound to current owner',async()=>{await guidedHttp(new NextRequest('https://visionxixlabs.com/api/desktop/cloud/gcp/guided/status?attemptId='+id),'status');expect(m.status).toHaveBeenCalledWith(p,id)});
it.each(['?attemptId='+id+'&attemptId='+id,'?organizationId=other','?attemptId=invalid'])('rejects unsafe status query %s',async query=>{expect((await guidedHttp(new NextRequest('https://visionxixlabs.com/api/desktop/cloud/gcp/guided/status'+query),'status')).status).toBe(503);expect(m.status).not.toHaveBeenCalled()});
it('does not accept success/token/project metadata authority in completion',async()=>{await guidedHttp(post('complete',{attemptId:id,resourceId:'project-one',verified:true,accessToken:'secret'}),'complete');expect(m.complete).not.toHaveBeenCalled()});
it('passes only selected resource to trusted service with bounded abort signal',async()=>{expect((await guidedHttp(post('complete',{attemptId:id,resourceId:'project-one'}),'complete')).status).toBe(200);expect(m.complete).toHaveBeenCalledWith(p,id,'project-one',expect.any(AbortSignal))});
it('oversized streamed body cannot reach service',async()=>{await guidedHttp(post('start',{extra:'x'.repeat(5000)}),'start');expect(m.start).not.toHaveBeenCalled()});
it('requires current paired authority before parsing or starting',async()=>{m.principal.mockRejectedValue(new Error('revoked'));await guidedHttp(post('start',{}),'start');expect(m.start).not.toHaveBeenCalled()});
it('cancel never calls exchange or complete',async()=>{m.status.mockResolvedValue({status:'cancelled',attemptId:id,expiresAt:'2026-10-27T01:00:00.000Z'});const r=await guidedHttp(post('cancel',{attemptId:id}),'cancel');expect(r.status).toBe(200);expect(m.cancel).toHaveBeenCalledWith(p,id);expect(m.complete).not.toHaveBeenCalled()});

it('cancel reply uses authoritative saved status and original expiry, including connected no-op',async()=>{const saved={status:'connected_read_only',attemptId:id,expiresAt:'2026-10-27T01:00:00.000Z',connection:{id:'account',resourceId:'project-one',version:1}};m.status.mockResolvedValue(saved);const response=await guidedHttp(post('cancel',{attemptId:id}),'cancel');expect((await response.json()).data).toEqual(saved);expect(m.status).toHaveBeenCalledWith(p,id)});
