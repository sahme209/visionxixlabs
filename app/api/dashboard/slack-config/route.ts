/**
 * GET/POST /api/dashboard/slack-config — Phase 517.
 *
 * GET: read org's Slack config (webhook URL is masked).
 * POST: upsert config.
 */

import { NextResponse, type NextRequest } from "next/server";
import {createWebNotificationMutationAuthority} from "@/lib/notifications/webNotificationMutationAuthority";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildSlackConfigReadResponse,
  buildSlackConfigUpsertResponse,
  type SlackRepo,
} from "@/lib/releaseops/slackNotificationResponder";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const r = await buildSlackConfigReadResponse(prisma as unknown as SlackRepo, ctx.organizationId);
  return NextResponse.json(r.body, { status: r.status });
}

export async function POST(req: NextRequest) {
  let authority;try{authority=await createWebNotificationMutationAuthority(req)}catch{return NextResponse.json({ok:false,error:'notification_mutation_unavailable'},{status:403})}
  let body: { webhookUrl?: unknown; enabledSignalKinds?: unknown; defaultChannel?: unknown; enabled?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const webhookUrl = typeof body.webhookUrl === "string" ? body.webhookUrl : "";
  const enabledSignalKinds = Array.isArray(body.enabledSignalKinds)
    ? body.enabledSignalKinds.filter((k): k is string => typeof k === "string")
    : undefined;

  try{
    const result=await authority.transaction(async(tx,assertAbsent)=>{
      const configRepo=tx as unknown as SlackRepo;
      const existing=await configRepo.slackNotificationConfig.findUnique({where:{organizationId:authority.organizationId}});
      // Only an exact pause can bypass increase refusal; stored destination,
      // filter and channel are always retained, never copied from this payload.
      const purePause=body.enabled===false&&Object.keys(body).every(key=>key==='enabled');
      if(!purePause)await assertAbsent();
      if(purePause){
        if(!existing)return {status:404,body:{ok:false,error:'slack_config_not_found'}};
        const writer=tx as unknown as {slackNotificationConfig:{updateMany(args:unknown):Promise<{count:number}>}};
        const changed=await writer.slackNotificationConfig.updateMany({where:{id:existing.id,organizationId:authority.organizationId},data:{enabled:false}});
        if(changed.count!==1)throw Error('notification_mutation_unavailable');
        return buildSlackConfigReadResponse(configRepo,authority.organizationId);
      }
      return buildSlackConfigUpsertResponse(configRepo,{organizationId:authority.organizationId,webhookUrl,...(enabledSignalKinds?{enabledSignalKinds}:{}),...(typeof body.defaultChannel==='string'?{defaultChannel:body.defaultChannel}:{}),...(typeof body.enabled==='boolean'?{enabled:body.enabled}:{})});
    });return NextResponse.json(result.value.body,{status:result.value.status});
  }catch{return NextResponse.json({ok:false,error:'notification_mutation_unavailable'},{status:409})}
}
