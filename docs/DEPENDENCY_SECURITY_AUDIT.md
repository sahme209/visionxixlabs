# Dependency security audit — 2026-10-15

A read-only `npm audit --omit=dev --json` against main `62d35145`
reported 12 production dependency findings: six high and six moderate.
Desktop production dependencies reported zero findings. These are registry
advisory results, not proof that the whole application is secure.

Compatible patches selected without forced major-version overrides:

| Dependency | Before | After | Reason |
| --- | --- | --- | --- |
| Next.js / matching ESLint config | 16.3.6 | 16.3.8 | Framework security fixes including image optimization SSRF, cache isolation and route authorization advisories |
| sharp | 0.35.4 | 0.35.5 | Patched bundled image dependency; stays within Next's supported range |
| source-map-js | 1.2.1 | 1.2.2 | Indexed source-map offset denial of service |

A clean, isolated `npm ci` succeeds. Repeating the production audit reports
**zero high/critical and two moderate findings**. The remaining advisories are
`uuid <11.1.1` and its parent `gaxios 6.4.0–6.7.1`, in Google Storage/gtoken
transitive dependencies. The installed gaxios 6 branch still requests uuid 9;
blindly replacing it across a major boundary would bypass the upstream contract.
The uuid advisory concerns buffer handling in v3/v5/v6. The two inspected gaxios copies call uuid v4 for multipart boundaries; the
advisory concerns v3/v5/v6. This narrows that inspected call path, but does not
establish all application call paths or clear those dependencies.

Next action: review the upstream Google dependency path and validate a compatible
resolution with provider contract tests. Reaudit before release. Do not suppress
the remaining findings or claim a clean audit.

Machine-readable counts and remaining advisories are preserved in
[dependency-security-audit.json](mission/dependency-security-audit.json).
Local validation passes: 537 Vitest files / 5,314 tests, web TypeScript,
desktop TypeScript/build, 30 Python CLI tests and mission coverage validation.
Exact-head CI and production-build results belong in the focused PR. Package installation generates the local Prisma
client; application builds explicitly forbid running migrations.
