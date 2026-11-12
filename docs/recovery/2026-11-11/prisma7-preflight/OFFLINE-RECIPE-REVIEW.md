# Prisma 7 current-source recipe compatibility review

The two remaining first-suite failures are in the current-source recipe unit helper. Its Prisma 5 schema/engine pins and removed `--to-schema-datamodel` syntax intentionally refuse the new schema before compiler invocation. This is not a network failure.

Proposed current-source unit/helper update:
- Schema pin: `3506b845ca355b6485fce4a4600957fc65c7f6b1b2a96ca886e4264d385d21ae`. Compared with prior `4a8c274e…`, only generator output/module metadata and removal of the datasource URL differ; all 175 model/enum/relation bodies and migration SQL remain byte-identical.
- CLI is installed Prisma 7.10.1. Its installed `build/cli.js` help/parser specifies `--to-schema` for a model-only diff. The removed URL is not reinserted; a scratch directory without any config or DATABASE_URL is used.
- Engine commit from installed `@prisma/engines-version`: `d1b3f377ca835d73fd50954a5e22128b9ebdd6b8`. Exact cached darwin-arm64 schema engine: SHA256 `6032ea1bdbd6dc3d453c36a22838d1d3b3554053083bf7695c104e9993637ba1`, 25,594,512 bytes. Cached sidecar matches. A byte-identical copy was restored into the installed engine package after `npm ci --ignore-scripts` omitted lifecycle restoration. No fetch, engine run or upstream-authenticity claim.
- Helper checks exact schema, engine and installed CLI package version before its injected runner. Only pure/mocked unit tests are authorized by this update. Coverage still requires every actual source model's table; missing output refuses.
- New output binding uses format `axiom.synthetic-fixture-schema/2`, explicit Prisma version and engine commit. It must NOT qualify as an old `/1` export.

Historical Python packets retain their original schema/helper hashes and cannot use the changed helper. The fixed old packet driver retains `/1` argv and packet checks and cannot execute the new `--to-schema` operation. No packet/receipt is renewed, qualification granted, or actual recipe execution authorized. A separately reviewed v2 driver/export and engine execution remain necessary for real qualification; the dormant issuer stays disabled.

This review covers local dependency compatibility, not production schema repair, native custody or live execution.
