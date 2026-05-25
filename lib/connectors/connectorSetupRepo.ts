/**
 * Phase 414 — ConnectorSetupSession persistence layer.
 *
 * Wraps the pure-function kernel from `connectorSetupSession.ts` with
 * Prisma reads/writes. Every transition attempt — legal or illegal — is
 * appended to ConnectorSetupTransition so the dashboard sidebar dot, the
 * cron health-check loop, and the audit log all read the same truth.
 *
 * Why dependency-injected client (not `import { prisma }`): tests in this
 * repo's `__tests__` dir cannot construct a real PrismaClient (iCloud +
 * broken `jws` / `gaxios` transitive deps make node_modules a minefield).
 * Taking the client as an arg with a narrow structural type lets the
 * vitest matrix pass an in-memory stub and exercise the full
 * kernel-plus-persistence path.
 */

import {
  ALL_STATUSES,
  transitionConnectorSetup,
  type ConnectorSetupEvent,
  type ConnectorSetupStatus,
} from "./connectorSetupSession";

/* ──────────────────────────────────────────────────────────────────
   Structural Prisma client contract.

   Mirrors the subset of the generated PrismaClient that this module
   touches. Keeps tests independent of the real client and lets us
   evolve the schema without touching test stubs.
   ────────────────────────────────────────────────────────────── */

export interface ConnectorSetupSessionRow {
  id: string;
  organizationId: string;
  provider: string; // CloudProvider enum at the Prisma level
  status: ConnectorSetupStatus;
  lastEventKind: string | null;
  lastErrorCode: string | null;
  firstConnectedAt: Date | null;
  lastTransitionAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectorSetupTransitionRow {
  id: string;
  sessionId: string;
  fromStatus: ConnectorSetupStatus;
  toStatus: ConnectorSetupStatus;
  eventKind: string;
  isLegal: boolean;
  rejectionReason: string | null;
  eventPayload: Record<string, unknown> | null;
  actorUserId: string | null;
  actorLabel: string | null;
  createdAt: Date;
}

interface SessionDelegate {
  findUnique(args: { where: { organizationId_provider: { organizationId: string; provider: string } } }): Promise<ConnectorSetupSessionRow | null>;
  create(args: { data: { organizationId: string; provider: string } }): Promise<ConnectorSetupSessionRow>;
  update(args: {
    where: { id: string };
    data: Partial<Pick<ConnectorSetupSessionRow, "status" | "lastEventKind" | "lastErrorCode" | "firstConnectedAt" | "lastTransitionAt">>;
  }): Promise<ConnectorSetupSessionRow>;
}

interface TransitionDelegate {
  create(args: { data: Omit<ConnectorSetupTransitionRow, "id" | "createdAt"> }): Promise<ConnectorSetupTransitionRow>;
  findMany(args: { where: { sessionId: string }; orderBy: { createdAt: "desc" }; take: number }): Promise<ConnectorSetupTransitionRow[]>;
}

export interface ConnectorSetupRepo {
  connectorSetupSession: SessionDelegate;
  connectorSetupTransition: TransitionDelegate;
  $transaction<T>(fn: (tx: ConnectorSetupRepo) => Promise<T>): Promise<T>;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export interface ApplyEventInput {
  organizationId: string;
  provider: string;
  event: ConnectorSetupEvent;
  actor: { userId: string } | { systemLabel: string };
  /** Override the wallclock used for lastTransitionAt + firstConnectedAt. Tests only. */
  now?: Date;
}

export type ApplyEventResult =
  | {
      ok: true;
      session: ConnectorSetupSessionRow;
      transition: ConnectorSetupTransitionRow;
      previousStatus: ConnectorSetupStatus;
      nextStatus: ConnectorSetupStatus;
    }
  | {
      ok: false;
      reason: "illegal_transition";
      session: ConnectorSetupSessionRow;
      transition: ConnectorSetupTransitionRow;
      from: ConnectorSetupStatus;
      eventKind: string;
    };

export async function applyConnectorSetupEvent(
  repo: ConnectorSetupRepo,
  input: ApplyEventInput,
): Promise<ApplyEventResult> {
  return repo.$transaction(async (tx) => {
    const existing = await tx.connectorSetupSession.findUnique({
      where: { organizationId_provider: { organizationId: input.organizationId, provider: input.provider } },
    });
    const session = existing ?? await tx.connectorSetupSession.create({
      data: { organizationId: input.organizationId, provider: input.provider },
    });

    const result = transitionConnectorSetup(session.status, input.event);

    const eventPayload = extractEventPayload(input.event);
    const actorUserId = "userId" in input.actor ? input.actor.userId : null;
    const actorLabel = "systemLabel" in input.actor ? input.actor.systemLabel : null;

    if (!result.ok) {
      const transition = await tx.connectorSetupTransition.create({
        data: {
          sessionId: session.id,
          fromStatus: session.status,
          toStatus: session.status,
          eventKind: input.event.kind,
          isLegal: false,
          rejectionReason: result.reason,
          eventPayload,
          actorUserId,
          actorLabel,
        },
      });
      return {
        ok: false as const,
        reason: "illegal_transition" as const,
        session,
        transition,
        from: session.status,
        eventKind: input.event.kind,
      };
    }

    const now = input.now ?? new Date();
    const reachedConnected = result.next === "connected" && session.firstConnectedAt === null;

    const updated = await tx.connectorSetupSession.update({
      where: { id: session.id },
      data: {
        status: result.next,
        lastEventKind: input.event.kind,
        lastErrorCode: input.event.kind === "validation_failed" ? input.event.errorCode : null,
        lastTransitionAt: now,
        ...(reachedConnected ? { firstConnectedAt: now } : {}),
      },
    });

    const transition = await tx.connectorSetupTransition.create({
      data: {
        sessionId: session.id,
        fromStatus: session.status,
        toStatus: result.next,
        eventKind: input.event.kind,
        isLegal: true,
        rejectionReason: null,
        eventPayload,
        actorUserId,
        actorLabel,
      },
    });

    return {
      ok: true as const,
      session: updated,
      transition,
      previousStatus: session.status,
      nextStatus: result.next,
    };
  });
}

export async function readConnectorSetupSession(
  repo: ConnectorSetupRepo,
  args: { organizationId: string; provider: string },
): Promise<ConnectorSetupSessionRow | null> {
  return repo.connectorSetupSession.findUnique({
    where: { organizationId_provider: { organizationId: args.organizationId, provider: args.provider } },
  });
}

export async function listRecentTransitions(
  repo: ConnectorSetupRepo,
  args: { sessionId: string; take?: number },
): Promise<ConnectorSetupTransitionRow[]> {
  return repo.connectorSetupTransition.findMany({
    where: { sessionId: args.sessionId },
    orderBy: { createdAt: "desc" },
    take: args.take ?? 25,
  });
}

/* ──────────────────────────────────────────────────────────────────
   Internals.
   ────────────────────────────────────────────────────────────── */

function extractEventPayload(event: ConnectorSetupEvent): Record<string, unknown> | null {
  switch (event.kind) {
    case "validation_failed":
      return { errorCode: event.errorCode };
    default:
      return null;
  }
}

/**
 * Type guard — useful when callers receive an unknown status string from an
 * older row that the kernel no longer recognizes.
 */
export function isKnownStatus(s: string): s is ConnectorSetupStatus {
  return (ALL_STATUSES as readonly string[]).includes(s);
}
