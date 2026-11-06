# Actual current v3 container: final seal proposal — not authorized

Exact proposed entry:

```text
/usr/bin/python3 -B /Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/docs/recovery/2026-11-06/governance-stage-b-source-preparation/final-seal-1-prepared/prepared-final-seal-controller.py
```

DriverSHA `fede288bb751d8102232c1637c9c4fe2b7cfe0b9c8404d85e13517ad1bed9b98`; controllerSHA `e7088914f5563a2034c397c85c4ff08e33a6a4d73a1608b4ef39a33bf734b831`; [exact command/target packet](operation-inputs.json) SHA `16cbe8844f61b33045838e9472b1c35db5b3b947405770c516a56a218c46d606`; [source/helper bindings](source-bindings.json) SHA `4ce957d5a27a9f7c47fca9ad8cf0312583ea51bfecabf3b0bbf0c581c6d55fea`. The controller is the proven original-driver controller, unchanged function AST, with600second total/1MiB output constants for this existing final-seal scope. No new driver/baseline/key command has run.

## Actual reviewed target and allowed changes

Target is `/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-stage-b-image-1/assembled/Axiom Synthetic Custodian.app`. Actual v3 preseal receipt SHA476dfd942d3bf7febccae9a72dd330b2edc9f27af6fc8b9ecc8deee5b7c610db selects source64eca and packageDigest6bf466785e75b6034fe2dae29ace452fb467746e8d1267a7ad13c11bf793e6d2. Its exact13file bindings are retained in the packet, not recomputed/replaced here.

Non-authoritative AxiomSyntheticContainerMain currently has SHAb3a4f59e49b2f8a172a9071a16fbcb6c0b829f8eb2cbe53c7ca6d426dbe155d8/16856bytes/mode0755. Its signature area and three derived signature/link-edit size fields may change, following the existing v3 parser. The only new resource permitted is Contents/_CodeSignature/CodeResources, with its containing signature directory. Source prefix/body, main ownership/mode/nlink and every other baseline file remain constrained by the unchanged validator.

**All12 non-main files must remain exact, including metadata:** four authoritative owner/broker/controller/maintenance leaves; Info.plist and issuer-binding.plist; image d5a7fe7cb98f732c0a6f568e54343d472921c91f240870693084d78048859b4f/4022884469bytes; producer681a/schema/binding/seed; external fixture-tools/node1aa6 outside the app. Original sources, image copy, package, native pins and unsigned preseal receipt are never restamped to adopt signing changes. No --deep or authoritative re-signing.

## Existing mechanism / minimum adapter

fixture_final_seal.py already accepts genuine v3 assembly and validates baseline/tool/postseal joins. It remains byte-unchanged (SHAaedf14044271b381cc0a8e8864033766184664a16dc4afb05172ff6078ea36b8). Legacy final_seal.py is also unchanged: it hardcodes the old November5 v2 target/receipt/entitlements and emits a different command-record format, so it cannot be repointed or replayed.

The new fixed-current-target fixture_seal_sequence.py adapts only that execution gap. Its selector/pipe _run function AST equals the existing proven legacy runner. It emits existing `axiom.fixture-seal-command/1` records required by the v3 validator, with true stdout/stderr bindings, exact argv/state/exit/cleanup/error, baseline SHA and targetAfter. No arbitrary path/command callback or global mutation.

An independently identified draft gap was fixed before approval: **immediately before the first key call**, the adapter runs existing verify_fixture_assembly and compares existing _metadata/_directory snapshots against the captured13file baseline, including actual image/resources/external Node and exact inventory. Baseline/preseal JSON plus main checks alone are insufficient. Two new aftercapture mutation regressions were observed RED, then all7 focused mocked cases passed; they prove zero signing calls for externalNode/fixture-resource changes, unchanged real v3 postseal-validator composition on synthetic data, failure stop/once-only/wrong baseline path and driver baseline-failure stop. No real process/crypto/key/host/package operation ran in those tests.

## One proposed sequence / exact bounds

1. Claim fresh private `BASE/2026-11-06-stage-b-final-seal-1` and separate controller output root. Existing capture_fixture_seal_baseline rechecks current source/package/image/assembly and records the actual13file/directory metadata, main-before.bin and empty-entitlements.plist outside the target. Its currentness path includes existing bounded local Git/file reads; no compiler, runtime or host-metadata command. It is NOT invoked by this source preparation. The empty XML dictionary is fixed SHA97704a8960b4facceef54397a08fb5d0a456247c3627359215aa2a27df22656c; actual baseline hash remains unknown until capture, not fabricated.
2. After the immediate adapter pre-key checks, ONE `/usr/bin/codesign --force --sign 4C2E59F247CA275001586AE020A9269464529452 --identifier com.visionxixlabs.axiom.synthetic.custodian --options runtime --entitlements <final-seal-1/empty-entitlements.plist> --timestamp=none <exact app>`:60seconds.
3. ONE `/usr/bin/codesign --verify --strict --verbose=2 <exact app>`:30seconds; then ONE `/usr/bin/codesign --display --verbose=4 --entitlements :- <exact app>`:30seconds. Exact absolute argv are frozen in the packet. No timestamp/notarization/spctl/alternate key/export/unlock/access grant/prompt interaction. An unanswered prompt or unknown result stops; no retry/reset or automatic target restoration.
4. Existing validate_fixture_postseal consumes the actual three records/current files. It requires exact identifier/teamFG5N98FE6W/Runtime and matching CDHash, supported empty-entitlement representation, allowed signature-only change and unchanged12components/directories. Strict static verification is recorded external tool evidence; cryptographicVerificationPerformedHere/runtimeIdentityQualified/installationReady/activationAllowed stayfalse. Emit new postseal receipt; never rewrite the unsigned baseline/preseal history.

Per-command shared stdout+stderr64KiB; at most5seconds original-child cleanup. Outer600seconds/shared1MiB includes potentially multi-GiB currentness hashing. No artifact RLIMIT from log allowance. The proven controller owns only its original driver group and never signals it after reaping; descendant quiescence/universal preemption/complete containment remain unavailable. Partial signature/resource changes and failed/unknown records remain preserved without another key attempt.

Separate procedural helper copies live at `BASE/2026-11-06-stage-b-seal-procedure-1`, outside accepted package source64eca; no Next/package/image rebuild. BASE is the existing private Qualification Lab. Source preparation only created code/data copies and ran7 synthetic/mocked tests. No actual baseline capture, signing/Security/Keychain/host/helper/Node/native/runtime invocation or4GB rehash ran.

This proposal needs independent exact source/target review and a NEW explicit key-use decision. It does not authorize installation, account/service/root/resource/Keychain provisioning, image create/mount, SQL/database/provider/customer/AI/deployment/CI/spend action or target launch. Even success is static seal/mutation evidence, not notarization, publisher authenticity, protected custody, executing identity, SAME-consumer/fleet/enrollment/complete Governance. All parent requirements remain open.
