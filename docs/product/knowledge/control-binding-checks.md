# Offline control-binding source checks

**Internal source tooling. Customer eligible: false. Publication approved: false.**

The [explicit registry](control-binding-checks.json) lists the eight registered `*bindings.test.cjs` suites and their SHA-256 values. The hashes identify reviewed test bytes; they are not approval authority. This registry does not replace the suites' own exact-node/baseline contracts, alter their pass/fail behavior or establish whole-product coverage.

Run the local checker from the repository:

```sh
python3 scripts/check-documentation-bindings.py --list
python3 scripts/check-documentation-bindings.py
```

`--list` validates the registry and current test files without importing or executing test code. No arguments runs all registered suites once in one fixed Node `--test` invocation. No custom command, executable, test path, installation, hydration or network fallback is accepted. No package, lockfile, CI or customer-help integration is added.

Preflight rejects unknown registry/record fields, duplicate JSON keys or test paths, malformed hashes, absolute/noncanonical/traversing paths, symlink files/ancestors, nonregular files and changed test bytes. Every matching `docs/product/knowledge/*bindings.test.cjs` file must be registered: a future unregistered suite or missing current suite fails rather than being silently skipped. Review a new/changed suite and its existing source contracts before updating the explicit registry; do not regenerate hashes to hide failing bindings.

Execution requires the existing canonical Node `/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node` and macOS `/usr/bin/sandbox-exec`. Unsupported restriction platforms or missing/noncanonical executables refuse, with no unsandboxed fallback. Only the Node child applies the profile: network is denied and writes are limited to one fresh private temporary directory. Inherited environment variables are replaced with fixed PATH/locale/timezone and private HOME/TMPDIR/cache; compile cache is disabled. Inputs and installed dependencies are read from the existing repository; no credentials or external services are requested.

The child owns a new process group. A 60-second deadline and 2 MiB output bound apply, including a child kernel file-size limit between parent checks. Timeout/output cleanup signals the owned group only while its parent is still unreaped, then waits for that parent. A normally reaped parent is never used for a later group signal; Node waits for its test workers. Arbitrary orphan/descendant containment is not claimed. Logs remain in the printed private directory; source-check failures retain their nonzero exit. This is an ordinary local test runner, not an issuer/runtime sandbox qualification, complete executable-closure proof or platform-security certification. Preflight hashes are provenance checks, not immutable file custody across execution.

The runner's own focused tests exercise pure filesystem fixtures and mocked subprocess boundaries, including refusal, scrubbed arguments/environment and process-group cleanup. They do **not** execute the registered binding suites. Any actual combined run has its own separate result; no combined success is inferred from runner tests or earlier individual suite receipts.

Passing these checks means only that the registered static source mappings satisfy their existing contracts at that invocation. It does not establish complete control/state inventory, genuine native/browser/keyboard/assistive-technology behavior, accepted media, editorial authority, release support, customer eligibility, retrieval quality or B4 completion. No percentage or global control-coverage total is derived.
