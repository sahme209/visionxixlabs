import {compareEvidenceSources} from './freshness';
import {z} from 'zod';
import {evaluateAction} from '@/lib/governance/policyEngine';
import type {PolicyRule} from '@/lib/governance/policyModel';
import type {TenantAutonomy} from '@/lib/governance/autonomyLevels';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {compileBaseline,parseEvidenceSnapshot,digestSchema,identifier,scopeSchema,GOVERNED_ACTIONS,type EvidenceSnapshot,type CompiledBaseline} from './contracts';
const requestSchema=z.object({organizationId:identifier,actorUserId:identifier,action:z.enum(GOVERNED_ACTIONS),scope:scopeSchema,planDigest:digestSchema,providerAccessVerified:z.boolean(),platformAllowed:z.boolean(),autonomyLevel:z.number().int().min(0).max(5),verifiedEvidence:z.boolean(),rollbackVerified:z.boolean()}).strict();
const claimRequestSchema=requestSchema.omit({providerAccessVerified:true}).extend({kind:z.literal('release_claim_eligibility_v1'),action:z.enum(['repository.merge','deployment.dispatch']),providerEligibilityVerified:z.boolean()}).strict();
const approvalSchema=z.object({organizationId:identifier,baselineDigest:digestSchema,planDigest:digestSchema,requesterUserId:identifier,approverUserId:identifier,currentAuthorityVerified:z.boolean(),expiresAt:z.string().datetime()}).strict();
// This vocabulary is more specific than policyEngine's legacy apply/execute
// signals. Exact human approval never raises the tenant's execution ceiling.
// Exhaustive typing prevents a new governed action from silently inheriting read
// authority. Level 5 still preserves every action's existing approval boundary.
const minimumAutonomy:Record<typeof GOVERNED_ACTIONS[number],number>={
 'discovery.read':0,
 'recommendation.create':1,
 'repository.merge':4,
 'deployment.dispatch':4,
 'integration.slack.send':4,
 'integration.teams.send':4,
 'integration.linear.create':4,
 'integration.linear.update':4,
 'integration.linear.close':4,
 'integration.outlook.send':4,
 'integration.outlook.event.create':4,
 'computer.replace_text':4,
};
export interface AdmissionInput {request:unknown;active:{baseline:CompiledBaseline;approvedDigest:string;activeDigest:string;revoked:boolean};evidence:EvidenceSnapshot|EvidenceSnapshot[];coverage:{enrolled:boolean;coveredActions:string[]};now:number;approval?:unknown;evidenceRefreshes?:Array<{approvedDigest:string;current:EvidenceSnapshot}>;[key:string]:unknown}
export function evaluateGovernancePolicy(input:AdmissionInput,mode:'execution'|'release_claim'){
 const result=(decision:'satisfied'|'denied'|'requires_approval'|'not_enrolled',reason:string,rules:string[]=[])=>({decision,reason,matchedRuleIds:rules});
 if(!input.coverage?.enrolled)return result('not_enrolled','scope_not_enrolled');
 try{
  if(mode!=='execution'&&mode!=='release_claim')return result('denied','invalid_governance_input');
  const r=mode==='execution'?requestSchema.parse(input.request):claimRequestSchema.parse(input.request);if(!Number.isFinite(input.now)||!input.coverage.coveredActions.includes(r.action))return result('denied','action_not_covered');
  const active=input.active,b=active.baseline,{digest,compilerVersion,...raw}=b,compiled=compileBaseline(raw);if(sha256ContentHash(compiled)!==sha256ContentHash(b)||active.revoked||active.activeDigest!==digest||active.approvedDigest!==digest||b.organizationId!==r.organizationId)return result('denied','active_baseline_unavailable');
  if(!r.platformAllowed||!(mode==='execution'?'providerAccessVerified'in r&&r.providerAccessVerified:'providerEligibilityVerified'in r&&r.providerEligibilityVerified))return result('denied','existing_authority_required');
  if(r.autonomyLevel<minimumAutonomy[r.action])return result('denied','autonomy_execution_unavailable');
  if(!b.scopes.some(s=>sha256ContentHash(s)===sha256ContentHash(r.scope)))return result('denied','scope_not_approved');
  const refreshes=z.array(z.object({approvedDigest:digestSchema,current:z.unknown()}).strict()).max(100).parse(input.evidenceRefreshes??[]);if(new Set(refreshes.map(x=>x.approvedDigest)).size!==refreshes.length||refreshes.some(x=>!b.evidenceDigests.includes(x.approvedDigest)))return result('denied','evidence_refresh_unbound');
  const snapshots=Array.isArray(input.evidence)?input.evidence:[input.evidence];const verified=new Map<string,EvidenceSnapshot>();
  for(const e of snapshots){const{digest:claimed,...source}=e,actual=parseEvidenceSnapshot(source);if(actual.digest!==claimed||e.organizationId!==r.organizationId||e.completeness!=='complete'||Date.parse(e.observedAt)>input.now)return result('denied','evidence_unavailable');const refresh=refreshes.find(x=>x.approvedDigest===actual.digest);if(refresh){const comparison=compareEvidenceSources(actual,refresh.current,input.now);if(comparison.status!=='unchanged')return result('denied',comparison.status==='changed'?'evidence_drift':'evidence_unavailable')}else if(Date.parse(e.expiresAt)<=input.now)return result('denied','evidence_unavailable');verified.set(actual.digest,actual)}
  if(b.evidenceDigests.some(d=>!verified.has(d)))return result('denied','evidence_missing');
  const applicable=b.rules.filter(x=>x.actions.includes(r.action)&&sha256ContentHash(x.scope)===sha256ContentHash(r.scope));if(!applicable.length)return result('denied','no_supported_rule');
  const ids=applicable.map(x=>x.id);if(applicable.some(x=>x.requirements.some(k=>k==='verified_evidence'?!r.verifiedEvidence:!r.rollbackVerified)))return result('denied','required_safeguard_missing',ids);
  const rules:PolicyRule[]=applicable.map(x=>({id:x.id,name:x.id,description:'Approved source-bound governance rule',category:'execution_safety',scope:{actionTypes:[r.action],environments:[r.scope.environment]},severity:'high',conditions:[],decision:x.decision,requiredApprovers:x.decision==='require_approval'?1:0,requiredApproverRole:'approver_role',enabled:true,source:'tenant',createdAt:new Date(input.now).toISOString(),updatedAt:new Date(input.now).toISOString()}));
  const evaluated=evaluateAction({action_type:r.action,environment:r.scope.environment}, {rules,autonomy:{level:r.autonomyLevel} as TenantAutonomy});
  if(evaluated.decision==='block')return result('denied','approved_policy_block',ids);
  if(evaluated.approvalRequired){const a=approvalSchema.safeParse(input.approval);if(!a.success||a.data.organizationId!==r.organizationId||a.data.baselineDigest!==digest||a.data.planDigest!==r.planDigest||a.data.requesterUserId!==r.actorUserId||a.data.approverUserId===r.actorUserId||!a.data.currentAuthorityVerified||Date.parse(a.data.expiresAt)<=input.now)return result('requires_approval','exact_independent_approval_required',ids)}
  return result('satisfied','current_approved_policy_satisfied',ids);
 }catch{return result('denied','invalid_governance_input')}
}
