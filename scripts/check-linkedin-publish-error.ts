/**
 * One-shot diagnostic: dump the latest LinkedInPostPublishRun outcomes
 * and the connection.lastError. Used to debug why prod publish failed.
 *
 * Run: npx tsx scripts/check-linkedin-publish-error.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const runs = await prisma.linkedInPostPublishRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 3,
    include: { draft: { select: { status: true, body: true, imageUrn: true, scheduledFor: true } } },
  });
  console.log("=== Recent publish runs ===");
  for (const r of runs) {
    console.log({
      id: r.id,
      outcome: r.outcome,
      httpStatus: r.httpStatus,
      errorDetail: r.errorDetail?.slice(0, 600),
      startedAt: r.startedAt,
      draftStatus: r.draft.status,
      hasImage: Boolean(r.draft.imageUrn),
      bodyPreview: r.draft.body.slice(0, 100),
    });
  }

  const conn = await prisma.linkedInAccountConnection.findFirst({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      lastError: true,
      lastUsedAt: true,
      organizationUrn: true,
      linkedinUrn: true,
      scopes: true,
      expiresAt: true,
    },
  });
  console.log("\n=== Active connection ===");
  console.log(conn);
}

main().finally(() => prisma.$disconnect());
