# Missing Rust path — source-only independent assessment

Root supplied actual outcome: all new compatibility fixtures, tiny Cargo, full real Rust/C compilation and final whole-library link completed; nm exited0 with about6.7MB stdout; the controller then refused missing_actual_rust_path. Native grant is consumed. No compiler/symbol tool/runtime or external read was performed in this review.

## What source establishes

The expected semantic functions exist in the actual frozen inputs: clockbound-precise-origin.patch adds inherent `impl Daemon` async construct_axiom; the copied actual Rust module defines inherent `impl NativeTimePublisher` publish_precise_then_delegate. Required full crate/module/type/method identities remain legitimate. The actual source/materialization hashes still need their already existing run receipts; source names alone do not prove linked code presence.

Current verify_symbols parses defined nm rows, checks all four C definitions, then requires contiguous legacy-style substrings:

- clock_bound::daemon::Daemon::construct_axiom
- clock_bound::daemon::time_publication_adapter::NativeTimePublisher::publish_precise_then_delegate

Because the reported failure occurs after the four-C loop, the checker accepted those C definitions in its actual output. The rejected Rust rows have not been independently observed here.

## Plausible format mismatch, not an observed binary result

Already cached Rust1.99.1 vendor rustc-demangle0.1.28 source (`/opt/homebrew/Cellar/rust/1.99.1/lib/rustlib/src/rust/library/vendor/rustc-demangle-0.1.28/src/v0.rs`) prints nonzero crate disambiguators as `[lowerhex]` at lines795–810. Lines857–870 print inherent implementation types as `<Type>`, which nested method paths can then suffix with `::method`. A plausible rendering is `<clock_bound[hash]::daemon::Daemon>::construct_axiom`, with the analogous qualified publisher method. Both the crate suffix and `>::` would defeat the current substring check while preserving semantic identity.

This is source-backed plausibility, not proof of the actual GNU nm version's output for these binaries. No runtime symbol evidence can be fabricated from cached demangler code or a hand-written example. An actual retention/elimination/link-path problem remains possible until the real rows are inspected.

## Smallest next evidence step

First use already retained job logs or owned nm stdout, if available, to extract only bounded actual rows containing the relevant crate/type/method segments, retaining original nm symbol type/address, exact tool/artifact identity and whole-output byte count/digest. Do not rebuild merely because the controller failed to summarize its own6.7MB output. Any new remote read still obeys its applicable permission; none was made here.

If actual evidence is truly unavailable, a fresh exact symbol-observation/build decision must preserve bounded raw mangled plus demangled rows BEFORE rejecting/accepting them, not discard the evidence again. Preserve old refusal/history. Do not force legacy mangling or replace full paths with unscoped method-name substring matching just to pass.

A reviewed parser correction may accept source-grounded recognized legacy/v0 formatting with exact crate/module/type/method identity and defined function symbols, rejecting lookalike crates/modules/types/method suffixes/undefined-only rows. Pure examples test that parser; only actual observed rows can establish this run's symbol result. Full runtime qualification and remaining Governance gates are unaffected.
