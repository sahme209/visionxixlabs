# Persistent startup consumption — same-UID gap retained

Source design only. Existing installation-design analysis is authorized; no new runtime/privileged-writer mechanism, implementation or OS experiment is authorized by this document.

## Rejected shortcut

Moving the existing exclusive-create claim to another dedicated-user0700 directory does not protect it from another process sharing that UID. Such a process can delete/replace it. The original threat model includes untrusted same-UID Node/other processes, so directory ownership plus a promise never to delete is insufficient. This is a source/design gap, not an activated bypass: the current canonical supplier remains closed.

## Candidate directions, not selected mechanisms

**A — Root-protected append-only consumption record.** The installed SDK's chflags manual describes SF_APPEND as append-only and superuser-controlled. The open manual separately describes append and exclusive-lock behavior. A potential design would keep the directory/file root-owned, grant the dedicated principal only explicitly reviewed read/append rights, and have the trusted installer establish the system append-only flag before any untrusted access. Any nonempty/malformed/changed record would refuse startup, never be cleared or reused; no code would interpret attacker-appended data as an authorization grant.

These declarations do not prove supported filesystem/ACL/descriptor interactions or atomic durable first-claim behavior. Actual refusal of truncation, offset writes, flag clearing, rename/unlink/replacement/link aliases and partial/competing appends must be specified and qualified. Advisory locks do not constrain a malicious writer. A hostile writer might force safe refusal; no denial-of-service immunity is claimed. Root remains trusted. No SF/UF flags, ACLs or files were changed or tested. The current O_CREAT/O_EXCL claim implementation cannot simply be repointed to such a precreated record.

**B — Trusted administrative launch owner.** An alternative is for the trusted administrative launcher to consume a root-only durable record before one actual owned non-root launch and authenticate that precise running instance. It must not accept a caller's record/UID/PID as authority. Expanding the installer into a privileged live launch guardian, and selecting any authenticated handoff, would be a new authority boundary requiring its own design review. No root daemon, generic write service, authentication token scheme or new signing key is chosen here.

Neither option may produce a positive gate from metadata or mocks. Select or reject a supported complete mechanism before implementation/installation qualification; preserve the original no-replay, exact-instance, unknown-history and same-UID requirements. The architecture remains the existing dedicated non-root custodian and controlled private consumer unless a separately approved change is necessary. This disposition grants no privilege or execution authority.

## Next independent input

The separate single pinned-Node metadata read remains necessary to resolve the Node/addon role profile and broker requirement dependency. It does not settle persistent claim enforcement. No additional external source, signature/API call, Node invocation or privileged action was used for this analysis. Local source provenance: claim-local-reference-bindings.json.
