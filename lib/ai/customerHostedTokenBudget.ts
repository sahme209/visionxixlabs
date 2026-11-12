/** Pure token arithmetic only. Callers must read ALL unresolved windows under
 * the same durable workspace lock. This module grants no execution authority. */
export interface CustomerHostedTokenRecord {
 readonly windowId:string;
 readonly status:'reserved'|'dispatched'|'unknown'|'settled'|'overrun';
 readonly reservedTokens:number;
 readonly reportedTokens:number|null;
}
function nonnegative(value:unknown):value is number {
 return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
}
export function customerHostedReservationFits(cap:unknown,exposure:unknown,reservation:unknown):boolean {
 return nonnegative(cap)&&nonnegative(exposure)&&nonnegative(reservation)&&reservation>0&&exposure<=cap&&reservation<=cap-exposure;
}
export function customerHostedUsageLiability(reservedTokens:number,reportedTokens:unknown):
 {status:'unknown'|'overrun'|'settled';liabilityTokens:number} {
 if(!nonnegative(reservedTokens)||reservedTokens===0)throw new Error('customer_hosted_invalid_token_hold');
 if(!nonnegative(reportedTokens))return {status:'unknown',liabilityTokens:reservedTokens};
 return {status:reportedTokens>reservedTokens?'overrun':'settled',liabilityTokens:reportedTokens};
}
export function customerHostedExposure(windowId:string,records:readonly CustomerHostedTokenRecord[]):number|null {
 let total=0;
 for(const record of records){
  if(!record.windowId||!nonnegative(record.reservedTokens)||record.reservedTokens===0)return null;
  let liability:number;
  switch(record.status){
   case 'reserved':case 'dispatched':case 'unknown':
    // Conservatively retain unknown/pending holds through configuration and
    // window changes. Merely passing a wall-clock deadline releases nothing.
    if(record.reportedTokens!==null)return null;
    liability=record.reservedTokens;break;
   case 'overrun':
    if(!nonnegative(record.reportedTokens)||record.reportedTokens<=record.reservedTokens)return null;
    liability=record.reportedTokens;break;
   case 'settled':
    if(!nonnegative(record.reportedTokens)||record.reportedTokens>record.reservedTokens)return null;
    liability=record.windowId===windowId?record.reportedTokens:0;break;
   default:return null;
  }
  if(liability>Number.MAX_SAFE_INTEGER-total)return null;
  total+=liability;
 }
 return total;
}
