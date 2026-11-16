# Production startup regression: investigation and release controls

This is a diagnostic and regression-control change, not a production repair claim. The exact current compiled application omits startup options for a recognized direct Neon host in an owned TLS fixture, while production still reports `08P01`/`P2039` rejecting startup `search_path`. The one freshly approved existing-setting read recognizes the expected direct host, but does not prove uniqueness or the value captured by the deployed process. Do not change endpoints, weaken TLS, repeat migrations or redeploy speculatively.

Source history identifies Prisma7 commit `4fbbb5db186ba9bf2a2e614526abcda0ab52c493` in PR321 as introducing the application startup option. The earlier Prisma5 client did not inject it. That history explains the compatibility regression; it does not prove the unresolved effective production client/configuration path.

The new trace is keyed to the actual factory-returned client. Failure logs contain only a fixed error classification, fixed revision/route/scope, two configuration booleans and four capped counters. Unknown cached clients remain unknown. Configuration preparation is not transmitted-packet proof; configured TLS is not negotiated-TLS proof; cumulative counters are not per-request attribution. Original raw errors/messages/stacks are removed from this log. Connection targets, startup behavior, initialization SQL/ACK checks, deadlines, channel binding and public responses are preserved.

The new `scripts/check-production-product.mjs` checks canonical public storage/download/redirect/release-manifest paths. It never turns provider advertisement into authentication proof. Even an automated pass retains real Google, mail, native pairing and installed-application verification as UNVERIFIED and `releaseAccepted:false`.

Completed external work: PR344 and its main checks passed; V19 0.1.24 run43878118864 succeeded and was published after actual owner review. Windows MSI/NSIS clean installs, five upgrade/update/collision cases and cleanup passed; Windows remains unsigned, with rendered UI and real Google pairing unverified. Both Mac packages passed signing/notarization/Gatekeeper checks. Public Windows files match candidate and GitHub digests and public detached signatures. The signed Apple Silicon candidate is open locally; its saved sign-in could not be verified.

The owner started the one final production deployment `dpl_BiPWrNTTaCZ1iTVQM7s45wur2y7Q` from green main `f05c307b4274eee9a343ee51caa02f4f76be8458`. It is READY and assigned to the live domain, but all four website download routes returned503 and three storage-backed status components remained unknown. The final release readiness flag was restored to false. No new deployment, private read, SQL or production setting change follows automatically from this investigation.

The earlier exactf05compiled fixture used an emitted artifact whose build wrapper lost its saved exit status after compilation. The recovered source/dependency/output hashes and actual compiled route execution are verified; full-build exit acceptance remains UNKNOWN. Do not rewrite that failure or treat a fixture as the deployed Vercel artifact.

See COPIED-EVIDENCE.json for original locations and byte hashes. Large full test/build transcripts remain outside Git; bounded receipts preserve their scope. All earlier master requirements and remaining product/Windows/Governance qualifications remain open. Governance stays incomplete and disabled after the product priorities.

## Accepted combined local build and trace

The combined diagnostic-source offline Next build PASSES with exit0, owned cleanup and unchanged input/index/cache checks. Its actual compiled-route TLS probe also PASSES: direct startup omits options with one preparation/removal observation, while the pooled control retains options and honestly reports zero direct-only counters; both return only safe synthetic08P01 categories. Authentication/SQL are zero and owned cleanup is verified. This is local uncommitted diagnostic-source evidence, not a Vercel artifact or a production functionality fix.

Evidence: combined-build/RESULT.json and combined-wire/{INPUTS,RESULT}.json. Four harness-only checks cover restored finalization, historical shadow-fault reproduction and cancellation/deadline refusal before the next dependency copy. Original f05 wrapper/log/history remain unchanged. The large build/source/namespace inventories stay external with exact hashes in combined-build/EXTERNAL-INVENTORIES.json. The eight diagnostic/control code hashes are unchanged from the accepted build/probe; later modifications are documentation/source-enrollment only.

Owner order: repair and visibly verify functional login/download first; then compact sign-in cleanup and provider circles; then Exact scrolling; Governance last. Scroll/design work is halted until functional repair. No frontend changes are included in this documentation closure.
