/**
 * Pure refinement-prompt builder — Phase 390.
 *
 * Builds the messages array for the SECOND Anthropic call: AI's first
 * proposed diff didn't parse or didn't apply against the real repo
 * state. We hand back the original instruction + the broken diff +
 * the specific error and ask for a corrected diff.
 *
 * Multi-turn shape: the system prompt stays identical to the first
 * call (so the prompt cache from the original code_propose call is
 * still warm). The conversation now has:
 *
 *   system: <CODE_PROPOSE_SYSTEM_PROMPT> + cache_control: ephemeral
 *   user:   <original instruction + repo context>
 *   assistant: <the broken patch the AI emitted>
 *   user:   <structured feedback about what failed + ask for a fix>
 *
 * The breakpoint sits after the system block. The repo context, the
 * original assistant turn, and the new user feedback all sit after
 * the breakpoint — but the cached system bytes are reused.
 */

import { CODE_PROPOSE_SYSTEM_PROMPT } from "./buildCodeProposeMessages";
import type { ValidateProposalResult } from "./validateProposal";

export interface RefinementInput {
  /** The operator's original instruction. */
  instruction: string;
  repoRef: string;
  branchHint: string | null;
  repoContext?: string;
  /** The broken patch text from the first attempt. */
  brokenPatchText: string;
  /** The validation report explaining what went wrong. */
  validation: ValidateProposalResult;
}

export interface RefinementMessages {
  system: ReadonlyArray<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }>;
  messages: ReadonlyArray<
    | { role: "user"; content: string }
    | { role: "assistant"; content: string }
  >;
}

function formatValidationFeedback(v: ValidateProposalResult): string {
  const lines: string[] = [];

  if (!v.parseOk) {
    lines.push(`# Parse failure`);
    lines.push(`The unified diff did not parse. Reason: ${v.parseFailureReason ?? "unknown"}.`);
    if (v.parseFailureDetail) lines.push(`Detail: ${v.parseFailureDetail}`);
    lines.push("");
    lines.push("Please re-emit the diff. Common fixes:");
    lines.push("- Wrap the diff in a ```diff fenced code block.");
    lines.push("- Use proper `--- a/path` / `+++ b/path` headers.");
    lines.push("- Use `@@ -oldStart,oldCount +newStart,newCount @@` hunk headers (counts can be elided for single-line hunks).");
    lines.push("- Every body line must start with ' ' (context), '+' (insert), or '-' (delete).");
    return lines.join("\n");
  }

  lines.push(`# Apply failures`);
  const failedFiles = v.files.filter((f) => !f.ok);
  if (failedFiles.length === 0) {
    lines.push("(parser succeeded but no specific file failures were flagged — please double-check the patch shape)");
  } else {
    lines.push(`The diff parsed but ${failedFiles.length} file(s) did not apply cleanly against the real base content:`);
    lines.push("");
    for (const f of failedFiles) {
      lines.push(`- **${f.path}** (${f.changeKind}) · ${f.reason}: ${f.detail ?? ""}`);
    }
    lines.push("");
    lines.push("Common fixes:");
    lines.push("- Verify that context lines (lines starting with ' ') match the base file EXACTLY, including whitespace.");
    lines.push("- Verify that `-` lines match the base content for those lines.");
    lines.push("- Re-emit the diff with corrected line numbers + context if needed.");
  }

  return lines.join("\n");
}

export function buildRefinementMessages(input: RefinementInput): RefinementMessages {
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

  const feedback = formatValidationFeedback(input.validation);

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
      { role: "assistant", content: input.brokenPatchText },
      {
        role: "user",
        content: [
          `Your previous proposal had problems. Please re-emit a corrected unified diff that addresses the feedback below. Keep the patch minimal and idiomatic — the operator's instruction has not changed.`,
          "",
          feedback,
          "",
          "Re-emit the FULL corrected diff in your response (don't reference the broken one).",
        ].join("\n"),
      },
    ],
  };
}
