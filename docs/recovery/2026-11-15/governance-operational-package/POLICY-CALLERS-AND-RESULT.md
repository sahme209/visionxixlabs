# Approved policy split — local source result

Owner approved call_ec97375ab4774ada843d22f242fcb95a. Governance remains INCOMPLETE/DISABLED. This unit neither compiles nor executes C/Rust/native code. No account, credential, provider, database, deployment, resource or spending action.

## Exact new file contract

`/etc/axiom-operational-time/profile` is still fixed and hashed against `AXIOM_OPERATIONAL_PROFILE_SHA256` in the original frozen table. For NEW packages its exact ASCII/LF fields are: `AXIOM_OPERATIONAL_POLICY_V1`, `aws-linux-operational-v1`, `aws-time-sync-ntp`, canonical decimal revision, canonical decimal reader UID, canonical decimal reader GID, `END`, final LF. Revision1..9007199254740991; identities1..4294967294. No arbitrary host, digest, boot, source-generation, unknown field, extension, NUL/CR, leading-zero integer or trailing byte. No policy file or qualified package has been created by this change.

The root owner reads the entire original held digest-checked file, requires the original bounded size and exact returned length, and decodes only this semantic format. The original reader-uid file must equal the canonical policy UID. Original boot/suspend and held root0750/exactGID/noACL directory facts are captured; original directory identity/mode/owner/group/timestamps, frozen files, boot/suspend, service exclusion and withdrawal are rechecked across capture. Exactly one getrandom32/GRND_NONBLOCK call supplies lowercase domain-separated host_/source_ labels; all short/error/EINTR/EAGAIN/zero returns refuse without retry. The verified compiled policy digest becomes acceptance.profile. Acceptance is separately encoded before exclusive creation of the original accepted file; no policy-byte copy or historical acceptance fallback.

Before the consumer filter/exec, setresuid/setresgid set all three identities and getresuid/getresgid verify real/effective/saved equality. No capability, filter, clock bound, activation/default/profile registration or CHECK/STATUS/FD contract is loosened.

## Actual caller mapping

A complete production caller search of packages/lib/scripts identifies:

- time_operational_status.h/c: policy decoder + pure derivation; existing acceptance/status/check wire remains AXIOM_ACCEPT_V1.
- time_operational_owner.c: sole production policy decoder/derivation caller and sole actual kernel/filesystem composition; no public JS constructor or acceptance CLI.
- time_operational_status.c daemon initialize: original FD8 acceptance decoder, unchanged.
- operational_publication.rs: original FD8 AXIOM_ACCEPT_V1 generation setup, unchanged.
- time_operational_binding.c: original accepted FD8/boot/directory/GID and native type-tag/currentness/sample checks, unchanged.
- operationalNativePorts.ts → operationalSource.ts → installedOperationalMain.ts: original addon/context only; no new parser, synthetic qualifier, provider or default registration.

Historical source/compiler/native/frozen packets remain unchanged and are not requalified by this new owner source. This unit does not regenerate the closed JavaScript main because its inputs are unchanged.

## Review and test limits

Initial source assertions failed before implementation; the initial incorrect Python module invocation and missing-helper errors are preserved separately. A root-found capture-snapshot omission received a separate RED→GREEN. Fresh independent review found P2 incomplete policy read; a dedicated source RED reproduced the absent length condition, now corrected with original-size bound plus exact read length. Reviewer was not asked for a second CLEAR. No other material source/desktop finding was reported.

Final 12 source assertions +4 explicitly synthetic specification scenarios PASS. Existing15 operational native SOURCE assertions PASS. These do not execute the C decoder/getrandom/filesystem/privilege code; simulation is specification evidence only. Full ordinary TypeScript suite19618PASS/1expectedfailure/1144skip; strict root/desktop types PASS. Desktop UI unit separately has37focused cases and one offline/no-network frontend compilation, not a native build or installed update. Exact hashes/logs are in POLICY-LOCAL-RESULT.json and the desktop-installed-version receipt.

## Remaining mandatory gates

The volatile exclusive marker does NOT consume attempts durably before marker creation or across reboot. An original external consume-before-start controller and its real persistence/unknown-response tests are absent. Exact target/toolchain/ABI/package/crypto/host ownership, syscall behavior, boot/suspend/service withdrawal, cancellation/reaping/lifecycle, authentic custody/fleet/expiry and human/provider/security acceptance remain unqualified. Empty expected hashes still refuse. No installed package, live host or Governance enablement follows from this source checkpoint.
