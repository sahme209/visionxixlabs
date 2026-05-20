/**
 * Pure access-review report builder.
 *
 * Quarterly access reviews require auditors to certify that every
 * user still needs every role they hold. This module folds raw
 * "user → role → last_used" rows into a per-user review card:
 *   - keep_recommended (used recently),
 *   - revoke_recommended (unused for X days),
 *   - investigate (never used since granted).
 *
 * Pure / deterministic. No DB.
 */

export interface AccessGrant {
  userId: string;
  userLabel: string;
  role: string;
  grantedAt: string;             // ISO
  lastUsedAt: string | null;     // ISO or null
}

export interface ReviewRow {
  userId: string;
  userLabel: string;
  role: string;
  grantedAgeDays: number;
  /** Null when never used. */
  lastUsedAgeDays: number | null;
  recommendation: "keep" | "revoke" | "investigate";
  reason: string;
}

export interface AccessReviewReport {
  rows: ReviewRow[];
  totals: { keep: number; revoke: number; investigate: number };
}

const DAY_MS = 24 * 60 * 60 * 1000;

const ageDaysOf = (iso: string | null, now: Date): number | null => {
  if (iso === null) return null;
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS);
};

export function buildAccessReview(input: {
  grants: readonly AccessGrant[];
  /** Days without use before revoke is recommended. Default 90. */
  unusedRevokeDays?: number;
  /** "Now" in ISO. Default = current time. */
  now?: string;
}): AccessReviewReport {
  const now = input.now ? new Date(input.now) : new Date();
  const threshold = Math.max(1, input.unusedRevokeDays ?? 90);

  const rows: ReviewRow[] = [];
  const totals = { keep: 0, revoke: 0, investigate: 0 };

  for (const g of input.grants) {
    const grantedAgeDays = ageDaysOf(g.grantedAt, now) ?? 0;
    const lastUsedAgeDays = ageDaysOf(g.lastUsedAt, now);

    let recommendation: ReviewRow["recommendation"];
    let reason: string;
    if (lastUsedAgeDays === null) {
      if (grantedAgeDays >= threshold) {
        recommendation = "investigate";
        reason = `never used since granted ${grantedAgeDays}d ago`;
      } else {
        recommendation = "keep";
        reason = `granted ${grantedAgeDays}d ago; new — give it time to be used`;
      }
    } else if (lastUsedAgeDays >= threshold) {
      recommendation = "revoke";
      reason = `last used ${lastUsedAgeDays}d ago (>= ${threshold}d threshold)`;
    } else {
      recommendation = "keep";
      reason = `used ${lastUsedAgeDays}d ago`;
    }

    rows.push({
      userId: g.userId,
      userLabel: g.userLabel,
      role: g.role,
      grantedAgeDays,
      lastUsedAgeDays,
      recommendation,
      reason,
    });
    totals[recommendation] += 1;
  }

  rows.sort((a, b) => {
    const rank: Record<ReviewRow["recommendation"], number> = { revoke: 0, investigate: 1, keep: 2 };
    if (rank[a.recommendation] !== rank[b.recommendation]) {
      return rank[a.recommendation] - rank[b.recommendation];
    }
    return a.userLabel < b.userLabel ? -1 : 1;
  });

  return { rows, totals };
}
