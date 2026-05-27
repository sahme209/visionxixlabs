/**
 * Phase 503 — first-run zero-touch checklist.
 *
 * Reads four signals (GitHub installation, repository, application,
 * release) and projects a 4-item progress checklist for the
 * dashboard. The pure projector takes raw counts and returns the
 * normalized view; the responder wraps it with DB I/O + migration
 * degradation.
 *
 * Each item carries a `cta` URL the UI deep-links to.
 */

import { isMissingTable } from "./releaseListResponder";
import { buildInstallUrl, type StatusContext as InstallCtx } from "./githubInstallationResponder";

/* ──────────────────────────────────────────────────────────────────
   Closed-unions.
   ────────────────────────────────────────────────────────────── */

export const CHECKLIST_ITEM_KEYS = [
  "install_github_app",
  "register_application",
  "track_repository",
  "create_release",
] as const;
export type ChecklistItemKey = (typeof CHECKLIST_ITEM_KEYS)[number];

/* ──────────────────────────────────────────────────────────────────
   Pure projector.
   ────────────────────────────────────────────────────────────── */

export interface CountsInput {
  installationCount: number;
  applicationCount: number;
  repositoryCount: number;
  releaseCount: number;
}

export interface ChecklistItem {
  key: ChecklistItemKey;
  title: string;
  description: string;
  done: boolean;
  cta: { label: string; href: string };
  /** Items earlier in the list must be done before unlocking this one. */
  blockedByPredecessor: boolean;
}

export interface ChecklistProjection {
  items: ChecklistItem[];
  completed: number;
  total: number;
  percent: number;
  nextItem: ChecklistItem | null;
  allDone: boolean;
}

export function projectChecklist(counts: CountsInput, installUrl: string): ChecklistProjection {
  const installDone = counts.installationCount > 0;
  const applicationDone = counts.applicationCount > 0;
  const repositoryDone = counts.repositoryCount > 0;
  const releaseDone = counts.releaseCount > 0;

  // CTA URLs — install_github_app prefers the external GitHub URL when
  // GITHUB_APP_SLUG is configured; otherwise falls back to the in-app
  // setup page that explains how to configure it.
  const installCta = installUrl || "/dashboard/github-app";

  const items: ChecklistItem[] = [
    {
      key: "install_github_app",
      title: "Install the Axiom GitHub App",
      description: "Authorize Axiom to read your repository inventory + receive webhook deliveries.",
      done: installDone,
      cta: { label: installDone ? "Manage install" : "Install on GitHub", href: installCta },
      blockedByPredecessor: false,
    },
    {
      key: "register_application",
      title: "Register your first application",
      description: "Applications are the governance unit. Releases attach to an application, not a repo.",
      done: applicationDone,
      cta: { label: applicationDone ? "Manage applications" : "Register an application", href: "/dashboard/applications" },
      blockedByPredecessor: !installDone,
    },
    {
      key: "track_repository",
      title: "Track your first repository",
      description: "Tells the platform which repo backs an application. After install, the auto-onboarder will surface candidates.",
      done: repositoryDone,
      cta: { label: repositoryDone ? "Manage repositories" : "Register a repository", href: "/dashboard/repositories" },
      blockedByPredecessor: !applicationDone,
    },
    {
      key: "create_release",
      title: "Cut your first release",
      description: "Pins a tag + commit to an application. Drives readiness scoring, evidence packs, and the audit trail.",
      done: releaseDone,
      cta: { label: releaseDone ? "View releases" : "Create a release", href: "/dashboard/releases" },
      blockedByPredecessor: !repositoryDone,
    },
  ];

  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const percent = Math.round((completed / total) * 100);
  const nextItem = items.find((i) => !i.done) ?? null;
  return { items, completed, total, percent, nextItem, allDone: completed === total };
}

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface OnboardingChecklistRepo {
  gitHubInstallation: {
    count(args: { where: { organizationId: string; status: "active" } }): Promise<number>;
  };
  application: {
    count(args: { where: { organizationId: string } }): Promise<number>;
  };
  repository: {
    count(args: { where: { organizationId: string } }): Promise<number>;
  };
  release: {
    count(args: { where: { organizationId: string } }): Promise<number>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Responder.
   ────────────────────────────────────────────────────────────── */

export type ChecklistBody =
  | { ok: true; data: { generatedAt: string; checklist: ChecklistProjection } }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ChecklistResult { status: number; body: ChecklistBody }

export async function buildOnboardingChecklistResponse(
  repo: OnboardingChecklistRepo,
  organizationId: string,
  installCtx: InstallCtx,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ChecklistResult> {
  try {
    const now = opts.now ?? new Date();
    // Each count is wrapped in its own try so a missing table for one
    // resource degrades to count=0 rather than 503-ing the whole
    // checklist. The bigger surface migrates over many phases.
    const installationCount = await safeCount(() =>
      repo.gitHubInstallation.count({ where: { organizationId, status: "active" } }));
    const applicationCount = await safeCount(() =>
      repo.application.count({ where: { organizationId } }));
    const repositoryCount = await safeCount(() =>
      repo.repository.count({ where: { organizationId } }));
    const releaseCount = await safeCount(() =>
      repo.release.count({ where: { organizationId } }));

    const installUrl = buildInstallUrl(installCtx, organizationId);
    const checklist = projectChecklist(
      { installationCount, applicationCount, repositoryCount, releaseCount },
      installUrl,
    );

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          checklist,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "One of the checklist source tables is missing." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

async function safeCount(fn: () => Promise<number>): Promise<number> {
  try { return await fn(); }
  catch (err) { if (isMissingTable(err)) return 0; throw err; }
}
