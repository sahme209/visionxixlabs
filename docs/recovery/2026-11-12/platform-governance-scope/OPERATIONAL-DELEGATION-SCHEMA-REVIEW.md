# Operational delegation schema — local source review only

Machine-readable exact hashes/counts: OPERATIONAL-DELEGATION-SCHEMA-REVIEW.json, compared against c942238f. Actual Prisma DMMF comparison:180prior models/182current. All existing model metadata and enums remain identical except the explicitly reviewed optional inverse relation on PlatformGovernanceAction. That inverse adds no existing parent data column.

New PlatformOperationalDelegation is keyed by the existing action identity and restricts parent deletion. It preserves immutable parent/manifest digests, private state/version and timestamps. Credential phases store metadata only: not requested, pending, issued with an opaque reference/expiry, or unknown. No credential value or public token hash is stored. An expiry field is not real credential/provider qualification or permission to clear a liability.

New PlatformOperationalWorkloadUse globally reserves the issuer/token-identity replay key and restricts deletion through its delegation relation. The action index supports exact history; reservation rows have no reset/release API. This is an isolated local proposed schema, not a production migration, grant or live admission.

Only the current mocked recipe helper schema pin changes after this semantic review. Cached engine, CLI version/bytes, seed and qualification:false stay fixed; omission tests now also reject either missing new operational table. No historical Python/native packets are renewed or changed. Ordinary ignored Prisma generation/compilation was refreshed with networking denied and no database URL; strict generated metadata guards pass.

An initial ad hoc comparison command failed on CommonJS/ESM named-import interoperability before comparison or pin write; its following generator command still refreshed ignored source. The corrected CommonJS comparison then passed before the helper pin was updated. No database/provider/credential operation occurred. Final metadata/schema tests and root types pass; this does not qualify production schema or the canonical issuer.
