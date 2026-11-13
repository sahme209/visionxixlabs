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
export async function assertPlatformPrincipalTime(tx:Pick<PlatformTransaction,'readPrincipal'>,raw:PlatformPrincipal,clock:ExecutionTimeSource,signal:AbortSignal):Promise<Readonly<{notBefore:number;expiresAt:number}>>{
 try{
  signal.throwIfAborted();const principal=platformPrincipalSchema.parse(raw),row=session.parse(await tx.readPrincipal(principal));signal.throwIfAborted();
  if(row.userId!==principal.userId||row.sessionId!==principal.sessionId||row.sessionIssuedAtMs>=row.sessionExpiresAtMs)throw Error('unavailable');
  await assertExecutionWindow(clock,{notBefore:row.sessionIssuedAtMs,expiresAt:row.sessionExpiresAtMs},signal);signal.throwIfAborted();return Object.freeze({notBefore:row.sessionIssuedAtMs,expiresAt:row.sessionExpiresAtMs});
 }catch{throw Error('platform_principal_time_unavailable')}
}
