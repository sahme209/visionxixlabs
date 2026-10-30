import {z} from 'zod';
import {isObservationOwner,type ObservationOwner} from './computerObservationContract';
export const COMPUTER_INPUT_SOURCE='native_selected_window_input' as const;
export const COMPUTER_INPUT_OPERATION_MS=10_000,COMPUTER_INPUT_PROPOSAL_MS=60_000;
const uuid='[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',hash=z.string().regex(/^[a-f0-9]{64}$/);
const context=z.string().regex(new RegExp('^computer_context_'+uuid+'$'));
const session=z.string().regex(new RegExp('^input_session_'+uuid+'$')),action=z.string().regex(new RegExp('^input_action_'+uuid+'$'));
const task=z.string().regex(/^bot_[a-f0-9]{64}$/),version=z.number().int().min(0).max(2147483647),instant=z.string().datetime();
function unicode(v:string){for(let i=0;i<v.length;i++){const c=v.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const n=v.charCodeAt(++i);if(!(n>=0xdc00&&n<=0xdfff))return false}else if(c>=0xdc00&&c<=0xdfff)return false}return true}
export const inputTextSchema=z.string().refine(v=>unicode(v)&&new TextEncoder().encode(v).length<=4096&&!/[\x00-\x08\x0b-\x1f\x7f-\x9f]/.test(v));
const label=z.string().min(1).max(240).refine(v=>!/[\x00-\x1f\x7f-\x9f]/.test(v));
export const computerInputSelectionSchema=z.object({ownerContextRef:context,observationSessionId:z.string().regex(new RegExp('^observation_'+uuid+'$')),observationRevision:version}).strict();
export type ComputerInputSelectionRef=z.infer<typeof computerInputSelectionSchema>;
export const computerInputStatusSchema=z.object({source:z.literal(COMPUTER_INPUT_SOURCE),supported:z.boolean(),inputAvailable:z.boolean(),typeAvailable:z.boolean(),pressAvailable:z.literal(false),ownerAuthorityAvailable:z.boolean(),foregroundPolicyAvailable:z.boolean(),reason:z.enum(['owner_authority_unavailable','owner_credential_unavailable','owner_service_unavailable','owner_service_refused','owner_proof_invalid','owner_proof_time_invalid','owner_proof_binding_invalid','owner_proof_native_rejected','foreground_policy_unavailable','accessibility_unavailable','accessibility_permission_required','ready','os_unsupported']).optional(),aiSharingAvailable:z.literal(false),backgroundInput:z.literal(false)}).strict().refine(v=>(!v.inputAvailable||v.supported&&v.typeAvailable&&v.ownerAuthorityAvailable&&v.foregroundPolicyAvailable)&&(!['owner_credential_unavailable','owner_service_unavailable','owner_service_refused','owner_proof_invalid','owner_proof_time_invalid','owner_proof_binding_invalid','owner_proof_native_rejected'].includes(v.reason??'')||!v.inputAvailable&&!v.typeAvailable&&!v.ownerAuthorityAvailable));
export const computerInputProposalSchema=z.object({source:z.literal(COMPUTER_INPUT_SOURCE),kind:z.literal('set_text'),inputSessionId:session,actionId:action,revision:z.literal(0),taskId:task,taskVersion:version,targetLabel:label,beforeText:inputTextSchema,afterText:inputTextSchema,beforeDigest:hash,afterDigest:hash,targetDigest:hash,expiresAt:instant,attemptCount:z.literal(0)}).strict();
export const computerInputResultSchema=z.object({source:z.literal(COMPUTER_INPUT_SOURCE),inputSessionId:session,actionId:action,revision:version,status:z.enum(['confirmed','refused','unknown','stopped','expired']),attemptCount:z.union([z.literal(0),z.literal(1)]),beforeDigest:hash,afterDigest:hash,targetDigest:hash,expiresAt:instant,inputPerformed:z.boolean().nullable()}).strict().refine(v=>v.status==='confirmed'?v.revision>=1&&v.attemptCount===1&&v.inputPerformed===true:v.status==='refused'||v.status==='stopped'||v.status==='expired'?v.attemptCount===0&&v.inputPerformed===false:v.inputPerformed===null);
export type ComputerInputStatus=z.infer<typeof computerInputStatusSchema>;
export type ComputerInputProposal=z.infer<typeof computerInputProposalSchema>;
export type ComputerInputResult=z.infer<typeof computerInputResultSchema>;
export interface ComputerInputAdapter{
 status(signal:AbortSignal,task?:{taskId:string;taskVersion:number}):Promise<unknown>;
 prepare(input:ComputerInputSelectionRef&{taskId:string;taskVersion:number;text:string},signal:AbortSignal):Promise<unknown>;
 confirm(input:{ownerContextRef:string;taskId:string;taskVersion:number;inputSessionId:string;actionId:string;expectedRevision:number},signal:AbortSignal):Promise<unknown>;
 recover(input:{ownerContextRef:string;taskId:string;taskVersion:number;actionId:string},signal:AbortSignal):Promise<unknown>;
 stop(input:{ownerContextRef:string;inputSessionId:string|null}):Promise<unknown>;
}
export const isComputerInputOwner=(v:unknown):v is ObservationOwner&{taskId:string;taskVersion:number}=>isObservationOwner(v)&&v.taskId!==null&&v.taskVersion!==null;
export async function computerInputTextDigest(text:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('')}
const safeNativeInputErrors=new Set(['native_input_invalid_request','native_input_invalid_response','native_input_unsupported','native_input_unavailable','native_input_owner_authority_unavailable','native_input_foreground_policy_unavailable','native_input_accessibility_unavailable','native_input_target_unavailable','native_input_busy','native_input_foreground_required','native_input_target_identity_unavailable','native_input_window_inventory_unavailable','native_input_text_structure_unavailable','native_input_text_not_editable','native_input_tree_incomplete','native_input_text_area_count','native_input_secure_text_area','native_input_text_enabled_unverified','native_input_text_disabled','native_input_text_value_unavailable','native_input_text_size_limit','native_input_saved_document','native_input_fixture_mismatch','native_input_ambiguous_window','native_input_session_changed','native_input_expired','native_input_stopped','native_input_outcome_unknown','owner_credential_unavailable','owner_service_unavailable','owner_service_refused','owner_proof_invalid','owner_proof_time_invalid','owner_proof_binding_invalid','owner_proof_native_rejected']);
export function safeComputerInputError(value:unknown,fallback='input_unavailable'):string {const code=typeof value==='string'?value:value instanceof Error?value.message:undefined;return code&&safeNativeInputErrors.has(code)?code:fallback}
export function computerInputRecoveryMessage(error:string|undefined){
 if(error==='native_input_tree_incomplete')return 'The accessibility tree could not be inspected completely. No text was changed.';
 if(error==='native_input_text_area_count')return 'The selected window did not expose exactly one ordinary text area. No text was changed.';
 if(error==='native_input_secure_text_area')return 'The selected text area is secure and cannot be used. No text was changed.';
 if(error==='native_input_text_disabled')return 'TextEdit reports the selected text area as disabled. No text was changed.';
 if(error==='native_input_text_enabled_unverified')return 'macOS did not verify that the selected text area is enabled. No text was changed.';
 if(error==='native_input_text_value_unavailable')return 'The selected text area did not expose a readable text value. No text was changed.';
 if(error==='native_input_text_size_limit')return 'The selected text exceeds the 4096-byte action limit. No text was changed.';
 if(error==='native_input_busy')return 'Another native input operation is still pending. Stop it before preparing another review.';
 if(error==='native_input_foreground_required')return 'Axiom must be the foreground app during preparation. No text was changed.';
 if(error==='native_input_target_identity_unavailable')return 'The selected TextEdit process or accessibility access could not be verified. No text was changed.';
 if(error==='native_input_window_inventory_unavailable')return 'The selected TextEdit accessibility window list could not be read. No text was changed.';
 if(error==='native_input_text_structure_unavailable')return 'Axiom could not verify exactly one enabled ordinary text area in this window. No text was changed.';
 if(error==='native_input_text_not_editable')return 'macOS did not confirm that the exact TextEdit text value is editable. No text was changed.';
 if(error==='native_input_fixture_mismatch')return 'The selected saved or autosaved document does not match the exact disposable test text and replacement. Other saved documents remain unavailable. No text was changed.';
 if(error==='native_input_saved_document')return 'This TextEdit document is saved or autosaved and its exact document review could not be confirmed. No text was changed.';
 if(error==='native_input_target_unavailable')return 'Select an unsaved TextEdit document containing one ordinary editable text area, then prepare the action again. Keep Axiom in front during preparation.';
 if(error==='native_input_ambiguous_window')return 'The selected TextEdit window could not be matched safely. Use one unsaved document window, then select it again in Observe.';
 if(error==='native_input_expired')return 'The selected action expired. Select the window and prepare a new review before confirming.';
 if(error==='native_input_session_changed')return 'The selected window or task changed. Select the intended window again in Observe, then prepare a new action.';
 if(error==='native_input_accessibility_unavailable')return 'Mac accessibility access is required. Review Axiom in macOS Privacy & Security → Accessibility, then check again.';
 if(error==='native_input_stopped')return 'The computer action was stopped. Select the intended window before preparing a new review.';
 if(error==='native_input_unsupported')return 'Computer actions require a supported native macOS app. Observation remains separate.';
 if(error==='native_input_outcome_unknown')return 'The action outcome is unconfirmed. Check the saved outcome; do not repeat the action.';
 if(error==='saved_task_required')return 'Save or reopen a task before preparing a computer action.';
 if(error==='selection_required')return 'Select one window in Observe before preparing an action.';
 if(error==='owner_credential_unavailable')return 'The native app could not verify the saved paired sign-in. Review your sign-in in Settings, then check again. No input was enabled.';
 if(error==='owner_service_refused')return 'The computer verification service refused this request. Review workspace access and service readiness before checking again. No input was enabled.';
 if(error==='owner_service_unavailable')return 'The computer verification service could not be reached or did not respond in time. Check the connection and service readiness, then check again. No input was enabled.';
 if(error==='owner_proof_time_invalid')return 'The short-lived computer verification has an invalid or expired validity window. Review service time and sign-in before checking again. No input was enabled.';
 if(error==='owner_proof_binding_invalid')return 'The computer verification response did not match the requested saved task and session. Review the sign-in and service setup before checking again. No input was enabled.';
 if(error==='owner_proof_native_rejected')return 'The native Mac bridge rejected the verified computer response. Review the app and service compatibility before checking again. No input was enabled.';
 if(error==='owner_proof_invalid')return 'The computer verification response could not be validated. Review the sign-in and service setup before checking again. No input was enabled.';
 if(error==='owner_authority_unavailable'||error==='native_input_owner_authority_unavailable')return 'Computer actions are not enabled for this workspace. Observation remains available.';
 if(error==='foreground_policy_unavailable'||error==='native_input_foreground_policy_unavailable')return 'The selected-window input policy is not available. No input will be sent.';
 if(error==='accessibility_permission_required'||error==='accessibility_unavailable')return 'Mac accessibility access is required before computer actions can be enabled.';
 if(error==='outcome_unknown')return 'The action outcome is unconfirmed. Check the saved outcome; do not repeat the action.';
 if(error==='owner_changed'||error==='selection_changed')return 'The task, workspace or selected window changed. Review a new action.';
 if(error==='expired')return 'The action expired. Review a new action before confirming.';
 return 'Computer input is unavailable or could not be confirmed. No automatic retry will run.';
}

export type ComputerInputRecoveryPointer=Pick<ComputerInputProposal,"inputSessionId"|"actionId"|"taskId"|"taskVersion"|"beforeDigest"|"afterDigest"|"targetDigest"|"expiresAt">&{ownerContextRef:string};
