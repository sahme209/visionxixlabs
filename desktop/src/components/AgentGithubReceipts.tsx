import { useState } from "react";
import { desktopClient } from "../lib/desktopClient";

interface GithubAction { id: string; toolName: string; status: string; argsJson: unknown; resultJson?: unknown }
const object = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
export const isGithubReceiptAction = (action: { toolName: string }) => action.toolName === "commit_github_files" || action.toolName === "open_github_pull_request";

function boundReceipt(action: GithubAction) {
  const args = object(action.argsJson), result = object(action.resultJson);
  if (!args || !result || typeof args.repositoryFullName !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(args.repositoryFullName)) return null;
  const repository = args.repositoryFullName;
  if (action.toolName === "commit_github_files") {
    if (typeof args.branch !== "string" || !args.branch || args.branch.length > 255 || /[\x00-\x20\x7f]/.test(args.branch)
      || !Array.isArray(args.files) || args.files.length < 1 || args.files.length > 20 || result.fileCount !== args.files.length
      || typeof result.sha !== "string" || !/^[a-f0-9]{40}$/.test(result.sha)) return null;
    const href = `https://github.com/${repository}/commit/${result.sha}`;
    if (result.htmlUrl !== href) return null;
    return { href, label: "View recorded commit", detail: `${repository} · ${args.branch} · ${result.fileCount} files`, identity: `Commit ${result.sha}` };
  }
  if (action.toolName === "open_github_pull_request") {
    if (typeof args.head !== "string" || typeof args.base !== "string" || !args.head || !args.base
      || args.head.length > 255 || args.base.length > 255 || /[\x00-\x20\x7f]/.test(args.head + args.base)
      || typeof result.number !== "number" || !Number.isSafeInteger(result.number) || result.number < 1) return null;
    const href = `https://github.com/${repository}/pull/${result.number}`;
    if (result.htmlUrl !== href) return null;
    return { href, label: "View recorded pull request", detail: `${repository} · ${args.head} → ${args.base}`, identity: `Pull request #${result.number}` };
  }
  return null;
}

/** Recorded provider evidence only. No retry, write, permission change or provider request. */
export function AgentGithubReceipts({ actions }: { actions: GithubAction[] }) {
  const [context] = useState(() => desktopClient.config);
  if (context !== desktopClient.config) return null;
  return <>{actions.filter(action => action.status === "executed" && isGithubReceiptAction(action)).map(action => {
    const receipt = boundReceipt(action);
    return <section key={action.id} aria-label="Recorded GitHub result" className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-xs text-zinc-400">
      {receipt ? <>
        <p className="font-medium text-zinc-200">{receipt.identity}</p>
        <p className="mt-1 break-all">{receipt.detail}</p>
        <a data-help-id="agent.workspace.github-receipt-link" className="mt-2 inline-block text-zinc-200 underline" href={receipt.href} target="_blank" rel="noopener noreferrer">{receipt.label}</a>
        <p className="mt-1">Tests, merge and recovery are not verified by this receipt.</p>
      </> : <p>Recorded GitHub result unavailable. Reopen the conversation to read it again; do not execute the action again to recover a receipt.</p>}
    </section>;
  })}</>;
}
