# Controlled-launch and descriptor-handoff preparation — local only

The original approved artifact work now has a concrete preparation module for the
fixed packaged Node executable, canonical CJS main, argv, cwd and environment. It
uses the existing strict closed-file-set verifier and refuses partial/tampered
packages, root/entrypoint aliases and caller argv/environment/cwd/stdio/fd options.
No existing large materialized package was rebuilt or reverified in this task.

The immutable contract describes an explicit readonly, no-follow, close-on-exec
`/dev/null` open for stdin and two launcher-owned anonymous output pipes, with
close-fds, no passed descriptors and no shell. It intentionally does not use
`subprocess.DEVNULL`, which can open a read/write descriptor. These are symbolic
instructions, not real descriptors or runnable Popen kwargs. The fixed environment
contains only server-selected values; inherited credentials and unknown values
are not forwarded or echoed. Loader/preload/cache overrides refuse early.

A shared pure environment check also fixes existing Python preflight: an actual
unit RED showed `NODE_COMPILE_CACHE` reaching package observation instead of early
loader refusal. The corrected preflight rejects it before package inspection.
The public launch function still always raises `verified_preimport_launch_unavailable`.
No contract is consumed by an execution path, initializer or identity issuer.

The strict recorded handoff decoder rejects writable stdio, named FIFOs, unowned
pipes, passed/inherited descriptors, extra fields and fake booleans. Its output is
always `recorded_handoff_shape_only` and unqualified. Recorded metadata and the
package-file-set observation digest are never executing process identity or a
freshness receipt; a future actual launch must reverify every required boundary.

Verification: 17 focused Python tests pass (14 new, 3 existing launcher tests).
Tests use small owned synthetic closed-file fixtures, a spawn stub and recorded
metadata; they do not run Node, create a descriptor handoff, inspect native process
capabilities, install a profile, mount an image or initialize identity. The initial
manifest-alias test tried to overwrite an immutable unit fixture manifest; its
setup was corrected to create a new declaration after removing only that owned
temporary fixture manifest. The failed log is retained. No production verifier or
refusal rule was weakened. Independent source review passes, no important finding.

The revised native capability mechanism remains pending its specific decision.
Actual clean exec/FD inheritance, native inventory, readonly package/backing-image
protection, same-artifact compiled consumer, fleet/legacy qualification, coverage
and activation remain unavailable. No provider, credential or production change.
