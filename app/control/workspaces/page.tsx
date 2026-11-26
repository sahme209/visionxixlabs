import Link from "next/link";

/** Recovery destination deliberately performs no tenant reads or redirects. */
export default function WorkspacesPage() {
  return <section aria-labelledby="workspaces-heading" className="max-w-2xl">
    <h1 id="workspaces-heading">Workspaces</h1>
    <p className="mt-3 text-sm text-zinc-400">Choose an available workspace in the sidebar, then select Open workspace.</p>
    <ol className="mt-6 grid gap-3 text-sm">
      <li className="rounded-xl border border-white/8 bg-[#111111] p-4"><p className="text-zinc-200">1. Pick a workspace</p><p className="mt-1 text-xs leading-5 text-zinc-400">The menu at the top of the sidebar lists only workspaces where your membership is verified.</p></li>
      <li className="rounded-xl border border-white/8 bg-[#111111] p-4"><p className="text-zinc-200">2. Open it</p><p className="mt-1 text-xs leading-5 text-zinc-400">Open workspace switches this session. Pages then show that workspace’s records and your role in it.</p></li>
      <li className="rounded-xl border border-white/8 bg-[#111111] p-4"><p className="text-zinc-200">3. No workspace listed?</p><p className="mt-1 text-xs leading-5 text-zinc-400">Ask a workspace owner or admin to invite you from Members. Invitation links expire after 7 days.</p></li>
    </ol>
    <p className="mt-6 text-xs text-zinc-500"><Link href="/docs/surfaces" className="underline underline-offset-4 hover:text-zinc-300">Where to work in V19</Link></p>
  </section>;
}
