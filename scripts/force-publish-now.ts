/**
 * One-shot: take the newest LinkedInPostDraft in status="scheduled" and
 * pull its scheduledFor into the past so the next publish-cron tick picks
 * it up immediately. No-op if there isn't a scheduled draft.
 *
 * Run: npx tsx scripts/force-publish-now.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const draft = await prisma.linkedInPostDraft.findFirst({
    where: { status: "scheduled" },
    orderBy: { scheduledFor: "desc" },
  });
  if (!draft) {
    console.log("no scheduled draft — nothing to fast-forward");
    return;
  }
  const past = new Date(Date.now() - 60_000);
  await prisma.linkedInPostDraft.update({
    where: { id: draft.id },
    data: { scheduledFor: past },
  });
  console.log("fast-forwarded:", {
    id: draft.id,
    bodyPreview: draft.body.slice(0, 80),
    hasImage: Boolean(draft.imageUrn),
    newScheduledFor: past.toISOString(),
  });
}

main().finally(() => prisma.$disconnect());
