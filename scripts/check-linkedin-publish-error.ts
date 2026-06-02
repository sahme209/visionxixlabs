/**
 * One-shot diagnostic: connection author URN + last publish run.
 *
 * Run: npx tsx scripts/check-linkedin-publish-error.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const conn = await prisma.linkedInAccountConnection.findFirst({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      organizationUrn: true,
      linkedinUrn: true,
      linkedinName: true,
      ownerEmail: true,
      scopes: true,
      expiresAt: true,
      lastUsedAt: true,
      lastError: true,
    },
  });
  console.log("=== Active connection ===");
  console.log(conn);
  console.log("\nauthor URN that posting.ts will use =",
    conn?.organizationUrn || conn?.linkedinUrn || "(none)");

  const lastRun = await prisma.linkedInPostPublishRun.findFirst({
    where: { outcome: "success" },
    orderBy: { startedAt: "desc" },
  });
  console.log("\n=== Last successful publish run ===");
  console.log(lastRun);
}

main().finally(() => prisma.$disconnect());
