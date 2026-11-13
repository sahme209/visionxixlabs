import 'server-only';
import {z} from 'zod';
import {platformPrincipalSchema,type PlatformPrincipal} from './contracts';
import type {PlatformTransaction} from './actionStore';
import {assertExecutionWindow,type ExecutionTimeSource} from './executionTime';

const stamp=z.number().int().nonnegative().safe();
const session=platformPrincipalSchema.extend({live:z.literal(true),sessionIssuedAtMs:stamp,sessionExpiresAtMs:stamp}).strip();
/** Additional private time validation, not a role or session issuer. The caller
 * must retain actual principal locks and recheck current authority afterwards.
 * Nonsecret history still uses its existing reader; this grants no new access. */
export async function readPlatformPrincipalTimeWindow(tx:Pick<PlatformTransaction,'readPrincipal'>,raw:PlatformPrincipal,signal:AbortSignal):Promise<Readonly<{notBefore:number;expiresAt:number}>>{
 try{
  signal.throwIfAborted();const principal=platformPrincipalSchema.parse(raw),row=session.parse(await tx.readPrincipal(principal));signal.throwIfAborted();
  if(row.userId!==principal.userId||row.sessionId!==principal.sessionId||row.sessionIssuedAtMs>=row.sessionExpiresAtMs)throw Error('unavailable');
  return Object.freeze({notBefore:row.sessionIssuedAtMs,expiresAt:row.sessionExpiresAtMs});
 }catch{throw Error('platform_principal_time_unavailable')}
}

/** Standalone checks reuse the same exact-row parser. Joined final decisions
 * collect every participant window first, then validate a single intersection. */
export async function assertPlatformPrincipalTime(tx:Pick<PlatformTransaction,'readPrincipal'>,raw:PlatformPrincipal,clock:ExecutionTimeSource,signal:AbortSignal):Promise<Readonly<{notBefore:number;expiresAt:number}>>{
 try{const window=await readPlatformPrincipalTimeWindow(tx,raw,signal);await assertExecutionWindow(clock,window,signal);signal.throwIfAborted();return window}catch{throw Error('platform_principal_time_unavailable')}
}

/** Supplemental time check for the actual phase's locked principals. It never
 * assigns roles or adds a reviewer. The owner must repeat current authority and
 * resource checks after this await and retain its original transaction locks. */
export async function assertPlatformParticipantsTime(tx:Pick<PlatformTransaction,'readPrincipal'>,actors:readonly PlatformPrincipal[],clock:ExecutionTimeSource,restriction:{readonly notBefore?:number;readonly expiresAt?:number},signal:AbortSignal){
 try{
  signal.throwIfAborted();if(!actors.length)throw Error('missing participants');
  const principals=actors.map(p=>platformPrincipalSchema.parse(p));
  let notBefore=restriction.notBefore===undefined?0:stamp.parse(restriction.notBefore),expiresAt=restriction.expiresAt===undefined?Number.MAX_SAFE_INTEGER:stamp.parse(restriction.expiresAt);
  for(const principal of principals){const row=await readPlatformPrincipalTimeWindow(tx,principal,signal);notBefore=Math.max(notBefore,row.notBefore);expiresAt=Math.min(expiresAt,row.expiresAt)}
  const window=Object.freeze({notBefore,expiresAt});await assertExecutionWindow(clock,window,signal);signal.throwIfAborted();return window;
 }catch{throw Error('platform_principal_time_unavailable')}
}
