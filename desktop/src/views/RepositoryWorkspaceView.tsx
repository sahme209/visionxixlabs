import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ExternalLink } from "../components/Primitives";
import { desktopClient } from "../lib/desktopClient";

interface RepositoryStatus {
  rootPath: string;
  repositoryFullName: string | null;
  branch: string;
  ahead: number;
  behind: number;
  changedFiles: Array<{ path: string; status: string }>;
}

export function RepositoryWorkspaceView() {
  const [parentPath, setParentPath] = useState("");
  const [repositories, setRepositories] = useState<string[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<string | null>(null);
  const [status, setStatus] = useState<RepositoryStatus | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cloneRepository, setCloneRepository] = useState("");
  const [branchName, setBranchName] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [prTitle, setPrTitle] = useState("");
  const [prBase, setPrBase] = useState("main");
  const [prUrl, setPrUrl] = useState<string | null>(null);

  const refreshRepository = useCallback(async (repositoryPath: string) => {
    const [nextStatus, nextFiles] = await Promise.all([
      invoke<RepositoryStatus>("repository_status", { repositoryPath }),
      invoke<string[]>("list_repository_files", { repositoryPath }),
    ]);
    setStatus(nextStatus);
    setFiles(nextFiles);
  }, []);

  const refreshList = useCallback(async (directory: string) => {
    const next = await invoke<string[]>("list_local_repositories", { parentPath: directory });
    setRepositories(next);
    setSelectedRepository((current) => current && next.includes(current) ? current : (next[0] ?? null));
  }, []);

  useEffect(() => {
    void invoke<string>("default_repos_directory").then((directory) => {
      setParentPath(directory);
      return refreshList(directory);
    }).catch((cause) => setError(String(cause)));
  }, [refreshList]);

  useEffect(() => {
    if (!selectedRepository) return;
    setError(null);
    setSelectedFile(null);
    setContent("");
    setSavedContent("");
    void refreshRepository(selectedRepository).catch((cause) => setError(String(cause)));
  }, [refreshRepository, selectedRepository]);

  const visibleFiles = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return query ? files.filter((file) => file.toLowerCase().includes(query)) : files;
  }, [files, filter]);

  async function run(label: string, operation: () => Promise<void>) {
    setBusy(label); setError(null); setNotice(null);
    try { await operation(); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(null); }
  }

  async function selectFile(path: string) {
    if (!selectedRepository) return;
    if (content !== savedContent && !window.confirm("Discard the unsaved editor changes?")) return;
    await run("open", async () => {
      const next = await invoke<string>("read_repository_file", { repositoryPath: selectedRepository, relativePath: path });
      setSelectedFile(path); setContent(next); setSavedContent(next); setCommitMessage("");
    });
  }

  function chooseRepository(repository: string) {
    if (repository === selectedRepository) return;
    if (content !== savedContent && !window.confirm("Discard the unsaved editor changes and switch repositories?")) return;
    setSelectedRepository(repository);
  }

  async function saveFile() {
    if (!selectedRepository || !selectedFile) return;
    await run("save", async () => {
      await invoke("write_repository_file", { repositoryPath: selectedRepository, relativePath: selectedFile, content });
      setSavedContent(content); setNotice(`Saved ${selectedFile}`);
      await refreshRepository(selectedRepository);
    });
  }

  async function clone() {
    if (!cloneRepository.includes("/") || !parentPath) return;
    await run("clone", async () => {
      const credential = await desktopClient.mintGithubCloneToken({ repositoryFullName: cloneRepository, purpose: "clone" });
      if (!credential.ok) throw new Error(credential.error);
      const repositoryName = cloneRepository.split("/")[1];
      const destinationPath = `${parentPath.replace(/\/$/, "")}/${repositoryName}`;
      await invoke("clone_repository", { cloneUrl: credential.data.cloneUrl, destinationPath });
      await refreshList(parentPath);
      setSelectedRepository(destinationPath);
      setCloneRepository("");
      setNotice(`Cloned ${cloneRepository} without storing its access token.`);
    });
  }

  async function sync(direction: "pull" | "push") {
    if (!selectedRepository || !status?.repositoryFullName) return;
    const warning = direction === "push"
      ? `Push branch ${status.branch} to ${status.repositoryFullName}? This changes GitHub.`
      : `Pull ${status.repositoryFullName}/${status.branch} with fast-forward only?`;
    if (!window.confirm(warning)) return;
    await run(direction, async () => {
      const credential = await desktopClient.mintGithubCloneToken({ repositoryFullName: status.repositoryFullName!, purpose: direction });
      if (!credential.ok) throw new Error(credential.error);
      await invoke(`${direction}_repository`, { repositoryPath: selectedRepository, authenticatedUrl: credential.data.cloneUrl });
      await refreshRepository(selectedRepository);
      setNotice(direction === "push" ? "Branch pushed to GitHub." : "Repository synchronized with a fast-forward pull.");
    });
  }

  async function createBranch() {
    if (!selectedRepository || !branchName.trim()) return;
    await run("branch", async () => {
      await invoke("create_repository_branch", { repositoryPath: selectedRepository, branchName: branchName.trim() });
      setBranchName("");
      await refreshRepository(selectedRepository);
      setNotice("Local branch created. Push it when you are ready to publish it.");
    });
  }

  async function commit() {
    if (!selectedRepository || !selectedFile || !commitMessage.trim()) return;
    await run("commit", async () => {
      if (content !== savedContent) {
        await invoke("write_repository_file", { repositoryPath: selectedRepository, relativePath: selectedFile, content });
        setSavedContent(content);
      }
      const sha = await invoke<string>("commit_repository_file", { repositoryPath: selectedRepository, relativePath: selectedFile, message: commitMessage.trim() });
      setCommitMessage("");
      await refreshRepository(selectedRepository);
      setNotice(`Committed ${selectedFile} at ${sha.slice(0, 8)}. Push explicitly when ready.`);
    });
  }

  async function openPullRequest() {
    if (!status?.repositoryFullName || !prTitle.trim() || !status.branch || status.branch === prBase) return;
    await run("pr", async () => {
      const result = await desktopClient.openGithubPullRequest({
        repositoryFullName: status.repositoryFullName!, head: status.branch, base: prBase.trim(), title: prTitle.trim(),
        body: "Opened from the governed Axiom Agent desktop repository workspace.",
      });
      if (!result.ok) throw new Error(result.error);
      setPrUrl(result.data.htmlUrl); setPrTitle("");
      setNotice(`Pull request #${result.data.number} opened.`);
    });
  }

  function editorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void saveFile(); return; }
    if (event.key === "Tab") {
      event.preventDefault();
      const target = event.currentTarget;
      const next = `${content.slice(0, target.selectionStart)}  ${content.slice(target.selectionEnd)}`;
      const cursor = target.selectionStart + 2;
      setContent(next);
      requestAnimationFrame(() => { target.selectionStart = cursor; target.selectionEnd = cursor; });
    }
  }

  return <div className="flex min-h-0 flex-1 flex-col bg-[#0b0c0e]">
    <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
      <input value={cloneRepository} onChange={(event) => setCloneRepository(event.target.value)} placeholder="owner/repository" className="w-56 rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-400/50" />
      <input value={parentPath} onChange={(event) => setParentPath(event.target.value)} aria-label="Local repositories folder" className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-400 outline-none focus:border-violet-400/50" />
      <button type="button" disabled={Boolean(busy) || !cloneRepository.includes("/")} onClick={() => void clone()} className="btn-primary disabled:opacity-40">{busy === "clone" ? "Cloning…" : "Clone"}</button>
      <button type="button" disabled={Boolean(busy) || !parentPath} onClick={() => void refreshList(parentPath)} className="btn-secondary disabled:opacity-40">Refresh</button>
    </div>
    {(error || notice) && <div role={error ? "alert" : "status"} className={`border-b px-4 py-2 text-xs ${error ? "border-rose-500/20 bg-rose-500/5 text-rose-300" : "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"}`}>{error ?? notice}</div>}
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-64 shrink-0 flex-col border-r border-white/[0.07] bg-[#111315]">
        <div className="border-b border-white/[0.06] px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">Local repositories</div>
        <div className="max-h-40 overflow-y-auto border-b border-white/[0.06] p-2">
          {repositories.length === 0 && <p className="px-2 py-3 text-xs text-zinc-600">Clone a connected GitHub repository to begin.</p>}
          {repositories.map((repository) => <button key={repository} type="button" onClick={() => chooseRepository(repository)} className={`mb-1 w-full truncate rounded px-2 py-2 text-left text-xs ${selectedRepository === repository ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/[0.05]"}`} title={repository}>{repository.split("/").pop()}</button>)}
        </div>
        <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter files" className="m-2 rounded-md border border-white/10 bg-black/20 px-2.5 py-2 text-xs outline-none focus:border-violet-400/50" />
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {visibleFiles.map((file) => <button key={file} type="button" onClick={() => void selectFile(file)} className={`block w-full truncate rounded px-2 py-1.5 text-left font-mono text-[11px] ${selectedFile === file ? "bg-violet-500/15 text-violet-100" : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"}`} title={file}>{file}</button>)}
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] px-3 py-2">
          <span className="mr-auto truncate text-xs text-zinc-300">{status ? `${status.repositoryFullName ?? "Local repository"} · ${status.branch}` : "Choose a repository"}</span>
          {status && <span className="text-[10px] text-zinc-600">↑{status.ahead} ↓{status.behind} · {status.changedFiles.length} changed</span>}
          <input value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="new branch" className="w-36 rounded border border-white/10 bg-black/20 px-2 py-1.5 text-xs outline-none" />
          <button type="button" disabled={Boolean(busy) || !selectedRepository || !branchName.trim()} onClick={() => void createBranch()} className="btn-secondary disabled:opacity-40">Branch</button>
          <button type="button" disabled={Boolean(busy) || !status?.repositoryFullName} onClick={() => void sync("pull")} className="btn-secondary disabled:opacity-40">{busy === "pull" ? "Pulling…" : "Pull"}</button>
          <button type="button" disabled={Boolean(busy) || !status?.repositoryFullName} onClick={() => void sync("push")} className="btn-secondary disabled:opacity-40">{busy === "push" ? "Pushing…" : "Push"}</button>
        </div>
        {selectedFile ? <>
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
            <span className="mr-auto truncate font-mono text-[11px] text-zinc-400">{selectedFile}{content !== savedContent ? " · unsaved" : ""}</span>
            <button type="button" disabled={Boolean(busy) || content === savedContent} onClick={() => void saveFile()} className="btn-secondary disabled:opacity-40">Save ⌘S</button>
          </div>
          <textarea value={content} onChange={(event) => setContent(event.target.value)} onKeyDown={editorKeyDown} spellCheck={false} aria-label={`Editing ${selectedFile}`} className="min-h-0 flex-1 resize-none bg-[#0b0c0e] p-4 font-mono text-[13px] leading-6 text-zinc-200 outline-none selection:bg-violet-500/30" />
          <div className="grid grid-cols-[minmax(220px,1fr)_auto_minmax(180px,0.7fr)_120px_auto] items-center gap-2 border-t border-white/[0.07] bg-[#111315] p-3">
            <input value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} placeholder="Commit message for this file" className="rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs outline-none" />
            <button type="button" disabled={Boolean(busy) || !commitMessage.trim()} onClick={() => void commit()} className="btn-primary disabled:opacity-40">{busy === "commit" ? "Committing…" : "Commit file"}</button>
            <input value={prTitle} onChange={(event) => setPrTitle(event.target.value)} placeholder="Pull request title" className="rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs outline-none" />
            <input value={prBase} onChange={(event) => setPrBase(event.target.value)} placeholder="base" className="rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs outline-none" />
            {prUrl ? <ExternalLink href={prUrl} className="text-xs text-emerald-300 hover:text-white">Open PR ↗</ExternalLink> : <button type="button" disabled={Boolean(busy) || !prTitle.trim() || !status || status.branch === prBase} onClick={() => void openPullRequest()} className="btn-secondary disabled:opacity-40">{busy === "pr" ? "Opening…" : "Open PR"}</button>}
          </div>
        </> : <div className="flex flex-1 items-center justify-center text-sm text-zinc-600">Choose a UTF-8 text file to edit.</div>}
      </section>
    </div>
  </div>;
}
