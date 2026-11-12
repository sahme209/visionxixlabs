# Actual instrumentation compiler boundary — reproduced

The instrumentation hook currently returns early when NEXT_RUNTIME is not nodejs, then imports the Node store factory afterward. Next's DefineEnv binds NEXT_RUNTIME to edge for the Edge compiler. Its development hot reloader emits an Edge instrumentation entry; the production entries builder removes the sole Edge instrumentation entry when no other Edge entry exists. This explains why the all299-page production build alone did not prove development startup.

An actual installed-Next Webpack development/webworker probe, with NEXT_RUNTIME defined as edge, reproduced the control-flow difference using the real @prisma/adapter-pg dependency:
- Early-return form: 17 errors, one pg-native warning, actual pg graph traversed, missing Node core dependencies.
- Positive Node-only condition enclosing the import: zero errors/warnings, no pg graph traversed.

No listener, child application, SQL, provider, engine, native issuer or credential was involved. The compiler output was not executed. The previous adapter-only Node-target probe had only a warning and was correctly not claimed as the root fix.

Proposed fix: wrap the existing try/import/store-configuration/logging block in `if (process.env.NEXT_RUNTIME === "nodejs")`. Keep Node behavior, error handling, store selection and authority unchanged. Do not stub modules, add native dependencies, relax guards, change Next internals/config pins, or increase acceptance timeouts. A regression should compile the actual hook source with an alias for only its store factory, retaining a real adapter dependency, prove Edge excludes it and Node retains it. Actual HTTP/website CI success is still required before claiming complete startup acceptance.

## Implemented regression and review

The test now compiles the actual `instrumentation.ts` hook with only its store-factory import aliased to a synthetic no-IO factory that retains the real driver dependency. Before the source correction it actually failed with 17 Edge compiler errors. After wrapping the unchanged Node block in the positive condition, the test passes: Edge has zero errors and excludes the adapter graph; Node has zero errors and retains it. No emitted application is executed. Independent implemented-source review found no important findings and confirmed the import/store/logging/catch behavior is preserved for Node and still skipped for non-Node runtimes. Actual HTTP and website CI acceptance remains pending.
