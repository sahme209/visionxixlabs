import { useEffect, useRef, useState } from "react";
import { Badge, riskToneFor } from "../components/Primitives";
import { desktopClient } from "../lib/desktopClient";

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

const TOOL_LABELS: Record<string, string> = {
  list_environments: "List environments",
  check_deploy_status: "Check deploy status",
  create_github_branch: "Create a branch",
  commit_github_file: "Commit a file",
  open_github_pull_request: "Open a pull request",
  trigger_aws_deploy: "Deploy to AWS",
};

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
    default:
      return JSON.stringify(a);
  }
}

export function AgentChatView() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pendingProposal, setPendingProposal] = useState<Proposal | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void desktopClient.createAgentConversation().then((result) => {
      if (result.ok) setConversationId(result.data.id);
      else setError(result.error);
    });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, pendingProposal]);

  async function send() {
    const message = input.trim();
    if (!message || !conversationId || sending) return;
    setInput("");
    setError(null);
    setTurns((prev) => [...prev, { id: `local_${Date.now()}`, role: "user", content: message }]);
    setSending(true);
    try {
      const result = await desktopClient.sendAgentMessage(conversationId, message);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTurns((prev) => [...prev, { id: `local_${Date.now()}_r`, role: "assistant", content: result.data.reply }]);
      setPendingProposal(result.data.proposal && result.data.proposal.status === "proposed" ? result.data.proposal : null);
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-3xl mx-auto space-y-5">
          {turns.length === 0 && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
              <p className="text-sm text-zinc-300">Tell me what you want to happen.</p>
              <p className="mt-2 text-xs text-zinc-500 leading-5">
                "Open a PR on acme/widgets that fixes the README typo" or "deploy acme/widgets to prod" — I'll check what's safe to do automatically,
                and ask you to approve anything that changes GitHub or AWS before it happens.
              </p>
            </div>
          )}
          {turns.map((turn) => <ChatBubble key={turn.id} turn={turn} />)}
          {pendingProposal && (
            <ProposalCard proposal={pendingProposal} deciding={decidingId === pendingProposal.id} onApprove={() => void decide(true)} onReject={() => void decide(false)} />
          )}
          {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
        </div>
      </div>
      <div className="border-t border-white/[0.06] px-8 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }}
            placeholder={pendingProposal ? "Approve or reject the proposed action above to continue…" : "What do you want to happen?"}
            disabled={sending || !conversationId || Boolean(pendingProposal)}
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-white/25 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !input.trim() || !conversationId || Boolean(pendingProposal)}
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-40"
          >
            {sending ? "Thinking…" : "Send"}
          </button>
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
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-semibold text-white">{TOOL_LABELS[proposal.toolName] ?? proposal.toolName}</p>
        <Badge tone={riskToneFor(proposal.riskLevel)}>{proposal.riskLevel} risk</Badge>
      </div>
      <p className="text-xs text-zinc-400 font-mono mb-4">{describeArgs(proposal.toolName, proposal.argsJson)}</p>
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
