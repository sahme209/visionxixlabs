import 'server-only';
import {z} from 'zod';
import {platformPrincipalSchema} from './contracts';
import type {PlatformAuthority} from './actionStore';
const rowSchema=platformPrincipalSchema.extend({email:z.string().email().max(320),live:z.literal(true)}).strict();
const fail=():never=>{throw Error('platform_governance_authority_unavailable')};
/** Platform privilege is the current deployment-admin allowlist, never a
 * customer workspace role. A paired session still requires current membership
 * for its own validity; that workspace is not the platform action's owner. */
export function createCurrentPlatformAuthority(readAdminEmails:()=>readonly string[]):PlatformAuthority{
 return {async assertCurrent(tx,raw){
  const principal=platformPrincipalSchema.parse(raw);
  const allowed=()=>readAdminEmails().map(s=>s.trim().toLowerCase()).filter(Boolean);
  if(!allowed().length)fail();
  const row=rowSchema.parse(await tx.readPrincipal(principal));
  if(row.userId!==principal.userId||row.sessionId!==principal.sessionId||!allowed().includes(row.email.toLowerCase()))fail();
 }};
}
export function readConfiguredPlatformAdmins():readonly string[]{return (process.env.ADMIN_EMAILS??'').split(',')}
