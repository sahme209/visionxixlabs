# Source-only legacy fixture qualification proposal

No compiler or test child has been invoked for this proposal. The two target binaries do not yet exist as reviewed artifacts. Existing GREEN recipes, harness, receipts and the 905-test baseline remain historical and unchanged by this proposal. This adds no budget: the runner reads the existing ROOT unit ledger, refuses a missing root or fewer than eight consumed invocations, and retains the whole-unit 32-invocation/480-second caps, 30-second child cap, 64-KiB combined output cap, five-second cleanup, core limit zero, existing network-denying sandbox and fixed CLT/SDK binding rules.

## Fixed source targets

* Owner journal: compile actual `test_owner_journal_native.c` (which includes actual `owner_journal_native.c`) with actual pure `owner_journal.c`. No production adapter, readiness, producer or Security implementation is separately linked. Its existing positive case reserves and writes intent (64 inert bytes), checks four simulated full-sync barriers and closes, then sweeps every successful-path effect index as a refusal. New init, both size calls, both opaque copies and both ACL frees participate in that same sweep. Additional root, ACL mismatch, ownership and link-count refusals remain. The shared ACL helper is included normally and executes its actual allocation, size bounds, copying, comparison and cleanup.
* Maintenance: compile actual `tests/maintenance_closed_test.c`, including unchanged actual closed main and actual `protected_fd`. The renamed admission stub returns zero; argc 1/2 both return 69. All dormant operational edges are renamed to assert-traps, so an unexpected admission-path reach fails without platform access. The independent FD-guard cases use inert fstat/get-ACL/init/size/copy/free stubs; owner/mode/type/link, absent ACL, opaque mismatch, copy failure, acquired-free failure and reference-free failure refuse.

## Effect containment

Owner-journal names `getuid`, `geteuid`, `open`, `openat`, `fstat`, `acl_get_fd_np`, `acl_init`, `acl_size`, `acl_copy_ext`, `acl_free`, `close`, `fchown`, `fchmod`, `write`, `fcntl` all redirect to local inert fixture functions. FD constants never designate actual descriptors. No actual filesystem write, ACL, sync or privilege operation is called.

Maintenance names `fstat`, `acl_get_fd_np`, `acl_init`, `acl_size`, `acl_copy_ext`, `acl_free` redirect to its inert predicate mocks. Names `getuid`, `geteuid`, `_NSGetExecutablePath`, `realpath`, `lstat`, `open`, `openat`, `close`, `axiom_origin_loaded_file_matches`, `ax_synthetic_native_provision`, `ax_fixture_commit_and_run_controller`, `ax_fixture_discard_authorization`, `printf` redirect to local assert-traps. `ax_fixture_maintenance_current` redirects to the zero-return admission stub. No actual Security/CSSM implementation is linked; included Security headers supply types only.

Actual allowed effects are process-local allocation/free, memory/string operations, assertion termination, and one fixed successful stdout line. No operational profile/principal selection or activation definition is supplied; no NDEBUG is supplied.

## Narrow proposed import additions requiring root review

The copied local binary guard leaves the existing guard untouched. It proposes these explicit target-scoped additions to the existing pure-memory/puts/assert/allocator import set:

* journal: `_strcmp` (fixed path and journal-name assertions), `_strchr` (single-component assertion), `_strlen` (actual generation decoder), `_strtok_r` (actual adapter's local mutable path buffer).
* maintenance: `_strcmp` (dormant fixed installed-path comparison), `_strtok_r` (dormant actual parent walker's local path buffer).

No wildcard additions, ACL, Security, filesystem, privilege, process or networking imports are allowed. These are source-predicted allowances, not assertions about compiled imports. Root must inspect each actual compiled binary and map before pinning its SHA-256/map binding. Test steps currently refuse because both reviewed binary pins are empty.

## Fixed outputs and remaining review

Journal stdout is exactly `owner journal actual-adapter stub cases passed\n`. Maintenance stdout is exactly `maintenance actual closed main and FD guard with inert platform mocks: PASS\n`. Tests require exit zero and empty stderr. No test claim may use compilation alone as qualification. Compile outputs use fresh `ROOT/legacy/owner-journal-test` and `ROOT/legacy/maintenance-test`, with one-MiB bounded owned regular binary/map artifacts. Compiler flags include strict warnings, no modules, ARM64, minimum macOS 13, fixed SDK, and deprecated-type-warning suppression for the actual legacy Security type headers; no framework is linked.

Root independent review must precede invocation. Actual compilation/import/map review and subsequent pinning remain pending. Local tests cannot establish actual platform ACL behavior, installation readiness, custody, signing provenance or runtime authority.
