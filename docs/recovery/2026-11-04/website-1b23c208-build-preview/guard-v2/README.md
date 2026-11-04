# Preview harness v2: profile-selector correction only

READY for independent review, PREPARED NOT STARTED. No sandbox compile/application/startup, network/HTTP/browser, app/native/provider/auth/DB/credentials/helper operations. Existing previews/sessions and exact built stage remain unchanged.

Original directory `/private/tmp/axiom-preview-harness-1b23c208-20261104` remains intact, including frozen42e52 evidence, original exit65 and backend-start.log. Every originally frozen file was rechecked unchanged. No quiet patch/retry.

V2 directory `/private/tmp/axiom-preview-harness-1b23c208-v2-20261104`. Exact diff in exact-v2.diff. The only policy change replaces network address host `127.0.0.1` with `localhost`, retaining exact5224/5225 ports: two backend selectors and three proxy selectors. No wildcard, write allowance or additional network rule. Backend outbound denial, proxy loopback5225-only outbound and both all-write denials remain. Actual program bind/backend HTTP target stay fixed127.0.0.1:5225/5224. Route/image/header guard source is byte-identical after only owned ROOT path relocation. Launcher similarly relocates owned paths/env HOME/TMPDIR; built stage and pinned Node/Next inputs unchanged. Asset manifest is byte-identical. Launch bindings update paths/hashes only. Test profile expected-selector literals update accordingly.

Source invariants were checked with assertions without executing launcher main. Root/new manifest identity verification remains part of prepared launcher. Syntax parser acceptance is NOT claimed; neither profile has been applied or parse-probed.

Only two focused pure tests selected: `test_prepared_launcher_binds_only_fixed_inputs_without_launch` and `test_prepared_profiles_deny_outbound_backend_and_all_writes`. Command from the V2 working directory:

`/usr/bin/env -i PATH=/usr/bin:/bin HOME=/private/tmp/axiom-preview-harness-1b23c208-v2-20261104 TMPDIR=/private/tmp/axiom-preview-harness-1b23c208-v2-20261104 PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 -m unittest -v test_harness.Compatibility.test_prepared_launcher_binds_only_fixed_inputs_without_launch test_harness.Compatibility.test_prepared_profiles_deny_outbound_backend_and_all_writes`

Actual V2 toolchunkdf848d, exit0, two passes in0.129s; focused-profile-green.log/exit.txt preserved. Launcher execve replaced and observed uncalled; only input byte reads and textual profile checks. Full14guard suite and build not repeated.

Provenance correction: initial selection chunk e7cb76 ran the same two tests from the ORIGINAL working directory, despite V2 environment/log path. Those two passes are NOT V2 evidence. Preserved separately as wrong-cwd-original-focused.log/exit.txt; corrected working directory then produced the actual V2 result above. No server or sandbox operation occurred in either selection.

Old three vulnerability reproductions and separately labeled canonical hardening remain historical original evidence. Prior single-backslash/NUL assessment correction is retained in original README, not reasserted as a vulnerability. Future startup/HTTP/image serving and browser/RSC/AT acceptance require separate authorization and remain unverified.
