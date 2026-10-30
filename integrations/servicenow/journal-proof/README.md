# Axiom narrow journal-proof package (local only)

The reviewed source is resource.js. No resource, scope, role, ACL, property or Axiom setting has been installed/enabled by this package. It is not live ServiceNow acceptance.

Intended service: /api/<verified-instance-namespace>/v1/axiom_evidence, resource GET /change/{sys_id}/journal-proof. Require authentication, a REST_Endpoint ACL for a separately reviewed least-privilege reader, OAuth-only API access policy, and REST API Auth Scope axiom.change_evidence_read bound only to this resource. Verify all settings on the actual release before activation. Do not enable general Table API, give admin to a service account or reuse a broad useraccount grant.

The script is default-off behind x_axiom_evidence.journal_proof_enabled. It reads only ACL-visible change_request/work_notes and exact attached sys_journal_field records using GlideRecordSecure. It performs no inserts/updates/deletes. Maximum 50 scanned entries; missing, inaccessible, duplicated or truncated evidence refuses. It returns no note, author, token or personal data. It returns only presence/absence, exact journal entry identity/creation time when present, digest and provider observation time. The expected note_digest is SHA256 of the UTF-8 JSON string serialization of the exact canonical Axiom evidence note, matching sha256ContentHash(string) in Axiom. Raw-text hashing is different and must not be substituted.

Before a specific installation approval, review the resource source hash, exact namespace/ACL/auth-scope/access-policy records and the existing integration identity. An independent source reviewer and actual permission tests must verify unauthenticated requests, wrong-scope OAuth, cross-record/field attempts, duplicates/limits and exact note matching. Access checks mocked locally are not proof of real scoped-table/API access. The enablement property and Axiom's journalRead remain false until that evidence exists. An installation/grant does not authorize sending or resending a work note.

The local Axiom client uses only the fixed proof route, a current server-bound credential and a read-only GET, with bounds, cancellation, no redirects, no browser credentials and strict response identity/digest verification. It refuses before fetch without separately verified journalRead permission. There is no Table API fallback or inference from blank work_notes.

Sources checked October29,2026:
- https://www.servicenow.com/docs/r/api-reference/server-api-reference/c_GlideDigestScopedAPI.html
- https://developer.servicenow.com/blog.do?p=%2Fpost%2Fgliderecord-vs-gliderecordsecure%2F
- https://www.servicenow.com/docs/r/platform-security/authentication/rest-api-auth-scope.html

This endpoint does not progress the native change lifecycle, approve CAB, declare a terminal state, or close a ticket. Those require the separate current policy, native transition validation and genuine human authorizations.

Append confirmation additionally requires a deterministic one-attempt Axiom action marker, confirmed absence before mutation, and a newly created exact entry after that provider-clock baseline. The per-dispatch verifier consumes the baseline once within 15 seconds; standalone presence is not an append receipt. Associated transport refuses before PATCH if absence verification is missing or not true. No pre-existing identical note may be attributed to a new action.

The unsubmitted dev316885 definition form reports Global application/API namespace 2278454. Intended API ID: axiom_evidence. The adapter requires the installed capability's explicit trusted server-side apiNamespace; it never guesses a namespace or accepts a client URL. Resource/version/ACL/auth-scope configuration still needs actual review and acceptance before grant or enablement.
