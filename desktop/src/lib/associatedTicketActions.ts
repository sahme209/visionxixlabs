import {z} from 'zod';
import {associatedTicketActionsRequestSchema,type AssociatedTicketActionsRequest} from '../../../lib/desktop/associatedTicketActionsContract';
import {parseJiraTicketActionDto,type JiraTicketActionDto} from '../../../lib/releaseops/jiraTicketLifecycleContract';
import {parseServiceNowTicketActionDto,type ServiceNowTicketActionDto} from '../../../lib/releaseops/serviceNowTicketLifecycleContract';
export {associatedTicketActionsRequestSchema};export type {AssociatedTicketActionsRequest};
export type AssociatedTicketAction=JiraTicketActionDto|ServiceNowTicketActionDto;
export interface RefreshableTicketDraft{id:string;version:number;kind:'link'|'close';readOnly:true}
export interface AssociatedTicketCloseOptions{linkActionId:string;linkVersion:number;expiresAt:string;transitions:Array<{id:string;label:string;targetStatusLabel:string}>;amendment?:{actionId:string;expectedVersion:number};blockedByConsumedAction?:true}
export interface AcceptedJiraLink{id:string;version:number;issueKey:string;runUrl:string;sourceCommit:string;evidenceId:string;evidenceDigest:string;originalAssociationReviewId:string;readOnly:true}
export type AssociatedTicketActionsResult={provider:'jira'|'servicenow';action:AssociatedTicketAction}|{provider:'jira'|'servicenow';actions:AssociatedTicketAction[];truncated:boolean;acceptedLinks?:AcceptedJiraLink[];refreshableDrafts?:RefreshableTicketDraft[]}|{provider:'jira';closeOptions:AssociatedTicketCloseOptions};
const label=z.string().min(1).max(200).refine(s=>!/[\x00-\x1f\x7f]/.test(s));
const acceptedLink=z.object({id:z.string().regex(/^jira_action_[a-f0-9]{64}$/),version:z.number().int().min(0),issueKey:z.string().regex(/^[A-Z][A-Z0-9_]*-[1-9][0-9]*$/),runUrl:z.string().regex(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/[1-9][0-9]*$/),sourceCommit:z.string().regex(/^[a-f0-9]{40}$/),evidenceId:z.string().regex(/^release_workflow_evidence_[a-f0-9]{64}$/),evidenceDigest:z.string().regex(/^[a-f0-9]{64}$/),originalAssociationReviewId:z.string().regex(/^ticket_review_[a-f0-9]{64}$/),readOnly:z.literal(true)}).strict();
const draft=z.object({id:z.string().regex(/^(jira|servicenow)_action_[a-f0-9]{64}$/),version:z.number().int().min(0).max(16),kind:z.enum(['link','close']),readOnly:z.literal(true)}).strict();
const options=z.object({linkActionId:z.string().regex(/^jira_action_[a-f0-9]{64}$/),linkVersion:z.number().int().min(0),expiresAt:z.string().datetime(),amendment:z.object({actionId:z.string().regex(/^jira_action_[a-f0-9]{64}$/),expectedVersion:z.number().int().min(0).max(16)}).strict().optional(),blockedByConsumedAction:z.literal(true).optional(),transitions:z.array(z.object({id:z.string().regex(/^[0-9]{1,20}$/),label,targetStatusLabel:label}).strict()).max(100)}).strict();
export function isAssociatedTicketActionsResult(value:unknown,reviewId:string,input:AssociatedTicketActionsRequest):value is AssociatedTicketActionsResult{
 try{
  const v=z.object({provider:z.enum(['jira','servicenow']),action:z.unknown().optional(),actions:z.array(z.unknown()).max(5).optional(),truncated:z.boolean().optional(),acceptedLinks:z.array(acceptedLink).max(5).optional(),refreshableDrafts:z.array(draft).max(5).optional(),closeOptions:z.unknown().optional()}).strict().parse(value);
  if(input.action==='close_options'){const p=options.parse(v.closeOptions);return Object.keys(v).sort().join(',')==='closeOptions,provider'&&v.provider==='jira'&&p.linkActionId===input.actionId&&new Set(p.transitions.map(t=>t.id)).size===p.transitions.length}
  const valid=(raw:unknown)=>{const a=v.provider==='jira'?parseJiraTicketActionDto(raw):parseServiceNowTicketActionDto(raw);return a.id.startsWith(v.provider==='jira'?'jira_action_':'servicenow_action_')&&a.kind!=='publish'&&'association'in a.review&&a.review.association?.reviewId===reviewId&&a.review.association.bindingDigest===input.bindingDigest};
  if(input.action==='list')return Object.keys(v).sort().join(',')===['actions','provider','truncated',...(v.acceptedLinks===undefined?[]:['acceptedLinks']),...(v.refreshableDrafts===undefined?[]:['refreshableDrafts'])].sort().join(',')&&(!v.acceptedLinks||v.provider==='jira'||v.acceptedLinks.length===0)&&!!v.actions&&v.actions.every(valid)&&new Set(v.actions.map(a=>(a as {id:string}).id)).size===v.actions.length;
  if(Object.keys(v).sort().join(',')!=='action,provider'||!valid(v.action))return false;
  const a=v.action as AssociatedTicketAction;
  if(input.action==='prepare_link')return a.kind==='link'&&a.status==='awaiting_approval'&&a.attemptCount===0&&(!input.amendment||a.id===input.amendment.actionId&&a.version===input.amendment.expectedVersion+1);
  if(input.action==='prepare_close')return a.kind==='close'&&a.status==='awaiting_approval'&&a.attemptCount===0&&'linkedEvidenceActionId'in a.review&&a.review.linkedEvidenceActionId===input.actionId&&(!input.amendment||a.id===input.amendment.actionId&&a.version===input.amendment.expectedVersion+1);
  if(a.id!==input.actionId)return false;if(input.action==='load')return true;if(input.action==='recover')return a.version>=input.expectedVersion;if(a.version<=input.expectedVersion)return false;return input.action==='approve'?a.status==='approved':input.action==='cancel'?a.status==='cancelled':['confirmed','refused','unknown','dispatching'].includes(a.status);
 }catch{return false}
}
