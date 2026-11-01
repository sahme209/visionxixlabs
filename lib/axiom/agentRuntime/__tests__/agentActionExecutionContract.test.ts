import {describe,it,expect} from 'vitest';
import {agentActionDigest} from '../proposalIntegrity';
import {readApprovedAgentReview} from '../agentActionExecutionContract';
const now=new Date('2030-01-01T00:00:00Z');
function fixture(){
 const input={organizationId:'org',conversationId:'conversation',proposedByUserId:'requester',toolName:'open_github_pull_request',args:{repositoryFullName:'fixture/repository',head:'change',base:'main',title:'Reviewed'}};
 const proposal={...input,id:'proposal',argsJson:input.args,status:'approved',actionDigest:agentActionDigest(input),riskLevel:'medium',decidedByUserId:'reviewer',decidedAt:new Date(now.getTime()-30000),createdAt:new Date(now.getTime()-60000),approvalExpiresAt:new Date(now.getTime()+30000)};
 const audit={id:'review-audit',organizationId:'org',actorUserId:'reviewer',actorKind:'user',action:'approval.grant',outcome:'success',entityRef:'agent_action:proposal',source:'live',occurredAt:proposal.decidedAt,detail:{decisionFormat:'agent_review_only_v1',actionDigest:proposal.actionDigest,requesterUserId:'requester',actorRole:'security_reviewer',toolName:proposal.toolName,riskLevel:'medium',expiresAt:proposal.approvalExpiresAt.toISOString()}};
 return{proposal,audit};
}
describe('new review evidence eligibility, never permission',()=>{
 it('binds the exact new human decision without copying tool content or granting execution',()=>{
  const f=fixture(),proof=readApprovedAgentReview(f.proposal,f.audit,now);
  expect(proof).toMatchObject({proposalId:'proposal',organizationId:'org',requesterUserId:'requester',reviewerUserId:'reviewer',reviewId:'review-audit',toolName:'open_github_pull_request',proposalDigest:f.proposal.actionDigest,expiresAt:'2030-01-01T00:00:30.000Z'});
  expect(proof).not.toHaveProperty('argsJson');expect(proof).not.toHaveProperty('token');expect(proof).not.toHaveProperty('executionAuthorized',true);
 });
 it.each(['old_marker','different_tenant','different_digest','different_actor','different_time','different_source','machine_actor','different_expiry','self_review','changed_content','consumed','expired'])('refuses %s even if proposal status says approved',change=>{
  const f=fixture();let at=now;
  if(change==='old_marker')delete (f.audit.detail as any).decisionFormat;
  if(change==='different_tenant')f.audit.organizationId='other';
  if(change==='different_digest')f.audit.detail.actionDigest='a'.repeat(64);
  if(change==='different_actor')f.audit.actorUserId='other';
  if(change==='different_time')f.audit.occurredAt=new Date(now.getTime()-20000);
  if(change==='different_source')f.audit.source='mock';
  if(change==='machine_actor')f.audit.actorKind='agent';
  if(change==='different_expiry')f.audit.detail.expiresAt='2031-01-01T00:00:00.000Z';
  if(change==='self_review'){f.proposal.decidedByUserId='requester';f.audit.actorUserId='requester'}
  if(change==='changed_content')f.proposal.argsJson={...f.proposal.argsJson,repositoryFullName:'other/repository'};
  if(change==='consumed')f.proposal.status='failed';
  if(change==='expired')at=f.proposal.approvalExpiresAt;
  expect(()=>readApprovedAgentReview(f.proposal,f.audit,at)).toThrow('agent_review_evidence_unavailable');
 });
 it('does not retain a mutable alias to the source decision',()=>{
  const f=fixture(),proof=readApprovedAgentReview(f.proposal,f.audit,now);f.audit.id='replacement';f.proposal.approvalExpiresAt.setUTCFullYear(2031);
  expect(proof.reviewId).toBe('review-audit');expect(proof.expiresAt).toBe('2030-01-01T00:00:30.000Z');
 });
});
