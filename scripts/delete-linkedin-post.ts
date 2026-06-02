/**
 * One-shot: delete a published LinkedIn post via the Posts API.
 *
 *   DELETE https://api.linkedin.com/rest/posts/{encoded-urn}
 *
 * Uses the stored member token. Member-tier `w_member_social` grants
 * delete-self on the user's own posts. Marks the local draft as
 * `failed` so it doesn't reappear in any timeline.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TARGET_URN = "urn:li:share:7467661358357151744";

async function main() {
  const conn = await prisma.linkedInAccountConnection.findFirst({
    where: { status: "connected" },
    orderBy: { updatedAt: "desc" },
  });
  if (!conn) {
    console.log("no connected account — abort");
    return;
  }

  const encoded = encodeURIComponent(TARGET_URN);
  const url = `https://api.linkedin.com/rest/posts/${encoded}`;
  const version = process.env.LINKEDIN_REST_VERSION || "202605";

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization:             `Bearer ${conn.accessToken}`,
      "LinkedIn-Version":        version,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    cache: "no-store",
  });

  const body = await res.text().catch(() => "");
  console.log({
    status: res.status,
    ok: res.ok,
    body: body.slice(0, 400),
  });

  if (res.ok || res.status === 204) {
    const updated = await prisma.linkedInPostDraft.updateMany({
      where: { linkedinPostUrn: TARGET_URN },
      data:  { status: "failed", linkedinPostUrn: null },
    });
    console.log("draft rows reset:", updated.count);
  }
}

main().finally(() => prisma.$disconnect());
