# ServiceNow proof response envelope correction

Actual provider transaction 3f8f3e78939c1710005fb6597bba1035 records the exact OAuth journal-proof GET as HTTP200,596ms, at 2026-10-30 10:31:31 provider display time (17:31:31UTC). The installed resource manually constructs {result:proof}; ServiceNow setBody adds its own result envelope, leaving the strict Axiom reader with {result:{result:proof}}. The old resource fixture incorrectly modeled setBody as the final wire body.

Correction: remove only the manually constructed result key from the existing resource success response. ServiceNow supplies the single wire envelope. Keep the strict Axiom reader, fields, query bounds, internal switch, OAuth-only policy, scope and admin ACL unchanged. No Vercel rollout, credential, grant, new ticket or resend is included.

Verification: actual source VM plus modeled provider envelope first failed2 tests, then25 proof/transport checks passed after the one-line fix. Independent review found no important issues. This reproduces the deterministic response contract mismatch; actual corrected readback remains to be accepted.

Sources: https://learn.microsoft.com/fr-ca/MicrosoftSearch/servicenow-knowledge-admin-setup (documented result envelope); https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_ScriptableServiceResponseBuilder.html (setBody serialization).

The original refused note remains consumed/version8/attempt1; no retry, alternate note or state transition is authorized by this code correction. Any subsequent exact note submission requires fresh explicit authorization, native approval and absence proof. ServiceNow's New-state lifecycle cannot be bypassed for closure.
