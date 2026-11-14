# Focused private merge coverage environment diagnosis

Outcome: **No product source defect established; no code or guard/pin changes made.** The exact9mocked tests pass under standard inherited local environment with pinned Node24.21.0, but4fail/5pass under root's synthetic env-i environment. This is independently reproduced on unchanged source, so the repeated full synthetic-environment failure is not evidence that the earlier corrected product slice regressed.

Standard pinned Node24 focused runs pass9/9 with both verbose and dot reporters. Exact synthetic environment HOME=ownedstage/home, PATH=pinnedNode+homebrew+/usr/bin+/bin, LANG=en_US.UTF-8,TZ=UTC,CI=1,NODE_ENV=test reproduces4/5. RemovingCI, usingrealHOME, removingTZ, addingexactPWD, removingexplicitNODE_ENV, or addingfreshownedTMPDIR individually does not repair it. No broader production claim follows from these local harness comparisons.

Authorized temporary test-only diagnostic copies retained original product source and assertions. Fixed boolean diagnostics show direct test import receives the expected native mock with current status/stable object/valid digest and captured repo/resolver/factory comparisons true in both environments. An added fixed marker in the mocked readIssuerIdentity factory shows1call in synthetic mode (only the direct diagnostic import), versus74calls in standard mode with9PASS. The actual coverage module therefore bypasses that native mock in the synthetic environment, then correctly refuses the real unavailable native origin. The exact resolver/transform cause is not fully identified; it must not be portrayed as a proven CI/HOME/TZ/TMPDIR bug or repaired by relaxing the product guard.

All temporary test copies were removed; original test SHA256 remains855b181631f75b625393171ceae41ba447bc494f16f66b5f8dd7284e957c8787. Diagnostic source copies/logs are retained privately. No native/helper/provider/network/SQL/build action occurred. Root has stopped additional diagnostics and is running the ordinary standard-environment full suite as the relevant local PR check; exact-head mandatory CI remains before merge. The separate missing-GPG-PATH issue is root/other-agent evidence, not established by this coverage lane.

## Retained focused log hashes

- `/private/tmp/axiom-private-coverage-focused-diagnosis.log`: `2930194c7602406a9d8cbc436a8203f37a1683be551abde11df55ea49540e3c9`
- `/private/tmp/axiom-private-coverage-clean-env.log`: `1f9e86a91e9985067b154d56482613dec5e0dd036b8136ee0211b24fe872d202`
- `/private/tmp/axiom-private-coverage-default-dot.log`: `35c94e14714deb54da7d2f830bc45d4e8758b1ba175b4a3feac4f08e911b65da`
- `/private/tmp/axiom-private-coverage-no-ci.log`: `3e13c360c3fb1282c650c0ad4a3c2ed68fee07048ebfb5ab72e1d6c18853194c`
- `/private/tmp/axiom-private-coverage-real-home.log`: `a73586a9d15892b9589ca6e1728a3fca00ac839ee3167368f093083efc640089`
- `/private/tmp/axiom-private-coverage-no-tz.log`: `4af807a5b9ae19306f93598decaeafb3e4afda31345b54403e200b2551a60572`
- `/private/tmp/axiom-private-coverage-pwd.log`: `b851661378dc52ff081ecbd98db13b6523bbb618615925d87877e384b93cd80f`
- `/private/tmp/axiom-private-coverage-no-node-env.log`: `993d8614c8a231c05a4bbb056028ba29631fb7446e4a8e1d2ed3fa7a44aefcda`
- `/private/tmp/axiom-private-coverage-fresh-tmp.log`: `c7a769fa3f6803e39add7080446f796047ea01e537a95ad710eed5df097c3455`
- `/private/tmp/axiom-private-coverage-benign-env.log`: `61d6009d4295c5c02efb0526fd66465ab7ef4cb693d627b3f95465fd60cfa5a4`
- `/private/tmp/axiom-private-coverage-mockcall-clean.log`: `94d68fe3d516b65bf6be34d14ef45c17756549d86c7eb00585f8036f29af0b16`
- `/private/tmp/axiom-private-coverage-mockcall-default.log`: `4bbd0558ed5e4254762fd7b65a0c87161c947a23a54ac96ed434f20cd0d3286b`
