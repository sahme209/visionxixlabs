# Combined source release

Website and desktop frontend builds passed; final maintained ordinary suite19,562PASS/1expectedfailure/1,144skip and PythonCLI36PASS. No installed desktop change or version/signing publication. Original failed build and custom stripped-environment test failures remain preserved. The stripped environment bypassed a transitive native mock; exact underlying resolver cause is not established, and no production guard was changed.

One combined PR is authorized, with normal mandatory exact-head CI before merge. Current main tree matches the local base tree at ff0e381844326d00bca086d3c894b0aa0653925d. No dependency/lock/schema/workflow/flag change is included. Recovery files/native patches retain exact bytes through .gitattributes; raw evidence whitespace is preserved intentionally. Large private cache/output packets are indexed by SHA rather than committed.

The owner-approved production read stopped after one metadata call; the selector could not safely choose a single unchanged production database setting. No detail, Neon or SQL call followed. Production target/schema/Prisma TLS/pool/recovery gates remain open; owner must not deploy this batch until reconciled. No deployment or Governance enablement occurred.
