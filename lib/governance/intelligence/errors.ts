import 'server-only';
/** Recognized policy/source invalidation, never a permission or configuration
 * failure. Historical views may show stale; execution must still refuse. */
export class GovernanceBaselineStale extends Error {
 constructor(readonly reason:'baseline_changed'|'baseline_revoked'|'active_pointer_missing'|'source_receipt_unavailable') {super('governance_'+reason);this.name='GovernanceBaselineStale'}
}
