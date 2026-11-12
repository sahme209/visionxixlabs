# Node driver externalization hypothesis — not yet accepted

Newest CI job 130877538703 identifies `missing_pg_native` alongside a still-unknown missing token. Both failures occur in Webpack development-mode startup. The direct Node factory and actual PostgreSQL tests succeed without pg-native; neither native PostgreSQL support nor a new binary dependency is required by the selected driver.

Installed source: pg exposes an optional native path requiring pg-native. Next's default external package list includes pg and @prisma/client, but not @prisma/adapter-pg. The new adapter is currently traversed by the web bundler. Hypothesis: bundling that Node-only adapter/driver path exposes optional driver modules that ordinary Node execution does not load. This is not yet proof of the complete startup cause.

Proposed bounded local correction: add only @prisma/adapter-pg and pg to the existing serverExternalPackages list, following the existing Node-only provider-SDK boundary; keep all packages installed, all client configuration/TLS/authority unchanged. Do not install pg-native, stub unknown modules or suppress errors. Review the exact config diff before updating only its current owned-framework source hash; historical pins remain unusable.

Before claiming a fix, obtain a compiler-level failing/passing regression where practical, strict local builds and actual HTTP/website CI success. Unknown startup errors remain failures. No deployment, runtime settings, new native library, provider call, database change or spending is authorized by this source change.

## Actual compiler probe — not sufficient for a fix

The installed Next Webpack compiler was used in development Node-target mode on a tiny public adapter import. Bundling produced zero errors and one pg-native missing-module warning; externalizing produced zero errors/warnings. The bundled constructor also loaded successfully without connecting. Thus pg-native traversal is real, but this probe does NOT establish it as the fatal startup cause. No next.config.ts or framework hash was changed. The unknown missing module must be identified rather than installing a native dependency or declaring the externalization hypothesis proven.
