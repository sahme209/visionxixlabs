import type { CloudProvider } from "../cloudSnapshot";

// ---------------------------------------------------------------------------
// Chat session context — loaded from DB at the start of each turn
// ---------------------------------------------------------------------------

export type ChatContext = {
  organizationId: string;
  userId: string;
  conversationId: string;
  provider?: CloudProvider;
  activeRunId?: string;
  activeAccountId?: string;
};

// ---------------------------------------------------------------------------
// Intent classification
// ---------------------------------------------------------------------------

export type ChatIntent =
  | "what_found"
  | "fix_priority"
  | "apply_safe"
  | "show_terraform"
  | "show_cli"
  | "why_risky"
  | "changes_since"
  | "savings_summary"
  | "start_scan"
  | "approval_decision"
  | "explain_finding"
  | "run_status"
  | "list_accounts"
  | "unknown";

// ---------------------------------------------------------------------------
// Chat response — what the handler returns to the caller
// ---------------------------------------------------------------------------

export type ChatResponse = {
  message: string;
  data?: Record<string, unknown>;
  actions?: ChatAction[];
  followUp?: string;
};

export type ChatAction = {
  type:
    | "start_scan"
    | "approve_all"
    | "approve_partial"
    | "reject_all"
    | "export_terraform"
    | "export_cli"
    | "apply_safe"
    | "view_details"
    | "view_finding";
  label: string;
  payload: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Handler signature — every intent handler conforms to this
// ---------------------------------------------------------------------------

export type ChatHandler = (
  ctx: ChatContext,
  params: Record<string, string>,
) => Promise<ChatResponse>;
