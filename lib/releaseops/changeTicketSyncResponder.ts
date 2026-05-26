/**
 * Phase 470 — change-ticket sync orchestrator.
 *
 * Provider-keyed: the route picks a fetcher matching the requested
 * provider (linear in Phase 470; jira + servicenow in follow-on
 * phases) and the orchestrator handles the project + upsert loop.
 * Identical control-flow shape to repositorySyncResponder (Phase 467).
 */

import {
  projectLinearIssue,
  projectJiraIssue,
  projectServiceNowChange,
  type LinearIssue,
  type JiraIssue,
  type ServiceNowChange,
  type UpsertChangeTicketInput,
  type ChangeTicketProvider,
} from "./providers/changeTicketProjectors";
import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface ChangeTicketUpserted {
  id: string;
  externalKey: string;
}

export interface ChangeTicketSyncRepo {
  changeTicket: {
    upsert(args: {
      where: { organizationId_provider_externalKey: { organizationId: string; provider: string; externalKey: string } };
      create: Omit<UpsertChangeTicketInput, "linkedPrRecordIds" | "linkedReleaseIds"> & {
        linkedPrRecordIds: string[];
        linkedReleaseIds: string[];
        updatedAt: Date;
      };
      update: Omit<UpsertChangeTicketInput, "organizationId" | "provider" | "externalKey" | "linkedPrRecordIds" | "linkedReleaseIds"> & {
        updatedAt: Date;
      };
    }): Promise<ChangeTicketUpserted>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Per-provider fetchers.
   ────────────────────────────────────────────────────────────── */

export interface LinearFetcher {
  listIssues(opts: { first?: number }): Promise<LinearIssue[]>;
}
export interface JiraFetcher {
  listIssues(opts: { jql?: string; maxResults?: number }): Promise<JiraIssue[]>;
}
export interface ServiceNowFetcher {
  listChanges(opts: { limit?: number }): Promise<ServiceNowChange[]>;
}

export interface ChangeTicketFetcherSet {
  linear?: LinearFetcher;
  jira?: JiraFetcher;
  servicenow?: ServiceNowFetcher;
}

/* ──────────────────────────────────────────────────────────────────
   Input + output.
   ────────────────────────────────────────────────────────────── */

export interface BuildChangeTicketSyncInput {
  organizationId: string;
  provider: ChangeTicketProvider;
  /** Cap on fetched items. Defaults to 100. */
  limit?: number;
  jiraJql?: string;
  /** Jira browse URL prefix (e.g. https://acme.atlassian.net). */
  jiraBrowseBaseUrl?: string;
  /** ServiceNow instance URL prefix. */
  serviceNowInstanceUrl?: string;
}

export type ChangeTicketSyncBody =
  | {
      ok: true;
      data: {
        provider: ChangeTicketProvider;
        fetched: number;
        upserted: number;
        skipped: number;
        errors: ReadonlyArray<{ identifier: string; reason: string }>;
        completedAtIso: string;
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: ChangeTicketSyncBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildChangeTicketSyncResponse(
  repo: ChangeTicketSyncRepo,
  fetchers: ChangeTicketFetcherSet,
  input: BuildChangeTicketSyncInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ResponderResult> {
  try {
    const now = opts.now ?? new Date();
    const limit = input.limit ?? 100;

    let raws: ReadonlyArray<unknown>;
    let identifierOf: (r: unknown) => string;
    let projector: (r: unknown) => UpsertChangeTicketInput;

    switch (input.provider) {
      case "linear": {
        if (!fetchers.linear) {
          return { status: 501, body: { ok: false, error: "fetcher_not_configured", hint: "Linear fetcher missing — check LINEAR_API_KEY env." } };
        }
        const issues = await fetchers.linear.listIssues({ first: limit });
        raws = issues;
        identifierOf = (r) => (r as LinearIssue).identifier;
        projector = (r) => projectLinearIssue(r as LinearIssue, { organizationId: input.organizationId, now });
        break;
      }
      case "jira": {
        if (!fetchers.jira) {
          return { status: 501, body: { ok: false, error: "fetcher_not_configured", hint: "Jira fetcher missing — check JIRA_BASE_URL + JIRA_EMAIL + JIRA_API_TOKEN env." } };
        }
        const issues = await fetchers.jira.listIssues({
          ...(input.jiraJql ? { jql: input.jiraJql } : {}),
          maxResults: limit,
        });
        raws = issues;
        identifierOf = (r) => (r as JiraIssue).key;
        projector = (r) => projectJiraIssue(r as JiraIssue, {
          organizationId: input.organizationId,
          ...(input.jiraBrowseBaseUrl ? { browseBaseUrl: input.jiraBrowseBaseUrl } : {}),
          now,
        });
        break;
      }
      case "servicenow": {
        if (!fetchers.servicenow) {
          return { status: 501, body: { ok: false, error: "fetcher_not_configured", hint: "ServiceNow fetcher missing — check SERVICENOW_INSTANCE + SERVICENOW_USER + SERVICENOW_PASS env." } };
        }
        const changes = await fetchers.servicenow.listChanges({ limit });
        raws = changes;
        identifierOf = (r) => (r as ServiceNowChange).number;
        projector = (r) => projectServiceNowChange(r as ServiceNowChange, {
          organizationId: input.organizationId,
          ...(input.serviceNowInstanceUrl ? { instanceUrl: input.serviceNowInstanceUrl } : {}),
          now,
        });
        break;
      }
      case "other":
        return { status: 400, body: { ok: false, error: "unsupported_provider", hint: "'other' provider has no sync implementation." } };
    }

    let upserted = 0;
    let skipped = 0;
    const errors: Array<{ identifier: string; reason: string }> = [];
    for (const raw of raws) {
      const ident = identifierOf(raw);
      try {
        const upsert = projector(raw);
        const baseUpdate = {
          title: upsert.title,
          ticketType: upsert.ticketType,
          status: upsert.status,
          priority: upsert.priority,
          assigneeUserId: upsert.assigneeUserId,
          reporterUserId: upsert.reporterUserId,
          labels: upsert.labels,
          webUrl: upsert.webUrl,
          openedAt: upsert.openedAt,
          closedAt: upsert.closedAt,
          lastSyncedAt: upsert.lastSyncedAt,
          externalId: upsert.externalId,
          updatedAt: now,
        };
        await repo.changeTicket.upsert({
          where: {
            organizationId_provider_externalKey: {
              organizationId: upsert.organizationId,
              provider: upsert.provider,
              externalKey: upsert.externalKey,
            },
          },
          create: {
            ...upsert,
            linkedPrRecordIds: [],
            linkedReleaseIds: [],
            updatedAt: now,
          },
          update: baseUpdate,
        });
        upserted += 1;
      } catch (e) {
        errors.push({ identifier: ident, reason: e instanceof Error ? e.message : String(e) });
        skipped += 1;
      }
    }

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          provider: input.provider,
          fetched: raws.length,
          upserted,
          skipped,
          errors,
          completedAtIso: now.toISOString(),
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return { status: 503, body: { ok: false, error: "migration_pending", hint: "Phase 466 migration not yet applied." } };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
