# AI invocation credential logging correction

Independent source inspection found three concrete leaks in the existing AI
invocation path. Synthetic regression tests failed before the correction:

- Truncating the storage preview at 200 characters could retain a credential
  prefix that no longer matched the canonical token pattern.
- The actual orchestrator already cut system/user previews at 100/80 characters,
  so redaction only at the logger would be too late.
- A failed Prisma log write printed the raw exception, which can repeat row
  arguments, bypassing the sanitized storage path.

Both preview boundaries now apply the existing canonical credential redactor
before slicing. Stored error text is also redacted, and logger failure emits a
fixed diagnostic label while remaining best-effort. Independently reviewed
supplied fingerprints accept only bounded legacy h/base36 or hexadecimal digest
encodings; other values fall back to the existing hash of the redacted preview,
or are omitted when there is no preview. No free-form fingerprint field is used
to persist a known credential.

Four focused suites passed **23 checks**, including the actual orchestrator and
logger with inert provider/database ports, existing compatibility and tenant
redaction checks, and the updated workforce walkthrough. Independent source
review accepted the original fix and the fingerprint correction. Type/lint/CI
results: focused imported TypeScript, scoped lint and diff checks passed.
Required exact-head CI remains the merge gate.

This is known-pattern credential scrubbing, not general PII removal or proof
that arbitrary content is safe. The historical 32-bit hash is a deduplication
label, not a cryptographic privacy boundary. Existing rows/logs are not rewritten
or deleted; historical exposure would need separate authorized investigation.
Tests use deliberately synthetic credentials and no live provider, database,
secret or account. Provider execution, billing, authorization, production
deployment and release gates are unchanged.
