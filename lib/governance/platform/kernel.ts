import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {platformPlanSchema,platformPrincipalSchema,platformStateSchema,type PlatformPlan,type PlatformPrincipal,type PlatformAction} from './contracts';
export type {PlatformPlan,PlatformPrincipal,PlatformAction} from './contracts';
function refuse():never{throw Error('platform_governance_action_unavailable')}
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}return value}
function clock(now:number){if(!Number.isSafeInteger(now)||now<0)refuse();return now}
/** Data contract only. A compiled plan never grants authority or permission. */
export function compilePlatformPlan(raw:unknown):PlatformPlan{
 const plan=platformPlanSchema.parse(raw);return freeze({...plan,digest:sha256ContentHash({kind:'platform_governance_plan_v1',...plan})});
}
function verifyPlan(raw:PlatformPlan){
 const {digest,...input}=raw,compiled=compilePlatformPlan(input);if(digest!==compiled.digest)refuse();return compiled;
}
export function readPlatformAction(raw:unknown):PlatformAction{
 const state=platformStateSchema.parse(raw);verifyPlan(state.plan);
 const versions={proposed:0,approved:1,claimed:2,confirmed:3,refused:3,unknown:3};
 if(state.version!==versions[state.status]||state.updatedAt<state.createdAt||state.createdAt>=Date.parse(state.plan.expiresAt))refuse();
 if(state.status==='proposed'){if(state.reviewer||state.attemptCount!==0)refuse()}
 else if(!state.reviewer||state.reviewer.userId===state.requester.userId||state.attemptCount!==(['approved'].includes(state.status)?0:1))refuse();
 return freeze(state);
}
function current(raw:PlatformAction,now:number,status:PlatformAction['status']){
 const state=readPlatformAction(raw);clock(now);if(state.status!==status||now<state.updatedAt||now>=Date.parse(state.plan.expiresAt))refuse();return state;
}
export function createPlatformAction(plan:PlatformPlan,requester:PlatformPrincipal,now:number):PlatformAction{
 clock(now);const checked=verifyPlan(plan);if(now>=Date.parse(checked.expiresAt))refuse();
 return readPlatformAction({plan:checked,requester:platformPrincipalSchema.parse(requester),reviewer:null,status:'proposed',attemptCount:0,version:0,createdAt:now,updatedAt:now});
}
export function approvePlatformAction(raw:PlatformAction,review:PlatformPrincipal&{planDigest:string},now:number):PlatformAction{
 const state=current(raw,now,'proposed'),{planDigest,...principal}=review,reviewer=platformPrincipalSchema.parse(principal);
 if(reviewer.userId===state.requester.userId||planDigest!==state.plan.digest)refuse();
 return readPlatformAction({...state,reviewer,status:'approved',version:1,updatedAt:now});
}
export function claimPlatformAction(raw:PlatformAction,principal:PlatformPrincipal,now:number):PlatformAction{
 const state=current(raw,now,'approved'),actor=platformPrincipalSchema.parse(principal);
 if(actor.userId!==state.requester.userId||actor.sessionId!==state.requester.sessionId)refuse();
 return readPlatformAction({...state,status:'claimed',attemptCount:1,version:2,updatedAt:now});
}
/** Observation after expiry is still recorded; it never revives execution. */
export function finishPlatformAction(raw:PlatformAction,outcome:'confirmed'|'refused'|'unknown',now:number):PlatformAction{
 const state=readPlatformAction(raw);clock(now);if(state.status!=='claimed'||now<state.updatedAt||!['confirmed','refused','unknown'].includes(outcome))refuse();
 return readPlatformAction({...state,status:outcome,version:3,updatedAt:now});
}
