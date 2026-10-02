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
