# Slack exact-message outbound composition — local only

The existing Slack request → independent approval → prepared session-bound operation → executor → fixed chat.postMessage path now composes the durable outbound slot and once-only submission-intent protocol. The canonical issuer always refuses before execute-only channel/credential preflight or claim. No identity, coverage enrollment or activation is supplied.

Slack's original semantics differ from Teams: an approved intent may be prepared in a new authenticated executor session, but the prepared operation remains bound to that exact session. The original requester's session must also stay valid. The claimed reader retains that rule, the original independent approval and reviewer session, current connection, exact public member channel, task revision, one-attempt session-ID lease, original source snapshot and deadlines. Original requester scope is read from the same durable approval binding; that read is not an authority grant. Final enrollment absence is checked under the organization lock.

The transport reserves before postclaim credential access, commits intent, then consumes retained current-authority and private intent freshness synchronously before its sole fixed plaintext POST. The shorter transport signal is checked after connection access before decryption. Original payload flags, channel/receipt validation, independent decisions and one-attempt history remain intact. Lost acknowledgements retain blocking state; no resend, reset, descendant or quiescence inference is added.

Existing preparation, channel discovery and execute preflight can resolve a persisted write-capable OAuth bearer. This is not a new token mint, and prior bearer lifetime is not qualified by this adoption. No provider-side delivery or atomic concurrency guarantee is added.

## Verification

- Six focused files: 69 tests pass, including new private current/intent physical-edge checks and prior Slack store/transport/HTTP tests. Positive issuer/current authority/provider ports are explicitly simulated.
- Actual-source scoped TypeScript: pass. No broad build.
- Root-owned actual isolated PostgreSQL: initial 12 pass and 1 new test-expectation failure; corrected targeted run 1 pass, 12 filtered. Thirteen distinct cases pass across runs, not a single 13-case green run. Both fixtures stopped; provider, request authorization and positive issuer are simulated. Original-requester reauthentication/revocation regressions and canonical refusal, lost mutation acknowledgement, lost reservation acknowledgement, enrollment after claim and linked-task revision after claim are included.
- The failing expectation was corrected without product changes: task revision also invalidates existing completion authority, so the consumed operation correctly remains dispatching/attempt1 rather than being rewritten as unknown. No slot, postclaim decrypt or POST occurs; history is preserved for existing authorized recovery. Initial failure retained in actual-pg-initial.log.
- Independent frozen source review: pass, no important findings.

No provider traffic, production deployment, settings, schema migration, new credentials, grants, spending or native probe execution occurred.
