# Initial scan storage atomicity

A legacy live scan first upserted `CloudAccount`, then created its `AxiomAgentRun` separately. If run storage was absent or refused the write, the helper returned its existing warn-only failure while retaining a newly enabled account or changing an existing account's scan metadata. This became particularly relevant after the narrow enrollment storage recovery; broader legacy scan storage is still incomplete.

The account upsert and run insert now share one transaction. Failure rolls back both initial operations and sends no completion notification. The existing scan-response behavior and subsequent persistence, recommendation, scheduling and notification behavior are preserved. This is **initial account/run atomicity**, not atomic persistence of every later finding or a completed scan-storage migration.

Actual owned PostgreSQL regression reproduced one unexpected account row before the fix. The failure and successful path passed afterward; an additional existing-account rollback case verifies preservation of its fields. Provider transports and notifications are isolated fixtures. No customer scan, cloud request, production row cleanup or implicit schedule change is performed by these tests. Deployment validation is recorded separately.
