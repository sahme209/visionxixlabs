# Root-protected monotonic consumption candidate — review before implementation

## Exact boundary

Replace only the System-profile startup-consumption primitive, not the old historical per-user profile. Retain the dedicated non-root custodian and actual authenticated-controller→owned-suspended-child flow. The broker source authenticates each start message in run_job before prepare_start; prepare_start consumes startup before package binding/spawn. Keep that ordering and late/cancelled/unknown refusal. A caller-written token, claimed PID, JSON status or record content never establishes authority.

## Candidate invariant

A root-owned, fixed, precreated regular record inside root-owned nonwritable ancestry may transition only from empty to nonempty. Any nonzero size, malformed metadata, changed inode, unknown durability or prior attempt refuses. Contents are not interpreted as permission. Trusted installation alone creates a fresh generation; no reset/cleanup/reuse endpoint. SF_APPEND plus exact dedicated-principal read/append ACL is a candidate, NOT qualified platform enforcement.

Installation must initialize protections while the parent is root-private and inaccessible to the non-root principal, then expose only the completed protected generation. No pre-protection writable descriptor/mapping may escape. Do not rename an already flagged file by assumption. Root maintenance remains trusted and serialized; same-UID attackers may force refusal by appending (availability is not guaranteed).

## Proposed primitive contract

A fixed-path consumer would open no-follow append-only, verify root owner, regular/single-link identity, exact generation/device/inode, reviewed append flag/ACL and protected ancestors, then take a nonblocking exclusive lock, revalidate empty state, append one fixed nonsecret byte, fsync and revalidate monotonic state before success. Any partial/uncertain effect permanently denies that attempt. Advisory locking serializes cooperative brokers only; non-cooperative writers cannot be trusted or authorized by their bytes. Lock contention must refuse, not wait indefinitely. This does not claim preemptible kernel-call guarantees; existing job cancellation/late suspended-child cleanup remains required.

## Qualification matrix required before broker integration

1. Positive: exactly one genuine consumer succeeds; competing genuine consumers refuse after first durable append.
2. Same-UID adversary: unlink/rename/replacement, truncate, overwrite/pwrite, writable shared mapping, flag clearing, ACL editing, owner/mode manipulation and hard-link/alias operations cannot restore empty or substitute an accepted record.
3. Pre-protection handles/mappings cannot exist outside trusted installation. Crash/partial append/fsync failure/close uncertainty never causes retry or successful next startup.
4. Actual supported filesystem/mount/ACL semantics must be demonstrated with disposable synthetic fixtures and separately approved privileged setup. Header declarations, pure tests and flag inspection alone cannot pass.
5. Actual authenticated start, claim, owned spawn, process identity and resource handoff must compose with the same installed generation. Correct primitive behavior alone is insufficient.

Unsupported semantics rejects this candidate; no fallback to current-user0700, unprotected state, advisory-lock-only authority or silently privileged live service. The alternative trusted launch owner remains a separate authority change.

## Requested scope, not yet approved

Local pure state-machine/adapter preparation and tests for this candidate only, keeping System integration/activation disabled. No flags/ACL/ownership changes, privileged file creation, process/service launch, actual OS restriction experiment, credentials, provider actions, installation or deployment. Actual platform qualification and integrated broker change require separate frozen review and authority. All original no-replay/custody/execution/coverage requirements remain; no whole-Governance completion follows.

## Independent review disposition — not implementation-ready

Review confirmed current authentication→consumption→root-binding→suspended-spawn source ordering and identified an unresolved durability case. Exact successful postcondition must require the same device/inode, fixed one-byte content and size1 with unchanged protection metadata; any competing extra append refuses, not merely any nonempty result. fsync or close uncertainty remains denial.

Process failure and power loss are distinct. Before durable consumption there must be no child spawn or resource release; after an unknown write/power-loss outcome, a record that reappears empty cannot by itself prove no previous attempt. The original unknown-history/no-replay requirement remains binding. This candidate currently cannot establish that invariant; pure tests or an observed fsync cannot make it true. Do not implement a positive branch or request installation as though resolved. The next architectural decision must supply an accepted durable authority/failure model without weakening history, or reject this candidate in favor of a separately reviewed trusted launch owner. No new live privileged service is selected here.
