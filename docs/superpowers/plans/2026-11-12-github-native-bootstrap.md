# GitHub Native Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for the preserved inline execution method. Steps use checkbox syntax.

**Goal:** Join the actual fixed job entrypoint to one bounded token acquisition and the original handoff; prepare a closed offline runtime artifact.
**Architecture:** A versioned immutable channel profile is qualified at artifact preparation. Job-local checks establish only bootstrap-channel consistency; the existing backend cryptographically authenticates workload and current execution authority. No default real profile is supplied.
**Tech Stack:** Existing TypeScript, Zod, Node22+, cached Next webpack and compiler API; no new dependencies.
**Spec:** docs/superpowers/specs/2026-11-12-github-native-bootstrap-design.md

## Global Constraints
- Local code/offline compilation/intercepted and owned isolated tests only; no real native environment/token/provider/configuration/workflow/production action.
- Existing private AWS custody, real profile qualification, independent review and one-attempt claims remain mandatory.
- No retry, secret logging, arbitrary code/endpoint/module supplier or old profile/hash renewal.
- Same-channel runner compromise is outside local detection; signed workload verification remains server-side.

## Review Focus
- Missing/changed channel profile refuses before reading private variables.
- Native URL query/path substitutions cannot redirect the request bearer.
- Repeated entry calls cannot replay even after acquisition/result uncertainty.
- Bundled dependency closure cannot smuggle private database/AWS/vault code or external packages.
- Embedded workflow configuration must match the compiled profile; no runtime endpoint override.

### Task 1: Versioned channel source and actual job entrypoint
**Files:** create operations/githubBootstrap.ts, operations/githubJobEntry.ts and __tests__/githubBootstrap.test.ts; modify existing native/remote identity method names and their test/PG callers.
**Interfaces:** export strict channelProfile schema, createGithubBootstrapSource(profile, readEnvironment), and createGithubJobEntry(profile, readEnvironment); fixed entry accepts original command, matching public config, optional abort. Environment reader is invoked only after profile validation. Distinct assertBootstrapCurrent / assertChannelQualified names never claim authenticated identity.
- [x] Write tests for exact field capture, hostile/missing profile, changed native context, malformed hints/URL, endpoint override, consumed attempt and complete intercepted native/preflight/source/submit chain.
- [x] Run named tests and observe RED before implementation.
- [x] Implement strict format2/purpose-bound immutable profile with exact origin/path/query-key constraints, fixed repository/ref/workflow and expiry; job fields are hints only, signed claims remain backend authority.
- [x] Run focused tests/root types; retain all old client/SQL semantics.
- [x] Commit with source-scoped receipt and living status.

### Task 2: Fixed offline runtime compiler
**Files:** scripts/build-github-handoff-runtime.cjs; scripts/fixtures/github-handoff-typescript-loader.cjs; operations/__tests__/githubHandoffRuntime.test.ts.
**Interfaces:** exported buildGithubHandoffRuntime(profile, outputDirectory) builds only fixed entry with cached webpack/compiler; returns runtime bytes/hash and reviewed source/dependency manifest. No active workflow write. Profile qualification remains the private artifact-source obligation.
- [x] Write failing actual-compile tests with source closure / embedded profile / no secret/environment-read assertions.
- [x] Implement fixed compiler with exact closed app-module allowlist, only node:crypto builtin, Zod dependency root and explicit server-only marker handling; forbid dynamic code loading and unlisted modules.
- [x] Run same emitted runtime with intercepted I/O, then actual artifact compiler/generated job shell; test tampered bytes and changed profile refusal.
- [x] Run focused tests/types and justified whole-source checks; update exact receipt/remaining-work. Preserve old full-build receipts as historical.
- [x] Commit. Whole-branch final independent review remains at the existing batch boundary; no per-unit redundant source reviews or push.

Ruling: continue the already selected inline method under the user's explicit implementation grant rather than add another plan checkpoint. No implementation gate or actual setup authority is inferred.

## Execution record
- Preserved inline method; no per-unit source-review agent. Whole-branch review remains the existing batch gate.
- Builder choice: use cached Next webpack with minification disabled because the installed distribution lacks its default minifier path. No new dependency; emitted size remains below1MiB.
- Initial missing-module/entrypoint/command REDs observed;23initial focused checks pass, expanded generated-runtime acceptance passes.
-114actual isolated SQL cases pass/stopped after correcting only the new entrypoint's expected sanitized error label. Provider/native/qualification simulated; actual runtime bytes and storage are real.
- Full source/type validation follows below in the exact receipt; no live qualification or activation claimed.

Local tasks implemented/tested in ad5a7063; complete production-mode build/types passes at that frozen commit, u7d7pwy5. Final whole-branch review remains the established full-batch gate, not a completed review of this branch. No native qualification or activation.

### Task2 completion follow-through: connected preparer
The compiler/runtime and workflow generator were exercised together in tests but lacked a production source composition function. Under the same approved design, compiledHandoffArtifact.ts now invokes only the fixed CJS compiler, rechecks immutable setup metadata around awaits, forwards exact compilation evidence to the private qualifier and returns the original in-memory artifact. New declaration file types the actual CJS interface.5new RED→GREEN checks and root types pass; no new authority mechanism/default, active route or setup grant is introduced. Source/state receipts remain separate from prior full compilation.
