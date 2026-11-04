/** Authoritative ledger arithmetic. Stage telemetry is only a display projection. */
export type RunCallCost = { status: string; estimatedCents: number; providerCents: number | null; integrityError?: string | null };
const cents = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
function unavailable(): never { throw new Error('coding_run_budget_unavailable'); }
export function runBudgetExposure(calls: readonly RunCallCost[], stages: readonly {costCents:number; linked:boolean}[]): number {
 let total=0;
 for(const call of calls) {
  if(!cents(call.estimatedCents)||call.estimatedCents<1||call.integrityError)unavailable();
  if(call.status==='settled'){if(!cents(call.providerCents))unavailable();total+=call.providerCents;}
  else if(['reserved','dispatch_unknown','pending_settlement'].includes(call.status)){if(call.providerCents!==null)unavailable();total+=call.estimatedCents;}
  else if(call.status!=='released'||call.providerCents!==null)unavailable();
  if(!cents(total))unavailable();
 }
 for(const stage of stages){if(!stage.linked){if(!cents(stage.costCents))unavailable();total+=stage.costCents;}}
 if(!cents(total))unavailable();return total;
}
export function assertRunAdmission(exposure:number, proposed:number, cap:number|null):void {
 if(!cents(exposure)||!cents(proposed)||cap!==null&&!cents(cap)||!cents(exposure+proposed))unavailable();
 if(cap!==null&&exposure+proposed>cap)throw new Error('coding_run_budget_exceeded');
}
