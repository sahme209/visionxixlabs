import 'server-only';
import {z} from 'zod';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import type {ReleaseOperationPlanTransaction as Tx} from '@/lib/agent/workflows/releaseOperationPlanStore';
const identity=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x1f\x7f]/.test(v));
const scopeSchema=z.object({organizationId:identity,actorUserId:identity,sessionId:identity}).strict();
export type CurrentDesktopSessionScope=z.infer<typeof scopeSchema>;
/** EXPIRY ONLY. Grants no role, commercial access, source or execution authority.
 * Caller must run existing actual participant/plan validators in the same tx.
 * Caller owns lock order; retain this private closure through later awaits and
 * final synchronous dispatch. Never serialize it as a permission marker. */
export async function captureCurrentDesktopSessionFreshness(tx:Tx,rawScope:CurrentDesktopSessionScope,signal:AbortSignal,now:()=>number=()=>Date.now()):Promise<()=>void>{
 const unavailable=():never=>{throw Error('current_session_freshness_unavailable')};
 try{
  const s=scopeSchema.parse(rawScope),started=now();
  const ready=()=>{signal.throwIfAborted();const at=now();if(!Number.isFinite(started)||!Number.isFinite(at)||at<started||at>=started+15000)unavailable()};ready();
  // Global exact ID lookup detects a conflicting foreign-tenant/session row;
  // returned scope is independently checked before trusting its expiry.
  const rows=await withGithubAbort(tx.$queryRaw<Array<{id:string;organizationId:string;userId:string;revokedAt:Date|null;expiresAt:Date;now:Date;live:boolean}>>`SELECT "id","organizationId","userId","revokedAt","expiresAt",clock_timestamp() AS "now",("revokedAt" IS NULL AND "expiresAt">clock_timestamp()) AS "live" FROM "DesktopSessionRecord" WHERE "id"=${s.sessionId} FOR SHARE`,signal);ready();
  const r=rows[0];if(rows.length!==1||!r||r.id!==s.sessionId||r.organizationId!==s.organizationId||r.userId!==s.actorUserId||r.revokedAt!==null||r.live!==true||!(r.expiresAt instanceof Date)||!Number.isFinite(r.expiresAt.getTime())||!(r.now instanceof Date)||!Number.isFinite(r.now.getTime())||r.now.getTime()>=r.expiresAt.getTime())unavailable();
  const expiry=r.expiresAt.getTime();const fresh=()=>{try{ready();if(now()>=expiry)unavailable()}catch{return unavailable()}};fresh();return fresh;
 }catch{return unavailable()}
}
