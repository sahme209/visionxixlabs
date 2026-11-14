# Independent whole-unit source review — joined host evaluation

Verdict: **WITH FIXES — three important findings; no critical finding identified.** This is a source review of the new evaluation unit, not native acceptance or permission to run it.

## Reviewed scope and evidence

Reviewed the twelve new files in `WHOLE-UNIT-REVIEW.diff`, the source manifest, implementation report, saved test ledger and review focus against `HOST-ARTIFACT-BOOTSTRAP-CONTRACT.md` and `HOST-JOINED-LOCAL-IMPLEMENTATION-REVIEW.md`. Reviewed transitive publisher, raw parent, worker interfaces, runtime restriction and relevant pinned vendor archive members as text. Read repository working rules and the supplied code-reviewer instructions. No product source, index, branch or historical receipt was modified; this report is the requested output.

All twelve current input hashes match `SOURCE-MANIFEST.json`; reconstructing the twelve added-file sections from the frozen diff gives the current twelve files exactly. Frozen diff SHA256: `ea449076cafe41cc85bc38c30ed8a25f8a6dd2b1c2f95789933ac31347cfa827`. The reviewed baseline is the supplied `876da65f` checkpoint. The saved ledger records six source checks and fourteen pure/mocked/source bootstrap checks passing; they were inspected, **not rerun**.

## Strengths and specification compliance

- The separate nondefault constructor, executable feature and runner select the actual existing Amazon ordinary NTP source. The fixed runner retains IPv4 and bypasses the stock stack-switch logic. The inspected evaluation path installs no PHC, public pool, additive configured source or resolver. Stock and previous private constructor bodies remain separate in the patch.
- The real existing clock-state, selected measurement-origin, publisher and delegated compatibility writers are composed. Fixed new compatibility paths replace global compatibility coordinates only for the new constructor. The existing strict policy remains absent, initial Unknown and preadjustment invalidation remain on the inherited path, and VMClock support is explicitly false.
- The reader opens the real generation and actual worker ELF, calls the actual private parent, acquires one original hold, observes both worker channels, requires cleanup, obtains fresh final P2 and releases the original hold. It creates no synthetic publication and supplies no accepted time policy, credential or custodian qualifier.
- The bootstrap restricts installed paths, ownership, privilege bits, access ACLs, package count/aggregate bytes, captured output and process deadlines. Its happy path checks the same producer before and after the reader, and retains uncertainty instead of retrying. Reader identity and restriction remain separate from the privileged clock writer.
- Package and result labels correctly keep target ABI, actual build, installation, real permissions, host behavior and external host termination unverified. These are future acceptance gates, not implied results of the twenty saved checks.

## Critical findings

None identified within this local source review.

## Important findings

### 1. The declared daemon build recipe cannot resolve the actual C publisher

Evidence: `packages/verified-issuer-runtime/linux/host-evaluation-package.json:13–32` lists only the layered patch and two Rust sources and declares an ordinary `cargo build ... --bin axiom-host-evaluation` recipe. The actual publication path calls external `axiom_time_publish_or_die` at `packages/verified-issuer-runtime/linux/time_publication_adapter.rs:10,75`. The pinned `clock-bound/Cargo.toml` and archive contain no crate `build.rs` or corresponding C linkage configuration. The new layered patch adds none. The historical compiler instead resolves this reference explicitly with `time_publication.o` in `scripts/governance_linux_compile.py:126–129,274–276`.

Consequently the declared runnable producer recipe omits a necessary compiled input and final link. Once compilation reaches linkage it has an unresolved publisher reference; the earlier static-library/link-only checkpoint does not make this new binary buildable. This is a source-integration defect, rather than uncertainty about whether AL2023 happens to accept the output.

Fix the evaluation-only build/package definition to enumerate `time_publication.c` and its header, compile it for the exact eventual target and explicitly link that object into this executable with the required system libraries. Keep stock/default build semantics and historical compiler packets unchanged. A source-level recipe assertion is useful now; actual compilation still requires its separate authorization.

### 2. Controller SIGTERM bypasses owned process cleanup

Evidence: `scripts/governance_host_evaluation_bootstrap.py:46–76` relies on Python exception unwinding to reach `stop_owned` and `close_local`; `main` at `271–281` installs no termination handler. Producer and reader are launched in new sessions at `191–193` and `227–230`. The producer's own termination listener and ninety-second deadline at `packages/verified-issuer-runtime/linux/host_evaluation.rs:43–59` run only in that separate process.

An ordinary SIGTERM of the controller during source waiting or raw observation terminates Python by its default signal disposition, without executing its `finally` block. Because the child has a separate session, that signal does not stop it. The privileged clock writer can continue steering after its owner has been canceled, up to its independent deadline; the reader/worker can also outlive the controller. The controller produces no known cleanup receipt. A child selfdeadline limits duration but does not implement the required owned cancellation and shutdown path.

Install bounded controller cancellation handling before ownership can be acquired, using a deferred cancellation flag and bounded loop checks so an asynchronous exception cannot interrupt the child-start/handle handoff and discard the newly owned child. Cancellation must unwind through the same exact producer and reader cleanup, never restart or claim success from sending a signal. Cover preownership, postownership and reader-active cancellation with mocked operations now; no native signal experiment is requested here. SIGKILL/power loss remain unknown and require external owned-host cleanup; no impossible process-local cleanup guarantee is requested.

### 3. The fixed source runner discards the failure categories the contract requires

Evidence: `packages/verified-issuer-runtime/linux/clockbound-host-evaluation.patch:284–291` handles only `Ok(event)` from the actual `Ntp::sample()` and silently discards every error. The new observation event at patch `129` exposes cumulative requests/responses only. `scripts/governance_host_evaluation_bootstrap.py:213–219` eventually reports `source_unavailable` if no response is observed. There is no tracing subscriber initialized by the fixed entrypoint, and tracing would not restore the discarded result in any case.

For example an actual local socket permission/bind failure, transport timeout and an unusable NTP response cannot be retained as distinct source facts. With no usable replies, the first two become the same sixty-second source-unavailable result. This misses the contract's explicit finite lifecycle/status distinction and makes the future joined-host evidence unable to establish what actually failed. It does not create false strict time authority, but it is an important evidence/diagnostic gap in this evaluation deliverable.

Match the actual `NtpIoError` into a fixed bounded vocabulary and carry those facts into the structured producer stream and controller receipt/log, retaining the fixed IPv4 source and no fallback. Preserve permission failure, timeout and unusable-source distinctions without logging raw OS/provider messages. Add source/mocked checks for the real error branches rather than only asserting that `sample()` occurs.

## Minor / deferred

The dense single-line Python, JavaScript and C orchestration makes ownership and refusal paths harder to audit. Expanding the ownership-critical branches would improve maintenance, but no separate blocker is asserted for formatting.

## Declined to judge

- Actual Rust/C compilation, linkage and emitted ABI: excluded from this grant; the definite missing-link source issue above is still actionable without compiling.
- AL2023 interpreter/library/version closure, Node/addon ABI and complete license/provenance bytes: explicitly future artifact acceptance; no actual package exists to qualify.
- Actual Linux service exclusivity, clock privilege, NTP reachability, ACL/filesystem behavior, process cleanup and host termination: require the separately approved exact host run; no simulated result is promoted to those claims.
- Physical-time/strict policy premises, genuine disruption detection, credential custody, fleet/human/provider qualification and whole Governance: remain unimplemented or unqualified, and are not supplied by this raw evaluation path.
- Separate production operational-assurance design: outside this unit and not implemented here.
- Historical twenty-seven native-input preservation: the new twelve-file diff does not modify those files, but this review does not renew or independently reproduce the historical native packet result.

## Assessment

**Ready to accept the local source unit? With fixes.** The intended source-to-publisher-to-raw-reader composition is present and its assurance labels are restrained. Correct the missing runnable-link recipe, controller cancellation cleanup and discarded source failure facts before declaring the joined local implementation complete. No tests, compiler, native program, network, service, clock, real permission, SQL, credential, provider, CI, resource or spending operation was performed for this review.
