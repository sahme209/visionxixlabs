/** Provenance review grants no execution. Each provider candidate has its own
 * bounded immutable deadline; revalidation never renews that deadline. */
export const TICKET_ASSOCIATION_WINDOW_MS=30*60*1000;
export const TICKET_PROVIDER_ACTION_WINDOW_MS=15*60*1000;
export function ticketProviderActionExpiry(associationExpiresAt:string,now:number,recordedDeadline?:string){
 const associationEnd=Date.parse(associationExpiresAt);
 if(!Number.isSafeInteger(now)||!Number.isFinite(associationEnd)||associationEnd<=now||associationEnd-now>TICKET_ASSOCIATION_WINDOW_MS)throw Error('ticket_action_window_unavailable');
 const maximum=Math.min(associationEnd,now+TICKET_PROVIDER_ACTION_WINDOW_MS),end=recordedDeadline===undefined?maximum:Date.parse(recordedDeadline);
 if(!Number.isFinite(end)||end<=now||end>maximum)throw Error('ticket_action_window_unavailable');
 return new Date(end).toISOString();
}
