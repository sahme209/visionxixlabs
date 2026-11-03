# Fixed offline Next build executor — first compilation blocked by font downloads

Root reviewed this implementation within the original approved trusted-host local
build model. It is an ordinary fixed compiler recipe, not private issuer launch,
upstream endorsement, complete descendant containment, or runtime qualification.
No actual Next compilation or additional Prisma execution occurred in this increment.

## Fixed execution and source inputs

`scripts/build-local-issuer-package-source.py:execute_build` requires explicit owned
stage/source/revision/cache/binding/generation/run coordinates, not a ready boolean
or a prepared JSON grant. It recomputes current source, compiler and generated-input
observations before commands and after compilation. Commands are fixed:

1. Pinned Node `scripts/check-vercel-build.mjs`.
2. Pinned Node `node_modules/next/dist/bin/next build --webpack`.

No npm, Prisma regeneration/formatting, migration, introspection, provider, or
database command is invoked. The environment is freshly constructed with the same
explicit local dummy database URL and fake build-only auth values as the prior
successful isolated harness, plus production/telemetry/cache controls. No ambient
credentials, proxy, Node loader overrides, or customer configuration are inherited.

Every archived regular source byte and executable mode is checked against the
exact Git archive. Git symlink type and target bytes are checked exactly; portable
host symlink permission bits are not a Git property. A bounded closed source-tree
scan rejects extra source/configuration/files/links, including untracked routes.
Only canonical installed `node_modules` is separate before compilation; `.next`
must be absent and is admitted as a separate output root only in post-build checks.
There is no arbitrary extra TypeScript/configuration allowance. The one derived
`next-env.d.ts` variant qualified below is post-build only and does not change
archive source identity/count. Other framework changes to tracked source or unknown
root files still refuse unless separately evidenced/reviewed.

Selected compiler packages are verified against their lock-pinned SHA512 tarball
bytes and complete owned installed file sets: Next, React, React DOM, TypeScript,
Darwin arm64 SWC, plus exact-lock nested packages under those selected roots.
Nested roots are verified against their own SRI tar first, then only those exact
roots are excluded from parent ownership. Parent tar overlap, unmatched files,
unlocked nested packages, aliases and changed nested bytes refuse. This does not
claim complete executable runtime closure.

The six existing Prisma source observations, exact original archive schema/lock,
strict `/2` engine binding, Node bytes, and five current required generated files
are rechecked. Immutable local generation attempt/result records and current raw
and canonical scratch bytes must correlate exactly with these current inputs.
Receipt booleans do not construct identity or replace independent file checks.
The earlier successful generation remains an unqualified at-time observation.

## Local process bounds and output semantics

Attempt/result/version/contract/compiler logs are exclusively created before child
launch. Existing output/log files refuse without overwrite. The actual Seatbelt
profile denies networking and writes except owned stage, temporary output and
designated logs. Explicit write denials cover original repository/npm cache/Prisma
cache, bound-engine files and original generation evidence. Build children additionally cannot read the known original
repository, source npm cache or original Prisma engine cache; the owned bound-engine
directory remains readable. This is known-path fallback prevention, not universal
host library/read closure. All phases share one
finite deadline, maximum 600 seconds. Original process-group timeout/kill/reap
behavior is retained; detached descendants are not claimed quiescent. The build
uses a bounded 2 GiB per-file child limit for compiler caches and 64 MiB log limit;
generation retains its existing 128 MiB default per-file bound.

After exit 0, bounded BUILD_ID, required-file, route and NFT trace metadata and
referenced paths are observed, then all original source/generated inputs are
checked again. These are not complete closure or loaded-code proofs. Success is
`build_outputs_observed_unqualified` with `buildOutputsVerified:true` only for
these checks; `buildCompatibilityVerified:false`, descendant quiescence, runtime,
complete executable closure, issuer identity and activation remain unavailable.
No sealed package or identity is granted; later packaging must freshly verify/seal.

## Exact local checks

- Initial absent-API RED: `/private/tmp/axiom-local-next-build-red.log`.
- Actual nested PostCSS ownership refusal reproduced by owned fixture RED:
  `/private/tmp/axiom-local-next-build-nested-red.log`.
- Genuine extra untracked route acceptance RED:
  `/private/tmp/axiom-local-next-build-extra-source-red.log`.
- Final **10 tests pass**: `/private/tmp/axiom-local-next-build-final-green.log`.
  Command: `python3 -m unittest discover -s scripts/tests -p test_local_next_build.py`.
- One directly affected nonnested Prisma source-observer regression passes:
  `/private/tmp/axiom-local-next-build-prisma-source-regression.log`.

The fixture build-command tests use actual pinned Node/Seatbelt/process deadlines
but explicitly simulated preparation and fixture CLI JavaScript, never actual
Next compilation or Prisma. A separate narrow fixture invokes the actual pinned
Next type-declaration writer only, as documented below.
They cover protected-write denial, clean environment, fixed arguments, missing or
escaping output metadata, existing-log preservation, stale `.next`, changed inputs,
real owned sleeping-child timeout/reap, complete source/extra-route/symlink checks,
and nested SRI-positive/tamper/unlocked/overlap cases. Fixtures and known child
processes are cleaned. An initial fixture trace used the wrong relative path; its
correction is not represented as a production defect. A positive symlink fixture
also exposed the difference between Git link identity and Darwin link permissions;
the verifier now checks the actual Git contract.

## Actual retained-stage read-only evidence

No compile: `/private/tmp/axiom-local-next-build-b964-inputs.json`.
Exact source: `b964992777d8c3c8601b7e151889e42ee2790d06`.
Stage: `/private/tmp/axiom-isolated-b9649927-a6uzltb3/stage`.
The closed archive check passed for **6,035 regular source files / 66,164,604 bytes**
and zero source symlinks. Selected installed compiler observation passed for
**8,950 files / 314,313,040 bytes** across the six packages above, including
`node_modules/next/node_modules/postcss` (55 nested files explaining the original
parent-package refusal). The existing generation evidence/current bytes correlate;
no formatter or engine was run to perform these checks.

Independent final source review and the parent's explicit cue remain required
before the first actual isolated Next compile. No active child/session remains.


## Exact pinned framework type output and known-path read denial

Source inspection before the first compile established that the archived b964 tree
has no tracked `next-env.d.ts`, while Next 16.4.2's verified installed
`dist/lib/typescript/writeAppTypeDeclarations.js` writes that root file during
TypeScript setup. Its callsite in `verify-typescript-setup.js` lines 198–205 passes
image/app/pages/strict/typed flags; `build/type-check.js` line 135 supplies the
configuration values. Verified installed defaults select `.next`, image imports
enabled, strict-route/typed-route flags false. The exact archived config SHA256 is
`491566295d50eddd8dae881ae9c143648c2a2af0ccbf7a050da62a8db4a2bd9f`; it has no
contrary overrides, and the controlled source has root app but no pages/src-pages.
Visual-fixture configuration variables are absent from the clean build environment.
Unknown config/version/app-layout variants refuse this narrow profile.

The exact accepted Darwin LF declaration has only next and image-global type
references, `./.next/types/routes.d.ts` and `./.next/types/root-params.d.ts` imports,
the fixed blank line and app-documentation notice. Expected SHA256:
`1862ac4bbbc5192d4bf562161df66ea547ed3e67173100656ab606ae9797db2b`.
The observed pinned writer SHA256 is
`3973ebf0093b08136059a790442951ba498421627a52bfcf06e1584360e034c9`.
The file must be regular, single-link, stable and mode 0644; the build child uses
umask 022. No wildcard, whitespace normalization, extra import or unknown content
is accepted. The file remains forbidden before compilation when absent from the
archive. After compilation it is validated separately and its observed identity is
recorded in output metadata. Immutable archive identity/count remains unchanged,
so genuine framework output does not masquerade as a changed Git source tree.

The owned test copies the actual pinned writer into its own fixture stage, invokes
only that built-in-dependent writer under network/write restrictions, and verifies
its output against the profile. No application/Next compilation occurs. Extra
import, wrong mode and hardlink variants refuse. Genuine initial refusal of the
correct framework output is saved at
`/private/tmp/axiom-local-next-derived-types-red.log`.

The build-only sandbox now also denies file reads of the original repository,
source npm cache and original Prisma engine cache, while retaining owned bound
input reads. Actual owned fixture read attempts demonstrated the old allowance:
`/private/tmp/axiom-local-next-workspace-read-red.log`. The fixed fixture confirms
those reads are denied along with protected writes. This does not add universal
host attestation or retroactively qualify/invalidate earlier data-only generation.
Generation helper defaults are unchanged; optional read-denial/umask parameters
are used explicitly only by the build recipe.

Final **11 tests pass**:
`/private/tmp/axiom-local-next-build-derived-final-green.log` (same focused command).
The earlier 10-test receipt remains historical. Actual b964 read-only preparation
with this profile passes at
`/private/tmp/axiom-local-next-build-b964-type-profile-inputs.json`.
No actual Next compile, Prisma execution, provider action, new network request,
issuer identity or activation occurred. No child/session remains active. Final
independent review/root cue is still required before actual compilation.

## First actual compilation — November 3

The reviewed executor ran once against the exact b964 stage. The contract check
passed, then actual Next compilation failed: `next/font/google` in `app/layout.tsx`
requests Inter and JetBrains Mono from fonts.googleapis.com. Kernel network denial
remained enforced. The compiler performed its own bounded fetch retries, not new
root-authorized build attempts. No Prisma regeneration, provider grant, database
operation, publication or deployment occurred.

The terminal result is unavailable with buildOutputsVerified false. Receipt hashes
and the concrete diagnosis are in `isolated-next-build-first-result.json`; original
logs remain under `/private/tmp/axiom-isolated-b9649927-a6uzltb3/build-run`.
Cached WOFF2 files exist in an older local build, but source/family/license mapping
must be established before any self-hosted source change. No mocked font response,
network exception or weaker source verification is accepted as the repair.

## Same-font source actual compilation and separate output observation

Source066d821a uses the exact13 retained fonts and no remote font fetch. Fresh
ownedstage `/private/tmp/axiom-isolated-066d821a-i6ofubya` passed offline dependency
preparation, current native input binding and one actual generation. The generation
was required for the new archived source and new absolute output path; old attempts
remain unchanged. Root initially omitted the private generation log directory,
so the first orchestration stopped before invoking the generator. It resumed the
same prepared stage after creating that required directory; preparation was not
repeated. `preexecution-stop.json` preserves that distinction.

Actual Next compilation, TypeScript and route generation exited0. The original
output checker refused its arbitrary250000 aggregate-reference budget: actual
output has1108 traces /289120 references /23310097 JSON bytes /22417253 path
characters, within existing64MiB JSON and32MiB path bounds. A focused genuine
RED→GREEN regression raised only the local observation budget to512000, checks
250001 acceptance/512001 refusal and a late escaping reference. All byte/tree/
trace/path/containment constraints remain; package producer/verifier profiles are
unchanged. Independent source review found no material issue. No recompile or
regeneration was used for the corrected observation.

A separate readonly current-input/output observation passed:6060 exact archived
regular source files,1104 routes and1108 trace records. Durable receipt
`local-build-066d821a-observation.json` retains the original refusal+hash and binds
the updated observer hash. The old result was not overwritten. This proves the
stated local source/compiler/output observation only. Complete executable closure,
descendant quiescence, loaded issuer identity, runtime qualification and activation
remain unavailable; executionAuthorized false. Full license notices are pending
and publication remains blocked. No provider/customer/database read, deployment,
paid CI or new permission occurred.
