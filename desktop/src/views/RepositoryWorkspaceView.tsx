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

interface GitHubRepository {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  defaultBranch: string;
  visibility: "private" | "public";
}

interface RepositoryCheck {
  id: string;
  label: string;
  command: string;
  description: string;
}

interface RepositoryCheckResult {
  checkId: string;
  success: boolean;
  exitCode: number | null;
  output: string;
  durationMs: number;
}

interface Confirmation {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

const WORKSPACE_NOISE_SEGMENTS = new Set([
  ".git", ".next", "build", "DerivedData", "dist", "node_modules", "target", "xcuserdata",
]);

function isWorkspaceNoise(path: string): boolean {
  if (path.endsWith("/.DS_Store") || path === ".DS_Store") return true;
  return path.split("/").some((segment) => WORKSPACE_NOISE_SEGMENTS.has(segment));
}

function isProjectMetadata(path: string): boolean {
  return path.endsWith(".pbxproj") || path.includes(".xcodeproj/") || path.includes(".xcworkspace/");
}

export function RepositoryWorkspaceView() {
  const [parentPath, setParentPath] = useState("");
  const [repositories, setRepositories] = useState<string[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<string | null>(null);
  const [status, setStatus] = useState<RepositoryStatus | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cloneRepository, setCloneRepository] = useState("");
  const [manualCloneRepository, setManualCloneRepository] = useState(false);
  const [remoteRepositories, setRemoteRepositories] = useState<GitHubRepository[]>([]);
  const [repositoryCatalogError, setRepositoryCatalogError] = useState<string | null>(null);
  const [repositoryCatalogTruncated, setRepositoryCatalogTruncated] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [prTitle, setPrTitle] = useState("");
  const [prBase, setPrBase] = useState("main");
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [checks, setChecks] = useState<RepositoryCheck[]>([]);
  const [verificationResult, setVerificationResult] = useState<RepositoryCheckResult | null>(null);
  const [showVerification, setShowVerification] = useState(false);

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
    void desktopClient.listGithubRepositories().then((repositoriesResult) => {
      if (!repositoriesResult.ok) {
        setRepositoryCatalogError(repositoriesResult.error);
      } else {
        setRemoteRepositories(repositoriesResult.data.repositories);
        const preferred = window.localStorage.getItem("axiom.workspace.repository.v1");
        const selected = repositoriesResult.data.repositories.find((repository) => repository.fullName === preferred) ?? repositoriesResult.data.repositories[0];
        setCloneRepository((current) => current || selected?.fullName || "");
        setRepositoryCatalogTruncated(repositoriesResult.data.truncated);
        setRepositoryCatalogError(null);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedRepository) return;
    setError(null);
    setSelectedFile(null);
    setContent("");
    setSavedContent("");
    setPrUrl(null);
    setVerificationResult(null);
    void Promise.all([
      refreshRepository(selectedRepository),
      invoke<RepositoryCheck[]>("detect_repository_checks", { repositoryPath: selectedRepository }).then(setChecks),
    ]).catch((cause) => setError(String(cause)));
  }, [refreshRepository, selectedRepository]);

  const visibleFiles = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const relevantFiles = showAllFiles ? files : files.filter((file) => !isWorkspaceNoise(file));
    return query ? relevantFiles.filter((file) => file.toLowerCase().includes(query)) : relevantFiles;
  }, [files, filter, showAllFiles]);
  const connectedRepository = status?.repositoryFullName
    ? remoteRepositories.find((repository) => repository.fullName.toLowerCase() === status.repositoryFullName?.toLowerCase())
    : undefined;
  const onDefaultBranch = Boolean(status?.branch && connectedRepository?.defaultBranch === status.branch);

  useEffect(() => {
    if (!status?.repositoryFullName) return;
    const connectedRepository = remoteRepositories.find((repository) => repository.fullName === status.repositoryFullName);
    if (connectedRepository) setPrBase(connectedRepository.defaultBranch);
  }, [remoteRepositories, status?.repositoryFullName]);

  useEffect(() => {
    if (!confirmation) return;
    const dismiss = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setConfirmation(null);
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [confirmation]);

  async function run(label: string, operation: () => Promise<void>) {
    setBusy(label); setError(null); setNotice(null);
    try { await operation(); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(null); }
  }

  async function openFile(path: string) {
    if (!selectedRepository) return;
    await run("open", async () => {
      const next = await invoke<string>("read_repository_file", { repositoryPath: selectedRepository, relativePath: path });
      setSelectedFile(path); setContent(next); setSavedContent(next); setCommitMessage("");
    });
  }

  function selectFile(path: string) {
    if (content !== savedContent) {
      setConfirmation({
        title: "Discard unsaved changes?",
        description: `Your edits to ${selectedFile ?? "the current file"} have not been saved.`,
        confirmLabel: "Discard and open",
        destructive: true,
        onConfirm: () => openFile(path),
      });
      return;
    }
    void openFile(path);
  }

  function chooseRepository(repository: string) {
    if (repository === selectedRepository) return;
    if (content !== savedContent) {
      setConfirmation({
        title: "Switch repositories?",
        description: `Your edits to ${selectedFile ?? "the current file"} will be discarded.`,
        confirmLabel: "Discard and switch",
        destructive: true,
        onConfirm: () => setSelectedRepository(repository),
      });
      return;
    }
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
    const repositoryFullName = cloneRepository.trim();
    if (!repositoryFullName.includes("/") || !parentPath) return;
    await run("clone", async () => {
      const credential = await desktopClient.mintGithubCloneToken({ repositoryFullName, purpose: "clone" });
      if (!credential.ok) throw new Error(credential.error);
      const repositoryName = repositoryFullName.split("/")[1];
      const destinationPath = `${parentPath.replace(/\/$/, "")}/${repositoryName}`;
      await invoke("clone_repository", { cloneUrl: credential.data.cloneUrl, destinationPath });
      await refreshList(parentPath);
      setSelectedRepository(destinationPath);
      setNotice(`Cloned ${repositoryFullName} without storing its access token.`);
    });
  }

  async function performSync(direction: "pull" | "push") {
    if (!selectedRepository || !status?.repositoryFullName) return;
    await run(direction, async () => {
      const repositoryFullName = status.repositoryFullName;
      if (!repositoryFullName) return;
      if (direction === "push" && onDefaultBranch) throw new Error("Create a branch and open a pull request; direct pushes to the default branch are not allowed.");
      const credential = await desktopClient.mintGithubCloneToken({ repositoryFullName, purpose: direction, ...(direction === "push" ? { branch: status.branch } : {}) });
      if (!credential.ok) throw new Error(credential.error);
      await invoke(`${direction}_repository`, { repositoryPath: selectedRepository, authenticatedUrl: credential.data.cloneUrl });
      await refreshRepository(selectedRepository);
      setNotice(direction === "push" ? "Branch pushed to GitHub." : "Repository synchronized with a fast-forward pull.");
    });
  }

  function sync(direction: "pull" | "push") {
    if (!status?.repositoryFullName) return;
    setConfirmation({
      title: direction === "push" ? "Push branch to GitHub?" : "Pull remote changes?",
      description: direction === "push"
        ? `${status.branch} will be published to ${status.repositoryFullName}. No force push is used.`
        : `${status.repositoryFullName}/${status.branch} will be fetched and merged only if it can fast-forward safely.`,
      confirmLabel: direction === "push" ? "Push branch" : "Pull changes",
      onConfirm: () => performSync(direction),
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
      if (onDefaultBranch) throw new Error("Create a branch before committing. Changes must reach the default branch through a pull request.");
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

  async function publishAndOpenPullRequest() {
    if (!status?.repositoryFullName || !prTitle.trim() || !prBase.trim() || !status.branch || status.branch === prBase.trim()) return;
    await run("pr", async () => {
      const repositoryFullName = status.repositoryFullName;
      if (!repositoryFullName || !selectedRepository) return;
      const credential = await desktopClient.mintGithubCloneToken({ repositoryFullName, purpose: "push", branch: status.branch });
      if (!credential.ok) throw new Error(credential.error);
      await invoke("push_repository", { repositoryPath: selectedRepository, authenticatedUrl: credential.data.cloneUrl });
      const result = await desktopClient.openGithubPullRequest({
        repositoryFullName, head: status.branch, base: prBase.trim(), title: prTitle.trim(),
        body: "Opened from the governed Axiom Agent desktop repository workspace.",
      });
      if (!result.ok) throw new Error(result.error);
      setPrUrl(result.data.htmlUrl); setPrTitle("");
      setNotice(`Pull request #${result.data.number} opened.`);
      await refreshRepository(selectedRepository);
    });
  }

  function reviewPullRequest() {
    if (!status?.repositoryFullName) return;
    setConfirmation({
      title: "Publish branch and open pull request?",
      description: `${status.branch} will be pushed to ${status.repositoryFullName}, then a pull request into ${prBase.trim()} will be opened.`,
      confirmLabel: "Publish and open PR",
      onConfirm: publishAndOpenPullRequest,
    });
  }

  async function confirmAction() {
    const action = confirmation;
    setConfirmation(null);
    await action?.onConfirm();
  }

  function verify(check: RepositoryCheck) {
    if (!selectedRepository) return;
    setConfirmation({
      title: `Run ${check.label}?`,
      description: `${check.command} will run inside this repository with credentials removed, a 5 minute timeout, and a 1 MB output limit. Repository scripts are code; run only repositories you trust.`,
      confirmLabel: "Run check",
      onConfirm: async () => {
        await run(`verify:${check.id}`, async () => {
          const result = await invoke<RepositoryCheckResult>("run_repository_check", { repositoryPath: selectedRepository, checkId: check.id });
          setVerificationResult(result);
          setShowVerification(true);
          await refreshRepository(selectedRepository);
          setNotice(result.success ? `${check.label} passed.` : `${check.label} failed with exit code ${result.exitCode ?? "unknown"}.`);
        });
      },
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
      <div className="w-72">
        <select value={manualCloneRepository ? "__manual__" : cloneRepository} onChange={(event) => {
          if (event.target.value === "__manual__") {
            setManualCloneRepository(true);
            setCloneRepository("");
          } else {
            setManualCloneRepository(false);
            setCloneRepository(event.target.value);
            window.localStorage.setItem("axiom.workspace.repository.v1", event.target.value);
          }
        }} aria-label="Connected GitHub repository" className="w-full rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-400/50">
          {remoteRepositories.length === 0 && <option value="">No connected repositories</option>}
          {remoteRepositories.map((repository) => <option key={repository.id} value={repository.fullName}>{repository.fullName} · {repository.visibility}</option>)}
          <option value="__manual__">Enter another authorized repository…</option>
        </select>
        {manualCloneRepository && <input autoFocus value={cloneRepository} onChange={(event) => setCloneRepository(event.target.value)} placeholder="owner/repository" aria-label="Repository owner and name" className="mt-2 w-full rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-400/50" />}
      </div>
      <input value={parentPath} onChange={(event) => setParentPath(event.target.value)} aria-label="Local repositories folder" className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-400 outline-none focus:border-violet-400/50" />
      <button type="button" disabled={Boolean(busy) || !cloneRepository.trim().includes("/")} onClick={() => void clone()} className="btn-primary disabled:opacity-40">{busy === "clone" ? "Cloning…" : "Clone"}</button>
      <button type="button" disabled={Boolean(busy) || !parentPath} onClick={() => void refreshList(parentPath)} className="btn-secondary disabled:opacity-40">Refresh</button>
    </div>
    {repositoryCatalogError && <div role="status" className="border-b border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs text-zinc-300">Connected repositories are temporarily unavailable. Validate GitHub under Settings → Integrations, then retry. Manual entry remains available for an authorized repository.</div>}
    {repositoryCatalogTruncated && !repositoryCatalogError && <div className="border-b border-white/[0.06] bg-white/[0.02] px-4 py-2 text-xs text-zinc-500">Showing the first 100 repositories authorized for the GitHub App. You can still enter another authorized owner/repository directly.</div>}
    {(error || notice) && <div role={error ? "alert" : "status"} className={`border-b px-4 py-2 text-xs ${error ? "border-rose-500/20 bg-rose-500/5 text-rose-300" : "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"}`}>{error ?? notice}</div>}
    {selectedRepository && <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-white/[0.015] px-4 py-2">
      <span className="mr-1 text-[10px] font-mono uppercase tracking-wider text-zinc-600">Verify changes</span>
      {checks.length === 0 ? <span className="text-xs text-zinc-600">No supported checks detected.</span> : checks.map((check) => <button key={check.id} type="button" disabled={Boolean(busy)} onClick={() => verify(check)} title={`${check.description} Runs: ${check.command}`} className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.07] disabled:opacity-40">{busy === `verify:${check.id}` ? `Running ${check.label}…` : check.label}</button>)}
      {verificationResult && <button type="button" onClick={() => setShowVerification((current) => !current)} className={`ml-auto rounded-md px-2.5 py-1.5 text-xs ${verificationResult.success ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>{verificationResult.success ? "Last check passed" : "Last check failed"} · {showVerification ? "hide output" : "show output"}</button>}
    </div>}
    {showVerification && verificationResult && <div className="max-h-56 overflow-auto border-b border-white/[0.07] bg-black/30 p-3">
      <div className="mb-2 flex items-center justify-between text-[10px] text-zinc-500"><span>{verificationResult.checkId}</span><span>{(verificationResult.durationMs / 1000).toFixed(1)}s · exit {verificationResult.exitCode ?? "none"}</span></div>
      <pre tabIndex={0} className="whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-zinc-300">{verificationResult.output || "The check completed without output."}</pre>
    </div>}
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-64 shrink-0 flex-col border-r border-white/[0.07] bg-[#111315]">
        <div className="border-b border-white/[0.06] px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">Local repositories</div>
        <div className="max-h-40 overflow-y-auto border-b border-white/[0.06] p-2">
          {repositories.length === 0 && <p className="px-2 py-3 text-xs text-zinc-600">Clone a connected GitHub repository to begin.</p>}
          {repositories.map((repository) => <button key={repository} type="button" onClick={() => chooseRepository(repository)} className={`mb-1 w-full truncate rounded px-2 py-2 text-left text-xs ${selectedRepository === repository ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/[0.05]"}`} title={repository}>{repository.split("/").pop()}</button>)}
        </div>
        <div className="border-b border-white/[0.06] p-2">
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter files" className="w-full rounded-md border border-white/10 bg-black/20 px-2.5 py-2 text-xs outline-none focus:border-violet-400/50" />
          <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-zinc-600">
            <span>{visibleFiles.length} files</span>
            <button type="button" onClick={() => setShowAllFiles((current) => !current)} className="rounded px-1.5 py-1 text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200">{showAllFiles ? "Source files" : "All files"}</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {visibleFiles.map((file) => <button key={file} type="button" onClick={() => selectFile(file)} className={`block w-full truncate rounded px-2 py-1.5 text-left font-mono text-[11px] ${selectedFile === file ? "bg-violet-500/15 text-violet-100" : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"}`} title={file}>{file}</button>)}
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] px-3 py-2">
          <span className="mr-auto truncate text-xs text-zinc-300">{status ? `${status.repositoryFullName ?? "Local repository"} · ${status.branch}` : "Choose a repository"}</span>
          {status && <span className="text-[10px] text-zinc-600">↑{status.ahead} ↓{status.behind} · {status.changedFiles.length} changed</span>}
          <input value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="new branch" className="w-36 rounded border border-white/10 bg-black/20 px-2 py-1.5 text-xs outline-none" />
          <button type="button" disabled={Boolean(busy) || !selectedRepository || !branchName.trim()} onClick={() => void createBranch()} className="btn-secondary disabled:opacity-40">Branch</button>
          <button type="button" disabled={Boolean(busy) || !status?.repositoryFullName} onClick={() => sync("pull")} className="btn-secondary disabled:opacity-40">{busy === "pull" ? "Pulling…" : "Pull"}</button>
          <button type="button" disabled={Boolean(busy) || !status?.repositoryFullName || onDefaultBranch} title={onDefaultBranch ? "Create a branch; direct pushes to the default branch are blocked." : undefined} onClick={() => sync("push")} className="btn-secondary disabled:opacity-40">{busy === "push" ? "Pushing…" : "Push"}</button>
        </div>
        {selectedFile ? <>
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
            <span className="mr-auto truncate font-mono text-[11px] text-zinc-400">{selectedFile}{content !== savedContent ? " · unsaved" : ""}</span>
            <button type="button" disabled={Boolean(busy) || content === savedContent} onClick={() => void saveFile()} className="btn-secondary disabled:opacity-40">Save ⌘S</button>
          </div>
          {isProjectMetadata(selectedFile) && <div role="status" className="border-b border-white/[0.08] bg-white/[0.025] px-4 py-2 text-xs text-zinc-400">This is generated project metadata. Edit it only when you understand the project format; source files are safer for normal changes.</div>}
          <textarea value={content} onChange={(event) => setContent(event.target.value)} onKeyDown={editorKeyDown} spellCheck={false} aria-label={`Editing ${selectedFile}`} className="min-h-0 flex-1 resize-none bg-[#0b0c0e] p-4 font-mono text-[13px] leading-6 text-zinc-200 outline-none selection:bg-violet-500/30" />
          <div className="grid grid-cols-[minmax(220px,1fr)_auto_minmax(180px,0.7fr)_120px_auto] items-center gap-2 border-t border-white/[0.07] bg-[#111315] p-3">
            <input value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} placeholder="Commit message for this file" className="rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs outline-none" />
            <button type="button" disabled={Boolean(busy) || !commitMessage.trim() || onDefaultBranch} title={onDefaultBranch ? "Create a branch before committing." : undefined} onClick={() => void commit()} className="btn-primary disabled:opacity-40">{busy === "commit" ? "Committing…" : "Commit file"}</button>
            <input value={prTitle} onChange={(event) => setPrTitle(event.target.value)} placeholder="Pull request title" className="rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs outline-none" />
            <input value={prBase} onChange={(event) => setPrBase(event.target.value)} placeholder="base" className="rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs outline-none" />
            {prUrl ? <ExternalLink href={prUrl} className="text-xs text-emerald-300 hover:text-white">Open PR ↗</ExternalLink> : <button type="button" disabled={Boolean(busy) || !prTitle.trim() || !prBase.trim() || !status || status.branch === prBase.trim() || status.changedFiles.length > 0 || content !== savedContent} onClick={reviewPullRequest} className="btn-secondary disabled:opacity-40" title={status && status.changedFiles.length > 0 ? "Commit all working-tree changes before publishing a pull request." : undefined}>{busy === "pr" ? "Publishing…" : "Publish & open PR"}</button>}
          </div>
        </> : <div className="flex flex-1 items-center justify-center text-sm text-zinc-600">Choose a UTF-8 text file to edit.</div>}
      </section>
    </div>
    {confirmation && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-6 backdrop-blur-sm" role="presentation" onMouseDown={() => setConfirmation(null)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="repository-confirmation-title" onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md rounded-xl border border-white/10 bg-[#181a1d] p-5 shadow-2xl">
        <h2 id="repository-confirmation-title" className="text-base font-semibold text-white">{confirmation.title}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">{confirmation.description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" autoFocus className="btn-secondary" onClick={() => setConfirmation(null)}>Cancel</button>
          <button type="button" className={confirmation.destructive ? "rounded-md bg-rose-500/90 px-3 py-2 text-xs font-medium text-white hover:bg-rose-400" : "btn-primary"} onClick={() => void confirmAction()}>{confirmation.confirmLabel}</button>
        </div>
      </div>
    </div>}
  </div>;
}
