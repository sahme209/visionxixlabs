import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { browserReleaseScope } from "@/lib/releaseops/browserReleaseScope";

export const dynamic = "force-dynamic";

const releaseStatus = new Map([
  ["draft", "Draft"],
  ["ready", "Ready"],
  ["deploying", "Deploying"],
  ["deployed", "Deployed"],
  ["rolled_back", "Rolled back"],
  ["failed", "Failed"],
]);

function Unavailable({ message }: { message: string }) {
  return <section className="max-w-2xl rounded-lg border border-white/10 p-5">
    <h1 className="text-xl font-semibold">Release unavailable</h1>
    <p className="mt-2 text-sm text-zinc-300">{message}</p>
  </section>;
}

export default async function LinkedReleasePage({ params }: { params: Promise<{ id: string }> }) {
  const scope = browserReleaseScope(await currentContext());
  if (!scope) return <Unavailable message="This release requires an active workspace membership." />;

  const { id } = await params;
  const release = await readLinkedRelease(id, scope.organizationId).catch(() => undefined);
  const current = browserReleaseScope(await currentContext());
  if (!current || current.userId !== scope.userId || current.organizationId !== scope.organizationId || release === null) {
    return <Unavailable message="This release could not be found in the active workspace. Check the workspace selector and reopen the link from V19 Studio." />;
  }
  if (!release) return <Unavailable message="The release record could not be checked. Reload the page to try again." />;

  return <section className="max-w-3xl space-y-6">
    <div>
      <p className="text-sm text-zinc-300">Release record</p>
      <h1 className="mt-2 text-2xl font-semibold">{release.releaseTag ?? "Untagged release"}</h1>
      {release.summary && <p className="mt-2 break-words text-sm text-zinc-300">{release.summary}</p>}
    </div>
    <dl className="space-y-4 rounded-lg border border-white/10 p-5 text-sm">
      <div><dt className="text-zinc-300">Status</dt><dd>{releaseStatus.get(release.status) ?? "Unknown"}</dd></div>
      <div><dt className="text-zinc-300">Release ID</dt><dd className="break-all font-mono">{release.id}</dd></div>
      <div><dt className="text-zinc-300">Commit</dt><dd className="break-all font-mono">{release.commitSha ?? "Awaiting a recorded commit"}</dd></div>
    </dl>
    <section aria-labelledby="linked-change-tickets" className="space-y-3">
      <h2 id="linked-change-tickets" className="text-lg font-semibold">Linked change tickets</h2>
      {release.tickets.length ? <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
        {release.tickets.slice(0, 50).map(ticket => <li key={ticket.id} className="break-words p-4 text-sm">
          <span className="font-mono">{ticket.externalKey}</span> <span className="text-zinc-300">{ticket.title}</span>
        </li>)}
      </ul> : <p className="text-sm text-zinc-300">No linked change tickets are recorded.</p>}
      {release.tickets.length > 50 && <p className="text-sm text-zinc-300">Showing 50 linked change tickets.</p>}
    </section>
    <p className="text-sm text-zinc-300">Use V19 Studio for release actions.</p>
  </section>;
}

async function readLinkedRelease(id: string, organizationId: string) {
  const release = await prisma.release.findFirst({
    where: { id, organizationId },
    select: { id: true, releaseTag: true, commitSha: true, status: true, summary: true },
  });
  if (!release) return null;
  const tickets = await prisma.changeTicket.findMany({
    where: { organizationId, linkedReleaseIds: { has: release.id } },
    orderBy: [{ lastSyncedAt: "desc" }, { id: "asc" }],
    take: 51,
    select: { id: true, externalKey: true, title: true },
  });
  return { ...release, tickets };
}
