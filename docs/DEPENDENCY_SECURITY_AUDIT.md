# Dependency security audit — 2026-10-15

The production dependency registry audit now reports **zero findings** after
compatible framework/image/source-map patches and Google Storage 8.4.0.
This is `npm audit --omit=dev --json` evidence, not application security
certification, actual IAM acceptance or successful production login.

| Checkpoint | High | Moderate | Total |
| --- | --- | --- | --- |
| Main `62d35145` | 6 | 6 | 12 |
| Framework patch, merged PR #119 (`65eafebb`) | 0 | 2 | 2 |
| Compatible Google Storage follow-up | 0 | 0 | 0 |

Desktop production dependencies separately reported zero findings at the
initial checkpoint. Development dependencies are outside these counts.

| Dependency | Before | After | Reason |
| --- | --- | --- | --- |
| Next.js / matching ESLint config | 16.3.6 | 16.3.8 | Framework fixes including image optimization SSRF, cache isolation and route authorization advisories |
| sharp | 0.35.4 | 0.35.5 | Patched bundled image dependency within Next's supported range |
| source-map-js | 1.2.1 | 1.2.2 | Indexed source-map offset denial of service |
| Google Cloud Storage | 8.2.0 | 8.4.0 | Same-major upstream update removes the older GoogleAuth/gaxios/uuid chain |

The intermediate moderate findings were uuid <11.1.1 and parent gaxios
6.4.0–6.7.1 in Google Storage/gtoken. Inspected gaxios copies called uuid v4
for multipart boundaries; the advisory concerned v3/v5/v6. No blanket
exploitability waiver or forced transitive major override was used. Updating
Storage through its upstream dependency contract removes the vulnerable chain.

Storage 8.4 requires Node >=22. The existing Vercel project uses Node 24;
web CI now matches that runtime rather than continuing on Node 20. Production
runtime settings are unchanged. Other tooling/native workflows are outside
this web runtime alignment.

The compatibility review also found the GCP snapshot reader casting
GoogleAuth's string access token to an OAuth-style token object. The reader
now uses the typed string contract and rejects missing/malformed tokens without
logging them. Seven focused cases cover valid strings, absent/malformed values
and credential failure. SDK construction/bucket/auth method smoke checks use
fake credentials and no network; they do not prove actual provider acceptance.

Machine-readable checkpoint counts and scope are preserved in
[dependency-security-audit.json](mission/dependency-security-audit.json).
Exact-head build/test/CI and deployment results belong in the focused PR.
Application builds forbid migration side effects; local install only generates
the Prisma client. Actual credential/IAM/inventory journeys, customer login
and wider security acceptance remain open. Repeat the audit before release.

## Development-tool scope extension

A full audit including development dependencies records nine existing package
findings: seven high/two moderate in the lint/CSS/glob toolchain. The set and
counts match before and after adding the DOM test tools; production-only audit
remains zero. Details and compatibility follow-ups are preserved in
[development-dependency-audit.json](mission/development-dependency-audit.json).
These development findings remain open; the earlier zero counts are explicitly
production-only.
