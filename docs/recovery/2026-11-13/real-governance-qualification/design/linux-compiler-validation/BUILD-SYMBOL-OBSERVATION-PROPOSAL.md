# Same-profile symbol observation — prepared decision

The conditional compatibility run43609722051 at7c35aec14a424caab5c4a52cb0d163a5583ad0fa is complete and CONSUMED. Its actual C/Rust fixtures, tiny offline Cargo, full daemon-feature Rust compilation and whole Rust+C/no-undefined link all succeeded. The nm command succeeded with6,719,910stdout bytes. The original strict checker then returned `missing_actual_rust_path`, on its FIRST expected Rust path. The second Rust path was not adjudicated. ELF/output-hash checks were after that rejection and did not execute; no accepted artifact exists.

Our diagnostic failed to retain the matching symbol rows. The ephemeral job's nm stdout/binary are unavailable. Matching source defines the functions/module, and cached rustc-demangle0.1.28 source supports crate `[hex]` disambiguators and inherent `<Type>::method` display, but GNU nm's actual rows are unseen. That plausible formatting issue is NOT proof of the actual cause and must not become a waived gate.

## Prepared local correction, acceptance rule unchanged

The prepared source change collects evidence BEFORE calling the unchanged strict `verify_symbols`:

- Record SHA256/size of the actual Rust staticlib, C object and linked ELF immediately after their creation/currentness checks.
- Read/validate the same ELF64/x86_64 header and save the bounded header.
- Run one fixed raw `nm --defined-only` and one fixed existing demangled `nm --demangle --defined-only` against the SAME frozen linked file, each bounded to30seconds/16MiB by the existing supervisor.
- Save each complete stdout's byte count/SHA256 and at most256rows/256KiB matching only the two required Rust method identifiers or four original C names, with16KiB per-row maximum. Measure row caps in JSON-encoded wire bytes and always emit a separate primary evidence receipt capped at1MiB, independently of the optional2MiB bulk metadata receipt. A missing/oversized primary receipt cannot yield acceptance. JSON-escape the receipt. Over-limit/incomplete evidence refuses; rows are observations, not function acceptance.
- Complete the original source/lock/tool/header/output checks and retain explicit final frozen-input/source results BEFORE enforcing the original exact symbol check. A late mismatch invalidates acceptance/currentness. A name mismatch still FAILS; no normalization, forced legacy mangling, closure-only substitute, symbol waiver, profile change or historical receipt reinterpretation occurs in this correction.

The old checker function is byte-identical. The real producer/patch/archive/dependencies/compiler options/link flags, candidate profile and trusted fixtures remain unchanged. The source's new prior-transition coordinate7c35aec does not rewrite the saved tool/std identity observation at207cf14; that separate identity anchor stays fixed.

## One fresh conditional native observation requested

After independent code/packet review and fresh current remote checks, make ONE exact PR331 transition from7c35aec14a424caab5c4a52cb0d163a5583ad0fa. Same free public standardUbuntu24.04 job,45minutes/shared2400second controller, explicit per-child deadlines/at most5seconds cleanup, no retry. Same-host safety fixtures and tiny compile must still pass before one full unchanged-source compile/link because the prior ephemeral artifact cannot be reused. Only the fixed locked dependency acquisition may use network; compiler networking remains restricted. Preserve every older packet/failed receipt. No existing check is bypassed and no additional workflow run is authorized automatically.

If the unchanged symbol gate fails again, the complete same-artifact identity/ELF/source observations and bounded real names will now remain available for a separately reviewed **local** parser/evidence decision. Do not assert that the names are merely cosmetic or that the artifact is accepted before that evidence exists. Another compiler execution is not authorized by a failed observation.

No runtime/helper application launch, actual clock qualification, secrets, credentials, database/provider action, cloud resources, signing, installation, deployment, enablement or spending. Full Governance/master scope remains incomplete/disabled. This approval is for one new native/build observation with better read-only evidence, not a new build-permission boundary or a completed Governance claim.
