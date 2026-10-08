import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, riskToneFor } from "../components/Primitives";
import { desktopClient, type AgentSkillCatalogItem } from "../lib/desktopClient";
import { normalizeAiProviderStatus } from "../lib/aiProviderStatus";
import { createLineDiff, type DiffLine } from "../lib/lineDiff";

/**
 * The flagship surface: a plain-English request becomes a risk-checked,
 * approval-gated, auditable action. The agent (lib/axiom/agentRuntime/**
 * server-side) never executes a write action itself — it only ever
 * proposes one here, and this view is where a human approves or rejects
 * it before anything in GitHub or AWS actually changes.
 */

interface ChatTurn {
  id: string;
  role: "user" | "assistant" | "tool_result";
  content: string;
}

interface Proposal {
  id: string;
  toolName: string;
  argsJson: unknown;
  riskLevel: string;
  status: string;
  resultJson?: unknown;
  errorMessage?: string | null;
}

interface ConversationSummary {
  id: string;
  title: string | null;
  turnCount: number;
  createdAt: string;
  updatedAt: string;
}

interface GitHubRepositoryOption {
  id: string;
  fullName: string;
  defaultBranch: string;
  visibility: "private" | "public";
}

interface EnvironmentOption {
  id: string;
  slug: string;
  name: string;
  tier: string;
}

interface GitHubBranchOption {
  name: string;
  protected: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  list_environments: "List environments",
  check_deploy_status: "Check deploy status",
  create_github_branch: "Create a branch",
  commit_github_file: "Commit a file",
  open_github_pull_request: "Open a pull request",
  trigger_aws_deploy: "Deploy to AWS",
  read_github_file: "Read a repository file",
  create_environment: "Create an environment",
  configure_deployment_target: "Configure a deployment target",
  connect_identity_provider: "Connect an identity provider",
  preview_scim_lifecycle: "Preview SCIM lifecycle",
  list_integrations: "List integrations",
};

const ACTIVE_REPOSITORY_KEY = "axiom.workspace.repository.v1";
const ACTIVE_ENVIRONMENT_KEY = "axiom.workspace.environment.v1";

function describeArgs(toolName: string, args: unknown): string {
  if (typeof args !== "object" || args === null) return "";
  const a = args as Record<string, unknown>;
  switch (toolName) {
    case "create_github_branch":
      return `${a.repositoryFullName}: branch "${a.newBranchName}" from "${a.baseBranch}"`;
    case "commit_github_file":
      return `${a.repositoryFullName}: commit "${a.path}" on branch "${a.branch}"`;
    case "open_github_pull_request":
      return `${a.repositoryFullName}: PR "${a.title}" — ${a.head} → ${a.base}`;
    case "trigger_aws_deploy":
      return `${a.repositoryFullName} → environment ${a.environmentId}`;
    case "create_environment":
      return `${a.name} (${a.slug}) · ${a.tier}`;
    case "configure_deployment_target":
      return `${a.environmentId}: ${a.ecsCluster}/${a.ecsService} in ${a.region}`;
    case "connect_identity_provider":
      return `${a.protocol}: ${a.issuerOrEntityId}`;
    default:
      return JSON.stringify(a);
  }
}

export function AgentChatView() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pendingProposal, setPendingProposal] = useState<Proposal | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [composerMode, setComposerMode] = useState<"chat" | "code">("chat");
  const [repositoryFullName, setRepositoryFullName] = useState(() => window.localStorage.getItem(ACTIVE_REPOSITORY_KEY) ?? "");
  const [manualRepository, setManualRepository] = useState(false);
  const [repositoryOptions, setRepositoryOptions] = useState<GitHubRepositoryOption[]>([]);
  const [branch, setBranch] = useState("main");
  const [manualBranch, setManualBranch] = useState(false);
  const [branchOptions, setBranchOptions] = useState<GitHubBranchOption[]>([]);
  const [environmentId, setEnvironmentId] = useState(() => window.localStorage.getItem(ACTIVE_ENVIRONMENT_KEY) ?? "");
  const [environmentOptions, setEnvironmentOptions] = useState<EnvironmentOption[]>([]);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [modelOptions, setModelOptions] = useState<Array<{ provider: string; label: string }>>([]);
  const [enabledSkills, setEnabledSkills] = useState<AgentSkillCatalogItem[]>([]);
  const [startupAttempt, setStartupAttempt] = useState(0);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void Promise.all([
      desktopClient.listAgentConversations(),
      desktopClient.aiProviderStatus(),
      desktopClient.listAgentSkills(),
      desktopClient.listGithubRepositories(),
      desktopClient.listEnvironments(),
    ])
      .then(async ([conversationList, models, skills, repositories, environments]) => {
        if (cancelled) return;
        if (!conversationList.ok) {
          setError("The Agent service could not load conversation history. Retry in a moment.");
        } else {
          setConversations(conversationList.data.conversations);
          const mostRecent = conversationList.data.conversations[0];
          if (mostRecent) {
            const conversation = await desktopClient.getAgentConversation(mostRecent.id);
            if (cancelled) return;
            if (conversation.ok) {
              setConversationId(conversation.data.id);
              setTurns(conversation.data.turns.filter((turn): turn is typeof turn & { role: ChatTurn["role"] } => turn.role === "user" || turn.role === "assistant" || turn.role === "tool_result"));
              setPendingProposal([...conversation.data.actions].reverse().find((action) => action.status === "proposed") ?? null);
            } else {
              setError("The most recent Agent conversation could not be reopened.");
            }
          } else {
            const created = await desktopClient.createAgentConversation();
            if (cancelled) return;
            if (created.ok) {
              setConversationId(created.data.id);
              setConversations([{ ...created.data, turnCount: 0, updatedAt: created.data.createdAt }]);
            } else {
              setError("The Agent service could not start a conversation. Retry in a moment.");
            }
          }
        }
        if (models.ok) {
          const status = normalizeAiProviderStatus(models.data);
          if (!status) {
            setError("The service returned an unsupported model configuration. Update the app or try again later.");
            return;
          }
          const options = status.policy.allowedProviders.flatMap((provider) => {
            const selectedModel = status.policy.modelSelections[provider];
            const model = status.providers.find((item) => item.provider === provider)?.models.find((item) => item.id === selectedModel);
            return selectedModel ? [{ provider, label: model?.label ?? selectedModel }] : [];
          });
          setModelOptions(options);
          setSelectedProvider(status.policy.fallbackOrder[0] ?? options[0]?.provider ?? "");
        }
        if (skills.ok) setEnabledSkills(skills.data.skills.filter((skill) => skill.status === "enabled"));
        if (repositories.ok) {
          setRepositoryOptions(repositories.data.repositories);
          const preferredRepository = window.localStorage.getItem(ACTIVE_REPOSITORY_KEY);
          const preferred = repositories.data.repositories.find((repository) => repository.fullName === preferredRepository);
          const selected = preferred ?? repositories.data.repositories[0];
          setRepositoryFullName(selected?.fullName ?? "");
          setBranch(selected?.defaultBranch ?? "main");
        }
        if (environments.ok) {
          setEnvironmentOptions(environments.data.environments);
          const preferredEnvironment = window.localStorage.getItem(ACTIVE_ENVIRONMENT_KEY);
          const preferred = environments.data.environments.find((environment) => environment.id === preferredEnvironment);
          setEnvironmentId(preferred?.id ?? environments.data.environments[0]?.id ?? "");
        }
        const contextFailures = [
          repositories.ok ? null : "GitHub repositories could not be loaded",
          environments.ok ? null : "environments could not be loaded",
        ].filter((message): message is string => Boolean(message));
        setContextError(contextFailures.length > 0 ? contextFailures.join(" and ") : null);
        setContextLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("The Agent could not start. Check your connection and try again.");
          setContextLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [startupAttempt]);

  useEffect(() => {
    if (repositoryFullName && !manualRepository) window.localStorage.setItem(ACTIVE_REPOSITORY_KEY, repositoryFullName);
  }, [manualRepository, repositoryFullName]);

  useEffect(() => {
    if (environmentId) window.localStorage.setItem(ACTIVE_ENVIRONMENT_KEY, environmentId);
  }, [environmentId]);

  useEffect(() => {
    let cancelled = false;
    if (!repositoryFullName.includes("/") || manualRepository) {
      setBranchOptions([]);
      return () => { cancelled = true; };
    }
    void desktopClient.listGithubBranches(repositoryFullName).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setBranchOptions([]);
        setContextError("Branches could not be loaded. You can enter a branch manually.");
        return;
      }
      setBranchOptions(result.data.branches);
      setContextError(null);
      setBranch((current) => current || result.data.branches[0]?.name || "main");
    });
    return () => { cancelled = true; };
  }, [manualRepository, repositoryFullName]);

  async function openConversation(id: string) {
    if (id === conversationId || sending || decidingId) return;
    setLoadingConversation(true);
    setError(null);
    try {
      const result = await desktopClient.getAgentConversation(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConversationId(result.data.id);
      setTurns(result.data.turns.filter((turn): turn is typeof turn & { role: ChatTurn["role"] } => turn.role === "user" || turn.role === "assistant" || turn.role === "tool_result"));
      setPendingProposal([...result.data.actions].reverse().find((action) => action.status === "proposed") ?? null);
    } finally {
      setLoadingConversation(false);
    }
  }

  async function newConversation() {
    if (sending || decidingId) return;
    setLoadingConversation(true);
    setError(null);
    try {
      const result = await desktopClient.createAgentConversation();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const summary: ConversationSummary = { ...result.data, turnCount: 0, updatedAt: result.data.createdAt };
      setConversations((current) => [summary, ...current]);
      setConversationId(result.data.id);
      setTurns([]);
      setPendingProposal(null);
      setInput("");
    } finally {
      setLoadingConversation(false);
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, pendingProposal]);

  async function send() {
    const instruction = input.trim();
    if (!instruction || !conversationId || sending || (composerMode === "code" && (!repositoryFullName.includes("/") || !branch.trim() || !filePath.trim()))) return;
    setInput("");
    setError(null);
    setTurns((prev) => [...prev, { id: `local_${Date.now()}`, role: "user", content: instruction }]);
    setSending(true);
    try {
      const result = await desktopClient.sendAgentMessage(conversationId, instruction, selectedProvider || undefined, {
        ...(repositoryFullName.trim() ? { repositoryFullName: repositoryFullName.trim() } : {}),
        ...(branch.trim() ? { branch: branch.trim() } : {}),
        ...(environmentId ? { environmentId } : {}),
        ...(composerMode === "code" && filePath.trim() ? { filePath: filePath.trim() } : {}),
        mode: composerMode,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTurns((prev) => [...prev, { id: `local_${Date.now()}_r`, role: "assistant", content: result.data.reply }]);
      setPendingProposal(result.data.proposal && result.data.proposal.status === "proposed" ? result.data.proposal : null);
      setConversations((current) => {
        const selected = current.find((conversation) => conversation.id === conversationId);
        if (!selected) return current;
        const updated = {
          ...selected,
          title: selected.title ?? instruction.replace(/\s+/g, " ").slice(0, 80),
          turnCount: selected.turnCount + 2,
          updatedAt: new Date().toISOString(),
        };
        return [updated, ...current.filter((conversation) => conversation.id !== conversationId)];
      });
    } finally {
      setSending(false);
    }
  }

  async function decide(approve: boolean) {
    if (!pendingProposal) return;
    setDecidingId(pendingProposal.id);
    try {
      const result = approve
        ? await desktopClient.approveAgentAction(pendingProposal.id)
        : await desktopClient.rejectAgentAction(pendingProposal.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTurns((prev) => [...prev, {
        id: `local_${Date.now()}_d`,
        role: "tool_result",
        content: approve
          ? (result.data as { status: string; errorMessage?: string | null }).status === "executed"
            ? `${TOOL_LABELS[pendingProposal.toolName] ?? pendingProposal.toolName} — done.`
            : `${TOOL_LABELS[pendingProposal.toolName] ?? pendingProposal.toolName} — failed: ${(result.data as { errorMessage?: string | null }).errorMessage ?? "unknown error"}`
          : `${TOOL_LABELS[pendingProposal.toolName] ?? pendingProposal.toolName} — rejected.`,
      }]);
      setPendingProposal(null);
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-axiom-bg">
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-8 py-3">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-[11px] text-zinc-500">
          <span className="shrink-0">Conversation</span>
          <select
            aria-label="Agent conversation"
            value={conversationId ?? ""}
            onChange={(event) => void openConversation(event.target.value)}
            disabled={loadingConversation || sending || Boolean(decidingId) || conversations.length === 0}
            className="min-w-0 max-w-md flex-1 truncate rounded-md border border-white/10 bg-[#151719] px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-white/25 disabled:opacity-50"
          >
            {conversations.length === 0 && <option value="">No conversations yet</option>}
            {conversations.map((conversation) => (
              <option key={conversation.id} value={conversation.id}>
                {conversation.title || "New conversation"}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void newConversation()} disabled={loadingConversation || sending || Boolean(decidingId)} className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.06] disabled:opacity-50">
          {loadingConversation ? "Loading…" : "New chat"}
        </button>
      </div>
      <div className="border-b border-white/[0.06] bg-white/[0.015] px-8 py-3">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-2 md:grid-cols-3">
          <label className="min-w-0 text-[10px] uppercase tracking-[0.12em] text-zinc-600">
            Repository
            <select
              aria-label="Active GitHub repository"
              value={manualRepository ? "__manual__" : repositoryFullName}
              onChange={(event) => {
                if (event.target.value === "__manual__") {
                  setManualRepository(true);
                  setRepositoryFullName("");
                  setManualBranch(true);
                  return;
                }
                const repository = repositoryOptions.find((item) => item.fullName === event.target.value);
                setManualRepository(false);
                setManualBranch(false);
                setRepositoryFullName(event.target.value);
                setBranch(repository?.defaultBranch ?? "main");
              }}
              disabled={contextLoading}
              className="mt-1 w-full truncate rounded-lg border border-white/10 bg-[#151719] px-3 py-2 text-xs normal-case tracking-normal text-zinc-200 outline-none focus:border-white/25 disabled:opacity-50"
            >
              {repositoryOptions.length === 0 && <option value="">No connected repositories</option>}
              {repositoryOptions.map((repository) => <option key={repository.id} value={repository.fullName}>{repository.fullName} · {repository.visibility}</option>)}
              <option value="__manual__">Enter another repository…</option>
            </select>
            {manualRepository && <input autoFocus aria-label="Repository owner and name" value={repositoryFullName} onChange={(event) => setRepositoryFullName(event.target.value)} placeholder="owner/repository" className="mt-2 w-full rounded-lg border border-white/10 bg-[#151719] px-3 py-2 text-xs normal-case tracking-normal text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-white/25" />}
          </label>
          <label className="min-w-0 text-[10px] uppercase tracking-[0.12em] text-zinc-600">
            Branch
            <select
              aria-label="Active GitHub branch"
              value={manualBranch ? "__manual__" : branch}
              onChange={(event) => {
                if (event.target.value === "__manual__") {
                  setManualBranch(true);
                  setBranch("");
                } else {
                  setManualBranch(false);
                  setBranch(event.target.value);
                }
              }}
              disabled={!repositoryFullName}
              className="mt-1 w-full truncate rounded-lg border border-white/10 bg-[#151719] px-3 py-2 text-xs normal-case tracking-normal text-zinc-200 outline-none focus:border-white/25 disabled:opacity-50"
            >
              {branchOptions.length === 0 && <option value={branch}>{branch || "No branches available"}</option>}
              {branchOptions.map((option) => <option key={option.name} value={option.name}>{option.name}{option.protected ? " · protected" : ""}</option>)}
              <option value="__manual__">Enter another branch…</option>
            </select>
            {manualBranch && <input autoFocus aria-label="Git branch name" value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="branch name" className="mt-2 w-full rounded-lg border border-white/10 bg-[#151719] px-3 py-2 text-xs normal-case tracking-normal text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-white/25" />}
          </label>
          <label className="min-w-0 text-[10px] uppercase tracking-[0.12em] text-zinc-600">
            Environment
            <select aria-label="Active deployment environment" value={environmentId} onChange={(event) => setEnvironmentId(event.target.value)} disabled={contextLoading || environmentOptions.length === 0} className="mt-1 w-full truncate rounded-lg border border-white/10 bg-[#151719] px-3 py-2 text-xs normal-case tracking-normal text-zinc-200 outline-none focus:border-white/25 disabled:opacity-50">
              {environmentOptions.length === 0 && <option value="">No environments configured</option>}
              {environmentOptions.map((environment) => <option key={environment.id} value={environment.id}>{environment.name} · {environment.tier}</option>)}
            </select>
          </label>
        </div>
        {contextError && <p role="status" className="mx-auto mt-2 max-w-5xl text-[11px] text-amber-300">{contextError}. Manual entry remains available.</p>}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-3xl mx-auto space-y-5">
          {turns.length === 0 && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
              <p className="text-sm text-zinc-300">Tell me what you want to happen.</p>
              <p className="mt-2 text-xs text-zinc-500 leading-5">
                &ldquo;Open a PR on acme/widgets that fixes the README typo&rdquo; or &ldquo;deploy acme/widgets to prod&rdquo; — I&apos;ll check what&apos;s safe to do automatically,
                and ask you to approve anything that changes GitHub or AWS before it happens.
              </p>
            </div>
          )}
          {turns.map((turn) => <ChatBubble key={turn.id} turn={turn} />)}
          {pendingProposal && (
            <ProposalCard proposal={pendingProposal} deciding={decidingId === pendingProposal.id} onApprove={() => void decide(true)} onReject={() => void decide(false)} />
          )}
          {error && (
            <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.05] px-4 py-3">
              <p className="text-xs text-rose-300">{error}</p>
              {!conversationId && <button type="button" onClick={() => setStartupAttempt((attempt) => attempt + 1)} className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.06]">Retry</button>}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-white/[0.06] px-8 py-5">
        <div className="max-w-3xl mx-auto">
          {enabledSkills.length > 0 && <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1"><span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-zinc-600">Skills</span>{enabledSkills.map((skill) => <button key={skill.id} type="button" disabled={sending || Boolean(pendingProposal)} onClick={() => setInput((current) => current || `/${skill.id} `)} className="shrink-0 rounded-full border border-violet-300/[0.12] bg-violet-300/[0.04] px-2.5 py-1 text-[10px] text-violet-200 hover:bg-violet-300/[0.08] disabled:opacity-40">/{skill.id}</button>)}</div>}
          <div className="mb-3 flex items-center gap-1" role="tablist" aria-label="Agent composer mode">
            <button type="button" role="tab" aria-selected={composerMode === "chat"} onClick={() => setComposerMode("chat")} className={`rounded-md px-3 py-1.5 text-xs ${composerMode === "chat" ? "bg-white/[0.09] text-white" : "text-zinc-500 hover:text-zinc-300"}`}>Chat</button>
            <button type="button" role="tab" aria-selected={composerMode === "code"} onClick={() => setComposerMode("code")} className={`rounded-md px-3 py-1.5 text-xs ${composerMode === "code" ? "bg-white/[0.09] text-white" : "text-zinc-500 hover:text-zinc-300"}`}>Edit repository file</button>
            <label className="ml-auto flex items-center gap-2 text-[11px] text-zinc-500">
              <span>Model</span>
              <select aria-label="Agent model" value={selectedProvider} onChange={(event) => setSelectedProvider(event.target.value)} disabled={sending || modelOptions.length === 0} className="max-w-52 rounded-md border border-white/10 bg-[#151719] px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-white/25 disabled:opacity-50">
                {modelOptions.length === 0 && <option value="">No model enabled</option>}
                {modelOptions.map((model) => <option key={model.provider} value={model.provider}>{model.label}</option>)}
              </select>
            </label>
          </div>
          {composerMode === "code" && <div className="mb-3 grid grid-cols-1 gap-2">
            <input aria-label="Repository file path" value={filePath} onChange={(event) => setFilePath(event.target.value)} placeholder="src/path/to/file.ts" className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-white/25" />
          </div>}
          <div className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }}
            placeholder={pendingProposal ? "Approve or reject the proposed action above to continue…" : composerMode === "code" ? "Describe the change you want in this file…" : "What do you want to happen?"}
            disabled={sending || !conversationId || Boolean(pendingProposal)}
            rows={2}
            className="min-h-[48px] flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-white/25 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !input.trim() || !conversationId || Boolean(pendingProposal) || (composerMode === "code" && (!repositoryFullName.includes("/") || !branch.trim() || !filePath.trim()))}
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-40"
          >
            {sending ? "Thinking…" : "Send"}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ turn }: { turn: ChatTurn }) {
  if (turn.role === "tool_result") {
    return <p className="text-xs text-zinc-500 italic px-1">{turn.content}</p>;
  }
  const isUser = turn.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${isUser ? "bg-white text-black" : "bg-white/[0.04] border border-white/[0.07] text-zinc-100"}`}>
        {turn.content}
      </div>
    </div>
  );
}

function ProposalCard({ proposal, deciding, onApprove, onReject }: { proposal: Proposal; deciding: boolean; onApprove: () => void; onReject: () => void }) {
  const [showDetails, setShowDetails] = useState(false);
  const args = typeof proposal.argsJson === "object" && proposal.argsJson !== null
    ? proposal.argsJson as Record<string, unknown>
    : {};
  const proposedContent = proposal.toolName === "commit_github_file" && typeof args.content === "string" ? args.content : null;
  const review = typeof args._review === "object" && args._review !== null ? args._review as Record<string, unknown> : null;
  const baseContent = review?.kind === "github_file" && typeof review.baseContent === "string" ? review.baseContent : null;
  const reviewArgs = Object.fromEntries(Object.entries(args).filter(([key]) => key !== "content" && key !== "metadataDocument" && key !== "_review"));
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-semibold text-white">{TOOL_LABELS[proposal.toolName] ?? proposal.toolName}</p>
        <Badge tone={riskToneFor(proposal.riskLevel)}>{proposal.riskLevel} risk</Badge>
      </div>
      <p className="text-xs text-zinc-400 font-mono mb-4">{describeArgs(proposal.toolName, proposal.argsJson)}</p>
      <button type="button" aria-expanded={showDetails} onClick={() => setShowDetails((current) => !current)} className="mb-4 text-xs text-zinc-400 underline decoration-zinc-700 underline-offset-4 hover:text-zinc-200">
        {showDetails ? "Hide approval details" : "Review approval details"}
      </button>
      {showDetails && (
        <div className="mb-5 space-y-3 rounded-xl border border-white/[0.07] bg-black/20 p-3">
          {proposedContent !== null && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-3 text-[11px] text-zinc-500">
                <span>{baseContent === null ? "Complete proposed file" : "Proposed changes"}</span>
                <span>{proposedContent.split("\n").length} lines · {new TextEncoder().encode(proposedContent).byteLength.toLocaleString()} bytes</span>
              </div>
              {baseContent === null
                ? <pre tabIndex={0} className="max-h-72 overflow-auto whitespace-pre text-[11px] leading-5 text-zinc-300">{proposedContent}</pre>
                : <FileDiff before={baseContent} after={proposedContent} />}
            </div>
          )}
          {Object.keys(reviewArgs).length > 0 && (
            <div>
              <p className="mb-2 text-[11px] text-zinc-500">Structured arguments</p>
              <pre tabIndex={0} className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-zinc-400">{JSON.stringify(reviewArgs, null, 2)}</pre>
            </div>
          )}
          {proposal.toolName === "connect_identity_provider" && typeof args.metadataDocument === "string" && (
            <p className="text-[11px] text-zinc-500">Identity metadata document supplied: {new TextEncoder().encode(args.metadataDocument).byteLength.toLocaleString()} bytes. It is omitted from this compact preview.</p>
          )}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onReject}
          disabled={deciding}
          className="rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={deciding}
          className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
        >
          {deciding ? "Working…" : "Approve & run"}
        </button>
      </div>
    </div>
  );
}

function FileDiff({ before, after }: { before: string; after: string }) {
  const lines = useMemo(() => createLineDiff(before, after), [before, after]);
  const additions = lines.filter((line) => line.kind === "add").length;
  const removals = lines.filter((line) => line.kind === "remove").length;
  if (additions === 0 && removals === 0) {
    return <p className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-200">No content changes detected. Reject this proposal unless an unchanged commit is intentional.</p>;
  }
  return (
    <div>
      <p className="mb-2 text-[11px]"><span className="text-emerald-400">+{additions}</span><span className="ml-2 text-rose-400">−{removals}</span></p>
      <div tabIndex={0} aria-label="Proposed file diff" className="max-h-80 overflow-auto rounded-lg border border-white/[0.06] bg-black/30 font-mono text-[11px] leading-5">
        {lines.map((line, index) => <DiffRow key={`${index}:${line.kind}:${line.oldLine ?? ""}:${line.newLine ?? ""}`} line={line} />)}
      </div>
    </div>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  if (line.kind === "omitted") return <div className="px-3 py-1 text-center text-zinc-600">{line.text}</div>;
  const marker = line.kind === "add" ? "+" : line.kind === "remove" ? "−" : " ";
  const tone = line.kind === "add"
    ? "bg-emerald-400/[0.08] text-emerald-100"
    : line.kind === "remove"
      ? "bg-rose-400/[0.08] text-rose-100"
      : "text-zinc-400";
  return (
    <div className={`grid min-w-max grid-cols-[2.5rem_2.5rem_1.25rem_minmax(0,1fr)] ${tone}`}>
      <span className="select-none border-r border-white/[0.04] px-2 text-right text-zinc-600">{line.oldLine ?? ""}</span>
      <span className="select-none border-r border-white/[0.04] px-2 text-right text-zinc-600">{line.newLine ?? ""}</span>
      <span className="select-none text-center">{marker}</span>
      <span className="whitespace-pre pr-3">{line.text || " "}</span>
    </div>
  );
}
