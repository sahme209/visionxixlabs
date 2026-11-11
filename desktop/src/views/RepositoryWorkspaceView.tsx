import {localWorkspaceSelectionKey,readLocalWorkspaceSelection,resolveLocalWorkspaceSelection,writeLocalWorkspaceSelection} from "../lib/localWorkspaceSelection";
import { verificationReceipt, type VerificationReceipt } from "../lib/verificationReceipt";
import { localEditBlocker, type LocalEditRequest, type LocalCreationProposal } from "../lib/localEditReview";
import { localCodeContextPrompt, type LocalCodeSelection, type LocalRepairSelection } from "../lib/localCodeContext";
import { RepositoryWorktrees } from "../components/RepositoryWorktrees";
import { FileDiff } from "../components/FileDiff";
import { editorMatches, replaceEditorMatch, editorLineRange } from "../lib/editorSearch";
import { newEditorHistory, editHistory, moveHistory } from "../lib/editorHistory";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
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

type RepositoryCheckResult = VerificationReceipt;

interface Confirmation {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  preview?: string;
  previewLabel?: string;
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

export function RepositoryWorkspaceView({ compact = false, active = true, onAskAgent, editRequest, workspace, selectionUser }: { editRequest?: LocalEditRequest; workspace?: string; selectionUser?: string; compact?: boolean; active?: boolean; onAskAgent?: (selection: LocalCodeSelection) => void }) {
  const revision = useSyncExternalStore(desktopClient.subscribeContext, desktopClient.getContextRevision, desktopClient.getContextRevision);
  return <RepositoryWorkspaceSession compact={compact} key={`${revision}:${selectionUser ?? ""}:${workspace ?? ""}`} selectionUser={selectionUser} revision={revision} active={active} onAskAgent={onAskAgent} editRequest={editRequest} workspace={workspace} />;
}

function RepositoryWorkspaceSession({ compact, revision, active, onAskAgent, editRequest, workspace, selectionUser }: { editRequest?: LocalEditRequest; workspace?: string; selectionUser?: string; revision: number; compact: boolean; active: boolean; onAskAgent?: (selection: LocalCodeSelection) => void }) {
  const [parentPath, setParentPath] = useState("");
  const selectionKey = localWorkspaceSelectionKey(desktopClient.config.apiBase, workspace, selectionUser);
  const knownRoots = useRef<string[]>([]);
  const selectionRoot = useRef<string | null>(null);
  const [sourceExpanded, setSourceExpanded] = useState(false);
  const [publishExpanded, setPublishExpanded] = useState(false);
  const [repositories, setRepositories] = useState<string[]>([]);
  const [selectedRepository, setSelectedRepositoryState] = useState<string | null>(null);
  const [status, setStatus] = useState<RepositoryStatus | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [fileNavigation, setFileNavigation] = useState<"files" | "changes">("files");
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const history = useRef(newEditorHistory(""));
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [selectionLength, setSelectionLength] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(-1);
  const [replacement, setReplacement] = useState("");
  const [lineTarget, setLineTarget] = useState("");
  const matches = useMemo(() => editorMatches(content, searchQuery), [content, searchQuery]);
  useEffect(() => { setMatchIndex(-1); }, [content, searchQuery]);
  // Reset per-file controls before the new editor becomes interactive. A passive
  // reset can otherwise close a Find action clicked just after the file commits.
  useLayoutEffect(() => { setSearchQuery(""); setReplacement(""); setLineTarget(""); setSearchOpen(false); setReviewOpen(false); setSelectionLength(0); }, [selectedFile]);
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
  const [confirmation, setConfirmationState] = useState<Confirmation | null>(null);
  const [checks, setChecks] = useState<RepositoryCheck[]>([]);
  const [verificationResult, setVerificationResult] = useState<RepositoryCheckResult | null>(null);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationStale, setVerificationStale] = useState(false);
  const [verificationTarget, setVerificationTarget] = useState<{rootPath: string; repositoryFullName: string; branch: string} | null>(null);
  const [cancelAvailable, setCancelAvailable] = useState(false);
  const verificationRun = useRef<{ id: string; repositoryPath: string; canceled: boolean } | null>(null);
  const sourceEpoch = useRef(0);
  const verificationGeneration = useRef(0);

  const [context] = useState(() => desktopClient.config);
  const mounted = useRef(false);
  const owner = useRef({ repository: null as string | null, generation: 0 });
  const fileRequest = useRef(0);
  const statusRequest = useRef(0);
  const listRequest = useRef(0);
  const catalogRequest = useRef(0);
  const manualClone = useRef(false);
  const operationRequest = useRef(0);
  const activeBusy = useRef<string | null>(null);
  const appliedEdit = useRef<{request: LocalEditRequest; paths: Set<string>} | undefined>(undefined);
  const loadedFile = useRef<{ repository: string; path: string; content: string; saved: string } | null>(null);
  // Only committed request changes retire consent. A -> B -> A must not revive
  // a pending operation or confirmation captured for the first A generation.
  const editSelection = useRef({ request: editRequest });
  useLayoutEffect(() => {
    if (editSelection.current.request !== editRequest) editSelection.current = { request: editRequest };
  }, [editRequest]);

  const owns = useCallback((captured: typeof owner.current) => mounted.current && desktopClient.config === context && desktopClient.getContextRevision() === revision
    && captured.generation === owner.current.generation && captured.repository === owner.current.repository, [context, revision]);

  useEffect(() => {
    const lifecycle = mounted, selection = owner, activeOperation = operationRequest;
    lifecycle.current = true;
    return () => { lifecycle.current = false; selection.current = { ...selection.current, generation: selection.current.generation + 1 }; activeOperation.current++; };
  }, []);

  const setSelectedRepository = useCallback((next: string | null | ((current: string | null) => string | null)) => {
    const repository = typeof next === "function" ? next(owner.current.repository) : next;
    if (repository === owner.current.repository) return;
    if (repository) {
      const root = knownRoots.current.includes(repository) ? repository : selectionRoot.current;
      if (root && knownRoots.current.includes(root)) { selectionRoot.current = root; writeLocalWorkspaceSelection(selectionKey, {root, checkout:repository}); }
    } else selectionRoot.current = null;
    owner.current = { repository, generation: owner.current.generation + 1 };
    fileRequest.current++; operationRequest.current++; activeBusy.current = null; loadedFile.current = null; history.current = newEditorHistory("");
    setSelectedRepositoryState(repository); setStatus(null); setFiles([]); setChecks([]);
    setSelectedFile(null); setContent(""); setSavedContent(""); setBusy(null);
    setCancelAvailable(false);
    setError(null); setNotice(null); setPrUrl(null); setVerificationResult(null); setVerificationTarget(null); setVerificationStale(false); sourceEpoch.current++; setConfirmationState(null);
  }, [selectionKey]);

  function setConfirmation(next: Confirmation | null) {
    const captured = owner.current;
    setConfirmationState(next ? { ...next, onConfirm: async () => { if (owns(captured)) await next.onConfirm(); } } : null);
  }

  function invalidateVerification() { sourceEpoch.current++; setVerificationStale(true); }

  function editContent(next: string) {
    if (!owns(owner.current) || !loadedFile.current || loadedFile.current.repository !== owner.current.repository) return;
    if (loadedFile.current.content !== next) invalidateVerification();
    history.current = editHistory(history.current, next);
    loadedFile.current.content = next; setContent(next);
  }

  function travelHistory(direction: "undo" | "redo") {
    const file = loadedFile.current;
    if (activeBusy.current || !owns(owner.current) || !file || file.repository !== owner.current.repository) return;
    const previous = history.current.present;
    history.current = moveHistory(history.current, direction);
    if (history.current.present !== previous) invalidateVerification();
    file.content = history.current.present; setContent(history.current.present);
  }

  const refreshRepository = useCallback(async (repositoryPath: string) => {
    const captured = owner.current, request = ++statusRequest.current;
    if (!owns(captured) || captured.repository !== repositoryPath) return;
    const [nextStatus, nextFiles] = await Promise.all([
      invoke<RepositoryStatus>("repository_status", { repositoryPath }),
      invoke<string[]>("list_repository_files", { repositoryPath }),
    ]);
    if (!owns(captured) || captured.repository !== repositoryPath || request !== statusRequest.current) return;
    setStatus(nextStatus); setFiles(nextFiles);
  }, [owns]);

  const refreshList = useCallback(async (directory: string, selectRepository = true) => {
    if (!mounted.current || desktopClient.config !== context || desktopClient.getContextRevision() !== revision) return;
    const request = ++listRequest.current;
    const next = await invoke<string[]>("list_local_repositories", { parentPath: directory });
    if (!mounted.current || desktopClient.config !== context || desktopClient.getContextRevision() !== revision || request !== listRequest.current) return;
    knownRoots.current = next;
    setRepositories(next);
    if (selectRepository) {
      const captured = owner.current;
      const current = captured.repository;
      const preferred = current && selectionRoot.current ? {root:selectionRoot.current, checkout:current} : readLocalWorkspaceSelection(selectionKey);
      const restored = current && next.includes(current) ? current : await resolveLocalWorkspaceSelection(preferred, next, root => invoke<Array<{path:string}>>("list_repository_worktrees", {repositoryPath:root}));
      if (!mounted.current || desktopClient.config !== context || desktopClient.getContextRevision() !== revision || request !== listRequest.current || captured !== owner.current) return;
      // Only a freshly recorded native worktree can restore a non-primary path.
      selectionRoot.current = preferred && next.includes(preferred.root) ? preferred.root : null;
      setSelectedRepository(restored ?? next[0] ?? null);
      if (preferred && restored !== preferred.checkout) setNotice("The saved checkout is unavailable. Opened an available repository; review its name before editing.");
    }
  }, [context, revision, selectionKey, setSelectedRepository]);

  useEffect(() => {
    let cancelled = false;
    void invoke<string>("default_repos_directory").then(directory => {
      if (cancelled || desktopClient.config !== context || desktopClient.getContextRevision() !== revision) return;
      setParentPath(directory); return refreshList(directory);
    }).catch(cause => { if (!cancelled && desktopClient.config === context && desktopClient.getContextRevision() === revision) setError(String(cause)); });
    return () => { cancelled = true; };
  }, [context, revision, refreshList]);

  const refreshCatalog = useCallback(async () => {
    const request = ++catalogRequest.current;
    const current = () => mounted.current && desktopClient.config === context
      && desktopClient.getContextRevision() === revision && request === catalogRequest.current;
    if (!current()) return;
    try {
      const result = await desktopClient.listGithubRepositories();
      if (!current()) return;
      if (!result.ok) { setRepositoryCatalogError(result.error); return; }
      setRemoteRepositories(result.data.repositories);
      // Repository preference is optional, never an availability or authorization gate.
      let preferred: string | null = null;
      try { preferred = window.localStorage.getItem("axiom.workspace.repository.v1"); } catch { /* Session-only selection remains available. */ }
      const selected = result.data.repositories.find(repository => repository.fullName === preferred) ?? result.data.repositories[0];
      if (!manualClone.current) setCloneRepository(value =>
        result.data.repositories.some(repository => repository.fullName === value) ? value : selected?.fullName || "");
      setRepositoryCatalogTruncated(result.data.truncated); setRepositoryCatalogError(null);
    } catch {
      if (current()) setRepositoryCatalogError("Connected repositories could not be loaded.");
    }
  }, [context, revision]);

  useEffect(() => {
    void refreshCatalog();
    return () => { catalogRequest.current++; };
  }, [refreshCatalog]);

  useEffect(() => {
    if (!selectedRepository) return;
    const captured = owner.current;
    // Selection can advance before this committed render's passive effect runs.
    if (captured.repository !== selectedRepository || !owns(captured)) return;
    void Promise.all([
      refreshRepository(selectedRepository),
      invoke<RepositoryCheck[]>("detect_repository_checks", { repositoryPath: selectedRepository }).then(next => { if (owns(captured)) setChecks(next); }),
    ]).catch(cause => { if (owns(captured)) setError(String(cause)); });
  }, [owns, refreshRepository, selectedRepository]);

  const visibleFiles = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const relevantFiles = showAllFiles ? files : files.filter((file) => !isWorkspaceNoise(file));
    return query ? relevantFiles.filter((file) => file.toLowerCase().includes(query)) : relevantFiles;
  }, [files, filter, showAllFiles]);
  const visibleChanges = (status?.changedFiles ?? []).filter(change => change.path.toLowerCase().includes(filter.trim().toLowerCase()));
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
    if (!confirmation || !active) return;
    const dismiss = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setConfirmationState(null);
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [active, confirmation]);

  async function run(label: string, operation: (current: () => boolean) => Promise<void>) {
    const captured = owner.current;
    if (!owns(captured)) return;
    const request = ++operationRequest.current;
    const current = () => owns(captured) && request === operationRequest.current;
    if (["save", "create", "pull", "branch", "commit", "pr", "clone"].includes(label)) invalidateVerification();
    activeBusy.current = label; setBusy(label); setError(null); setNotice(null);
    try { await operation(current); } catch (cause) { if (current()) setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { if (current()) { activeBusy.current = null; setBusy(null); } }
  }

  async function openFile(path: string) {
    const repository = owner.current.repository;
    if (!repository) return;
    const request = ++fileRequest.current;
    loadedFile.current = null; history.current = newEditorHistory(""); setSelectedFile(null); setContent(""); setSavedContent("");
    await run("open", async current => {
      const next = await invoke<string>("read_repository_file", { repositoryPath: repository, relativePath: path });
      if (!current() || request !== fileRequest.current) return;
      history.current = newEditorHistory(next);
      loadedFile.current = { repository, path, content: next, saved: next };
      setSelectedFile(path); setContent(next); setSavedContent(next); setCommitMessage("");
    });
  }

  function selectFile(path: string) {
    if (loadedFile.current && loadedFile.current.content !== loadedFile.current.saved) {
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
    if (loadedFile.current && loadedFile.current.content !== loadedFile.current.saved) {
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
    const file = loadedFile.current;
    if (activeBusy.current || !file || file.repository !== owner.current.repository || file.path !== selectedFile || file.content !== content) return;
    const snapshot = file.content;
    await run("save", async current => {
      if (!current() || loadedFile.current !== file || file.content !== snapshot) return;
      await invoke("write_repository_file", { repositoryPath: file.repository, relativePath: file.path, content: snapshot, expectedContent: file.saved });
      if (!current() || loadedFile.current !== file) return;
      file.saved = snapshot; setSavedContent(snapshot); setNotice(`Saved ${file.path}`);
      await refreshRepository(file.repository);
    });
  }

  async function clone() {
    const repositoryFullName = cloneRepository.trim();
    if (!repositoryFullName.includes("/") || !parentPath
      || (!manualCloneRepository && !remoteRepositories.some(repository => repository.fullName === repositoryFullName))) return;
    await run("clone", async current => {
      const credential = await desktopClient.mintGithubCloneToken({ repositoryFullName, purpose: "clone" });
      if (!current()) return;
      if (!credential.ok) throw new Error(credential.error);
      const repositoryName = repositoryFullName.split("/")[1];
      const destinationPath = `${parentPath.replace(/\/$/, "")}/${repositoryName}`;
      await invoke("clone_repository", { cloneUrl: credential.data.cloneUrl, destinationPath });
      if (!current()) return;
      await refreshList(parentPath, false);
      if (!current()) return;
      setSelectedRepository(destinationPath);
      setNotice(`Cloned ${repositoryFullName} without storing its access token.`);
    });
  }

  async function performSync(direction: "pull" | "push") {
    if (!selectedRepository || selectedRepository !== owner.current.repository || !status?.repositoryFullName) return;
    await run(direction, async current => {
      const repositoryFullName = status.repositoryFullName;
      if (!repositoryFullName) return;
      if (direction === "push" && onDefaultBranch) throw new Error("Create a branch and open a pull request; direct pushes to the default branch are not allowed.");
      const credential = await desktopClient.mintGithubCloneToken({ repositoryFullName, purpose: direction, ...(direction === "push" ? { branch: status.branch } : {}) });
      if (!current()) return;
      if (!credential.ok) throw new Error(credential.error);
      await invoke(`${direction}_repository`, { repositoryPath: selectedRepository, authenticatedUrl: credential.data.cloneUrl, repositoryFullName, branch: status.branch });
      if (!current()) return;
      await refreshRepository(selectedRepository);
      if (!current()) return;
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
    if (!selectedRepository || selectedRepository !== owner.current.repository || !branchName.trim()) return;
    await run("branch", async current => {
      await invoke("create_repository_branch", { repositoryPath: selectedRepository, branchName: branchName.trim() });
      if (!current()) return;
      setBranchName("");
      await refreshRepository(selectedRepository);
      if (!current()) return;
      setNotice("Local branch created. Push it when you are ready to publish it.");
    });
  }

  async function commit() {
    const file = loadedFile.current;
    if (!file || file.repository !== owner.current.repository || file.path !== selectedFile || file.content !== content || activeBusy.current || !commitMessage.trim()) return;
    const snapshot = file.content;
    await run("commit", async current => {
      if (onDefaultBranch) throw new Error("Create a branch before committing. Changes must reach the default branch through a pull request.");
      if (!current() || loadedFile.current !== file || file.content !== snapshot) return;
      if (snapshot !== file.saved) {
        await invoke("write_repository_file", { repositoryPath: file.repository, relativePath: file.path, content: snapshot, expectedContent: file.saved });
        if (!current() || loadedFile.current !== file) return;
        file.saved = snapshot; setSavedContent(snapshot);
      }
      if (!current() || loadedFile.current !== file || file.content !== snapshot) throw new Error("The file changed while saving. Review it before committing.");
      const sha = await invoke<string>("commit_repository_file", { repositoryPath: file.repository, relativePath: file.path, message: commitMessage.trim() });
      if (!current()) return;
      setCommitMessage(""); await refreshRepository(file.repository);
      if (current()) setNotice(`Committed ${file.path} at ${sha.slice(0, 8)}. Push explicitly when ready.`);
    });
  }

  async function publishAndOpenPullRequest() {
    if (!selectedRepository || selectedRepository !== owner.current.repository || !status?.repositoryFullName || !prTitle.trim() || !prBase.trim() || !status.branch || status.branch === prBase.trim()) return;
    await run("pr", async current => {
      const repositoryFullName = status.repositoryFullName;
      if (!repositoryFullName || !selectedRepository) return;
      const credential = await desktopClient.mintGithubCloneToken({ repositoryFullName, purpose: "push", branch: status.branch });
      if (!current()) return;
      if (!credential.ok) throw new Error(credential.error);
      await invoke("push_repository", { repositoryPath: selectedRepository, authenticatedUrl: credential.data.cloneUrl, repositoryFullName, branch: status.branch });
      if (!current()) return;
      const result = await desktopClient.openGithubPullRequest({
        repositoryFullName, head: status.branch, base: prBase.trim(), title: prTitle.trim(),
        body: "Opened from the governed Axiom Agent desktop repository workspace.",
      });
      if (!current()) return;
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

  async function cancelVerification() {
    const attempt = verificationRun.current;
    const captured = owner.current;
    const generation = verificationGeneration.current;
    if (!attempt || attempt.repositoryPath !== captured.repository || !owns(captured)) return;
    attempt.canceled = true;
    setCancelAvailable(false);
    setVerificationStale(true);
    try {
      const accepted = await invoke<boolean>("cancel_repository_check", { repositoryPath: attempt.repositoryPath, runId: attempt.id });
      if (owns(captured) && verificationGeneration.current === generation) setNotice(accepted
        ? "Stop requested for the direct child only. Descendants may still run; their status is unverified. This attempt cannot pass."
        : "The check already completed. This canceled attempt cannot pass; descendant status is unverified.");
    } catch (cause) {
      if (owns(captured) && verificationGeneration.current === generation) setError(`Stop could not be confirmed: ${String(cause)}. Descendants are unverified; this attempt cannot pass.`);
    }
  }

  function verify(check: RepositoryCheck) {
    if (!selectedRepository || selectedRepository !== owner.current.repository) return;
    if (loadedFile.current && loadedFile.current.content !== loadedFile.current.saved) {
      setError("Save or discard unsaved editor changes before verification; checks run against files on disk."); return;
    }
    const consentEpoch = sourceEpoch.current;
    const consentRoot = status?.rootPath;
    setConfirmation({
      title: `Run ${check.label}?`,
      description: `${check.command} will run inside this repository with a minimal process environment. Scripts are not sandboxed: they can access files and network resources available to your user, including stored credentials. Native timeout/output limits do not establish process-tree isolation. Run only repositories you trust. Stop check requests a bounded direct-child stop only; descendants may continue and their status is unverified. Closing or switching views does not cancel a running check.`,
      confirmLabel: "Run check",
      onConfirm: async () => {
        if (activeBusy.current) return;
        await run(`verify:${check.id}`, async current => {
          if (loadedFile.current && loadedFile.current.content !== loadedFile.current.saved) {
            setError("Save or discard unsaved editor changes before verification; checks run against files on disk."); return;
          }
          if (consentEpoch !== sourceEpoch.current) { setError("The source changed after check consent was requested. Review and request the check again."); return; }
          const checkedEpoch = sourceEpoch.current;
          const checkedStatus = await invoke<RepositoryStatus>("repository_status", {repositoryPath: selectedRepository});
          if (!current()) return;
          if (typeof checkedStatus.rootPath !== "string" || !checkedStatus.rootPath
            || (consentRoot && checkedStatus.rootPath !== consentRoot) || consentEpoch !== sourceEpoch.current) {
            setError("The repository or source changed before verification. Review and request the check again."); return;
          }
          verificationGeneration.current++;
          setVerificationTarget(null);
          setVerificationStale(true);
          const id = await invoke<string>("prepare_repository_check", { repositoryPath: selectedRepository, checkId: check.id });
          if (!current()) {
            await invoke("cancel_repository_check", { repositoryPath: selectedRepository, runId: id });
            return;
          }
          // Native preparation is asynchronous. Consent must still describe
          // the source at the boundary where a process can actually start.
          if (consentEpoch !== sourceEpoch.current) {
            await invoke("cancel_repository_check", { repositoryPath: selectedRepository, runId: id });
            if (current()) setError("The source changed while preparing the check. Save or discard edits, then review and request the check again.");
            return;
          }
          const attempt = { id, repositoryPath: selectedRepository, canceled: false };
          verificationRun.current = attempt;
          setCancelAvailable(true);
          let raw: unknown;
          try {
            raw = await invoke<unknown>("run_repository_check", { repositoryPath: selectedRepository, checkId: check.id, runId: id });
          } finally {
            if (verificationRun.current === attempt) {
              verificationRun.current = null;
              if (current()) setCancelAvailable(false);
            }
          }
          if (!current() || attempt.canceled) return;
          const result = verificationReceipt(raw, check.id);
          const stale = checkedEpoch !== sourceEpoch.current;
          setVerificationResult(result); setVerificationStale(stale);
          setVerificationTarget(!stale && checkedStatus.repositoryFullName && checkedStatus.branch
            ? {rootPath: checkedStatus.rootPath, repositoryFullName: checkedStatus.repositoryFullName, branch: checkedStatus.branch} : null);
          setShowVerification(true);
          await refreshRepository(selectedRepository);
          if (!current()) return;
          setNotice(checkedEpoch !== sourceEpoch.current ? "Check completed, but local edits changed during or after the run. Save and rerun before relying on this result." : result.success ? `${check.label} passed.` : `${check.label} failed with exit code ${result.exitCode ?? "unknown"}.`);
        });
      },
    });
  }

  async function loadAgentDraft() {
    const file = loadedFile.current, request = editRequest, selection = editSelection.current;
    if (!active || activeBusy.current || !request || !file || !owns(owner.current)) return;
    const edit = request.edits?.find(candidate => candidate.path === file.path) ?? request.edit;
    if (request.context !== desktopClient.config || request.workspace !== workspace) { setError("Agent draft belongs to a different sign-in or workspace."); return; }
    if (edit.kind === "create") { setError("New-file proposals require explicit Create, never loading over an existing file."); return; }
    const snapshot = file.content;
    await run("load-agent-draft", async current => {
      const live = await invoke<RepositoryStatus>("repository_status", {repositoryPath: file.repository});
      if (!current() || loadedFile.current !== file || file.content !== snapshot) return;
      if (selection !== editSelection.current || selection.request !== request) { setError("The Agent proposal changed. Review the current proposal before loading it."); return; }
      if (live.rootPath !== file.repository) { setError("The local repository identity could not be verified."); return; }
      const blocker = localEditBlocker(edit, {repositoryFullName: live.repositoryFullName, branch: live.branch, path: file.path, saved: file.saved, content: file.content});
      if (blocker) { setError(blocker); return; }
      editContent(edit.content); setReviewOpen(true);
      if (appliedEdit.current?.request !== request) appliedEdit.current = {request, paths: new Set()};
      appliedEdit.current.paths.add(edit.path);
      setNotice("Agent draft loaded locally. Review changes, then explicitly Save and run verification. GitHub approval is unchanged.");
    });
  }

  function createAgentFile(edit: LocalCreationProposal) {
    const request = editRequest, repository = owner.current.repository, selection = editSelection.current;
    if (!active || activeBusy.current || !request || !repository || request.context !== desktopClient.config || request.workspace !== workspace) return;
    if (loadedFile.current && loadedFile.current.content !== loadedFile.current.saved) { setError("Save or discard existing edits before creating a proposed file."); return; }
    setConfirmation({title: `Create ${edit.path}?`, description: "Create only this new local file. Existing files and symlinks must be refused. Parent folders must already exist. This does not approve GitHub or run checks. If writing fails, inspect the potentially partial new file before retrying. Other files are separate operations.", confirmLabel: "Create local file", preview: edit.content, previewLabel: "New file content to create",
      onConfirm: async () => {
        if (activeBusy.current || request.context !== desktopClient.config || request.workspace !== workspace) return;
        if (selection !== editSelection.current || selection.request !== request) { setError("The Agent proposal changed. Review and confirm the current new-file proposal."); return; }
        if (loadedFile.current && loadedFile.current.content !== loadedFile.current.saved) { setError("Save or discard existing edits before creating a proposed file."); return; }
        await run("create", async current => {
          const live = await invoke<RepositoryStatus>("repository_status", {repositoryPath: repository});
          if (!current()) return;
          if (selection !== editSelection.current || selection.request !== request) { setError("The Agent proposal changed. Review and confirm the current new-file proposal."); return; }
          if (live.rootPath !== repository || live.repositoryFullName?.toLowerCase() !== edit.repositoryFullName.toLowerCase() || live.branch !== edit.branch) { setError("Open the proposal's repository and branch before creating this file."); return; }
          if (loadedFile.current && loadedFile.current.content !== loadedFile.current.saved) { setError("Existing edits changed during creation review. Review them before creating the file."); return; }
          await invoke("create_repository_file", {repositoryPath: repository, relativePath: edit.path, content: edit.content, repositoryFullName: edit.repositoryFullName, branch: edit.branch});
          if (!current()) return;
          await refreshRepository(repository);
          if (current()) setNotice(`Created ${edit.path} locally. Open it to inspect; verification and GitHub approval remain separate.`);
        });
      },
    });
  }

  function askAboutVerification() {
    if (!active || !onAskAgent || activeBusy.current || !verificationResult || !owns(owner.current)) return;
    const receipt = verificationResult, epoch = sourceEpoch.current, generation = verificationGeneration.current;
    const selection: LocalCodeSelection = {kind: "verification", checkId: receipt.checkId, exitCode: receipt.exitCode, stale: verificationStale, excerpt: receipt.output.slice(0, 8000)};
    if (!localCodeContextPrompt(selection)) return;
    let prepared = false;
    setConfirmation({
      title: "Prepare check output for Agent?",
      description: `${receipt.output.length > 8000 ? "Only the first 8,000 characters are included. " : ""}This output may contain credentials or private data. Review the excerpt below and redact the unsent prompt before Send. Preparing it does not contact a model, run commands or authorize changes.`,
      confirmLabel: "Prepare check draft",
      preview: selection.excerpt,
      onConfirm: () => {
        if (sourceEpoch.current !== epoch || verificationGeneration.current !== generation || activeBusy.current) { setError("The verification context changed. Review the check output again."); return; }
        if (prepared) return;
        prepared = true;
        onAskAgent(selection);
      },
    });
  }

  function prepareRepair() {
    const file = loadedFile.current, receipt = verificationResult, target = verificationTarget;
    if (!active || !onAskAgent || activeBusy.current || !owns(owner.current) || !file || !receipt || !target
      || verificationStale || receipt.success || receipt.exitCode === null || file.content !== file.saved) return;
    const selection: LocalRepairSelection = {kind: "repair", repositoryFullName: target.repositoryFullName, branch: target.branch, path: file.path,
      checkId: receipt.checkId, exitCode: receipt.exitCode, stale: false, excerpt: receipt.output.slice(0, 8000)};
    if (!localCodeContextPrompt(selection)) return;
    const epoch = sourceEpoch.current, generation = verificationGeneration.current, snapshot = file.saved;
    setConfirmation({
      title: "Prepare a coding repair draft?",
      description: `Prepare an unsent repair request for ${target.repositoryFullName} · ${target.branch} · ${file.path}. Review the check excerpt for credentials or private data. The receipt is historical evidence, not an exact source snapshot. This does not contact a model, save files, run checks or approve changes.`,
      confirmLabel: "Prepare repair draft", preview: selection.excerpt,
      onConfirm: async () => {
        if (activeBusy.current) return;
        await run("prepare-agent-repair", async current => {
          const [live, disk] = await Promise.all([
            invoke<RepositoryStatus>("repository_status", {repositoryPath: file.repository}),
            invoke<string>("read_repository_file", {repositoryPath: file.repository, relativePath: file.path}),
          ]);
          if (!current()) return;
          if (sourceEpoch.current !== epoch || verificationGeneration.current !== generation
            || loadedFile.current !== file || file.content !== snapshot || disk !== snapshot
            || live.rootPath !== target.rootPath || live.repositoryFullName?.toLowerCase() !== target.repositoryFullName.toLowerCase()
            || live.branch !== target.branch) {
            setError("The repair source, target or verification context changed. Refresh and review it again."); return;
          }
          onAskAgent(selection);
        });
      },
    });
  }

  function askAboutSelection() {
    const file = loadedFile.current, editor = editorRef.current;
    if (!active || !onAskAgent || activeBusy.current || !owns(owner.current) || !file || !editor) return;
    const snapshot = file.content;
    const selection = {path: file.path, excerpt: snapshot.slice(editor.selectionStart, editor.selectionEnd)};
    if (!localCodeContextPrompt(selection)) { setError("Select up to 8,000 characters from a non-sensitive source file."); return; }
    setConfirmation({
      title: "Prepare selected code for Agent?",
      description: `The selection from ${file.path} will be placed in an unsent Agent prompt in Inspect / Code Review mode. Preparing it does not save files or send code to a model. Choosing Send later shares the prompt with your approved provider; review it for credentials and private data first.`,
      confirmLabel: "Prepare Agent draft",
      onConfirm: () => {
        if (!activeBusy.current && loadedFile.current === file && file.content === snapshot) onAskAgent(selection);
        else setError("The file changed while reviewing this selection. Select and review it again.");
      },
    });
  }

  function goToLine() {
    const file = loadedFile.current, editor = editorRef.current;
    if (!active || activeBusy.current || !owns(owner.current) || !file || !editor || file.content !== content) return;
    const range = /^[1-9][0-9]{0,6}$/.test(lineTarget) ? editorLineRange(file.content, Number(lineTarget)) : null;
    if (!range) { setError("Enter an existing one-based line number in the current file."); return; }
    setError(null); setMatchIndex(-1); editor.focus(); editor.setSelectionRange(range.start, range.end);
    setSelectionLength(range.end - range.start);
  }

  function openSearch() {
    setSearchOpen(true);
    requestAnimationFrame(() => { searchRef.current?.focus(); searchRef.current?.select(); });
  }

  function replaceMatch() {
    const file = loadedFile.current;
    if (!active || activeBusy.current || !owns(owner.current) || !file || file.content !== content || matchIndex < 0) return;
    const next = replaceEditorMatch(file.content, searchQuery, replacement, matches.offsets[matchIndex]);
    if (next === null) { setError("The match changed or replacement exceeds the editor limit. Find the match again."); return; }
    editContent(next);
    setMatchIndex(-1);
    setNotice("Replaced one literal match in the unsaved buffer. Review and Save explicitly.");
  }

  function navigateMatch(direction: 1 | -1) {
    if (!matches.offsets.length || !editorRef.current) return;
    const index = matchIndex < 0 ? (direction === 1 ? 0 : matches.offsets.length - 1)
      : (matchIndex + direction + matches.offsets.length) % matches.offsets.length;
    setMatchIndex(index);
    const offset = matches.offsets[index];
    editorRef.current.focus(); editorRef.current.setSelectionRange(offset, offset + searchQuery.length);
  }

  function editorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "f") {
      event.preventDefault(); openSearch(); return;
    }
    if (event.key === "Escape" && searchOpen) { event.preventDefault(); setSearchOpen(false); return; }
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "z") {
      event.preventDefault(); travelHistory(event.shiftKey ? "redo" : "undo"); return;
    }
    if (event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "y") {
      event.preventDefault(); travelHistory("redo"); return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void saveFile(); return; }
    if (event.key === "Tab") {
      event.preventDefault();
      const target = event.currentTarget;
      const next = `${content.slice(0, target.selectionStart)}  ${content.slice(target.selectionEnd)}`;
      const cursor = target.selectionStart + 2;
      editContent(next);
      requestAnimationFrame(() => { target.selectionStart = cursor; target.selectionEnd = cursor; });
    }
  }

  return <div className="local-editor-workspace flex min-h-0 flex-1 flex-col bg-[#111214]">
    <div aria-label="Active local editor repository" className="local-scope-strip">
      <span className="local-scope-label">Local</span>
      <span className="min-w-0 flex-1 truncate" title={selectedRepository ?? undefined}>{selectedRepository ? selectedRepository.split("/").pop() : "Choose a local repository"}</span>
      {status && <span className="shrink-0 text-zinc-400">{status.branch}</span>}
      {status && <button type="button" onClick={() => setFileNavigation("changes")} className="shrink-0 text-xs text-zinc-400 hover:text-zinc-200" aria-label={`View ${status.changedFiles.length} changed files`}>{status.changedFiles.length} changed</button>}
    </div>
    <details open={sourceExpanded || (!compact && !selectedRepository)} onToggle={event => { if (compact || selectedRepository) setSourceExpanded(event.currentTarget.open); }} className="shrink-0 border-b border-white/[0.07]">
      <summary className="cursor-pointer px-4 py-2 text-xs text-zinc-400 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-violet-300">Clone or refresh repositories</summary>
    <div className="flex flex-wrap items-center gap-2 px-4 py-3">
      <div className="w-72 min-w-0">
        <label htmlFor="clone-source" className="mb-1 block text-[11px] text-zinc-400">Clone source · GitHub</label>
        <select id="clone-source" value={manualCloneRepository ? "__manual__" : cloneRepository} onChange={(event) => {
          if (event.target.value === "__manual__") {
            manualClone.current = true;
            setManualCloneRepository(true);
            setCloneRepository("");
          } else {
            manualClone.current = false;
            setManualCloneRepository(false);
            setCloneRepository(event.target.value);
            try { window.localStorage.setItem("axiom.workspace.repository.v1", event.target.value); } catch { /* Keep the selected repository in memory. */ }
          }
        }} aria-label="Connected GitHub repository" className="w-full rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-hidden focus:border-violet-400/50">
          {remoteRepositories.length === 0 && <option value="">No connected repositories</option>}
          {remoteRepositories.map((repository) => <option key={repository.id} value={repository.fullName}>{repository.fullName} · {repository.visibility}</option>)}
          <option value="__manual__">Enter another authorized repository…</option>
        </select>
        {manualCloneRepository && <input autoFocus value={cloneRepository} onChange={(event) => setCloneRepository(event.target.value)} placeholder="owner/repository" aria-label="Repository owner and name" className="mt-2 w-full rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-hidden placeholder:text-zinc-600 focus:border-violet-400/50" />}
      </div>
      <button type="button" onClick={() => void refreshCatalog()} className="btn-secondary">Refresh connected repositories</button>
      <input value={parentPath} onChange={(event) => setParentPath(event.target.value)} aria-label="Local repositories folder" className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-400 outline-hidden focus:border-violet-400/50" />
      <button type="button" disabled={Boolean(busy) || !cloneRepository.trim().includes("/") || (!manualCloneRepository && !remoteRepositories.some(repository => repository.fullName === cloneRepository))} onClick={() => void clone()} className="btn-primary disabled:opacity-40">{busy === "clone" ? "Cloning…" : "Clone"}</button>
      <button type="button" disabled={Boolean(busy) || !parentPath} onClick={() => void refreshList(parentPath)} className="btn-secondary disabled:opacity-40">Refresh</button>
    </div>
    </details>
    {repositoryCatalogError && !compact && <div role="status" className="border-b border-white/8 px-4 py-2 text-xs text-zinc-300">GitHub access is unavailable. Existing local files remain usable. Review Settings → Integrations before cloning or syncing.</div>}
    {repositoryCatalogTruncated && !repositoryCatalogError && <div className="border-b border-white/6 bg-white/2 px-4 py-2 text-xs text-zinc-500">Showing the first 100 repositories authorized for the GitHub App. You can still enter another authorized owner/repository directly.</div>}
    {editRequest && editRequest.context === desktopClient.config && editRequest.workspace === workspace && (!(appliedEdit.current?.request === editRequest && appliedEdit.current.paths.has(editRequest.edit.path)) || Boolean(editRequest.edits?.length)) && <section aria-label="Agent local draft review" className="max-h-96 shrink-0 overflow-auto border-b border-violet-300/20 p-4 text-xs text-zinc-300">
      <p>Proposal {editRequest.edit.proposalId}: {editRequest.edit.repositoryFullName} · {editRequest.edit.branch} · {editRequest.edits?.length ? `${editRequest.edits.length} files` : editRequest.edit.path}</p>
      <p className="my-2 text-zinc-400">Open the matching file to load this into a clean editor buffer. No file is saved, GitHub proposal approved, or check run by this action.</p>
      {editRequest.edits?.length ? <div className="space-y-2">
        <p>{appliedEdit.current?.request === editRequest ? appliedEdit.current.paths.size : 0} of {editRequest.edits.length} drafts loaded during this review. This is not saved or verified status; local writes are per file.</p>
        {editRequest.edits.map(edit => <details key={edit.path} className="rounded-sm border border-white/10 p-2">
          <summary className="cursor-pointer">{edit.path}</summary>
          {edit.kind === "create" ? <button type="button" disabled={Boolean(busy) || !selectedRepository} onClick={() => createAgentFile(edit)} className="btn-secondary my-2 disabled:opacity-40">Create {edit.path} locally</button> : <button type="button" disabled={Boolean(busy) || !selectedRepository || status?.repositoryFullName?.toLowerCase() !== edit.repositoryFullName.toLowerCase() || status?.branch !== edit.branch || !files.includes(edit.path)} onClick={() => selectFile(edit.path)} className="btn-secondary my-2 disabled:opacity-40">Open {edit.path} for local review</button>}
          <FileDiff before={edit.baseContent} after={edit.content} label={`Agent proposed diff for ${edit.path}`} />
        </details>)}
      </div> : <FileDiff before={editRequest.edit.baseContent} after={editRequest.edit.content} label="Agent proposed local diff" />}
      {editRequest.edit.kind === "create" && !editRequest.edits?.length && <button type="button" disabled={Boolean(busy) || !selectedRepository} onClick={() => { if (editRequest.edit.kind === "create") createAgentFile(editRequest.edit); }} className="btn-secondary mt-2">Create {editRequest.edit.path} locally</button>}
      <button type="button" disabled={Boolean(busy) || !selectedFile || editRequest.context !== desktopClient.config || editRequest.workspace !== workspace} onClick={() => void loadAgentDraft()} className="btn-secondary mt-2 disabled:opacity-40">Load editor draft</button>
    </section>}
    {(error || notice) && <div role={error ? "alert" : "status"} className={`border-b px-4 py-2 text-xs ${error ? "border-rose-500/20 bg-rose-500/5 text-rose-300" : "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"}`}>{error ?? notice}</div>}
    {selectedRepository && <div className="flex flex-wrap items-center gap-2 border-b border-white/6 bg-white/1.5 px-4 py-2">
      <span className="mr-1 text-[10px] font-mono uppercase tracking-wider text-zinc-600">Verify changes</span>
      {checks.length === 0 ? <span className="text-xs text-zinc-600">No supported checks detected.</span> : checks.map((check) => <button key={check.id} type="button" disabled={Boolean(busy)} onClick={() => verify(check)} title={`${check.description} Runs: ${check.command}`} className="rounded-md border border-white/8 bg-white/3 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.07] disabled:opacity-40">{busy === `verify:${check.id}` ? `Running ${check.label}…` : check.label}</button>)}
      {cancelAvailable && busy?.startsWith("verify:") && <button type="button" onClick={cancelVerification} className="btn-secondary">Stop check (direct child only)</button>}
      {verificationResult && <button type="button" onClick={() => setShowVerification((current) => !current)} className={`ml-auto rounded-md px-2.5 py-1.5 text-xs ${verificationStale ? "bg-amber-500/10 text-amber-200" : verificationResult.success ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>{verificationStale ? "Previous check result (stale)" : verificationResult.success ? "Last check passed" : "Last check failed"} · {showVerification ? "hide output" : "show output"}</button>}
    </div>}
    {verificationResult && verificationStale && <p role="status" className="border-b border-amber-300/20 px-4 py-2 text-xs text-amber-200">Verification is stale or superseded by a newer attempt. Save and run checks again; historical output remains available.</p>}
    {showVerification && verificationResult && <div className="max-h-56 overflow-auto border-b border-white/[0.07] bg-black/30 p-3">
      <p className="mb-2 text-xs text-zinc-500">Recorded process result only. It does not certify the current working tree or changes made outside Axiom.</p>
      <div className="mb-2 flex items-center justify-between text-[10px] text-zinc-500"><span>{verificationResult.checkId}</span><span>{(verificationResult.durationMs / 1000).toFixed(1)}s · exit {verificationResult.exitCode ?? "none"}</span></div>
      <pre tabIndex={0} className="whitespace-pre-wrap wrap-break-word font-mono text-[11px] leading-5 text-zinc-300">{verificationResult.output || "The check completed without output."}</pre>
      {onAskAgent && <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={Boolean(busy) || !verificationResult.output} onClick={askAboutVerification} className="btn-secondary disabled:opacity-40">Prepare check output for Agent</button>
        <button type="button" disabled={Boolean(busy) || verificationStale || verificationResult.success || !verificationTarget || !selectedFile || content !== savedContent || !localCodeContextPrompt({kind: "repair", ...verificationTarget, path: selectedFile, checkId: verificationResult.checkId, exitCode: verificationResult.exitCode ?? 0, stale: false, excerpt: verificationResult.output.slice(0, 8000)})} onClick={prepareRepair} className="btn-secondary disabled:opacity-40">Prepare repair with Agent</button>
      </div>}
    </div>}
    <div className="repository-files-layout flex min-h-0 flex-1">
      <aside className={`flex ${compact ? "w-44" : "w-56"} shrink-0 flex-col border-r border-white/[0.07] bg-[#111315]`}>
        <div className="border-b border-white/6 px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">Local repositories</div>
        <div className="max-h-40 overflow-y-auto border-b border-white/6 p-2">
          {repositories.length === 0 && <p className="px-2 py-3 text-xs text-zinc-600">Clone a connected GitHub repository to begin.</p>}
          {repositories.map((repository) => <button key={repository} type="button" onClick={() => chooseRepository(repository)} className={`mb-1 w-full truncate rounded-sm px-2 py-2 text-left text-xs ${selectedRepository === repository ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5"}`} title={repository}>{repository.split("/").pop()}</button>)}
        </div>
        {selectedRepository && <RepositoryWorktrees key={selectedRepository} repositoryPath={selectedRepository} disabled={Boolean(busy) || !active} onOpen={chooseRepository} />}
        <div className="border-b border-white/6 p-2">
          <div className="mb-2 flex gap-1" aria-label="Repository file navigation">
            <button data-help-id="repositories.editor.files" type="button" aria-pressed={fileNavigation === "files"} onClick={() => setFileNavigation("files")} className={`flex-1 rounded-sm px-2 py-1.5 text-xs ${fileNavigation === "files" ? "bg-white/10 text-zinc-100" : "text-zinc-500"}`}>Files</button>
            <button data-help-id="repositories.editor.changes" type="button" aria-pressed={fileNavigation === "changes"} onClick={() => setFileNavigation("changes")} className={`flex-1 rounded-sm px-2 py-1.5 text-xs ${fileNavigation === "changes" ? "bg-white/10 text-zinc-100" : "text-zinc-500"}`}>Changes</button>
          </div>
          <input data-help-id="repositories.editor.filter-files" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter files" className="w-full rounded-md border border-white/10 bg-black/20 px-2.5 py-2 text-xs outline-hidden focus:border-violet-400/50" />
          <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-zinc-600">
            <span>{fileNavigation === "changes" ? `${visibleChanges.length} recorded changes` : `${visibleFiles.length} files`}</span>
            <button data-help-id="repositories.editor.file-filter-mode" type="button" disabled={fileNavigation === "changes"} onClick={() => setShowAllFiles((current) => !current)} className="rounded-sm px-1.5 py-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-200">{showAllFiles ? "Source files" : "All files"}</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {fileNavigation === "changes" && <>
            <button data-help-id="repositories.editor.refresh-changes" type="button" disabled={Boolean(busy) || !selectedRepository} onClick={() => {if (selectedRepository) void run("refresh-changes", () => refreshRepository(selectedRepository));}} className="mx-2 my-1 rounded-sm border border-white/10 px-2 py-1 text-[10px] text-zinc-400 disabled:opacity-40">Refresh changes</button>
            <p className="px-2 py-2 text-[10px] leading-4 text-zinc-500">Recorded Git status. Open an available file to inspect its current contents. Deleted or unavailable files cannot be opened.</p>
            {!status && <p role="status" className="px-2 py-2 text-xs text-zinc-500">Repository status is not verified.</p>}
            {status && visibleChanges.length === 0 && <p role="status" className="px-2 py-2 text-xs text-zinc-500">{filter.trim() ? "No matching changed files." : "No recorded Git changes."}</p>}
            {visibleChanges.map(change => <button data-help-id="repositories.editor.changed-file-row" key={change.path} type="button" aria-label={`${change.status} ${change.path}`} disabled={Boolean(busy) || !files.includes(change.path)} onClick={() => selectFile(change.path)} title={`${change.status} ${change.path}${!files.includes(change.path) ? " · unavailable in the current file list" : ""}`} className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left font-mono text-[11px] disabled:opacity-40 ${selectedFile === change.path ? "bg-violet-500/15 text-violet-100" : "text-zinc-400 hover:bg-white/4"}`}><span className="w-5 shrink-0 text-amber-300">{change.status}</span><span className="truncate">{change.path}</span></button>)}
          </>}
          {fileNavigation === "files" && visibleFiles.map((file) => <button data-help-id="repositories.editor.file-row" key={file} type="button" onClick={() => selectFile(file)} className={`block w-full truncate rounded-sm px-2 py-1.5 text-left font-mono text-[11px] ${selectedFile === file ? "bg-violet-500/15 text-violet-100" : "text-zinc-500 hover:bg-white/4 hover:text-zinc-300"}`} title={file}>{file}</button>)}
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <details className="editor-git-controls" open={!compact}>
          <summary className={compact ? "cursor-pointer px-3 py-2 text-xs text-zinc-400" : "hidden"}>Branch & sync</summary>
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] px-3 py-2">
          <input value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="new branch" className="w-36 rounded-sm border border-white/10 bg-black/20 px-2 py-1.5 text-xs outline-hidden" />
          <button type="button" disabled={Boolean(busy) || !selectedRepository || !branchName.trim()} onClick={() => void createBranch()} className="btn-secondary disabled:opacity-40">Branch</button>
          <button type="button" disabled={Boolean(busy) || !status?.repositoryFullName} onClick={() => sync("pull")} className="btn-secondary disabled:opacity-40">{busy === "pull" ? "Pulling…" : "Pull"}</button>
          <button type="button" disabled={Boolean(busy) || !status?.repositoryFullName || onDefaultBranch} title={onDefaultBranch ? "Create a branch; direct pushes to the default branch are blocked." : undefined} onClick={() => sync("push")} className="btn-secondary disabled:opacity-40">{busy === "push" ? "Pushing…" : "Push"}</button>
        </div>
        </details>
        {selectedFile ? <>
          <div className="flex flex-wrap items-center gap-2 border-b border-white/6 px-3 py-2">
            <span className="mr-auto truncate font-mono text-[11px] text-zinc-400">{selectedFile}{content !== savedContent ? " · unsaved" : ""}</span>
            {onAskAgent && <button data-help-id="repositories.editor.ask-selection" type="button" aria-label="Ask Agent about selection" disabled={Boolean(busy) || selectionLength === 0 || selectionLength > 8000 || !localCodeContextPrompt({path: selectedFile, excerpt: "selection"})} onClick={askAboutSelection} className="btn-secondary disabled:opacity-40">Ask Agent</button>}
            <button data-help-id="repositories.editor.review" type="button" aria-label="Review local changes" aria-expanded={reviewOpen} onClick={() => setReviewOpen(value => !value)} className="btn-secondary">Review changes</button>
            <details className="editor-tools" open={!compact}><summary data-help-id="repositories.editor.editing-tools" className={compact ? "cursor-pointer rounded-md px-2 py-1.5 text-xs text-zinc-300" : "hidden"}>Editing tools</summary><div className={compact ? "editor-tools-menu" : "flex flex-wrap items-center gap-2"}>            <input data-help-id="repositories.editor.line-number" aria-label="Line number" inputMode="numeric" maxLength={7} placeholder="Line" value={lineTarget} onChange={event => setLineTarget(event.target.value)} onKeyDown={event => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); goToLine(); }
            }} className="w-16 rounded-sm border border-white/10 bg-black/20 px-2 py-1 text-xs" />
            <button data-help-id="repositories.editor.go-to-line" type="button" disabled={Boolean(busy) || !lineTarget} onClick={goToLine} className="btn-secondary disabled:opacity-40">Go to line</button>
            <button data-help-id="repositories.editor.find" type="button" aria-label="Find in file" onClick={openSearch} className="btn-secondary">Find</button>
            <button data-help-id="repositories.editor.undo" type="button" aria-label="Undo edit" disabled={Boolean(busy) || !history.current.past.length} onClick={() => travelHistory("undo")} className="btn-secondary disabled:opacity-40">Undo</button>
            <button data-help-id="repositories.editor.redo" type="button" aria-label="Redo edit" disabled={Boolean(busy) || !history.current.future.length} onClick={() => travelHistory("redo")} className="btn-secondary disabled:opacity-40">Redo</button>
</div></details>
            <button data-help-id="repositories.editor.save" type="button" disabled={Boolean(busy) || content === savedContent} onClick={() => void saveFile()} className="btn-secondary disabled:opacity-40">Save ⌘S</button>
          </div>
          {reviewOpen && <section aria-label="Review unsaved file changes" className="max-h-96 shrink-0 overflow-auto border-b border-white/10 p-3">
            <p className="mb-2 text-xs text-zinc-400">Draft compared with the last loaded or saved content. This does not save, stage, commit or approve changes.</p>
            <FileDiff before={savedContent} after={content} label="Local unsaved file diff" unchangedMessage="No unsaved content changes." />
          </section>}
          {searchOpen && <div role="search" aria-label="Search current file" className="flex flex-wrap items-center gap-2 border-b border-white/10 p-2 text-xs">
            <input data-help-id="repositories.editor.find-text" ref={searchRef} type="search" aria-label="Find literal text" placeholder="Case-sensitive literal text" maxLength={256} value={searchQuery} onChange={event => setSearchQuery(event.target.value)} onKeyDown={event => {
              if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
              if (event.key === "Enter") { event.preventDefault(); navigateMatch(event.shiftKey ? -1 : 1); }
              if (event.key === "Escape") { setSearchOpen(false); editorRef.current?.focus(); }
            }} className="rounded-sm border border-white/10 bg-black/20 px-2 py-1" />
            <input data-help-id="repositories.editor.replacement-text" aria-label="Replacement literal text" placeholder="Replace with (literal)" maxLength={8000} value={replacement} onChange={event => setReplacement(event.target.value)} className="rounded-sm border border-white/10 bg-black/20 px-2 py-1" />
            <button data-help-id="repositories.editor.replace-match" type="button" disabled={Boolean(busy) || matchIndex < 0 || !matches.offsets.length} onClick={replaceMatch} className="btn-secondary disabled:opacity-40">Replace selected match</button>
            <span role="status">{!searchQuery ? "Enter text to find" : !matches.offsets.length ? "No matches" : `${matchIndex < 0 ? 0 : matchIndex + 1} of ${matches.offsets.length}${matches.limited ? "+ (display limit)" : ""}`}</span>
            <button data-help-id="repositories.editor.previous-match" type="button" aria-label="Previous match" disabled={!matches.offsets.length} onClick={() => navigateMatch(-1)} className="btn-secondary disabled:opacity-40">Previous</button>
            <button data-help-id="repositories.editor.next-match" type="button" aria-label="Next match" disabled={!matches.offsets.length} onClick={() => navigateMatch(1)} className="btn-secondary disabled:opacity-40">Next</button>
            <button data-help-id="repositories.editor.close-search" type="button" aria-label="Close file search" onClick={() => { setSearchOpen(false); editorRef.current?.focus(); }} className="btn-secondary">Close</button>
          </div>}
          {isProjectMetadata(selectedFile) && <div role="status" className="border-b border-white/8 bg-white/2.5 px-4 py-2 text-xs text-zinc-400">This is generated project metadata. Edit it only when you understand the project format; source files are safer for normal changes.</div>}
          <textarea data-help-id="repositories.editor.buffer" ref={editorRef} value={content} onSelect={event => setSelectionLength(event.currentTarget.selectionEnd - event.currentTarget.selectionStart)} onChange={(event) => editContent(event.target.value)} onKeyDown={editorKeyDown} spellCheck={false} aria-label={`Editing ${selectedFile}`} className="min-h-0 flex-1 resize-none bg-[#0b0c0e] p-4 font-mono text-[13px] leading-6 text-zinc-200 outline-hidden selection:bg-violet-500/30" />
          <details open={!compact || publishExpanded} onToggle={event => { if (compact) setPublishExpanded(event.currentTarget.open); }} className="shrink-0 border-t border-white/[0.07] bg-[#111315]">
            <summary className={compact ? "cursor-pointer px-4 py-2 text-xs text-zinc-400 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-violet-300" : "hidden"}>Commit & publish{prUrl ? " · PR available" : ""}</summary>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-3">
            <input value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} aria-label="Commit message for this file" placeholder="Commit message for this file" className="min-w-0 rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs outline-hidden" />
            <button type="button" disabled={Boolean(busy) || !commitMessage.trim() || onDefaultBranch} title={onDefaultBranch ? "Create a branch before committing." : undefined} onClick={() => void commit()} className="btn-primary disabled:opacity-40">{busy === "commit" ? "Committing…" : "Commit file"}</button>
            <input value={prTitle} onChange={(event) => setPrTitle(event.target.value)} aria-label="Pull request title" placeholder="Pull request title" className="min-w-0 rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs outline-hidden" />
            <input value={prBase} onChange={(event) => setPrBase(event.target.value)} aria-label="Pull request base branch" placeholder="base" className="min-w-0 rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs outline-hidden" />
            {prUrl ? <ExternalLink href={prUrl} className="text-xs text-emerald-300 hover:text-white">Open PR ↗</ExternalLink> : <button type="button" disabled={Boolean(busy) || !prTitle.trim() || !prBase.trim() || !status || status.branch === prBase.trim() || status.changedFiles.length > 0 || content !== savedContent} onClick={reviewPullRequest} className="btn-secondary disabled:opacity-40" title={status && status.changedFiles.length > 0 ? "Commit all working-tree changes before publishing a pull request." : undefined}>{busy === "pr" ? "Publishing…" : "Publish & open PR"}</button>}
          </div>
          </details>
        </> : <div className="flex flex-1 items-center justify-center text-sm text-zinc-600">Choose a UTF-8 text file to edit.</div>}
      </section>
    </div>
    {confirmation && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-6 backdrop-blur-xs" role="presentation" onMouseDown={() => setConfirmation(null)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="repository-confirmation-title" onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md rounded-xl border border-white/10 bg-[#181a1d] p-5 shadow-2xl">
        <h2 id="repository-confirmation-title" className="text-base font-semibold text-white">{confirmation.title}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">{confirmation.description}</p>
        {confirmation.preview && <pre aria-label={confirmation.previewLabel ?? "Check output excerpt to prepare"} className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap wrap-break-word text-xs text-zinc-300">{confirmation.preview}</pre>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" autoFocus className="btn-secondary" onClick={() => setConfirmation(null)}>Cancel</button>
          <button type="button" className={confirmation.destructive ? "rounded-md bg-rose-500/90 px-3 py-2 text-xs font-medium text-white hover:bg-rose-400" : "btn-primary"} onClick={() => void confirmAction()}>{confirmation.confirmLabel}</button>
        </div>
      </div>
    </div>}
  </div>;
}
