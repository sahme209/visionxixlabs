import { publicBillingPolicyEnabled, configuredPublicBillingIdentity } from "@/lib/billing/publicBillingConfig";
import { enrollNewPublicWorkspace } from "@/lib/billing/publicFreeEnrollment";
import "server-only";

import { prisma } from "@/lib/db";
import { deriveWorkspaceIdFromEmail } from "@/lib/auth/workspaceId";

/**
 * Gives a newly authenticated account an explicit owner membership in only
 * its own derived workspace. This replaces the former implicit owner role;
 * it never creates access to an invited or shared organization.
 */
export async function ensurePersonalWorkspaceMembership(input: {
  userId: string;
  email: string;
}): Promise<void> {
  const organizationId = String(deriveWorkspaceIdFromEmail(input.email));
  if (publicBillingPolicyEnabled()) {
    const identity=configuredPublicBillingIdentity();
    await prisma.$transaction(async tx=>{
      const existing=await tx.orgMembership.findUnique({where:{userId_organizationId:{userId:input.userId,organizationId}}});
      await tx.orgMembership.upsert({where:{userId_organizationId:{userId:input.userId,organizationId}},create:{userId:input.userId,organizationId,role:"owner",acceptedAt:new Date()},update:{}});
      if (!existing) await enrollNewPublicWorkspace(tx,organizationId,identity);
    },{isolationLevel:"Serializable"});
    return;
  }
  await prisma.orgMembership.upsert({
    where: {
      userId_organizationId: {
        userId: input.userId,
        organizationId,
      },
    },
    create: {
      userId: input.userId,
      organizationId,
      role: "owner",
      acceptedAt: new Date(),
    },
    update: {},
  });
}
