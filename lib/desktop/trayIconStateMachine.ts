/**
 * Pure desktop tray-icon / menu-bar state machine.
 *
 * Folds the platform's current observable state (active alerts +
 * pending approvals + AI provider verdict + integration health +
 * session) into a single tray icon variant + tooltip. The desktop
 * shell calls reduceTrayState on every meaningful event and renders
 * the result.
 *
 * Pure / deterministic.
 */

export interface TrayInputs {
  /** Count of unread incident alerts. */
  unreadIncidentCount: number;
  /** Count of pending approval packets. */
  pendingApprovalCount: number;
  /** Overall public-status verdict. */
  platformVerdict: "operational" | "degraded" | "down" | "unknown";
  /** Active AI provider name, or null when only Mock is available. */
  activeAiProvider: string | null;
  /** Overall integration-health verdict. */
  integrationVerdict: "operational" | "degraded" | "down";
  /** Session verdict from sessionSecurityHelpers.assessSession. */
  sessionVerdict: "ok" | "warn" | "require_login";
  /** Network connectivity. */
  online: boolean;
}

export type TrayVariant =
  | "ok"            // green dot
  | "attention"    // amber with badge
  | "critical"     // red with badge
  | "offline"      // gray, no badge
  | "needs_login";  // amber w/ lock

export interface TrayState {
  variant: TrayVariant;
  /** Badge number (0 = no badge). */
  badgeCount: number;
  /** Tooltip rendered on hover. */
  tooltip: string;
  /** Menu sections the shell should render. */
  menu: TrayMenuItem[];
}

export interface TrayMenuItem {
  kind: "header" | "approvals" | "incidents" | "status" | "ai_provider" | "integrations" | "open_app" | "quit";
  label: string;
  badge?: number;
  /** True when this item is the highest-attention item — the shell may bold it. */
  primary?: boolean;
}

function tooltipOf(state: TrayInputs, variant: TrayVariant, badgeCount: number): string {
  if (variant === "offline") return "Axiom — offline";
  if (variant === "needs_login") return "Axiom — sign-in required";
  if (variant === "critical") {
    return badgeCount > 0
      ? `Axiom — ${badgeCount} item(s) need attention now`
      : "Axiom — platform reports critical";
  }
  if (variant === "attention") {
    const parts: string[] = [];
    if (state.pendingApprovalCount > 0) parts.push(`${state.pendingApprovalCount} pending approval${state.pendingApprovalCount === 1 ? "" : "s"}`);
    if (state.unreadIncidentCount > 0) parts.push(`${state.unreadIncidentCount} unread incident${state.unreadIncidentCount === 1 ? "" : "s"}`);
    if (parts.length === 0) parts.push(state.platformVerdict);
    return `Axiom — ${parts.join(" · ")}`;
  }
  return "Axiom — all clear";
}

export function reduceTrayState(input: TrayInputs): TrayState {
  // Decision ladder runs from most-blocking to least-blocking.
  if (!input.online) {
    return {
      variant: "offline", badgeCount: 0,
      tooltip: tooltipOf(input, "offline", 0),
      menu: [
        { kind: "header", label: "Offline — reconnecting..." },
        { kind: "open_app", label: "Open Axiom" },
        { kind: "quit", label: "Quit" },
      ],
    };
  }
  if (input.sessionVerdict === "require_login") {
    return {
      variant: "needs_login", badgeCount: 0,
      tooltip: tooltipOf(input, "needs_login", 0),
      menu: [
        { kind: "header", label: "Sign-in required", primary: true },
        { kind: "open_app", label: "Open Axiom to sign in" },
        { kind: "quit", label: "Quit" },
      ],
    };
  }

  const critical =
    input.platformVerdict === "down"
    || input.integrationVerdict === "down"
    || input.unreadIncidentCount >= 3;

  const attention =
    critical
    || input.pendingApprovalCount > 0
    || input.unreadIncidentCount > 0
    || input.platformVerdict === "degraded"
    || input.integrationVerdict === "degraded"
    || input.sessionVerdict === "warn";

  const variant: TrayVariant = critical ? "critical" : attention ? "attention" : "ok";
  const badgeCount = input.pendingApprovalCount + input.unreadIncidentCount;

  const menu: TrayMenuItem[] = [
    { kind: "header", label: variant === "critical" ? "Axiom — needs action" : variant === "attention" ? "Axiom — attention" : "Axiom — all clear" },
    { kind: "approvals", label: `Approvals (${input.pendingApprovalCount})`, badge: input.pendingApprovalCount, primary: input.pendingApprovalCount > 0 },
    { kind: "incidents", label: `Incidents (${input.unreadIncidentCount})`, badge: input.unreadIncidentCount, primary: input.unreadIncidentCount > 0 },
    { kind: "status", label: `Platform: ${input.platformVerdict}` },
    { kind: "ai_provider", label: `AI: ${input.activeAiProvider ?? "(mock fallback)"}` },
    { kind: "integrations", label: `Integrations: ${input.integrationVerdict}` },
    { kind: "open_app", label: "Open Axiom" },
    { kind: "quit", label: "Quit" },
  ];

  return {
    variant,
    badgeCount,
    tooltip: tooltipOf(input, variant, badgeCount),
    menu,
  };
}
