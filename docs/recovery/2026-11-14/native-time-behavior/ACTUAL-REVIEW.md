# Actual native behavior evidence review

Verdict: CLEAR for the approved fixed, role-free native behavior checkpoint. No important inconsistency found in the saved evidence or its current frozen source binding. This independent review read saved files only; no native execution, rerun, test, provider or network operation was performed.

Run 43622733276, job 132531785280, PR334, head cdc2174e1268fc964cf26f1a77a27ca1fa8aa2d3 records accepted=true and finalFrozenInputsMatched=true. All 29 command receipts report success, returncode 0 and cleanup_confirmed=true. The sole four-case Node invocation took approximately 0.0372 seconds; the sum of recorded supervised phases is approximately 3.623 seconds. These are recorded phase durations, not a separately reconstructed total job duration.

All 27 packet file hashes match the actual current local files. The packet's SHA matches the observed packetSha256. The pinned controller checks that same exact packet before/after phases and again in finally, separately from its 236-entry frozenInputs map of actual headers, tools, compiled sources and generated artifacts; not every inert packet input is duplicated in that latter map. Tool paths/hashes and the five Node SDK24.22.2 header hashes exactly match the earlier accepted worker compile receipt. The actual Node executable is separately pinned and the fixed harness checks its runtime version.

The runtime profile's retained raw BPF instructions recompute to b4174e1eddf0610203c2c2a64d17d4ec2f95d5317947a1b3d4818683bb5c85ee. Its deniedSyscalls list equals the current header's literal deny macro. Its explicit default-allow trusted-fixed-source scope and clone3 pointed-flags trust limit are retained; this is not evidence of complete hostile-code or filesystem containment. Historical compiler-profile bytes remain packet-bound separately.

Saved ELF headers and required definition rows identify the actual ELF64 x86-64 worker, fixed stall executable and instrumented DYN N-API module; each output hash also matches its frozenInputs entry. Worker: 26344 bytes, SHA256 5b69b826bf3cc2bce8d1d32273d29a9c2a1c23c238439ef8a99b73c0ea7cc3d3 (also byte-identical to the earlier accepted worker compile). Instrumented module: 55704 bytes, SHA256 7b7a6486d51997ce09cfcade5c3c683ed002dc9c491accc0a1a92971caa51425. Stall: 16144 bytes, SHA256 2d562e2244e841b7d4333907369bdf8b4aaf57700eaf8ef2c50fb2bec580e213. The module's saved unresolved imports contain no unresolved private axiom_ symbol; the actual controller checked N-API declarations against the frozen installed headers.

The fixed harness reports joined, replacement, cancellation and foreign accepted. This is execution of the previously reviewed actual native ownership assertions: original capture/hold association, raw timestamp ordering and final P2, same original FD successful once-only close after ref drain, replacement refusal without repair, genuine owned-pidfd SIGKILL/reap after explicit predeadline cancellation request, and authentic foreign-parent/plain-object refusal. The saved public observation contains case acceptance rather than all individual numeric native snapshots; the conclusion rests on the exact pinned harness's assertions, not independently exported per-case numeric traces. Cancellation-request time is not a separately measured signal-delivery latency guarantee.

Compiler warning bodies are retained without truncation: worker 2843 bytes and module 11033 bytes. The observed categories are -Wmisleading-indentation and -Wunused-result (the eventfd write); no implicit declaration, incompatible pointer, integer/pointer conversion, return-type, unresolved-private-symbol or N-API ABI diagnostic appears. This is not a warning-free build claim.

The saved outcome explicitly retains timeAuthority=false and governanceEnabled=false. It establishes the exact instrumented trusted fixture's behavior on this runner, not a protected real publisher/bootstrap/lifecycle, accepted sampling conversion, physical UTC/error/rate/lifetime premise, production time admission, real credentials/provider/fleet/people coverage, or full Governance. Regular CI and any further activation have separate status and authority.

## Reviewed evidence hashes

- `OBSERVED-RESULT.json`: `dba11c8798301d4f46baa3166869f1ef347b40d05b4e4e6d2f5ac79365d0229d`
- `COMMAND-RECEIPTS.json`: `1c79378f7b7efad1c70effd0e7d2ed8bbe5052556837b165584bfefabb25dc6e`
- `INPUT-PACKET.json`: `82aa2c0c62e27eb1c36b4f1bf65c096d8f72eeacf97aa276eca2e0edfb9c709f`
