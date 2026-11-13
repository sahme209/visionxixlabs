/** Legacy force-scheduling is intentionally unavailable.
 * Use a separately reviewed growth.schedule.change platform action.
 * No database client or credential is initialized by this retired entry point.
 * The managed workflow remains incomplete until its UI/HTTP is mounted.
 */
throw new Error("platform_governance_review_required: direct force scheduling is disabled");
export {};
