import {beforeEach,it,expect,vi} from 'vitest';import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({auth:vi.fn(),query:vi.fn(),prepare:vi.fn(),recover:vi.fn(),read:vi.fn(),consume:vi.fn(),deps:null as any,approvalDeps:null as any}));
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:m.auth}));
vi.mock('@/lib/tauri/releaseProviderMergeApprovalStore',()=>({createReleaseProviderMergeApprovalStore:(_repo:unknown,deps:unknown)=>{m.approvalDeps=deps;return {readProviderApproval:m.read,consumeProviderApproval:m.consume}}}));
vi.mock('@/lib/tauri/releaseProviderMergeStore',()=>({createReleaseProviderMergeStore:(_repo:unknown,deps:any)=>{m.deps=deps;return {prepare:async(scope:unknown,planId:unknown)=>{await deps.assertCurrent({$queryRaw:m.query},scope);return m.prepare(scope,planId)},recover:async(scope:unknown,id:unknown)=>{await deps.assertCurrent({$queryRaw:m.query},scope);return m.recover(scope,id)},cancel:vi.fn()}}}));
import {createReleaseProviderMergeCoordinator} from '../releaseProviderMergeCoordinator';
const actor={id:'session',userId:'executor',organizationId:'org',credentialKind:'desktop_session',capabilities:['github:read','deploy:execute']},planId='release_plan_'+'a'.repeat(64),op='release_merge_provider_'+'b'.repeat(64);
const request=()=>new NextRequest('https://app.test/local-provider-coordinator');const ports=()=>({enabled:()=>true,readCredential:vi.fn(async()=>null),readDirectMergeSupport:vi.fn(async()=>null)});
beforeEach(()=>{vi.clearAllMocks();m.auth.mockResolvedValue({...actor});m.query.mockResolvedValue([{organizationId:'org',userId:'executor',role:'operator',acceptedAt:new Date()}]);m.prepare.mockResolvedValue({state:'prepared'});m.recover.mockResolvedValue({state:'unknown'})});
it('default unavailable adapters refuse before authentication, persistence or any credential request',async()=>{await expect(createReleaseProviderMergeCoordinator({}as never,request()).prepare(planId)).rejects.toThrow('adapters_unavailable');expect(m.auth).not.toHaveBeenCalled();expect(m.prepare).not.toHaveBeenCalled()});
it('uses the verified paired caller and never accepts API-key authority',async()=>{const p=ports(),c=createReleaseProviderMergeCoordinator({}as never,request(),p);expect(await c.prepare(planId)).toEqual({state:'prepared'});expect(m.prepare).toHaveBeenCalledWith({organizationId:'org',actorUserId:'executor',sessionId:'session'},planId);expect(p.readCredential).not.toHaveBeenCalled();m.auth.mockResolvedValue({...actor,credentialKind:'api_key'});await expect(createReleaseProviderMergeCoordinator({}as never,request(),ports()).prepare(planId)).rejects.toThrow('permission_required')});
it('fences caller replacement and current role loss before a new operation persists',async()=>{m.auth.mockResolvedValueOnce(actor).mockResolvedValue({...actor,userId:'other'});await expect(createReleaseProviderMergeCoordinator({}as never,request(),ports()).prepare(planId)).rejects.toThrow('identity_changed');expect(m.prepare).not.toHaveBeenCalled();m.auth.mockResolvedValue(actor);m.query.mockResolvedValue([{organizationId:'org',userId:'executor',role:'read_only',acceptedAt:new Date()}]);await expect(createReleaseProviderMergeCoordinator({}as never,request(),ports()).prepare(planId)).rejects.toThrow('permission_required')});
it('wires provider-purpose issuer consumption rather than a simulated or client approval',async()=>{await createReleaseProviderMergeCoordinator({}as never,request(),ports()).prepare(planId);const scope={organizationId:'org',actorUserId:'executor',sessionId:'session'},tx={};await m.deps.readProviderApproval(tx,scope,planId,op);expect(m.read).toHaveBeenCalledWith(tx,scope,planId,op);await m.deps.consumeProviderApproval(tx,scope,'approval',op);expect(m.consume).toHaveBeenCalledWith(tx,scope,'approval',op);await expect(m.approvalDeps.assertCurrent({$queryRaw:m.query},{scope,actorUserId:'executor',role:'reader',purpose:'simulation',sourcePolicy:'expected_head_observed_base'})).rejects.toThrow('purpose_required')});
it('allows authorized read-only recovery while dispatch is disabled without requesting credentials',async()=>{m.auth.mockResolvedValue({...actor,capabilities:['github:read']});m.query.mockResolvedValue([{organizationId:'org',userId:'executor',role:'read_only',acceptedAt:new Date()}]);const p={...ports(),enabled:()=>false};expect(await createReleaseProviderMergeCoordinator({}as never,request(),p).recover(op)).toEqual({state:'unknown'});expect(p.readCredential).not.toHaveBeenCalled();expect(m.prepare).not.toHaveBeenCalled()});
it('revalidates reviewer-only authority without granting executor authority',async()=>{
 await createReleaseProviderMergeCoordinator({}as never,request(),ports()).prepare(planId);
 const scope={organizationId:'org',actorUserId:'executor',sessionId:'session'};
 m.query.mockImplementation(async(q:TemplateStringsArray,...v:unknown[])=>q.join('').includes('DesktopSessionRecord')?[{id:'review-session',organizationId:'org',userId:'reviewer',live:true}]:[{organizationId:'org',userId:v[1],role:v[1]==='reviewer'?'security_reviewer':'operator',acceptedAt:new Date()}]);
 await m.approvalDeps.assertCurrent({$queryRaw:m.query},{scope,actorUserId:'reviewer',role:'approver',purpose:'provider_merge',sourcePolicy:'expected_head_observed_base',approverSessionId:'review-session'});
 await expect(m.approvalDeps.assertCurrent({$queryRaw:m.query},{scope,actorUserId:'reviewer',role:'executor',purpose:'provider_merge',sourcePolicy:'expected_head_observed_base'})).rejects.toThrow('permission_required');
 m.query.mockResolvedValue([{organizationId:'org',userId:'reviewer',role:'operator',acceptedAt:new Date()}]);
 await expect(m.approvalDeps.assertCurrent({$queryRaw:m.query},{scope,actorUserId:'reviewer',role:'approver',purpose:'provider_merge',sourcePolicy:'expected_head_observed_base'})).rejects.toThrow('permission_required');
});

it('fences an entire locked participant check once while retaining every current role check',async()=>{
 await createReleaseProviderMergeCoordinator({}as never,request(),ports()).prepare(planId);
 m.auth.mockClear();m.query.mockClear();
 m.query.mockImplementation(async(_q:TemplateStringsArray,...v:unknown[])=>[{organizationId:'org',userId:v[1],role:v[1]==='reviewer'?'security_reviewer':'operator',acceptedAt:new Date()}]);
 await m.deps.assertCurrent({$queryRaw:m.query},{organizationId:'org',actorUserId:'executor',sessionId:'session'},{approval:{approverUserId:'reviewer',executorUserId:'executor'}});
 expect(m.query).toHaveBeenCalledTimes(3);expect(m.auth).toHaveBeenCalledTimes(2);
});
it.each(['identity','capability'])('refuses %s loss at the closing principal fence before persistence',async kind=>{
 m.auth.mockResolvedValueOnce(actor).mockResolvedValueOnce(actor).mockResolvedValue(kind==='identity'?{...actor,id:'replacement'}:{...actor,capabilities:['github:read']});
 await expect(createReleaseProviderMergeCoordinator({}as never,request(),ports()).prepare(planId)).rejects.toThrow(kind==='identity'?'identity_changed':'permission_required');
 expect(m.prepare).not.toHaveBeenCalled();
});
