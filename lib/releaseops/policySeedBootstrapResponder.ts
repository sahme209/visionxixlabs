/**
 * Phase 484 — policy seed bootstrap.
 *
 * Copies the Phase 443 SEED_POLICIES catalog into the caller's
 * PolicyRule table via the (organizationId, key) compound unique
 * upsert. Idempotent: re-running an already-bootstrapped org refreshes
 * the rule metadata against any catalog updates but doesn't disable
 * operator-edited rules (source=operator rows are skipped on update).
 */

import { isMissingTable } from "./releaseListResponder";
import { SEED_POLICIES, type PolicyRuleSeed } from "./policies/seed";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface SeedExistingRule {
  id: string;
  key: string;
  source: string;
  enabled: boolean;
}

export interface PolicySeedBootstrapRepo {
  policyRule: {
    findMany(args: {
      where: { organizationId: string };
    }): Promise<SeedExistingRule[]>;
    create(args: {
      data: {
        organizationId: string;
        key: string;
        label: string;
        severity: string;
        blocking: boolean;
        exceptionAllowed: boolean;
        approverRole: string | null;
        evidenceRequired: boolean;
        autoRemediationKey: string | null;
        description: string;
        enabled: true;
        source: "seed";
      };
    }): Promise<{ id: string }>;
    update(args: {
      where: { id: string };
      data: {
        label: string;
        severity: string;
        blocking: boolean;
        exceptionAllowed: boolean;
        approverRole: string | null;
        evidenceRequired: boolean;
        autoRemediationKey: string | null;
        description: string;
      };
    }): Promise<{ id: string }>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Input + output.
   ────────────────────────────────────────────────────────────── */

export interface BuildPolicySeedBootstrapInput {
  organizationId: string;
  /** Optional override of the seed list — tests pass a fixture. */
  catalog?: ReadonlyArray<PolicyRuleSeed>;
}

export type PolicySeedBootstrapBody =
  | {
      ok: true;
      data: {
        seeded: number;
        refreshed: number;
        skippedOperatorEdited: number;
        totalCatalog: number;
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: PolicySeedBootstrapBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildPolicySeedBootstrapResponse(
  repo: PolicySeedBootstrapRepo,
  input: BuildPolicySeedBootstrapInput,
  opts: { correlationId?: string } = {},
): Promise<ResponderResult> {
  try {
    const catalog = input.catalog ?? SEED_POLICIES;
    const existing = await repo.policyRule.findMany({ where: { organizationId: input.organizationId } });
    const existingByKey = new Map(existing.map((r) => [r.key, r]));

    let seeded = 0;
    let refreshed = 0;
    let skippedOperatorEdited = 0;

    for (const seed of catalog) {
      const prior = existingByKey.get(seed.key);
      if (!prior) {
        await repo.policyRule.create({
          data: {
            organizationId: input.organizationId,
            key: seed.key,
            label: seed.label,
            severity: seed.severity,
            blocking: seed.blocking,
            exceptionAllowed: seed.exceptionAllowed,
            approverRole: seed.approverRole,
            evidenceRequired: seed.evidenceRequired,
            autoRemediationKey: seed.autoRemediationKey,
            description: seed.description,
            enabled: true,
            source: "seed",
          },
        });
        seeded += 1;
        continue;
      }
      // Don't overwrite operator-edited rules.
      if (prior.source !== "seed") {
        skippedOperatorEdited += 1;
        continue;
      }
      await repo.policyRule.update({
        where: { id: prior.id },
        data: {
          label: seed.label,
          severity: seed.severity,
          blocking: seed.blocking,
          exceptionAllowed: seed.exceptionAllowed,
          approverRole: seed.approverRole,
          evidenceRequired: seed.evidenceRequired,
          autoRemediationKey: seed.autoRemediationKey,
          description: seed.description,
        },
      });
      refreshed += 1;
    }

    return {
      status: 200,
      body: {
        ok: true,
        data: { seeded, refreshed, skippedOperatorEdited, totalCatalog: catalog.length },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Phase 442 migration must include PolicyRule." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
