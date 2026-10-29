import type { CodingArtifact } from "@/lib/workforce/pipelines/codingArtifact";

/** Server-rendered, tenant-checked artifact. React escapes repository content. */
export function CodingArtifactReview({artifact,digest}:{artifact:CodingArtifact;digest:string}) {
  return <section aria-label="Exact coding review" className="mb-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
    <h2 className="text-sm font-semibold text-zinc-100">Review coding changes</h2>
    <p className="mt-1 text-xs leading-5 text-zinc-400">Approval covers these exact files at the saved commit. Structural and assertion checks do not run repository lint or tests.</p>
    <dl className="mt-3 grid min-w-0 gap-3 text-xs sm:grid-cols-2">
      <div><dt className="text-zinc-500">Repository</dt><dd className="mt-1 break-all text-zinc-200">{artifact.repositoryFullName}</dd></div>
      <div><dt className="text-zinc-500">Base branch</dt><dd className="mt-1 break-all text-zinc-200">{artifact.baseBranch}</dd></div>
      <div className="sm:col-span-2"><dt className="text-zinc-500">Base commit</dt><dd className="mt-1 break-all font-mono text-[11px] text-zinc-300">{artifact.baseCommitSha}</dd></div>
    </dl>
    <div className="mt-4 space-y-2">{artifact.files.map(file=><details key={file.path} className="min-w-0 rounded-lg border border-white/10">
      <summary className="cursor-pointer break-all px-3 py-2 text-xs text-zinc-200">{file.path}<span className="ml-2 text-[10px] text-zinc-500">{file.kind}</span></summary>
      <div className="grid min-w-0 gap-3 border-t border-white/10 p-3 lg:grid-cols-2">
        <div className="min-w-0"><p className="mb-1 text-[10px] text-zinc-500">Before</p>{file.before===null?<p className="text-xs text-zinc-500">New file</p>:<pre aria-label={`${file.path} before`} className="max-h-80 overflow-auto whitespace-pre rounded-md bg-black/20 p-2 font-mono text-[11px] text-zinc-400">{file.before}</pre>}</div>
        <div className="min-w-0"><p className="mb-1 text-[10px] text-zinc-500">After</p>{file.after===null?<p className="text-xs text-rose-300">File will be deleted</p>:<pre aria-label={`${file.path} after`} className="max-h-80 overflow-auto whitespace-pre rounded-md bg-black/20 p-2 font-mono text-[11px] text-zinc-200">{file.after}</pre>}</div>
      </div>
    </details>)}</div>
    <details className="mt-3 text-[10px] text-zinc-500"><summary className="cursor-pointer">Review fingerprint</summary><p className="mt-1 break-all font-mono">{digest}</p></details>
  </section>;
}
