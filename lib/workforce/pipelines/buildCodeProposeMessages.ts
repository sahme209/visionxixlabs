/**
 * Pure prompt builder for the AI code-propose stage — Phase 380.
 *
 * Builds the messages array passed to Claude for patch proposal. Splits
 * cleanly into:
 *
 *   - system (cacheable): the engineer persona + output contract. Stable
 *     across every coding task in the workspace — `cache_control:
 *     ephemeral` on the last system block enables prompt caching.
 *   - user (volatile): the operator instruction + repo target + (later)
 *     the repo-read context. Goes after the breakpoint so cache reads
 *     fire on every task.
 *
 * Stable bytes go early. No timestamps, no UUIDs, no per-request data
 * in the system prompt — prompt caching is a prefix match, any byte
 * change anywhere in the prefix invalidates everything after it.
 */

export interface CodeProposeInput {
  instruction: string;
  repoRef: string;
  branchHint: string | null;
  /** Optional repo-read context (file tree summary, related symbols, etc.) — wired in a follow-up phase. */
  repoContext?: string;
}

export interface CodeProposeMessages {
  system: ReadonlyArray<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }>;
  messages: ReadonlyArray<{ role: "user"; content: string }>;
}

/** Frozen system-prompt text. Never interpolate per-request data here. */
export const CODE_PROPOSE_SYSTEM_PROMPT = [
  "You are the AI software engineer in the VisionXIXLabs workforce platform.",
  "Your job is to propose a MINIMAL diff that satisfies the operator's instruction.",
  "",
  "Output contract:",
  "  1. First, a one-paragraph plan describing exactly what the patch will change and why.",
  "  2. Then, the full proposed diff in unified diff format (one --- / +++ pair per file).",
  "  3. Then, a one-line summary suitable for a PR title.",
  "",
  "Rules:",
  "  - Touch the smallest number of files that solves the problem.",
  "  - Do not add features, refactor unrelated code, or introduce abstractions beyond what's needed.",
  "  - Do not add new dependencies unless absolutely necessary; if you do, justify it explicitly.",
  "  - Match the existing code style and conventions visible from the repo context.",
  "  - If the instruction is ambiguous, state your assumption clearly before patching.",
  "  - If the instruction asks for something destructive or out of scope, refuse and explain why.",
  "",
  "The runtime gate will require two human approvers before this patch is shipped — focus on correctness, not on persuading reviewers.",
].join("\n");

export function buildCodeProposeMessages(input: CodeProposeInput): CodeProposeMessages {
  const userParts: string[] = [
    `Repository: ${input.repoRef}`,
  ];
  if (input.branchHint) userParts.push(`Branch: ${input.branchHint}`);
  if (input.repoContext) {
    userParts.push("");
    userParts.push("Repo context:");
    userParts.push(input.repoContext);
  }
  userParts.push("");
  userParts.push("Operator instruction:");
  userParts.push(input.instruction);

  return {
    system: [
      {
        type: "text",
        text: CODE_PROPOSE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      { role: "user", content: userParts.join("\n") },
    ],
  };
}
