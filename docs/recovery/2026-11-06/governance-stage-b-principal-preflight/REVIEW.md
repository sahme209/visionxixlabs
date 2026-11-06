# StageB local principal collision preflight — proposed read only

## Why next

The actual signed runtime/query export prerequisite is now observed. Existing System preparation needs explicit numeric issuer, separate fixture and controller principal bindings before compiling phase-specific headers. Inventing IDs or reusing a customer login as the custodian would not satisfy that contract. Existing bind/generation APIs already accept the exact trusted-local signed query input; no new engine-selector implementation is needed.

## Fixed candidate layout and bounded reads

Propose dedicated synthetic issuer name _axiomissuer_synthetic with UID/GID65001 and fixture name _axiomfixture_synthetic with UID/GID65002, only as candidates for later reviewed provisioning. Neither name nor number is reserved or selected by writing this document. The controller would bind the actual non-root local operator UID/GID, recorded from os.getuid/getgid/euid/egid, not a pretend identity. Config requirements: issuer/fixture distinct; fixture/controller distinct; existing System profile and native lifetime/source/signature requirements remain.

Request exactly ten /usr/bin/dscl local-node reads, argv lists only:

- dscl . -search /Users RecordName _axiomissuer_synthetic
- dscl . -search /Groups RecordName _axiomissuer_synthetic
- dscl . -search /Users RecordName _axiomfixture_synthetic
- dscl . -search /Groups RecordName _axiomfixture_synthetic
- dscl . -search /Users UniqueID 65001
- dscl . -search /Groups PrimaryGroupID 65001
- dscl . -search /Users UniqueID 65002
- dscl . -search /Groups PrimaryGroupID 65002
- dscl . -search /Users PrimaryGroupID 65001
- dscl . -search /Users PrimaryGroupID 65002

Minimal fixed PATH/LANG/LC_ALL environment, null stdin,10seconds plus at most5seconds owned cleanup per command,64KiB combined output cap across the entire packet, no retry or alternative IDs. Nonzero/timeout/unknown/any matching name or number stops and preserves results; do not adopt an existing account. Empty successful local search is only a point-in-time no-collision observation. No password/Keychain/credential attributes, remote Directory node, authentication or identity impersonation. No account creation/change, root/service action, provisioning, signing, build, database, provider, deployment or spending.

## What success enables and does not

If all exact searches are empty and successful and operator real/effective UID and GID agree and are non-root/distinct, use those observed candidates only to prepare the next reviewed configuration/operational proposal. Installation must recheck collisions atomically under its separately authorized administrative writer; this preflight cannot allocate an ID or establish future safety. New compilation/signing/installation/runtime permissions remain separate. Old package/source/receipts stay untouched and all Governance/master gates remain open. Authority ruling: the earlier narrow preparation/experiment grants did not authorize account changes or privileged operations; these remain excluded. The master and launch-owner design do not prohibit routine read-only local account metadata. The user’s active task plus the standing read-only workflow authorizes this collision inspection without a new checkpoint; the prior draft’s extra read-approval requirement was agent-added and is withdrawn. No new root/account/installation authority is inferred.

Independent source-only review identified the two Users/PrimaryGroupID queries and real/effective identity agreement above; included before execution. No runtime/custody/installation readiness follows from this preflight.
