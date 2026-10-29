import { useRef, useState, useSyncExternalStore } from "react";
import { desktopClient } from "../lib/desktopClient";
type Catalogue = { repositoryFullName: string; ref: string; files: Array<{ name: string; path: string; blobSha: string }> };
function validCatalogue(data: Catalogue, repository: string, ref: string) {
  return data?.repositoryFullName === repository && data.ref === ref && Array.isArray(data.files) && data.files.length <= 200 && new Set(data.files.map(file => file.name)).size === data.files.length && data.files.every(file => typeof file.name === "string" && /^[A-Za-z0-9_][A-Za-z0-9_. -]{0,150}\.ya?ml$/.test(file.name) && file.path === `.github/workflows/${file.name}` && /^[a-f0-9]{40}$/.test(file.blobSha));
}
/** Discovery assists intake; a selected file is not a runnable or approved action. */
export function WorkflowCatalogue({ repositoryFullName, refName, workflowPath, onSelect }: {
  repositoryFullName: string; refName: string; workflowPath: string; onSelect: (path: string) => void;
}) {
  const revision = useSyncExternalStore(desktopClient.subscribeContext, desktopClient.getContextRevision, desktopClient.getContextRevision);
  const key = JSON.stringify([repositoryFullName, refName, revision]);
  const current = useRef(key); current.current = key;
  const [load, setLoad] = useState<{ key: string; config: typeof desktopClient.config; status: "loading" | "ready" | "error"; data?: Catalogue }>();
  const owned = load?.key === key && load.config === desktopClient.config ? load : undefined;
  const data = owned?.status === "ready" ? owned.data : undefined;
  const canRead = /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(repositoryFullName) && Boolean(refName.trim());
  async function read() {
    if (!canRead || owned?.status === "loading") return;
    const owner = key, config = desktopClient.config;
    setLoad({ key: owner, config, status: "loading" });
    try {
      const result = await desktopClient.listGithubWorkflows(repositoryFullName, refName);
      if (current.current !== owner || config !== desktopClient.config) return;
      if (!result.ok || !validCatalogue(result.data, repositoryFullName, refName)) { setLoad({ key: owner, config, status: "error" }); return; }
      setLoad({ key: owner, config, status: "ready", data: result.data });
    } catch { if (current.current === owner && config === desktopClient.config) setLoad({ key: owner, config, status: "error" }); }
  }
  const listed = data?.files.some(file => file.path === workflowPath);
  return <div className="col-span-2 space-y-2 rounded-lg border border-white/10 p-3">
    <div className="flex items-center justify-between gap-3"><p className="text-xs text-zinc-400">Find workflow files in the selected repository and branch.</p><button type="button" className="btn-secondary shrink-0" disabled={!canRead || owned?.status === "loading"} onClick={() => void read()}>{owned?.status === "loading" ? "Finding workflows…" : "Find workflows"}</button></div>
    {owned?.status === "error" && <p role="status" className="text-xs text-amber-300">Workflow files could not be verified. Your recorded workflow is retained.</p>}
    {data && <><label className="block space-y-1 text-xs text-zinc-400"><span>Repository workflow</span><select aria-label="Repository workflow" value={listed ? workflowPath : ""} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200" onChange={event => { if (data.files.some(file => file.path === event.target.value)) onSelect(event.target.value); }}><option value="">Choose a workflow file</option>{data.files.map(file => <option key={file.path} value={file.path}>{file.name}</option>)}</select></label>
    {data.files.length === 0 && <p className="text-xs text-zinc-400">No workflow files were found at this source.</p>}
    {workflowPath && !listed && <p className="text-xs text-amber-300">Your recorded workflow is not in this listing. It has not been changed.</p>}
    <p className="text-[11px] text-zinc-500">{data.repositoryFullName} · {data.ref}. Select a file, then read its fields. Listing a file does not verify dispatch support.</p></>}
  </div>;
}
