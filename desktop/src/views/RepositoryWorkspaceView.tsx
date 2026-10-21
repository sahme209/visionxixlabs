import { verificationReceipt, type VerificationReceipt } from "../lib/verificationReceipt";
import { localEditBlocker, type LocalEditRequest } from "../lib/localEditReview";
import { localCodeContextPrompt, type LocalCodeSelection } from "../lib/localCodeContext";
import { FileDiff } from "../components/FileDiff";
import { editorMatches, replaceEditorMatch, editorLineRange } from "../lib/editorSearch";
import { newEditorHistory, editHistory, moveHistory } from "../lib/editorHistory";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
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

export function RepositoryWorkspaceView({ active = true, onAskAgent, editRequest, workspace }: { editRequest?: LocalEditRequest; workspace?: string; active?: boolean; onAskAgent?: (selection: LocalCodeSelection) => void }) {
  const revision = useSyncExternalStore(desktopClient.subscribeContext, desktopClient.getContextRevision, desktopClient.getContextRevision);
  return <RepositoryWorkspaceSession key={revision} revision={revision} active={active} onAskAgent={onAskAgent} editRequest={editRequest} workspace={workspace} />;
}

function RepositoryWorkspaceSession({ revision, active, onAskAgent, editRequest, workspace }: { editRequest?: LocalEditRequest; workspace?: string; revision: number; active: boolean; onAskAgent?: (selection: LocalCodeSelection) => void }) {
  const [parentPath, setParentPath] = useState("");
  const [repositories, setRepositories] = useState<string[]>([]);
  const [selectedRepository, setSelectedRepositoryState] = useState<string | null>(null);
  const [status, setStatus] = useState<RepositoryStatus | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
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
  useEffect(() => { setSearchQuery(""); setReplacement(""); setLineTarget(""); setSearchOpen(false); setReviewOpen(false); setSelectionLength(0); }, [selectedFile]);
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
    owner.current = { repository, generation: owner.current.generation + 1 };
    fileRequest.current++; operationRequest.current++; activeBusy.current = null; loadedFile.current = null; history.current = newEditorHistory("");
    setSelectedRepositoryState(repository); setStatus(null); setFiles([]); setChecks([]);
    setSelectedFile(null); setContent(""); setSavedContent(""); setBusy(null);
    setCancelAvailable(false);
    setError(null); setNotice(null); setPrUrl(null); setVerificationResult(null); setVerificationStale(false); sourceEpoch.current++; setConfirmationState(null);
  }, []);

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
    setRepositories(next);
    if (selectRepository) setSelectedRepository(current => current && next.includes(current) ? current : (next[0] ?? null));
  }, [context, revision, setSelectedRepository]);

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
      const preferred = window.localStorage.getItem("axiom.workspace.repository.v1");
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
    if (["save", "pull", "branch", "commit", "pr", "clone"].includes(label)) invalidateVerification();
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
      await invoke(`${direction}_repository`, { repositoryPath: selectedRepository, authenticatedUrl: credential.data.cloneUrl });
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
      await invoke("push_repository", { repositoryPath: selectedRepository, authenticatedUrl: credential.data.cloneUrl });
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
          verificationGeneration.current++;
          setVerificationStale(true);
          const id = await invoke<string>("prepare_repository_check", { repositoryPath: selectedRepository, checkId: check.id });
          if (!current()) {
            await invoke("cancel_repository_check", { repositoryPath: selectedRepository, runId: id });
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
          setShowVerification(true);
          await refreshRepository(selectedRepository);
          if (!current()) return;
          setNotice(checkedEpoch !== sourceEpoch.current ? "Check completed, but local edits changed during or after the run. Save and rerun before relying on this result." : result.success ? `${check.label} passed.` : `${check.label} failed with exit code ${result.exitCode ?? "unknown"}.`);
        });
      },
    });
  }

  async function loadAgentDraft() {
    const file = loadedFile.current, request = editRequest;
    if (!active || activeBusy.current || !request || !file || !owns(owner.current)) return;
    const edit = request.edits?.find(candidate => candidate.path === file.path) ?? request.edit;
    if (request.context !== desktopClient.config || request.workspace !== workspace) { setError("Agent draft belongs to a different sign-in or workspace."); return; }
    const snapshot = file.content;
    await run("load-agent-draft", async current => {
      const live = await invoke<RepositoryStatus>("repository_status", {repositoryPath: file.repository});
      if (!current() || loadedFile.current !== file || file.content !== snapshot) return;
      if (live.rootPath !== file.repository) { setError("The local repository identity could not be verified."); return; }
      const blocker = localEditBlocker(edit, {repositoryFullName: live.repositoryFullName, branch: live.branch, path: file.path, saved: file.saved, content: file.content});
      if (blocker) { setError(blocker); return; }
      editContent(edit.content); setReviewOpen(true);
      if (appliedEdit.current?.request !== request) appliedEdit.current = {request, paths: new Set()};
      appliedEdit.current.paths.add(edit.path);
      setNotice("Agent draft loaded locally. Review changes, then explicitly Save and run verification. GitHub approval is unchanged.");
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

  return <div className="flex min-h-0 flex-1 flex-col bg-[#0b0c0e]">
    <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
      <div className="w-72">
        <select value={manualCloneRepository ? "__manual__" : cloneRepository} onChange={(event) => {
          if (event.target.value === "__manual__") {
            manualClone.current = true;
            setManualCloneRepository(true);
            setCloneRepository("");
          } else {
            manualClone.current = false;
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
      <button type="button" onClick={() => void refreshCatalog()} className="btn-secondary">Refresh connected repositories</button>
      <input value={parentPath} onChange={(event) => setParentPath(event.target.value)} aria-label="Local repositories folder" className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-400 outline-none focus:border-violet-400/50" />
      <button type="button" disabled={Boolean(busy) || !cloneRepository.trim().includes("/") || (!manualCloneRepository && !remoteRepositories.some(repository => repository.fullName === cloneRepository))} onClick={() => void clone()} className="btn-primary disabled:opacity-40">{busy === "clone" ? "Cloning…" : "Clone"}</button>
      <button type="button" disabled={Boolean(busy) || !parentPath} onClick={() => void refreshList(parentPath)} className="btn-secondary disabled:opacity-40">Refresh</button>
    </div>
    {repositoryCatalogError && <div role="status" className="border-b border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs text-zinc-300">Connected repositories are temporarily unavailable. Validate GitHub under Settings → Integrations, then retry. Manual entry remains available for an authorized repository.</div>}
    {repositoryCatalogTruncated && !repositoryCatalogError && <div className="border-b border-white/[0.06] bg-white/[0.02] px-4 py-2 text-xs text-zinc-500">Showing the first 100 repositories authorized for the GitHub App. You can still enter another authorized owner/repository directly.</div>}
    {editRequest && editRequest.context === desktopClient.config && editRequest.workspace === workspace && (!(appliedEdit.current?.request === editRequest && appliedEdit.current.paths.has(editRequest.edit.path)) || Boolean(editRequest.edits?.length)) && <section aria-label="Agent local draft review" className="max-h-96 shrink-0 overflow-auto border-b border-violet-300/20 p-4 text-xs text-zinc-300">
      <p>Proposal {editRequest.edit.proposalId}: {editRequest.edit.repositoryFullName} · {editRequest.edit.branch} · {editRequest.edits?.length ? `${editRequest.edits.length} files` : editRequest.edit.path}</p>
      <p className="my-2 text-zinc-400">Open the matching file to load this into a clean editor buffer. No file is saved, GitHub proposal approved, or check run by this action.</p>
      {editRequest.edits?.length ? <div className="space-y-2">
        <p>{appliedEdit.current?.request === editRequest ? appliedEdit.current.paths.size : 0} of {editRequest.edits.length} drafts loaded during this review. This is not saved or verified status; local writes are per file.</p>
        {editRequest.edits.map(edit => <details key={edit.path} className="rounded border border-white/10 p-2">
          <summary className="cursor-pointer">{edit.path}</summary>
          <button type="button" disabled={Boolean(busy) || !selectedRepository || status?.repositoryFullName?.toLowerCase() !== edit.repositoryFullName.toLowerCase() || status?.branch !== edit.branch || !files.includes(edit.path)} onClick={() => selectFile(edit.path)} className="btn-secondary my-2 disabled:opacity-40">Open {edit.path} for local review</button>
          <FileDiff before={edit.baseContent} after={edit.content} label={`Agent proposed diff for ${edit.path}`} />
        </details>)}
      </div> : <FileDiff before={editRequest.edit.baseContent} after={editRequest.edit.content} label="Agent proposed local diff" />}
      <button type="button" disabled={Boolean(busy) || !selectedFile || editRequest.context !== desktopClient.config || editRequest.workspace !== workspace} onClick={() => void loadAgentDraft()} className="btn-secondary mt-2 disabled:opacity-40">Load editor draft</button>
    </section>}
    {(error || notice) && <div role={error ? "alert" : "status"} className={`border-b px-4 py-2 text-xs ${error ? "border-rose-500/20 bg-rose-500/5 text-rose-300" : "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"}`}>{error ?? notice}</div>}
    {selectedRepository && <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-white/[0.015] px-4 py-2">
      <span className="mr-1 text-[10px] font-mono uppercase tracking-wider text-zinc-600">Verify changes</span>
      {checks.length === 0 ? <span className="text-xs text-zinc-600">No supported checks detected.</span> : checks.map((check) => <button key={check.id} type="button" disabled={Boolean(busy)} onClick={() => verify(check)} title={`${check.description} Runs: ${check.command}`} className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.07] disabled:opacity-40">{busy === `verify:${check.id}` ? `Running ${check.label}…` : check.label}</button>)}
      {cancelAvailable && busy?.startsWith("verify:") && <button type="button" onClick={cancelVerification} className="btn-secondary">Stop check (direct child only)</button>}
      {verificationResult && <button type="button" onClick={() => setShowVerification((current) => !current)} className={`ml-auto rounded-md px-2.5 py-1.5 text-xs ${verificationStale ? "bg-amber-500/10 text-amber-200" : verificationResult.success ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>{verificationStale ? "Previous check result (stale)" : verificationResult.success ? "Last check passed" : "Last check failed"} · {showVerification ? "hide output" : "show output"}</button>}
    </div>}
    {verificationResult && verificationStale && <p role="status" className="border-b border-amber-300/20 px-4 py-2 text-xs text-amber-200">Verification is stale or superseded by a newer attempt. Save and run checks again; historical output remains available.</p>}
    {showVerification && verificationResult && <div className="max-h-56 overflow-auto border-b border-white/[0.07] bg-black/30 p-3">
      <p className="mb-2 text-xs text-zinc-500">Recorded process result only. It does not certify the current working tree or changes made outside Axiom.</p>
      <div className="mb-2 flex items-center justify-between text-[10px] text-zinc-500"><span>{verificationResult.checkId}</span><span>{(verificationResult.durationMs / 1000).toFixed(1)}s · exit {verificationResult.exitCode ?? "none"}</span></div>
      <pre tabIndex={0} className="whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-zinc-300">{verificationResult.output || "The check completed without output."}</pre>
      {onAskAgent && <button type="button" disabled={Boolean(busy) || !verificationResult.output} onClick={askAboutVerification} className="btn-secondary mt-2 disabled:opacity-40">Prepare check output for Agent</button>}
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
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-3 py-2">
            <span className="mr-auto truncate font-mono text-[11px] text-zinc-400">{selectedFile}{content !== savedContent ? " · unsaved" : ""}</span>
            {onAskAgent && <button type="button" aria-label="Ask Agent about selection" disabled={Boolean(busy) || selectionLength === 0 || selectionLength > 8000 || !localCodeContextPrompt({path: selectedFile, excerpt: "selection"})} onClick={askAboutSelection} className="btn-secondary disabled:opacity-40">Ask Agent</button>}
            <button type="button" aria-label="Review local changes" aria-expanded={reviewOpen} onClick={() => setReviewOpen(value => !value)} className="btn-secondary">Review changes</button>
            <input aria-label="Line number" inputMode="numeric" maxLength={7} placeholder="Line" value={lineTarget} onChange={event => setLineTarget(event.target.value)} onKeyDown={event => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); goToLine(); }
            }} className="w-16 rounded border border-white/10 bg-black/20 px-2 py-1 text-xs" />
            <button type="button" disabled={Boolean(busy) || !lineTarget} onClick={goToLine} className="btn-secondary disabled:opacity-40">Go to line</button>
            <button type="button" aria-label="Find in file" onClick={openSearch} className="btn-secondary">Find</button>
            <button type="button" aria-label="Undo edit" disabled={Boolean(busy) || !history.current.past.length} onClick={() => travelHistory("undo")} className="btn-secondary disabled:opacity-40">Undo</button>
            <button type="button" aria-label="Redo edit" disabled={Boolean(busy) || !history.current.future.length} onClick={() => travelHistory("redo")} className="btn-secondary disabled:opacity-40">Redo</button>
            <button type="button" disabled={Boolean(busy) || content === savedContent} onClick={() => void saveFile()} className="btn-secondary disabled:opacity-40">Save ⌘S</button>
          </div>
          {reviewOpen && <section aria-label="Review unsaved file changes" className="max-h-96 shrink-0 overflow-auto border-b border-white/10 p-3">
            <p className="mb-2 text-xs text-zinc-400">Draft compared with the last loaded or saved content. This does not save, stage, commit or approve changes.</p>
            <FileDiff before={savedContent} after={content} label="Local unsaved file diff" unchangedMessage="No unsaved content changes." />
          </section>}
          {searchOpen && <div role="search" aria-label="Search current file" className="flex flex-wrap items-center gap-2 border-b border-white/10 p-2 text-xs">
            <input ref={searchRef} type="search" aria-label="Find literal text" placeholder="Case-sensitive literal text" maxLength={256} value={searchQuery} onChange={event => setSearchQuery(event.target.value)} onKeyDown={event => {
              if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
              if (event.key === "Enter") { event.preventDefault(); navigateMatch(event.shiftKey ? -1 : 1); }
              if (event.key === "Escape") { setSearchOpen(false); editorRef.current?.focus(); }
            }} className="rounded border border-white/10 bg-black/20 px-2 py-1" />
            <input aria-label="Replacement literal text" placeholder="Replace with (literal)" maxLength={8000} value={replacement} onChange={event => setReplacement(event.target.value)} className="rounded border border-white/10 bg-black/20 px-2 py-1" />
            <button type="button" disabled={Boolean(busy) || matchIndex < 0 || !matches.offsets.length} onClick={replaceMatch} className="btn-secondary disabled:opacity-40">Replace selected match</button>
            <span role="status">{!searchQuery ? "Enter text to find" : !matches.offsets.length ? "No matches" : `${matchIndex < 0 ? 0 : matchIndex + 1} of ${matches.offsets.length}${matches.limited ? "+ (display limit)" : ""}`}</span>
            <button type="button" aria-label="Previous match" disabled={!matches.offsets.length} onClick={() => navigateMatch(-1)} className="btn-secondary disabled:opacity-40">Previous</button>
            <button type="button" aria-label="Next match" disabled={!matches.offsets.length} onClick={() => navigateMatch(1)} className="btn-secondary disabled:opacity-40">Next</button>
            <button type="button" aria-label="Close file search" onClick={() => { setSearchOpen(false); editorRef.current?.focus(); }} className="btn-secondary">Close</button>
          </div>}
          {isProjectMetadata(selectedFile) && <div role="status" className="border-b border-white/[0.08] bg-white/[0.025] px-4 py-2 text-xs text-zinc-400">This is generated project metadata. Edit it only when you understand the project format; source files are safer for normal changes.</div>}
          <textarea ref={editorRef} value={content} onSelect={event => setSelectionLength(event.currentTarget.selectionEnd - event.currentTarget.selectionStart)} onChange={(event) => editContent(event.target.value)} onKeyDown={editorKeyDown} spellCheck={false} aria-label={`Editing ${selectedFile}`} className="min-h-0 flex-1 resize-none bg-[#0b0c0e] p-4 font-mono text-[13px] leading-6 text-zinc-200 outline-none selection:bg-violet-500/30" />
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
        {confirmation.preview && <pre aria-label="Check output excerpt to prepare" className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-zinc-300">{confirmation.preview}</pre>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" autoFocus className="btn-secondary" onClick={() => setConfirmation(null)}>Cancel</button>
          <button type="button" className={confirmation.destructive ? "rounded-md bg-rose-500/90 px-3 py-2 text-xs font-medium text-white hover:bg-rose-400" : "btn-primary"} onClick={() => void confirmAction()}>{confirmation.confirmLabel}</button>
        </div>
      </div>
    </div>}
  </div>;
}
