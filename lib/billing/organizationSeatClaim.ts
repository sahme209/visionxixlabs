import { publicBillingPolicyEnabled, configuredPublicBillingIdentity } from "./publicBillingConfig";
import { publicDatabaseNow } from "./publicCreditAuthority";
import { readPublicEntitlementSnapshot } from "./publicBillingEntitlements";
import { lockPublicOrganization, type PublicSql } from "./publicBillingStore";
import { billingTierToPublicPlan } from "./deploymentQuota";
import { PUBLIC_PLAN_CATALOG } from "./publicPlanCatalog";

export interface OrganizationSeatClaimRepo {
  $transaction<T>(fn: (tx: OrganizationSeatClaimTx) => Promise<T>, options: { isolationLevel: "Serializable" }): Promise<T>;
}

interface OrganizationSeatClaimTx {
  tenantBillingPlan: {
    findUnique(args: { where: { organizationId: string } }): Promise<{ tier: string; status: string; seatQuantity: number | null } | null>;
  };
  orgMembership: {
    findUnique(args: { where: { userId_organizationId: { userId: string; organizationId: string } } }): Promise<{ id: string; acceptedAt?: Date | null } | null>;
    count(args: { where: { organizationId: string; acceptedAt: { not: null } } }): Promise<number>;
    create(args: { data: { userId: string; organizationId: string; role: string; invitedBy?: string; acceptedAt: Date } }): Promise<unknown>;
    update(args: { where: { id: string }; data: { role: string; acceptedAt: Date } }): Promise<unknown>;
  };
}

export type SeatClaimResult =
  | { ok: true; created: boolean; used: number; limit: number | null }
  | { ok: false; error: "seat_limit_exhausted" | "seat_entitlement_unavailable"; used?: number; limit?: number };

/** Claims an accepted organization seat and membership in one transaction. */
export async function claimOrganizationSeat(
  repo: OrganizationSeatClaimRepo,
  input: { organizationId: string; userId: string; role: string; invitedBy?: string },
): Promise<SeatClaimResult> {
  try {
    return await repo.$transaction(async (tx) => {
      if(publicBillingPolicyEnabled()){
        const sql=tx as unknown as PublicSql;await lockPublicOrganization(sql,input.organizationId);
        const now=await publicDatabaseNow(sql),plan=await readPublicEntitlementSnapshot(sql,input.organizationId,configuredPublicBillingIdentity(),now);
        if(plan){
          if(!plan.usable||plan.seatQuantity<1)return {ok:false as const,error:"seat_entitlement_unavailable" as const};
          const existing=await tx.orgMembership.findUnique({where:{userId_organizationId:{userId:input.userId,organizationId:input.organizationId}}});
          const used=await tx.orgMembership.count({where:{organizationId:input.organizationId,acceptedAt:{not:null}}});
          const accepted=existing?.acceptedAt instanceof Date;
          if(!Number.isSafeInteger(used)||used<0||existing&&existing.acceptedAt===undefined)return {ok:false as const,error:"seat_entitlement_unavailable" as const};
          if(!accepted&&used>=plan.seatQuantity)return {ok:false as const,error:"seat_limit_exhausted" as const,used,limit:plan.seatQuantity};
          if(existing)await tx.orgMembership.update({where:{id:existing.id},data:{role:input.role,acceptedAt:accepted?existing.acceptedAt!:now}});
          else await tx.orgMembership.create({data:{userId:input.userId,organizationId:input.organizationId,role:input.role,...(input.invitedBy?{invitedBy:input.invitedBy}:{}),acceptedAt:now}});
          return {ok:true as const,created:!existing,used:used+(accepted?0:1),limit:plan.seatQuantity};
        }
      }
      const existing = await tx.orgMembership.findUnique({
        where: { userId_organizationId: { userId: input.userId, organizationId: input.organizationId } },
      });
      if (existing) {
        await tx.orgMembership.update({ where: { id: existing.id }, data: { role: input.role, acceptedAt: new Date() } });
        const used = await tx.orgMembership.count({ where: { organizationId: input.organizationId, acceptedAt: { not: null } } });
        // Existing members do not consume another seat. The caller only needs
        // the authoritative limit when a new seat is claimed.
        return { ok: true as const, created: false, used, limit: null };
      }

      const billing = await tx.tenantBillingPlan.findUnique({ where: { organizationId: input.organizationId } });
      const planId = billingTierToPublicPlan(billing?.tier, billing?.status);
      const plan = PUBLIC_PLAN_CATALOG.find((candidate) => candidate.id === planId);
      if (!plan) return { ok: false as const, error: "seat_entitlement_unavailable" as const };
      const limit = plan.includedSeats ?? billing?.seatQuantity ?? 0;
      if (limit < 1) return { ok: false as const, error: "seat_entitlement_unavailable" as const };
      const used = await tx.orgMembership.count({ where: { organizationId: input.organizationId, acceptedAt: { not: null } } });
      if (used >= limit) return { ok: false as const, error: "seat_limit_exhausted" as const, used, limit };
      await tx.orgMembership.create({
        data: { userId: input.userId, organizationId: input.organizationId, role: input.role, ...(input.invitedBy ? { invitedBy: input.invitedBy } : {}), acceptedAt: new Date() },
      });
      return { ok: true as const, created: true, used: used + 1, limit };
    }, { isolationLevel: "Serializable" });
  } catch {
    return { ok: false, error: "seat_entitlement_unavailable" };
  }
}
