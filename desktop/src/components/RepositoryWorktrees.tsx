import {DesktopDialog} from "./DesktopDialog";
import {useCallback, useEffect, useRef, useState} from "react";
import {invoke} from "@tauri-apps/api/core";
interface Worktree {path: string; branch: string; bytes: number}
export function RepositoryWorktrees({repositoryPath, onOpen, disabled = false}: {repositoryPath: string; onOpen: (path: string) => void; disabled?: boolean}) {
  const [rows, setRows] = useState<Worktree[]>([]), [branch, setBranch] = useState("");
  const [verified, setVerified] = useState(false), [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null), [removing, setRemoving] = useState<Worktree | null>(null);
  const mounted = useRef(false), generation = useRef(0), mutation = useRef(false);
  const load = useCallback(async () => {
    const request = ++generation.current;
    try {
      const result = await invoke<Worktree[]>("list_repository_worktrees", {repositoryPath});
      if (!mounted.current || generation.current !== request) return;
      if (!Array.isArray(result) || result.some(row => typeof row.path !== "string" || typeof row.branch !== "string" || !Number.isSafeInteger(row.bytes) || row.bytes < 0)) throw Error("invalid_inventory");
      setRows(result); setVerified(true);
    } catch {if (mounted.current && generation.current === request) {setRows([]); setVerified(false); setNotice("Worktree inventory could not be verified. Refresh before choosing a checkout.");}}
  }, [repositoryPath]);
  useEffect(() => {mounted.current = true; void load(); return () => {mounted.current = false; generation.current++;};}, [load]);
  async function perform(action: "create" | "remove", row?: Worktree) {
    if (disabled || mutation.current || !verified || (action === "remove" && (!row || row.path === repositoryPath))) return;
    mutation.current = true; setBusy(true); setNotice(null); setRemoving(null);
    try {
      if (action === "create") {
        await invoke("create_repository_worktree", {repositoryPath, branchName: branch.trim()});
        if (mounted.current) {setBranch(""); setNotice("Worktree created from the selected checkout’s committed HEAD. Open it below; uncommitted edits remain in their original checkout.");}
      } else {
        await invoke("remove_repository_worktree", {repositoryPath, worktreePath: row!.path});
        if (mounted.current) setNotice("Clean checkout removed. Its branch and commits are retained.");
      }
    } catch {if (mounted.current) setNotice("Worktree operation was not confirmed. Dirty, ignored, locked, index-excluded or changed checkouts are preserved. Review the refreshed inventory before retrying.");}
    finally {if (mounted.current) {await load(); mutation.current = false; setBusy(false);}}
  }
  return <details className="shrink-0 border-b border-white/[0.06] p-2">
    <summary className="cursor-pointer px-1 py-1 text-xs text-zinc-400">Workspaces <span className="text-zinc-600">{verified ? `· ${rows.length} isolated` : "· checking"}</span></summary>
    <p className="mt-2 text-[10px] leading-4 text-zinc-500">Separate branches and files. Starts at the selected checkout’s committed HEAD; uncommitted edits stay here. No automatic tests or dependency installs. Repository hooks and custom checkout filters are skipped.</p>
    <label className="mt-2 block text-[10px] text-zinc-500">New worktree branch<input aria-label="New worktree branch" maxLength={200} value={branch} onChange={event => setBranch(event.target.value)} disabled={disabled || busy} placeholder="axiom/my-task" className="mt-1 w-full rounded border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-zinc-200"/></label>
    <div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={disabled || busy || !verified || !branch.trim()} onClick={() => void perform("create")} className="rounded border border-white/10 px-2 py-1 text-[10px] text-zinc-300 disabled:opacity-40">Create worktree</button><button type="button" disabled={disabled || busy} onClick={() => {setNotice(null); void load();}} className="text-[10px] text-zinc-500 underline disabled:opacity-40">Refresh workspaces</button></div>
    <p className="mt-2 text-[10px] text-zinc-600">Up to 25 checkouts · 50 GB combined file bytes · shared Git objects excluded</p>
    {notice && <p role="status" className="mt-2 break-words text-[10px] leading-4 text-zinc-400">{notice}</p>}
    {verified && rows.length === 0 && <p className="mt-2 text-[10px] text-zinc-500">No managed worktrees yet.</p>}
    <div className="mt-2 max-h-48 overflow-y-auto">{rows.map(row => <div key={row.path} className="border-t border-white/[0.06] py-2"><p className="truncate text-xs text-zinc-300" title={row.path}>{row.branch || "Detached checkout"}{row.path === repositoryPath ? " · current" : ""}</p><p className="mt-1 text-[10px] text-zinc-600">{(row.bytes / 1024 / 1024).toFixed(1)} MB</p><div className="mt-1 flex gap-3"><button type="button" aria-label={`Open ${row.branch}`} disabled={disabled || busy || !verified || row.path === repositoryPath} onClick={() => onOpen(row.path)} className="text-[10px] text-zinc-400 underline disabled:opacity-40">Open</button><button type="button" aria-label={`Remove ${row.branch}`} disabled={disabled || busy || !verified || row.path === repositoryPath} onClick={() => setRemoving(row)} className="text-[10px] text-zinc-500 hover:text-rose-300 disabled:opacity-40">Remove</button></div></div>)}</div>
    {removing && <DesktopDialog label="Remove isolated checkout" busy={busy} onClose={() => setRemoving(null)}><h2 className="text-sm font-semibold text-white">Remove {removing.branch} checkout?</h2><p className="mt-3 text-xs leading-5 text-zinc-400">The local checkout folder will be removed only if it has no changed, untracked or ignored files. The branch and commits remain. Locked worktrees are never forced or pruned.</p><p className="mt-2 break-all font-mono text-[10px] text-zinc-500">{removing.path}</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setRemoving(null)} className="btn-secondary">Cancel</button><button type="button" onClick={() => void perform("remove", removing)} className="btn-secondary">Remove clean checkout</button></div></DesktopDialog>}
  </details>;
}
