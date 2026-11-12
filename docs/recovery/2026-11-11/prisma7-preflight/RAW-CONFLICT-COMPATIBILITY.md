# Proposed raw serialization conflict compatibility

Actual local/CI evidence: Prisma 7 model updates produce P2034 as expected; raw SQL in a Serializable transaction can instead throw the real adapter's `DriverAdapterError` with own `cause.kind === 'TransactionWriteConflict'` and no code/meta. Installed adapter maps only SQLSTATE 40001/40P01 to that cause. AWS last-slot and two legacy admission CI assertions reject that new representation; their transaction assertions remain valid.

Proposed pure compatibility reader: return an existing own string code unchanged; otherwise recognize only own data properties `name: DriverAdapterError`, `cause` object, `cause.kind: TransactionWriteConflict` as P2034. No message parsing, getters, inherited data, arbitrary rejections, SQL/provider operation, automatic retry or mutation of the error. Unknown shapes remain unknown.

Use that reader in existing P2034 classifiers, preserving each current status/retry cap and whole-transaction scope. Do not add retries to execution claims or provider operations. The AWS fixture and legacy outcome classifier reuse the same reader, retaining exactly-one-commit, revocation and existing raw P2010/40001 assertions. Unit negatives cover deceptive text, other driver errors, getters and inherited causes; actual PG raw-SQL concurrency must prove one commit and one recognized abort. This restores intended transaction-conflict semantics within the authorized migration; it grants no execution/production authority.

## Additional actual wrapper evidence

The new raw-SQL PG regression first failed with P2010 rather than P2034; its legacy meta.code was absent. Installed runtime `client.js` constructs P2010 with `meta.driverAdapterError` (function ri). A new exact nested-shape unit test failed first. Independent review approved the narrow exception: only that own-data P2010 path containing the exact adapter conflict maps to P2034; all other existing codes retain precedence. No recursive cause search, getters or message parsing. Additional negatives preserve P2010 on malformed/accessor/inherited nested evidence.
