# Revised native capability component — local implementation only

**Superseding causal evidence:** actual owned shared-file and POSIX shared-memory mappings reported SM_PRIVATE and were incorrectly allowed by the first classifier. [Counterexamples](../native-mapping-causal-comparison/README.md). The [conservative correction](../native-classifier-conservative-fix/README.md) now refuses all maximum-write mappings, closing that false acceptance but making the runtime unusable as-is. Earlier pure-test/source-review passes below do not qualify mapping safety. No initializer was loaded or identity activated. More VM shape exceptions are not an accepted solution; the [pre-runtime candidate](../pre-node-controlled-origin/design.md) is design-only and needs separate validation.

The specifically approved local revised mechanism now has concrete C descriptor
and VM collectors/classifiers, a separate compile-only N-API initializer and a
small isolated native harness. No wrapper inventory is substituted for this work.
Current canonical CJS still returns unavailable and does not load the addon.

The collector queries only its own PID/task using public installed SDK APIs.
It bounds descriptor/region count and recursion/progress, checks typed descriptors,
access modes and exact readonly stdin/pipe shape, refuses writable vnodes and
unexplained capabilities, checks current and maximum VM protections, and compares
double snapshots. Shared maximum-write and unknown/incomplete/changing metadata
refuse. Recorded classifications are metadata, not process identity or proof of
complete capability closure; public VM share-mode information has explicit SDK
limitations and requires actual same-artifact qualification.

The unexecuted initializer derives the real loaded addon location and actual
packaged Node path, requires the actual readonly mount root, then implements
pre-inventory → fixed named NoWrite installation/error cleanup → post-inventory.
It exports only a frozen empty object. It supplies no method, initializer token,
boolean, digest or private CJS identity. A future main must still reverify the
closed file set and loader state before application import.

Three artifacts compile with installed Clang/SDK and cached Node v24.21.0 headers:
classifier executable, readonly metadata executable, and the initializer bundle.
The bundle is mode 0600 and **was not loaded**; that mode alone is not claimed to
prevent dlopen. Test executables link only the collector, never initializer/profile
code. No Node require, dlopen, NoWrite call, new restriction probe, mount, provider
operation, credential access, private identity or activation ran in this task.

## Focused evidence

- 33 pure classifier/bounds assertions pass: retained writable descriptor shapes,
  wrong stdio direction, socket/shared-memory/unknown types, snapshot incompleteness,
  count/size overflow, private/COW versus shared maximum-write mappings and upgrade
  rights. These inputs are synthetic metadata, not executing authority.
- The first minimal real own-process metadata child ran before the larger negative
  matrix. It inspected three descriptors and reached thirteen VM regions, then
  conservatively refused a mapping. The final diagnostic smoke identifies
  SM_TRUESHARED (5), current protection 0, maximum protection 7, external-pager 0.
  Descriptor scan completed; VM admission did not. Identity stays unavailable.
- A second readonly metadata child was intentionally given an owned retained
  writable descriptor. It refused that capability; the owned file remained empty.
  This inspects metadata and does not rerun the consumed NoWrite write experiment.
- Fresh independent source review passes within the unexecuted/unqualified scope.
  Exact commands, artifact hashes and fixed outputs are in focused-result.json.
  Source/test hashes are in source-sha256.json. No whole-app build was performed.

To reproduce only these scoped tests from the repository root, create the owned
output directory `work/native-capability`, then run
`scripts/governance_local_issuer/native_tests/run_native_tests.py` with Python.
This runner compiles but never loads the initializer. Its only executed native
children are pure classifiers and fixed-own-PID readonly metadata programs.

## Concrete remaining qualification

The observed mapping refusal is not proof that the host is unsupported, nor a
license to whitelist this region. The strict component currently admits no usable
runtime in the observed smoke. Safe actual mapping/capability classification and
real clean-launch handoff must be qualified without silently relaxing the rule.
The separately controlled actual profile/mount experiment is still unapproved.

After that blocker is resolved and an exact experiment is reviewed, build a new
closed artifact containing the reviewed native component and actual compiled
issuer/store/transport consumer together. Use its real readonly package and owned
backing image for retained descriptor, shared/upgrade-capable mapping, alias and
mutation controls; preserve all original loader/cache/tamper/duplicate/restart
and same-module private-capability gates. A toy/native classifier pass cannot
complete those gates. Do not retrofit the old copied package or emit an executing
artifact digest. Fleet/legacy/provider-effect qualifications and enrollment remain
separate and unavailable. The original failed retained-write/truncate evidence and
consumed one-run approval remain unchanged.
