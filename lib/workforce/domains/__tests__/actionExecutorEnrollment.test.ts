import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({metadata:vi.fn(),config:vi.fn(),credential:vi.fn(),persist:vi.fn(),provider:vi.fn(),packet:vi.fn(),save:vi.fn(),audit:vi.fn(),context:vi.fn()}));
vi.mock('@/lib/db',()=>({prisma:{durableAgentWorkflow:{findMany:m.metadata},aiRationaleEnrichment:{upsert:m.persist}}}));
vi.mock('@/lib/workforce/domains/integrationRegistry',()=>({readIntegrationConfig:m.config,resolveCredentialReferenceAsync:m.credential}));
vi.mock('@/lib/auth/currentContext',()=>({requireContext:m.context,currentContext:m.context}));
vi.mock('@/lib/workforce/domains/approverEngineer',()=>({runApproverEngineer:m.packet,persistApprovalPacket:m.save,APPROVER_TARGET_KIND:'approval_packet'}));
vi.mock('@/lib/audit/secureAudit',()=>({record:m.audit}));
import {dispatchAction,dispatchApprovalActions,shouldDispatchApproval} from '../actionExecutor';
import {POST as generate} from '@/app/api/workforce/approver_engineer/run-domain/route';
import {POST as explicit} from '@/app/api/workforce/integrations/github/test/route';
const packet={slug:'model-packet',title:'Proposed change',executiveSummary:'Summary',proposalSummary:'Proposal',impactRadius:'org',decisionAuthority:'owner',reversibility:'irreversible',recommendedDecision:'approve',approvalChecklist:[],outcome:'ai_generated'};
afterEach(()=>vi.unstubAllGlobals());
const payload={title:'Explicit request',body:'Synthetic only'};
const kinds=['github_issue','linear_ticket','slack_action_post'] as const;
beforeEach(()=>{
 vi.resetAllMocks();vi.stubGlobal('fetch',m.provider);m.metadata.mockResolvedValue([]);m.persist.mockResolvedValue({});m.save.mockResolvedValue(undefined);m.packet.mockResolvedValue(packet);m.audit.mockResolvedValue(undefined);
 m.context.mockResolvedValue({isAuthenticated:true,userId:'user',sessionUserId:'user',organizationId:'org',email:'operator@example.test',roles:['owner']});
 m.config.mockResolvedValue({github:{enabled:true,repo:'team/repo',patReference:'env://SYNTHETIC',issueLabel:'test'},linear:{enabled:true,teamId:'team',apiKeyReference:'env://SYNTHETIC'},slackActions:{enabled:true,webhookUrl:'https://hooks.slack.com/services/synthetic'}});
 m.credential.mockResolvedValue({ok:true,value:'SIMULATED_TOKEN'});m.provider.mockImplementation(async()=>new Response(JSON.stringify({html_url:'https://github.com/team/repo/issues/1',data:{issueCreate:{success:true,issue:{id:'issue'}}}}),{status:200}));
});
it.each(kinds)('refuses enrolled %s before reading config/credentials or posting',async kind=>{
 m.metadata.mockResolvedValue([{id:'governance_active_org',organizationId:'org',workflowKind:'governance_baseline_active_v1'}]);const r=await dispatchAction('org',kind,payload);expect(r.result.errorCode).toBe('governance_execution_coverage_unavailable');expect(m.config).not.toHaveBeenCalled();expect(m.credential).not.toHaveBeenCalled();expect(m.provider).not.toHaveBeenCalled();
});
it.each(kinds)('refuses unknown enrollment for %s without provider/secret access',async kind=>{
 m.metadata.mockRejectedValue(Error('private database failure'));const r=await dispatchAction('org',kind,payload);expect(r.result.errorCode).toBe('governance_execution_coverage_unavailable');expect(m.credential).not.toHaveBeenCalled();expect(m.provider).not.toHaveBeenCalled();expect(JSON.stringify(r)).not.toContain('private database');
});
it.each(kinds)('rechecks %s immediately after last awaited preparation',async kind=>{
 const enroll=()=>m.metadata.mockResolvedValue([{id:'governance_active_org',organizationId:'org',workflowKind:'governance_baseline_active_v1'}]);
 if(kind==='slack_action_post')m.config.mockImplementation(async()=>{enroll();return{slackActions:{enabled:true,webhookUrl:'https://hooks.slack.com/services/synthetic'}}});else m.credential.mockImplementation(async()=>{enroll();return{ok:true,value:'SIMULATED_TOKEN'}});
 const r=await dispatchAction('org',kind,payload);expect(r.result.errorCode).toBe('governance_execution_coverage_unavailable');expect(m.provider).not.toHaveBeenCalled();
});
it.each(['github_issue','linear_ticket'] as const)('rechecks %s after config loading before resolving credentials',async kind=>{
 const config=await m.config();m.config.mockImplementation(async()=>{m.metadata.mockResolvedValue([{id:'governance_active_org',organizationId:'org',workflowKind:'governance_baseline_active_v1'}]);return config});
 const r=await dispatchAction('org',kind,payload);expect(r.result.errorCode).toBe('governance_execution_coverage_unavailable');expect(m.credential).not.toHaveBeenCalled();expect(m.provider).not.toHaveBeenCalled();
});
it.each(kinds)('refuses newly unknown %s enrollment after preparation without a provider attempt',async kind=>{
 const unavailable=()=>m.metadata.mockRejectedValue(Error('metadata unavailable'));
 if(kind==='slack_action_post'){const config=await m.config();m.config.mockImplementation(async()=>{unavailable();return config})}else m.credential.mockImplementation(async()=>{unavailable();return{ok:true,value:'SIMULATED_TOKEN'}});
 const r=await dispatchAction('org',kind,payload);expect(r.result.errorCode).toBe('governance_execution_coverage_unavailable');expect(m.provider).not.toHaveBeenCalled();
});
it.each(kinds)('preserves positively unenrolled explicit %s dispatch without retry',async kind=>{const r=await dispatchAction('org',kind,payload);expect(r.result.status).toBe('executed');expect(m.provider).toHaveBeenCalledOnce();expect(m.metadata.mock.calls.length).toBeGreaterThanOrEqual(2);expect(m.metadata.mock.calls.every(([args])=>args.where.organizationId==='org')).toBe(true)});
it('does not treat model-recommended approval or asserted authority text as a human decision',async()=>{expect(shouldDispatchApproval(packet).dispatch).toBe(false);expect(await dispatchApprovalActions('org',packet)).toEqual([]);expect(m.config).not.toHaveBeenCalled();expect(m.provider).not.toHaveBeenCalled()});
it('actual generation handler preserves generated packet but never fans out model approval',async()=>{const r=await generate(new Request('https://axiom.invalid/api/workforce/approver_engineer/run-domain',{method:'POST',body:new URLSearchParams({title:'Proposal',proposalDescription:'Description',riskContext:'Risk'})}));expect(r.status).toBe(303);expect(m.save).toHaveBeenCalledWith('org',packet);expect(m.packet).toHaveBeenCalledOnce();expect(m.config).not.toHaveBeenCalled();expect(m.provider).not.toHaveBeenCalled();expect(m.audit).toHaveBeenCalled()});
it('actual explicit current-owner test route remains positive only for positively unenrolled org',async()=>{const request=()=>new NextRequest('https://axiom.invalid/api/workforce/integrations/github/test',{method:'POST',headers:{origin:'https://axiom.invalid'}});expect((await explicit(request())).status).toBe(303);expect(m.provider).toHaveBeenCalledOnce();m.provider.mockClear();m.metadata.mockResolvedValue([{id:'governance_active_org',organizationId:'org',workflowKind:'governance_baseline_active_v1'}]);expect((await explicit(request())).status).toBe(303);expect(m.provider).not.toHaveBeenCalled()});
it.each(['',undefined,null])('unknown organization %s never falls back to provider access',async org=>{const r=await dispatchAction(org as any,'github_issue',payload);expect(r.result.status).toBe('failed');expect(m.config).not.toHaveBeenCalled();expect(m.provider).not.toHaveBeenCalled()});
