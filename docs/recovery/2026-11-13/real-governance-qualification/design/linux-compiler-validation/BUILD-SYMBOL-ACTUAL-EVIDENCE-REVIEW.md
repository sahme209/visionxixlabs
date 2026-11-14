# Actual same-artifact symbol evidence: independent review

The saved evidence resolves the observed spelling mismatch. It does not change the original run's failed status. Run43612023366/job132498917778, head8aefbd599cd921eff685295ae8eacb89e59499a4, remains accepted=false/missing_actual_rust_path. No new native execution or green rerun occurred in this review.

Primary and bulk receipts agree on every shared evidence field, exact packet3ecb86f637d86aa8610e9544895b7a6cbe073a8319c77d6994bb73fc8aa0014c, outputs/tool/std identities, ELF and final source/frozen checks. All29 retained child observations report success with cleanup confirmed. The primary marks evidenceComplete=true, finalSourceChecksPassed=true and finalFrozenInputsMatched=true; this is complete recorded build evidence, not runtime qualification.

Both saved nm observations contain16complete candidate rows with16unique matching address/type pairs. Actual primary definitions are:

| Address | Type | Exact demangled name |
| --- | --- | --- |
| 000000000020a440 | T | `<clock_bound::daemon::Daemon>::construct_axiom` |
| 00000000001ef630 | t | `<clock_bound::daemon::time_publication_adapter::NativeTimePublisher>::publish_precise_then_delegate` |

Each pairs with a distinct raw `_RNv...` symbol at the same address/type. Daemon future/inner closures, publisher closure, ClockState methods and D-type tracing callsites are separately retained; none must substitute for a required primary definition. Lowercase t on the private publisher is a local text definition, not absence or an undefined reference. All four exact C functions are uppercase T definitions with identical raw/demangled names and address/type pairs.

The linked ELF is recorded as ELF64 little-endian x86-64,57,937,864bytes, SHA256450ce45a47284b944bdaed95efaa7eee3046c5802295d610ede459b7712ebc10. Rust staticlib138,945,356bytes and C object11,312bytes have separate saved hashes. Raw nm stdout is recorded7,956,663bytes/SHA2561f91a3b07e3ccf9d188f41b266b7a6ab470b80fb7d271b614dc5950c7ee61d08; demangled stdout6,719,910bytes/SHA256790b37936696ccc42a864db56cee4cdaf4042984264efbb7a784aeca72cf887f. The full stdout and executable are no longer available for independent rehashing; this review checks saved receipts, captured rows and their reviewed producer, without claiming fresh binary verification.

## Precise local correction criteria

1. Parse actual nm rows into address, type and complete symbol name. Require text definitions T/t for the exact Rust primary names above; retain exact C definitions. Do not accept arbitrary non-U letters: saved D callsites show why that is insufficient.
2. Match complete explicitly supported method spellings. Support the observed inherent-impl angle-bracket form directly; any retained earlier flat form must also be an exact full name. Do not globally strip angle brackets/disambiguators or use identifier substring matching. No future/closure suffix, wrong receiver/module, trait implementation, data symbol, undefined symbol or method name nested inside another generic function may satisfy a primary.
3. Use same-artifact raw/demangled address+type correlation in saved-evidence adjudication; reject missing, conflicting, duplicate or ambiguous required pairs. Do not pin observed numeric addresses for future builds or claim that addresses prove native authority.
4. Test the real saved16-row fixture as a positive supplementary parser case, and negative removals/closure-only/wrong-receiver/type/duplicate cases. Keep original accepted=false receipt immutable. A supplementary local interpretation must be named and versioned separately, bound to these exact source/packet/output/tool/evidence hashes. It is not a rerun, activation, runtime or clock qualification.

No source implementation was changed; no tests, compiler, native child, network or external reads were run. Any future actual final validation still needs its own explicit owner scope. Native publisher policy issuance/liveness/time/custody/fleet/human/provider qualification and full Governance remain open.

Saved primary SHA256: `50a48acf9a19ae7e5fa16cfba13256f260c6627ab6ff6d0463d329eb7e17e66e`.

Saved bulk receipt SHA256: `86e0b744a9d79bdf24d6817b812f18bea20c22bd258f2ab85b890127515ac37b`.
