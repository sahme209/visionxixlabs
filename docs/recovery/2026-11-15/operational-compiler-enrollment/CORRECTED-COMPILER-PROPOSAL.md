# Corrected symbol-preserving compiler batch — proposal only

The original owner-authorized run43729260461/job132857866569 at35b88cba5aae932aa53f9aa08bc87810a1ce0697 failed. Its grant call_60732fcbde694192b8efdaf317b506d1 is consumed; no rerun is authorized. All nine ordinary exact-head checks passed. PR337 remains draft/unmerged.

## Observed failure

All18 supervised commands exited zero with owned cleanup confirmed. Status and publisher C objects and the Rust daemon compiled/linked; static ELF validation passed. Full nm returned zero stdout and "no symbols" on stderr. The existing nonempty full-symbol gate correctly refused with operational_symbol_output_limit. Worker/addon/owner were not reached. All10861 frozen hashes matched, canonical manifest41cd0812d2cd3b8c1a9fd08cecf4527499358e5b0cc32439e704fddc96b8990c. Warnings remain retained. No Governance output ran. This does not establish native runtime or production acceptance.

The root Cargo.toml release profile has strip=true; the package profile is ignored. Cargo's official documentation confirms true strips symbols and command-line configuration overrides manifest profiles:
- https://doc.rust-lang.org/cargo/reference/profiles.html#strip
- https://doc.rust-lang.org/cargo/reference/config.html#command-line-overrides

## Exact proposed correction

Only the daemon validation-build argv gains two literal arguments immediately after the absolute cargo executable and before rustc:
`--config`, `profile.release.strip=false`.

No source Cargo.toml or native source changes. This is an explicit changed compiler profile for this test, so a new owner decision is required by the original proposal's stop-on-profile-change rule. All other release optimization, LTO, panic, features, target, no-undefined linking and libraries stay unchanged. The artifact is an unstripped compiler-validation artifact, not the unchanged stripped production artifact; no production binary equivalence or runtime claim follows. No weaker dynamic-only symbol fallback or empty-output acceptance.

Before any eligible push, add pure recipe assertions for exactly this override and unchanged other phase argv/security gates, keep empty-symbol rejection, and independently review the exact changed source/commands/packet. Update only changed input hashes and bind a new owner decision and before-head35b88cba5aae932aa53f9aa08bc87810a1ce0697. Original packets and failure evidence remain intact. One source synchronize on the SAME PR337, no new PR, manual retry, dispatch or merge past a red applicable check.

## One corrected attempt requested

One fresh standard public Ubuntu24.04 runner, same40minute shared budget plus5seconds terminal cleanup and42minute outer. Same fixed tool/SDK/source/dependency identities, exact event/original-attempt guards, trusted compiler dependency build scripts, explicit one locked fetch then restricted offline compile/static readers. No additional tools/downloads/timeout, paid resources, credentials, database, services, deployment or Governance enablement. No Governance program/addon/main runs, loads or imports. Stop after first failure/cancellation/unknown without retry. Full symbols remain limited to16MiB and all existing artifact/frozen-input/cleanup checks stay mandatory.

This proposal is not implementation or runtime approval. Exact final enrollment and packet review must precede the one eligible push. Success would establish compiler-only acceptance of this explicitly unstripped test profile; host/controller/storage/custody/fleet/people/provider and runtime acceptance remain open.
