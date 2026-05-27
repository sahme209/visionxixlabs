/**
 * Phase 502 — GitHub App installation persistence.
 *
 * Pure responders over the GitHubInstallation table:
 *   • buildInstallationCaptureResponse — upsert on (orgId, installationId)
 *     from the post-install callback. Idempotent.
 *   • buildInstallationStatusResponse   — UI reads this to decide
 *     whether to show "+ Install GitHub App" or "Connected as …".
 *   • buildInstallationTransitionResponse — suspend/revoke/reactivate.
 *
 * The actual minting of installation access tokens (which is required
 * to call api.github.com on the org's behalf) ships in a follow-on
 * phase together with the App's private key. This phase covers
 * persistence + UI surface only.
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Closed-unions.
   ────────────────────────────────────────────────────────────── */

export const INSTALL_STATUSES = ["active", "suspended", "revoked"] as const;
export type InstallStatus = (typeof INSTALL_STATUSES)[number];

export const INSTALL_TRANSITIONS = ["suspend", "revoke", "reactivate"] as const;
export type InstallTransition = (typeof INSTALL_TRANSITIONS)[number];

export const ACCOUNT_TYPES = ["User", "Organization"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const REPO_SELECTIONS = ["all", "selected"] as const;
export type RepoSelection = (typeof REPO_SELECTIONS)[number];

function isStatus(s: string): s is InstallStatus {
  return (INSTALL_STATUSES as readonly string[]).includes(s);
}
function isAccountType(s: string): s is AccountType {
  return (ACCOUNT_TYPES as readonly string[]).includes(s);
}
function isRepoSelection(s: string): s is RepoSelection {
  return (REPO_SELECTIONS as readonly string[]).includes(s);
}

/* ──────────────────────────────────────────────────────────────────
   Pure transition.
   ────────────────────────────────────────────────────────────── */

export interface TransitionPlan {
  ok: true;
  next: InstallStatus;
  fields: Partial<{ suspendedAt: Date | null; revokedAt: Date | null }>;
}

export interface TransitionReject {
  ok: false;
  reason: "illegal_transition";
  from: InstallStatus;
  action: InstallTransition;
}

export function planInstallTransition(
  current: InstallStatus,
  action: InstallTransition,
  ctx: { now: Date },
): TransitionPlan | TransitionReject {
  if (action === "suspend") {
    if (current !== "active") return { ok: false, reason: "illegal_transition", from: current, action };
    return { ok: true, next: "suspended", fields: { suspendedAt: ctx.now } };
  }
  if (action === "reactivate") {
    if (current !== "suspended") return { ok: false, reason: "illegal_transition", from: current, action };
    return { ok: true, next: "active", fields: { suspendedAt: null } };
  }
  if (action === "revoke") {
    if (current === "revoked") return { ok: false, reason: "illegal_transition", from: current, action };
    return { ok: true, next: "revoked", fields: { revokedAt: ctx.now } };
  }
  return { ok: false, reason: "illegal_transition", from: current, action };
}

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface InstallationRow {
  id: string;
  organizationId: string;
  githubInstallationId: string;
  accountLogin: string;
  accountType: string;
  repositorySelection: string;
  status: string;
  sourceFlow: string;
  installedByUserId: string | null;
  installedAt: Date;
  suspendedAt: Date | null;
  revokedAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GitHubInstallationRepo {
  gitHubInstallation: {
    findUnique(args: {
      where: { organizationId_githubInstallationId: { organizationId: string; githubInstallationId: string } };
    }): Promise<InstallationRow | null>;
    findFirst(args: {
      where: { organizationId: string; status?: { in: InstallStatus[] } };
      orderBy: { installedAt: "desc" };
    }): Promise<InstallationRow | null>;
    findMany(args: {
      where: { organizationId: string };
      orderBy: { installedAt: "desc" };
    }): Promise<InstallationRow[]>;
    upsert(args: {
      where: { organizationId_githubInstallationId: { organizationId: string; githubInstallationId: string } };
      create: {
        organizationId: string;
        githubInstallationId: string;
        accountLogin: string;
        accountType: AccountType;
        repositorySelection: RepoSelection;
        status: "active";
        sourceFlow: string;
        installedByUserId: string | null;
        rawCallbackJson: unknown;
      };
      update: {
        accountLogin: string;
        accountType: AccountType;
        repositorySelection: RepoSelection;
        status: "active";
        suspendedAt: null;
        revokedAt: null;
        rawCallbackJson: unknown;
      };
    }): Promise<InstallationRow>;
    update(args: {
      where: { id: string };
      data: { status: InstallStatus; suspendedAt?: Date | null; revokedAt?: Date | null };
    }): Promise<InstallationRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Projection.
   ────────────────────────────────────────────────────────────── */

export interface InstallationView {
  id: string;
  githubInstallationId: string;
  accountLogin: string;
  accountType: AccountType | "unknown";
  repositorySelection: RepoSelection | "unknown";
  status: InstallStatus | "unknown";
  sourceFlow: string;
  installedByUserId: string | null;
  installedAtIso: string;
  suspendedAtIso: string | null;
  revokedAtIso: string | null;
  lastSeenAtIso: string | null;
}

function projectRow(r: InstallationRow): InstallationView {
  return {
    id: r.id,
    githubInstallationId: r.githubInstallationId,
    accountLogin: r.accountLogin,
    accountType: isAccountType(r.accountType) ? r.accountType : "unknown",
    repositorySelection: isRepoSelection(r.repositorySelection) ? r.repositorySelection : "unknown",
    status: isStatus(r.status) ? r.status : "unknown",
    sourceFlow: r.sourceFlow,
    installedByUserId: r.installedByUserId,
    installedAtIso: r.installedAt.toISOString(),
    suspendedAtIso: r.suspendedAt ? r.suspendedAt.toISOString() : null,
    revokedAtIso: r.revokedAt ? r.revokedAt.toISOString() : null,
    lastSeenAtIso: r.lastSeenAt ? r.lastSeenAt.toISOString() : null,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Capture (idempotent upsert from post-install callback).
   ────────────────────────────────────────────────────────────── */

export interface CaptureInput {
  organizationId: string;
  installedByUserId?: string;
  githubInstallationId: string;
  accountLogin: string;
  accountType: string;
  repositorySelection?: string;
  rawCallbackJson?: unknown;
  sourceFlow?: string;
}

export type CaptureError =
  | "installation_id_required"
  | "account_login_required"
  | "account_type_invalid";

export type CaptureBody =
  | {
      ok: true;
      data: {
        installation: InstallationView;
        created: boolean;
      };
    }
  | { ok: false; error: CaptureError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface CaptureResult { status: number; body: CaptureBody }

export async function buildInstallationCaptureResponse(
  repo: GitHubInstallationRepo,
  input: CaptureInput,
  opts: { correlationId?: string } = {},
): Promise<CaptureResult> {
  const id = input.githubInstallationId?.trim() ?? "";
  if (!id) return { status: 422, body: { ok: false, error: "installation_id_required" } };
  const login = input.accountLogin?.trim() ?? "";
  if (!login) return { status: 422, body: { ok: false, error: "account_login_required" } };
  if (!isAccountType(input.accountType)) {
    return {
      status: 422,
      body: { ok: false, error: "account_type_invalid", hint: "accountType must be 'User' or 'Organization'" },
    };
  }
  const repoSel: RepoSelection = isRepoSelection(input.repositorySelection ?? "")
    ? (input.repositorySelection as RepoSelection)
    : "selected";

  try {
    const existing = await repo.gitHubInstallation.findUnique({
      where: { organizationId_githubInstallationId: { organizationId: input.organizationId, githubInstallationId: id } },
    });
    const row = await repo.gitHubInstallation.upsert({
      where: { organizationId_githubInstallationId: { organizationId: input.organizationId, githubInstallationId: id } },
      create: {
        organizationId: input.organizationId,
        githubInstallationId: id,
        accountLogin: login,
        accountType: input.accountType,
        repositorySelection: repoSel,
        status: "active",
        sourceFlow: input.sourceFlow ?? "install",
        installedByUserId: input.installedByUserId ?? null,
        rawCallbackJson: input.rawCallbackJson ?? null,
      },
      update: {
        accountLogin: login,
        accountType: input.accountType,
        repositorySelection: repoSel,
        status: "active",
        suspendedAt: null,
        revokedAt: null,
        rawCallbackJson: input.rawCallbackJson ?? null,
      },
    });
    return {
      status: existing ? 200 : 201,
      body: { ok: true, data: { installation: projectRow(row), created: !existing } },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "GitHubInstallation table needs Phase 502 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Status (UI reads this on every page load).
   ────────────────────────────────────────────────────────────── */

export interface StatusContext {
  appSlug: string;
  callbackBaseUrl: string;
}

export type StatusBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        installed: boolean;
        active: InstallationView | null;
        history: InstallationView[];
        installUrl: string;
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface StatusResult { status: number; body: StatusBody }

/**
 * Build the GitHub App install URL. Embeds organizationId in the
 * `state` param so the post-install callback knows which tenant
 * the install belongs to.
 */
export function buildInstallUrl(ctx: StatusContext, organizationId: string): string {
  if (!ctx.appSlug) return "";
  const state = encodeURIComponent(organizationId);
  return `https://github.com/apps/${ctx.appSlug}/installations/new?state=${state}`;
}

export async function buildInstallationStatusResponse(
  repo: GitHubInstallationRepo,
  organizationId: string,
  ctx: StatusContext,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<StatusResult> {
  try {
    const now = opts.now ?? new Date();
    const history = await repo.gitHubInstallation.findMany({
      where: { organizationId },
      orderBy: { installedAt: "desc" },
    });
    const active = history.find((h) => h.status === "active") ?? null;

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          installed: active !== null,
          active: active ? projectRow(active) : null,
          history: history.map(projectRow),
          installUrl: buildInstallUrl(ctx, organizationId),
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "GitHubInstallation table needs Phase 502 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Transition (suspend / revoke / reactivate).
   ────────────────────────────────────────────────────────────── */

export interface TransitionInput {
  organizationId: string;
  installationRowId: string;
  action: InstallTransition;
}

export type TransitionError =
  | "installation_not_found"
  | "cross_org_installation"
  | "unknown_current_status"
  | "illegal_transition";

export type TransitionBody =
  | { ok: true; data: { id: string; previousStatus: InstallStatus; status: InstallStatus; action: InstallTransition } }
  | { ok: false; error: TransitionError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface TransitionResult { status: number; body: TransitionBody }

export async function buildInstallationTransitionResponse(
  repo: GitHubInstallationRepo,
  input: TransitionInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<TransitionResult> {
  if (!(INSTALL_TRANSITIONS as readonly string[]).includes(input.action)) {
    return { status: 422, body: { ok: false, error: "illegal_transition", hint: `Unknown action "${input.action}".` } };
  }
  try {
    const all = await repo.gitHubInstallation.findMany({
      where: { organizationId: input.organizationId },
      orderBy: { installedAt: "desc" },
    });
    const existing = all.find((r) => r.id === input.installationRowId);
    if (!existing) return { status: 404, body: { ok: false, error: "installation_not_found" } };
    if (existing.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_installation" } };
    }
    if (!isStatus(existing.status)) {
      return {
        status: 409,
        body: { ok: false, error: "unknown_current_status", hint: `Installation.status="${existing.status}" not in closed-union.` },
      };
    }
    const now = opts.now ?? new Date();
    const plan = planInstallTransition(existing.status as InstallStatus, input.action, { now });
    if (!plan.ok) {
      return {
        status: 409,
        body: { ok: false, error: "illegal_transition", hint: `Cannot ${input.action} from "${existing.status}".` },
      };
    }
    const update: { status: InstallStatus; suspendedAt?: Date | null; revokedAt?: Date | null } = { status: plan.next };
    if (plan.fields.suspendedAt !== undefined) update.suspendedAt = plan.fields.suspendedAt;
    if (plan.fields.revokedAt !== undefined) update.revokedAt = plan.fields.revokedAt;
    await repo.gitHubInstallation.update({ where: { id: existing.id }, data: update });
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          id: existing.id,
          previousStatus: existing.status as InstallStatus,
          status: plan.next,
          action: input.action,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "GitHubInstallation table needs Phase 502 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
