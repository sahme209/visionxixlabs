# Production TypeScript root boundary correction

Actual approved run3 compiled Next successfully, then TypeScript correctly refused an archived recovery preview config importing a nonexistent relative vitest.config. The inherited broad source glob accidentally discovered docs/recovery as production roots. The old run/stage/source and failure remain preserved.

Only tsconfig.next.json adds `docs/recovery/**`; the existing source contract requires that precise exclusion. No include path, strict/noEmit behavior or ignoreBuildErrors setting is weakened. TypeScript exclude only controls initial root discovery: imported source is still checked. Targeted production source inspection found no direct import of docs/recovery; test fixture reads are separate.

Two new regression cases were observed RED before the fix. The complete focused existing contract test file then passed7/7. Its tiny real TypeScript fixture proves archival root removal, retained app/lib/package/.next type roots, retained application type errors and retained errors in an explicitly imported excluded source. It does not typecheck the full application or assert a successful Next build.

Exact changed source hashes/commands/results are in result.json. No npm, Prisma generation, System recorder, full application typecheck, Next retry, signing, native helper or old-stage edit ran. Independent review and a pure read-only contract preflight on the future exact selected source remain gates before any newly authorized full build.
