/**
 * Phase 494 — repository registration.
 *
 * POST /api/dashboard/repository-create. Idempotent on the schema-
 * level unique (organizationId, provider, remoteOwner, remoteName).
 *
 * remoteUrl can be supplied by the caller (preferred) or auto-derived
 * from provider + owner + name when omitted. defaultBranch defaults
 * to "main" (matches the schema default).
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Closed-union provider.
   ────────────────────────────────────────────────────────────── */

export const ALL_REGISTRABLE_PROVIDERS = ["github", "gitlab", "azuredevops", "other"] as const;
export type RegistrableProvider = (typeof ALL_REGISTRABLE_PROVIDERS)[number];

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface RepositoryCreatedRow {
  id: string;
  provider: string;
  remoteOwner: string;
  remoteName: string;
  remoteUrl: string;
  defaultBranch: string;
}

export interface RepositoryCreateRepo {
  repository: {
    findUnique(args: {
      where: {
        organizationId_provider_remoteOwner_remoteName: {
          organizationId: string;
          provider: RegistrableProvider;
          remoteOwner: string;
          remoteName: string;
        };
      };
    }): Promise<RepositoryCreatedRow | null>;
    create(args: {
      data: {
        organizationId: string;
        provider: RegistrableProvider;
        remoteOwner: string;
        remoteName: string;
        remoteUrl: string;
        defaultBranch: string;
        repoFlavor: string | null;
      };
    }): Promise<RepositoryCreatedRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Input + output.
   ────────────────────────────────────────────────────────────── */

export interface BuildRepositoryCreateInput {
  organizationId: string;
  provider: string;          // narrowed before responder runs
  remoteOwner: string;
  remoteName: string;
  remoteUrl?: string;
  defaultBranch?: string;
  repoFlavor?: string;
}

export type RepositoryCreateError =
  | "provider_invalid"
  | "owner_invalid"
  | "name_invalid"
  | "remote_url_invalid";

export type RepositoryCreateBody =
  | {
      ok: true;
      data: {
        id: string;
        provider: string;
        displayName: string;
        remoteUrl: string;
        defaultBranch: string;
        created: boolean;
      };
    }
  | { ok: false; error: RepositoryCreateError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: RepositoryCreateBody }

const SAFE_PART = /^[A-Za-z0-9._-]+$/;

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildRepositoryCreateResponse(
  repo: RepositoryCreateRepo,
  input: BuildRepositoryCreateInput,
  opts: { correlationId?: string } = {},
): Promise<ResponderResult> {
  if (!(ALL_REGISTRABLE_PROVIDERS as readonly string[]).includes(input.provider)) {
    return { status: 422, body: { ok: false, error: "provider_invalid" } };
  }
  const provider = input.provider as RegistrableProvider;
  if (!input.remoteOwner || !SAFE_PART.test(input.remoteOwner)) {
    return { status: 422, body: { ok: false, error: "owner_invalid" } };
  }
  if (!input.remoteName || !SAFE_PART.test(input.remoteName)) {
    return { status: 422, body: { ok: false, error: "name_invalid" } };
  }

  // Derive remoteUrl when not supplied; tolerant of explicit overrides.
  const remoteUrl = input.remoteUrl?.trim() || defaultRemoteUrl(provider, input.remoteOwner, input.remoteName);
  try {
    // Lightweight URL validation — must parse and use https/http.
    const u = new URL(remoteUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return { status: 422, body: { ok: false, error: "remote_url_invalid" } };
    }
  } catch {
    return { status: 422, body: { ok: false, error: "remote_url_invalid" } };
  }

  try {
    const existing = await repo.repository.findUnique({
      where: {
        organizationId_provider_remoteOwner_remoteName: {
          organizationId: input.organizationId,
          provider,
          remoteOwner: input.remoteOwner,
          remoteName: input.remoteName,
        },
      },
    });
    if (existing) {
      return {
        status: 200,
        body: {
          ok: true,
          data: {
            id: existing.id,
            provider: existing.provider,
            displayName: `${existing.remoteOwner}/${existing.remoteName}`,
            remoteUrl: existing.remoteUrl,
            defaultBranch: existing.defaultBranch,
            created: false,
          },
        },
      };
    }
    const row = await repo.repository.create({
      data: {
        organizationId: input.organizationId,
        provider,
        remoteOwner: input.remoteOwner,
        remoteName: input.remoteName,
        remoteUrl,
        defaultBranch: input.defaultBranch?.trim() || "main",
        repoFlavor: input.repoFlavor?.trim() || null,
      },
    });
    return {
      status: 201,
      body: {
        ok: true,
        data: {
          id: row.id,
          provider: row.provider,
          displayName: `${row.remoteOwner}/${row.remoteName}`,
          remoteUrl: row.remoteUrl,
          defaultBranch: row.defaultBranch,
          created: true,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Repository table needs Phase 466 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Helpers — exported for testing.
   ────────────────────────────────────────────────────────────── */

export function defaultRemoteUrl(provider: RegistrableProvider, owner: string, name: string): string {
  if (provider === "github") return `https://github.com/${owner}/${name}`;
  if (provider === "gitlab") return `https://gitlab.com/${owner}/${name}`;
  if (provider === "azuredevops") return `https://dev.azure.com/${owner}/${name}/_git/${name}`;
  return `https://example.invalid/${owner}/${name}`;
}
